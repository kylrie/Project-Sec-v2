package com.project.ahri.plugins

import ai.picovoice.porcupine.*
import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Handler
import android.os.Looper
import android.speech.SpeechRecognizer
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.content.Intent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "WakeWord")
class WakeWordPlugin : Plugin() {
    
    private var porcupine: Porcupine? = null
    private var audioRecord: AudioRecord? = null
    private var isListening = false
    private var speechRecognizer: SpeechRecognizer? = null
    private val handler = Handler(Looper.getMainLooper())
    private var silenceRunnable: Runnable? = null
    
    @PluginMethod
    fun initialize(call: PluginCall) {
        val accessKey = call.getString("accessKey") ?: run {
            call.reject("Missing Picovoice access key")
            return
        }
        
        try {
            val customPath = call.getString("keywordPath") ?: "hey-ahri_android.ppn"
            val hasCustomAsset = try {
                context.assets.open(customPath).close()
                true
            } catch (e: Exception) {
                false
            }

            val builder = Porcupine.Builder().setAccessKey(accessKey)
            if (hasCustomAsset) {
                builder.setKeywordPaths(arrayOf(customPath))
            } else {
                builder.setKeywords(arrayOf(Porcupine.BuiltInKeyword.JARVIS, Porcupine.BuiltInKeyword.PORCUPINE))
            }

            porcupine = builder.build(context)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to initialize Porcupine: ${e.message}")
        }
    }
    
    @PluginMethod
    fun startListening(call: PluginCall) {
        if (isListening) {
            call.resolve()
            return
        }
        
        isListening = true
        startPorcupineListening()
        call.resolve()
    }
    
    @PluginMethod
    fun stopListening(call: PluginCall) {
        isListening = false
        stopAudioCapture()
        stopSpeechRecognition()
        call.resolve()
    }
    
    private fun startPorcupineListening() {
        val sampleRate = porcupine?.sampleRate ?: 16000
        val frameLength = porcupine?.frameLength ?: 512
        
        val minBufferSize = AudioRecord.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        
        try {
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                sampleRate,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                maxOf(minBufferSize, frameLength * 2)
            )
            
            audioRecord?.startRecording()
            
            Thread {
                val buffer = ShortArray(frameLength)
                while (isListening) {
                    val read = audioRecord?.read(buffer, 0, frameLength) ?: 0
                    if (read == frameLength) {
                        try {
                            val keywordIndex = porcupine?.process(buffer)
                            if (keywordIndex != null && keywordIndex >= 0) {
                                handler.post {
                                    notifyWakeWordDetected()
                                    startSpeechToText()
                                }
                            }
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                }
            }.start()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
    
    private fun notifyWakeWordDetected() {
        val ret = JSObject()
        ret.put("event", "wake_word_detected")
        notifyListeners("wakeWordEvent", ret)
    }
    
    private fun startSpeechToText() {
        stopAudioCapture() // Stop wake word to free mic
        
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context)
        speechRecognizer?.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: android.os.Bundle?) {
                notifyListeners("wakeWordEvent", JSObject().apply {
                    put("event", "listening_started")
                })
            }
            
            override fun onResults(results: android.os.Bundle?) {
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val transcript = matches?.firstOrNull() ?: ""
                
                notifyListeners("wakeWordEvent", JSObject().apply {
                    put("event", "transcript_ready")
                    put("transcript", transcript)
                })
                
                // Auto-restart wake word after processing
                handler.postDelayed({ startPorcupineListening() }, 500)
            }
            
            override fun onError(error: Int) {
                notifyListeners("wakeWordEvent", JSObject().apply {
                    put("event", "error")
                    put("code", error)
                })
                handler.postDelayed({ startPorcupineListening() }, 1000)
            }
            
            override fun onPartialResults(p0: android.os.Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onBufferReceived(p0: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onEvent(p0: Int, p1: android.os.Bundle?) {}
            override fun onRmsChanged(p0: Float) {}
        })
        
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }
        
        speechRecognizer?.startListening(intent)
        
        // Auto-stop after 10 seconds if no result
        silenceRunnable = Runnable {
            speechRecognizer?.stopListening()
        }
        handler.postDelayed(silenceRunnable!!, 10000)
    }
    
    private fun stopAudioCapture() {
        try {
            audioRecord?.stop()
            audioRecord?.release()
        } catch (e: Exception) {}
        audioRecord = null
    }
    
    private fun stopSpeechRecognition() {
        silenceRunnable?.let { handler.removeCallbacks(it) }
        try {
            speechRecognizer?.destroy()
        } catch (e: Exception) {}
        speechRecognizer = null
    }
    
    override fun handleOnDestroy() {
        isListening = false
        stopAudioCapture()
        stopSpeechRecognition()
        try {
            porcupine?.delete()
        } catch (e: Exception) {}
        super.handleOnDestroy()
    }
}
