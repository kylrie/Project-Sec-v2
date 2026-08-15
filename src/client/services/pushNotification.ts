import { getClientMessaging } from '../lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';

export class PushNotificationService {
  private vapidKey = (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY;

  /**
   * Request Notification permission and retrieve FCM Push Token
   */
  public async requestPermission(): Promise<string | null> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('[PushNotification] Notifications not supported in this environment.');
      return null;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('[PushNotification] User denied push notifications.');
        return null;
      }

      // Register Firebase Messaging Service Worker
      let swRegistration: ServiceWorkerRegistration | undefined;
      if ('serviceWorker' in navigator) {
        swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      }

      const messaging = await getClientMessaging();
      if (!messaging) return null;

      if (!this.vapidKey) {
        console.warn('[PushNotification] VITE_FIREBASE_VAPID_KEY not set. Skipping FCM token retrieval.');
        return null;
      }

      const token = await getToken(messaging, {
        vapidKey: this.vapidKey,
        serviceWorkerRegistration: swRegistration
      });

      console.log('[PushNotification] FCM Token obtained:', token ? `${token.substring(0, 15)}...` : 'null');
      return token;
    } catch (err: any) {
      console.warn('[PushNotification] Failed to get FCM token:', err.message);
      return null;
    }
  }

  /**
   * Register device token on the backend
   */
  public async sendTokenToServer(
    token: string,
    authToken?: string,
    platform: 'web' | 'windows' | 'macos' | 'android' | 'ios' = 'web'
  ): Promise<boolean> {
    try {
      const deviceName = `${navigator.platform || 'Desktop'} (${navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Browser'})`;
      const res = await fetch('/api/user/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          deviceName,
          platform,
          pushToken: token
        })
      });
      return res.ok;
    } catch (err) {
      console.error('[PushNotification] Failed to register device token with backend:', err);
      return false;
    }
  }

  /**
   * Listen for foreground push notifications
   */
  public async onMessageHandler(callback: (payload: any) => void): Promise<(() => void) | null> {
    const messaging = await getClientMessaging();
    if (!messaging) return null;

    return onMessage(messaging, (payload) => {
      console.log('[PushNotification] Foreground notification received:', payload);
      callback(payload);

      // Display system notification if permission is granted
      if (Notification.permission === 'granted' && payload.notification) {
        new Notification(payload.notification.title || 'Project Ahri Alert', {
          body: payload.notification.body,
          icon: '/icon-192.png'
        });
      }
    });
  }
}

export const pushNotificationService = new PushNotificationService();
