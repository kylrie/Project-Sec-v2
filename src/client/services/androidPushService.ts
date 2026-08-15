import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

/**
 * Initialize Android FCM Push Notifications via Capacitor Plugin
 */
export async function initAndroidPush() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const permStatus = await PushNotifications.requestPermissions();
    if (permStatus.receive === 'granted') {
      await PushNotifications.register();

      PushNotifications.addListener('registration', (token) => {
        // Send token to backend device registry
        fetch('/api/user/devices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceName: 'Android Phone',
            platform: 'android',
            pushToken: token.value
          })
        }).catch(err => {
          console.warn('[Android Push] Failed to register device token with backend:', err);
        });
      });

      PushNotifications.addListener('registrationError', (err) => {
        console.error('[Android Push] Registration error:', err);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[Android Push] Notification received in foreground:', notification);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('[Android Push] Notification action performed:', notification.actionId, notification.inputValue);
      });
    }
  } catch (error) {
    console.warn('[Android Push] Push notification initialization notice:', error);
  }
}
