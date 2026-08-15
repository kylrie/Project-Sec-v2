import cron from 'node-cron';
import { adminMessaging } from '../lib/firebaseAdmin.js';
import { dbRepository } from '../db/supabaseClient.js';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  icon?: string;
  clickAction?: string;
}

export class NotificationService {
  /**
   * Send a targeted push notification to all active devices registered to a user
   */
  public async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data: Record<string, string> = {}
  ): Promise<{ success: boolean; dispatchedCount: number; errors?: string[] }> {
    try {
      // 1. Fetch user's registered devices with push tokens from Supabase
      const devices = await dbRepository.getUserDevices(userId);
      const pushTokens = devices
        .map((d: any) => d.push_token)
        .filter((token: any): token is string => !!token && typeof token === 'string' && token.length > 10);

      // Save notification to Supabase notifications table
      await dbRepository.createNotification(userId, {
        title,
        body,
        data,
        type: 'reminder'
      });

      if (pushTokens.length === 0) {
        console.log(`[Notification Service] No active FCM tokens registered for user: ${userId}`);
        return { success: true, dispatchedCount: 0 };
      }

      // 2. Dispatch FCM Multicast via Firebase Admin
      return await this.sendMulticast(pushTokens, title, body, data);

    } catch (err: any) {
      console.error('[Notification Service] Failed to send push notification:', err);
      return { success: false, dispatchedCount: 0, errors: [err.message] };
    }
  }

  /**
   * Send multicast push notifications to a raw list of FCM device tokens
   */
  public async sendMulticast(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, string> = {}
  ): Promise<{ success: boolean; dispatchedCount: number; errors?: string[] }> {
    if (!adminMessaging) {
      console.warn('[Notification Service] Firebase Admin Messaging not active. Notification logged in database.');
      return { success: true, dispatchedCount: 0 };
    }

    try {
      const response = await adminMessaging.sendEachForMulticast({
        tokens,
        notification: {
          title,
          body,
        },
        data: {
          ...data,
          timestamp: Date.now().toString(),
          click_action: data.click_action || '/'
        },
        webpush: {
          notification: {
            title,
            body,
            icon: '/icon-192.png',
            badge: '/badge-72.png',
            requireInteraction: true
          }
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            priority: 'max',
            channelId: 'ahri_executive_alerts'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      });

      console.log(`[Notification Service] Dispatched ${response.successCount} of ${tokens.length} push notifications.`);
      return {
        success: response.successCount > 0,
        dispatchedCount: response.successCount,
        errors: response.responses.filter(r => !r.success).map(r => r.error?.message || 'Unknown FCM error')
      };
    } catch (err: any) {
      console.error('[Notification Service] FCM send error:', err);
      return { success: false, dispatchedCount: 0, errors: [err.message] };
    }
  }

  /**
   * Schedule a recurring daily morning briefing push notification (e.g. 08:30 AM)
   */
  public scheduleBriefingNotification(userId: string, cronExpression: string = '30 8 * * 1-5') {
    cron.schedule(cronExpression, async () => {
      console.log(`[Notification Service] Triggering scheduled Executive Morning Briefing for ${userId}...`);
      await this.sendPushNotification(
        userId,
        "✦ Executive Morning Briefing",
        "Your daily agenda, urgent email overview, and route traffic telemetry are synthesized.",
        { type: "morning_briefing", url: "/briefing" }
      );
    });
    console.log(`[Notification Service] Scheduled Executive Briefing cron for user ${userId} with pattern: ${cronExpression}`);
  }
}

export const notificationService = new NotificationService();
