package com.project.ahri;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.project.ahri.plugins.OverlayPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(OverlayPlugin.class);
        super.onCreate(savedInstanceState);
        handleVoiceIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleVoiceIntent(intent);
    }

    private void handleVoiceIntent(Intent intent) {
        if (intent != null && "voice_command".equals(intent.getStringExtra("action"))) {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().post(new Runnable() {
                    @Override
                    public void run() {
                        getBridge().eval("window.dispatchEvent(new CustomEvent('ahri-voice-trigger'))", null);
                    }
                });
            }
        }
    }
}
