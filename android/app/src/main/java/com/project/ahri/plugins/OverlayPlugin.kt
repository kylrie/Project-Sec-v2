package com.project.ahri.plugins

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.project.ahri.overlay.FloatingBubbleService

@CapacitorPlugin(name = "Overlay")
class OverlayPlugin : Plugin() {
    
    @PluginMethod
    fun requestPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(context)) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:${context.packageName}")
                )
                activity.startActivityForResult(intent, 1001)
            }
        }
        call.resolve()
    }
    
    @PluginMethod
    fun showBubble(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
            call.reject("Overlay permission not granted")
            return
        }
        val intent = Intent(context, FloatingBubbleService::class.java)
        ContextCompat.startForegroundService(context, intent)
        call.resolve()
    }
    
    @PluginMethod
    fun hideBubble(call: PluginCall) {
        val intent = Intent(context, FloatingBubbleService::class.java)
        context.stopService(intent)
        call.resolve()
    }
    
    @PluginMethod
    fun isBubbleVisible(call: PluginCall) {
        val ret = JSObject()
        ret.put("visible", false)
        call.resolve(ret)
    }
}
