package com.project.ahri.plugins;

import ai.picovoice.porcupine.Porcupine;
import android.content.Intent;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;

@CapacitorPlugin(name = "WakeWord")
public class WakeWordPlugin extends Plugin {

    private Porcupine porcupine = null;
    private AudioRecord audioRecord = null;
    private boolean isListening = false;
    private SpeechRecognizer speechRecognizer = null;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable silenceRunnable = null;

    @PluginMethod
    public void initialize(PluginCall call) {
        String accessKey = call.getString("accessKey");
        if (accessKey == null || accessKey.trim().isEmpty()) {
            call.reject("Missing Picovoice access key");
            return;
        }

        try {
            String customPath = call.getString("keywordPath", "hey-ahri_android.ppn");
            boolean hasCustomAsset = false;
            try {
                getContext().getAssets().open(customPath).close();
                hasCustomAsset = true;
            } catch (Exception ignored) {}

            Porcupine.Builder builder = new Porcupine.Builder().setAccessKey(accessKey);
            if (hasCustomAsset) {
                builder.setKeywordPaths(new String[]{customPath});
            } else {
                builder.setKeywords(new Porcupine.BuiltInKeyword[]{
                    Porcupine.BuiltInKeyword.JARVIS,
                    Porcupine.BuiltInKeyword.PORCUPINE
                });
            }

            porcupine = builder.build(getContext());
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to initialize Porcupine: " + e.getMessage());
        }
    }

    @PluginMethod
    public void startListening(PluginCall call) {
        if (isListening) {
            call.resolve();
            return;
        }

        isListening = true;
        startPorcupineListening();
        call.resolve();
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        isListening = false;
        stopAudioCapture();
        stopSpeechRecognition();
        call.resolve();
    }

    private void startPorcupineListening() {
        if (porcupine == null) return;
        final int sampleRate = porcupine.getSampleRate();
        final int frameLength = porcupine.getFrameLength();

        int minBufferSize = AudioRecord.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        );

        try {
            audioRecord = new AudioRecord(
                MediaRecorder.AudioSource.MIC,
                sampleRate,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                Math.max(minBufferSize, frameLength * 2)
            );

            audioRecord.startRecording();

            new Thread(new Runnable() {
                @Override
                public void run() {
                    short[] buffer = new short[frameLength];
                    while (isListening) {
                        int read = (audioRecord != null) ? audioRecord.read(buffer, 0, frameLength) : 0;
                        if (read == frameLength && porcupine != null) {
                            try {
                                int keywordIndex = porcupine.process(buffer);
                                if (keywordIndex >= 0) {
                                    handler.post(new Runnable() {
                                        @Override
                                        public void run() {
                                            notifyWakeWordDetected();
                                            startSpeechToText();
                                        }
                                    });
                                }
                            } catch (Exception e) {
                                e.printStackTrace();
                            }
                        }
                    }
                }
            }).start();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void notifyWakeWordDetected() {
        JSObject ret = new JSObject();
        ret.put("event", "wake_word_detected");
        notifyListeners("wakeWordEvent", ret);
    }

    private void startSpeechToText() {
        stopAudioCapture();

        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle params) {
                JSObject obj = new JSObject();
                obj.put("event", "listening_started");
                notifyListeners("wakeWordEvent", obj);
            }

            @Override
            public void onResults(Bundle results) {
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                String transcript = (matches != null && !matches.isEmpty()) ? matches.get(0) : "";

                JSObject obj = new JSObject();
                obj.put("event", "transcript_ready");
                obj.put("transcript", transcript);
                notifyListeners("wakeWordEvent", obj);

                handler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        startPorcupineListening();
                    }
                }, 500);
            }

            @Override
            public void onError(int error) {
                JSObject obj = new JSObject();
                obj.put("event", "error");
                obj.put("code", error);
                notifyListeners("wakeWordEvent", obj);

                handler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        startPorcupineListening();
                    }
                }, 1000);
            }

            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override public void onEndOfSpeech() {}
            @Override public void onPartialResults(Bundle partialResults) {}
            @Override public void onEvent(int eventType, Bundle params) {}
        });

        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);

        speechRecognizer.startListening(intent);

        silenceRunnable = new Runnable() {
            @Override
            public void run() {
                if (speechRecognizer != null) {
                    speechRecognizer.stopListening();
                }
            }
        };
        handler.postDelayed(silenceRunnable, 10000);
    }

    private void stopAudioCapture() {
        try {
            if (audioRecord != null) {
                audioRecord.stop();
                audioRecord.release();
            }
        } catch (Exception ignored) {}
        audioRecord = null;
    }

    private void stopSpeechRecognition() {
        if (silenceRunnable != null) {
            handler.removeCallbacks(silenceRunnable);
        }
        try {
            if (speechRecognizer != null) {
                speechRecognizer.destroy();
            }
        } catch (Exception ignored) {}
        speechRecognizer = null;
    }

    @Override
    protected void handleOnDestroy() {
        isListening = false;
        stopAudioCapture();
        stopSpeechRecognition();
        try {
            if (porcupine != null) {
                porcupine.delete();
            }
        } catch (Exception ignored) {}
        super.handleOnDestroy();
    }
}
