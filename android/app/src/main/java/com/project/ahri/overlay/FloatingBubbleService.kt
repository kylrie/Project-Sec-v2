package com.project.ahri.overlay

import ai.picovoice.porcupine.Porcupine
import android.app.Service
import android.content.Intent
import android.graphics.PixelFormat
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
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

    private var porcupine: Porcupine? = null
    private var audioRecord: AudioRecord? = null
    private var isListening = false
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        showBubble()
        
        // Start wake word detection when bubble is active
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
        Thread {
            try {
                val hasCustomAsset = try {
                    assets.open("hey-ahri_android.ppn").close()
                    true
                } catch (e: Exception) {
                    false
                }

                // In production, user provides key in config/preferences
                val accessKey = "YOUR_PICOVOICE_ACCESS_KEY"
                val builder = Porcupine.Builder().setAccessKey(accessKey)
                if (hasCustomAsset) {
                    builder.setKeywordPaths(arrayOf("hey-ahri_android.ppn"))
                } else {
                    builder.setKeywords(arrayOf(Porcupine.BuiltInKeyword.JARVIS, Porcupine.BuiltInKeyword.PORCUPINE))
                }

                porcupine = builder.build(this)
                val sampleRate = porcupine?.sampleRate ?: 16000
                val frameLength = porcupine?.frameLength ?: 512

                val minBufferSize = AudioRecord.getMinBufferSize(
                    sampleRate,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT
                )

                audioRecord = AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    sampleRate,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    maxOf(minBufferSize, frameLength * 2)
                )

                audioRecord?.startRecording()
                isListening = true

                val buffer = ShortArray(frameLength)
                while (isListening) {
                    val read = audioRecord?.read(buffer, 0, frameLength) ?: 0
                    if (read == frameLength) {
                        val keywordIndex = porcupine?.process(buffer) ?: -1
                        if (keywordIndex >= 0) {
                            mainHandler.post {
                                val expandedPanel = bubbleView?.findViewById<LinearLayout>(R.id.expanded_panel)
                                val bubbleIcon = bubbleView?.findViewById<ImageView>(R.id.bubble_icon)
                                if (!isExpanded) {
                                    toggleExpanded(expandedPanel, bubbleIcon)
                                }
                                launchVoiceCommand()
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                // Graceful fallback if access key is not set or mic unavailable
            }
        }.start()
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
            audioRecord?.stop()
            audioRecord?.release()
        } catch (e: Exception) {}
        try {
            porcupine?.delete()
        } catch (e: Exception) {}
        bubbleView?.let { windowManager.removeView(it) }
    }
}
