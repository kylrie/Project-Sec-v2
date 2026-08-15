package com.project.ahri.plugins

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.SpeechRecognizer
import android.speech.RecognizerIntent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "WakeWord")
class WakeWordPlugin : Plugin() {
    
    private var speechRecognizer: SpeechRecognizer? = null
    private var isListening = false
    private val handler = Handler(Looper.getMainLooper())
    private var silenceRunnable: Runnable? = null
    private var wakeWordDetected = false
    
    @PluginMethod
    fun initialize(call: PluginCall) {
        // No key needed for free version
        call.resolve()
    }
    
    @PluginMethod
    fun startListening(call: PluginCall) {
        if (isListening) {
            call.resolve()
            return
        }
        
        isListening = true
        startContinuousListening()
        call.resolve()
    }
    
    @PluginMethod
    fun stopListening(call: PluginCall) {
        isListening = false
        wakeWordDetected = false
        stopSpeechRecognition()
        call.resolve()
    }
    
    private fun startContinuousListening() {
        handler.post {
            try {
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context)
                speechRecognizer?.setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) {}
                    override fun onBeginningOfSpeech() {}
                    override fun onRmsChanged(rmsdB: Float) {}
                    override fun onBufferReceived(buffer: ByteArray?) {}
                    override fun onEndOfSpeech() {}
                    
                    override fun onResults(results: Bundle?) {
                        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        val transcript = matches?.firstOrNull()?.lowercase() ?: ""
                        
                        // Check for wake word
                        if (!wakeWordDetected && (transcript.contains("hey ahri") || transcript.contains("hi ahri") || transcript.contains("ahri"))) {
                            wakeWordDetected = true
                            notifyEvent("wake_word_detected")
                            notifyEvent("listening_started")
                            
                            restartListening()
                        } 
                        // If wake word already detected, this is the command
                        else if (wakeWordDetected) {
                            val command = transcript.replace("hey ahri", "").replace("hi ahri", "").replace("ahri", "").trim()
                            if (command.length > 2) {
                                notifyEvent("transcript_ready", command)
                                wakeWordDetected = false
                                notifyEvent("listening_ended")
                            }
                            restartListening()
                        } else {
                            restartListening()
                        }
                    }
                    
                    override fun onPartialResults(partialResults: Bundle?) {
                        val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        val transcript = matches?.firstOrNull()?.lowercase() ?: ""
                        
                        // Early wake word detection from partial results
                        if (!wakeWordDetected && (transcript.contains("hey ahri") || transcript.contains("hi ahri") || transcript.contains("ahri"))) {
                            wakeWordDetected = true
                            notifyEvent("wake_word_detected")
                            notifyEvent("listening_started")
                        }
                    }
                    
                    override fun onError(error: Int) {
                        if (isListening) {
                            handler.postDelayed({ restartListening() }, 500)
                        }
                    }
                    
                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })
                
                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
                }
                
                speechRecognizer?.startListening(intent)
                
                silenceRunnable = Runnable {
                    if (isListening && !wakeWordDetected) {
                        restartListening()
                    }
                }
                handler.postDelayed(silenceRunnable!!, 10000)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
    
    private fun restartListening() {
        if (!isListening) return
        stopSpeechRecognition()
        startContinuousListening()
    }
    
    private fun stopSpeechRecognition() {
        silenceRunnable?.let { handler.removeCallbacks(it) }
        try {
            speechRecognizer?.destroy()
        } catch (e: Exception) {}
        speechRecognizer = null
    }
    
    private fun notifyEvent(event: String, transcript: String = "") {
        val ret = JSObject()
        ret.put("event", event)
        if (transcript.isNotEmpty()) ret.put("transcript", transcript)
        notifyListeners("wakeWordEvent", ret)
    }
    
    override fun handleOnDestroy() {
        isListening = false
        stopSpeechRecognition()
        super.handleOnDestroy()
    }
}
