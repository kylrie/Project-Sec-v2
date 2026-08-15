package com.project.ahri.overlay;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.LinearLayout;
import androidx.core.app.NotificationCompat;
import java.util.ArrayList;

import com.project.ahri.MainActivity;
import com.project.ahri.R;

public class FloatingBubbleService extends Service {
    private static final String CHANNEL_ID = "ahri_bubble_service_channel";
    private static final int NOTIFICATION_ID = 99991;

    public static boolean isRunning = false;

    private WindowManager windowManager;
    private View bubbleView;
    private WindowManager.LayoutParams params;
    private int initialX = 0;
    private int initialY = 0;
    private float initialTouchX = 0f;
    private float initialTouchY = 0f;
    private boolean isExpanded = false;

    private SpeechRecognizer speechRecognizer = null;
    private boolean isListening = false;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        isRunning = true;
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, createNotification());

        windowManager = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        showBubble();

        startWakeWordDetection();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Ahri Assistant Overlay",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Maintains quick-access floating AI assistant bubble");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification createNotification() {
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Project Ahri Active")
            .setContentText("Tap the floating bubble or say 'Hey Ahri' anytime")
            .setSmallIcon(R.drawable.ic_bubble)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true);
        return builder.build();
    }

    private void showBubble() {
        LayoutInflater inflater = LayoutInflater.from(this);
        bubbleView = inflater.inflate(R.layout.floating_bubble, null);

        int layoutType;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            layoutType = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
        } else {
            layoutType = WindowManager.LayoutParams.TYPE_PHONE;
        }

        params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        );

        params.gravity = Gravity.TOP | Gravity.START;
        params.x = 100;
        params.y = 250;

        final ImageView bubbleIcon = bubbleView.findViewById(R.id.bubble_icon);
        final LinearLayout expandedPanel = bubbleView.findViewById(R.id.expanded_panel);

        if (bubbleIcon != null) {
            bubbleIcon.setOnTouchListener(new View.OnTouchListener() {
                @Override
                public boolean onTouch(View v, MotionEvent event) {
                    switch (event.getAction()) {
                        case MotionEvent.ACTION_DOWN:
                            initialX = params.x;
                            initialY = params.y;
                            initialTouchX = event.getRawX();
                            initialTouchY = event.getRawY();
                            return true;

                        case MotionEvent.ACTION_MOVE:
                            params.x = initialX + (int) (event.getRawX() - initialTouchX);
                            params.y = initialY + (int) (event.getRawY() - initialTouchY);
                            if (bubbleView != null && windowManager != null) {
                                windowManager.updateViewLayout(bubbleView, params);
                            }
                            return true;

                        case MotionEvent.ACTION_UP:
                            float diffX = Math.abs(event.getRawX() - initialTouchX);
                            float diffY = Math.abs(event.getRawY() - initialTouchY);
                            if (diffX < 15 && diffY < 15) {
                                toggleExpanded(expandedPanel, bubbleIcon);
                            }
                            return true;

                        default:
                            return false;
                    }
                }
            });
        }

        ImageView btnMic = bubbleView.findViewById(R.id.btn_mic);
        ImageView btnOpen = bubbleView.findViewById(R.id.btn_open);
        ImageView btnClose = bubbleView.findViewById(R.id.btn_close);

        if (btnMic != null) {
            btnMic.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    launchVoiceCommand();
                    toggleExpanded(expandedPanel, bubbleIcon);
                }
            });
        }

        if (btnOpen != null) {
            btnOpen.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    Intent intent = new Intent(FloatingBubbleService.this, MainActivity.class);
                    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    startActivity(intent);
                    toggleExpanded(expandedPanel, bubbleIcon);
                }
            });
        }

        if (btnClose != null) {
            btnClose.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    stopSelf();
                }
            });
        }

        windowManager.addView(bubbleView, params);
    }

    private void launchVoiceCommand() {
        Intent intent = new Intent(FloatingBubbleService.this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("action", "voice_command");
        startActivity(intent);
    }

    private void startWakeWordDetection() {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                try {
                    speechRecognizer = SpeechRecognizer.createSpeechRecognizer(FloatingBubbleService.this);
                    speechRecognizer.setRecognitionListener(new RecognitionListener() {
                        @Override public void onReadyForSpeech(Bundle params) {}
                        @Override public void onBeginningOfSpeech() {}
                        @Override public void onRmsChanged(float rmsdB) {}
                        @Override public void onBufferReceived(byte[] buffer) {}
                        @Override public void onEndOfSpeech() {}

                        @Override
                        public void onResults(Bundle results) {
                            ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                            String text = (matches != null && !matches.isEmpty()) ? matches.get(0).toLowerCase() : "";
                            if (text.contains("hey ahri") || text.contains("hi ahri") || text.contains("ahri")) {
                                ImageView bubbleIcon = (bubbleView != null) ? bubbleView.findViewById(R.id.bubble_icon) : null;
                                LinearLayout expandedPanel = (bubbleView != null) ? bubbleView.findViewById(R.id.expanded_panel) : null;
                                if (!isExpanded) {
                                    toggleExpanded(expandedPanel, bubbleIcon);
                                }
                                launchVoiceCommand();
                            }
                            if (isListening) {
                                mainHandler.postDelayed(new Runnable() {
                                    @Override
                                    public void run() {
                                        startWakeWordDetection();
                                    }
                                }, 500);
                            }
                        }

                        @Override
                        public void onPartialResults(Bundle partialResults) {
                            ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                            String text = (matches != null && !matches.isEmpty()) ? matches.get(0).toLowerCase() : "";
                            if (text.contains("hey ahri") || text.contains("hi ahri") || text.contains("ahri")) {
                                ImageView bubbleIcon = (bubbleView != null) ? bubbleView.findViewById(R.id.bubble_icon) : null;
                                LinearLayout expandedPanel = (bubbleView != null) ? bubbleView.findViewById(R.id.expanded_panel) : null;
                                if (!isExpanded) {
                                    toggleExpanded(expandedPanel, bubbleIcon);
                                }
                                launchVoiceCommand();
                            }
                        }

                        @Override
                        public void onError(int error) {
                            if (isListening) {
                                mainHandler.postDelayed(new Runnable() {
                                    @Override
                                    public void run() {
                                        startWakeWordDetection();
                                    }
                                }, 1000);
                            }
                        }

                        @Override public void onEvent(int eventType, Bundle params) {}
                    });

                    Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                    intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);

                    isListening = true;
                    speechRecognizer.startListening(intent);
                } catch (Exception ignored) {}
            }
        });
    }

    private void toggleExpanded(LinearLayout panel, ImageView bubble) {
        if (panel == null || bubble == null) return;
        if (isExpanded) {
            panel.setVisibility(View.GONE);
            bubble.setAlpha(1.0f);
        } else {
            panel.setVisibility(View.VISIBLE);
            bubble.setAlpha(0.7f);
        }
        isExpanded = !isExpanded;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isRunning = false;
        isListening = false;
        try {
            if (speechRecognizer != null) {
                speechRecognizer.destroy();
            }
        } catch (Exception ignored) {}
        speechRecognizer = null;

        if (bubbleView != null && windowManager != null) {
            try {
                windowManager.removeView(bubbleView);
            } catch (Exception ignored) {}
            bubbleView = null;
        }
    }
}
