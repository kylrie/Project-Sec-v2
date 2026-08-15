package com.project.ahri.plugins;

import android.content.Intent;
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

    private SpeechRecognizer speechRecognizer = null;
    private boolean isListening = false;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable silenceRunnable = null;
    private boolean wakeWordDetected = false;

    @PluginMethod
    public void initialize(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void startListening(PluginCall call) {
        if (isListening) {
            call.resolve();
            return;
        }

        isListening = true;
        startContinuousListening();
        call.resolve();
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        isListening = false;
        wakeWordDetected = false;
        stopSpeechRecognition();
        call.resolve();
    }

    private void startContinuousListening() {
        handler.post(new Runnable() {
            @Override
            public void run() {
                try {
                    speechRecognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
                    speechRecognizer.setRecognitionListener(new RecognitionListener() {
                        @Override public void onReadyForSpeech(Bundle params) {}
                        @Override public void onBeginningOfSpeech() {}
                        @Override public void onRmsChanged(float rmsdB) {}
                        @Override public void onBufferReceived(byte[] buffer) {}
                        @Override public void onEndOfSpeech() {}

                        @Override
                        public void onResults(Bundle results) {
                            ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                            String transcript = (matches != null && !matches.isEmpty()) ? matches.get(0).toLowerCase() : "";

                            if (!wakeWordDetected && (transcript.contains("hey ahri") || transcript.contains("hi ahri") || transcript.contains("ahri"))) {
                                wakeWordDetected = true;
                                notifyEvent("wake_word_detected", "");
                                notifyEvent("listening_started", "");
                                restartListening();
                            } else if (wakeWordDetected) {
                                String command = transcript.replace("hey ahri", "").replace("hi ahri", "").replace("ahri", "").trim();
                                if (command.length() > 2) {
                                    notifyEvent("transcript_ready", command);
                                    wakeWordDetected = false;
                                    notifyEvent("listening_ended", "");
                                }
                                restartListening();
                            } else {
                                restartListening();
                            }
                        }

                        @Override
                        public void onPartialResults(Bundle partialResults) {
                            ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                            String transcript = (matches != null && !matches.isEmpty()) ? matches.get(0).toLowerCase() : "";

                            if (!wakeWordDetected && (transcript.contains("hey ahri") || transcript.contains("hi ahri") || transcript.contains("ahri"))) {
                                wakeWordDetected = true;
                                notifyEvent("wake_word_detected", "");
                                notifyEvent("listening_started", "");
                            }
                        }

                        @Override
                        public void onError(int error) {
                            if (isListening) {
                                handler.postDelayed(new Runnable() {
                                    @Override
                                    public void run() {
                                        restartListening();
                                    }
                                }, 500);
                            }
                        }

                        @Override public void onEvent(int eventType, Bundle params) {}
                    });

                    Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                    intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                    intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);

                    speechRecognizer.startListening(intent);

                    silenceRunnable = new Runnable() {
                        @Override
                        public void run() {
                            if (isListening && !wakeWordDetected) {
                                restartListening();
                            }
                        }
                    };
                    handler.postDelayed(silenceRunnable, 10000);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        });
    }

    private void restartListening() {
        if (!isListening) return;
        stopSpeechRecognition();
        startContinuousListening();
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

    private void notifyEvent(String event, String transcript) {
        JSObject ret = new JSObject();
        ret.put("event", event);
        if (transcript != null && !transcript.isEmpty()) {
            ret.put("transcript", transcript);
        }
        notifyListeners("wakeWordEvent", ret);
    }

    @Override
    protected void handleOnDestroy() {
        isListening = false;
        stopSpeechRecognition();
        super.handleOnDestroy();
    }
}
