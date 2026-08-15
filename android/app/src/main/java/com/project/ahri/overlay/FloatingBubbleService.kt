package com.project.ahri.overlay

import android.app.Service
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.os.Bundle
import android.view.*
import android.widget.ImageView
import android.widget.LinearLayout
import com.project.ahri.R
import com.project.ahri.MainActivity

class FloatingBubbleService : Service() {
    private lateinit var windowManager: WindowManager
    private var bubbleView: View? = null
    private var params: WindowManager.LayoutParams? = null
    private var initialX = 0
    private var initialY = 0
    private var initialTouchX = 0f
    private var initialTouchY = 0f
    private var isExpanded = false

    private var speechRecognizer: SpeechRecognizer? = null
    private var isListening = false
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        showBubble()
        
        // Start continuous wake word listening (Free, native SpeechRecognizer)
        startWakeWordDetection()
    }

    private fun showBubble() {
        bubbleView = LayoutInflater.from(this).inflate(R.layout.floating_bubble, null)

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            WindowManager.LayoutParams.TYPE_PHONE
        }

        params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 100
            y = 200
        }

        val bubbleIcon = bubbleView?.findViewById<ImageView>(R.id.bubble_icon)
        val expandedPanel = bubbleView?.findViewById<LinearLayout>(R.id.expanded_panel)

        bubbleIcon?.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = params!!.x
                    initialY = params!!.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    params!!.x = initialX + (event.rawX - initialTouchX).toInt()
                    params!!.y = initialY + (event.rawY - initialTouchY).toInt()
                    windowManager.updateViewLayout(bubbleView, params)
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (Math.abs(event.rawX - initialTouchX) < 15 && Math.abs(event.rawY - initialTouchY) < 15) {
                        toggleExpanded(expandedPanel, bubbleIcon)
                    }
                    true
                }
                else -> false
            }
        }

        val btnMic = bubbleView?.findViewById<ImageView>(R.id.btn_mic)
        val btnOpen = bubbleView?.findViewById<ImageView>(R.id.btn_open)
        val btnClose = bubbleView?.findViewById<ImageView>(R.id.btn_close)

        btnMic?.setOnClickListener {
            launchVoiceCommand()
            toggleExpanded(expandedPanel, bubbleIcon)
        }

        btnOpen?.setOnClickListener {
            val intent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            startActivity(intent)
            toggleExpanded(expandedPanel, bubbleIcon)
        }

        btnClose?.setOnClickListener {
            stopSelf()
        }

        windowManager.addView(bubbleView, params)
    }

    private fun launchVoiceCommand() {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("action", "voice_command")
        }
        startActivity(intent)
    }

    private fun startWakeWordDetection() {
        mainHandler.post {
            try {
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this)
                speechRecognizer?.setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) {}
                    override fun onBeginningOfSpeech() {}
                    override fun onRmsChanged(rmsdB: Float) {}
                    override fun onBufferReceived(buffer: ByteArray?) {}
                    override fun onEndOfSpeech() {}

                    override fun onResults(results: Bundle?) {
                        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        val text = matches?.firstOrNull()?.lowercase() ?: ""
                        if (text.contains("hey ahri") || text.contains("hi ahri") || text.contains("ahri")) {
                            val expandedPanel = bubbleView?.findViewById<LinearLayout>(R.id.expanded_panel)
                            val bubbleIcon = bubbleView?.findViewById<ImageView>(R.id.bubble_icon)
                            if (!isExpanded) {
                                toggleExpanded(expandedPanel, bubbleIcon)
                            }
                            launchVoiceCommand()
                        }
                        if (isListening) {
                            mainHandler.postDelayed({ startWakeWordDetection() }, 500)
                        }
                    }

                    override fun onPartialResults(partialResults: Bundle?) {
                        val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        val text = matches?.firstOrNull()?.lowercase() ?: ""
                        if (text.contains("hey ahri") || text.contains("hi ahri") || text.contains("ahri")) {
                            val expandedPanel = bubbleView?.findViewById<LinearLayout>(R.id.expanded_panel)
                            val bubbleIcon = bubbleView?.findViewById<ImageView>(R.id.bubble_icon)
                            if (!isExpanded) {
                                toggleExpanded(expandedPanel, bubbleIcon)
                            }
                            launchVoiceCommand()
                        }
                    }

                    override fun onError(error: Int) {
                        if (isListening) {
                            mainHandler.postDelayed({ startWakeWordDetection() }, 1000)
                        }
                    }

                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })

                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                }

                isListening = true
                speechRecognizer?.startListening(intent)
            } catch (e: Exception) {
                // Ignore if mic unavailable
            }
        }
    }

    private fun toggleExpanded(panel: LinearLayout?, bubble: ImageView?) {
        if (isExpanded) {
            panel?.visibility = View.GONE
            bubble?.alpha = 1.0f
        } else {
            panel?.visibility = View.VISIBLE
            bubble?.alpha = 0.7f
        }
        isExpanded = !isExpanded
    }

    override fun onDestroy() {
        super.onDestroy()
        isListening = false
        try {
            speechRecognizer?.destroy()
        } catch (e: Exception) {}
        speechRecognizer = null
        bubbleView?.let { windowManager.removeView(it) }
    }
}
