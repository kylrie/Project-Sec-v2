package com.project.ahri.overlay

import android.app.Service
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.view.*
import android.widget.ImageView
import android.widget.LinearLayout
import com.project.ahri.R
import com.getcapacitor.BridgeActivity

class FloatingBubbleService : Service() {
    private lateinit var windowManager: WindowManager
    private var bubbleView: View? = null
    private var params: WindowManager.LayoutParams? = null
    private var initialX = 0
    private var initialY = 0
    private var initialTouchX = 0f
    private var initialTouchY = 0f
    private var isExpanded = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        showBubble()
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
                    if (Math.abs(event.rawX - initialTouchX) < 10 && Math.abs(event.rawY - initialTouchY) < 10) {
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
            val intent = Intent(this, com.project.ahri.MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                putExtra("action", "voice_command")
            }
            startActivity(intent)
        }

        btnOpen?.setOnClickListener {
            val intent = Intent(this, com.project.ahri.MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            startActivity(intent)
        }

        btnClose?.setOnClickListener {
            stopSelf()
        }

        windowManager.addView(bubbleView, params)
    }

    private fun toggleExpanded(panel: LinearLayout?, bubble: ImageView?) {
        if (isExpanded) {
            panel?.visibility = View.GONE
            bubble?.alpha = 1.0f
        } else {
            panel?.visibility = View.VISIBLE
            bubble?.alpha = 0.5f
        }
        isExpanded = !isExpanded
    }

    override fun onDestroy() {
        super.onDestroy()
        bubbleView?.let { windowManager.removeView(it) }
    }
}
