import * as admin from 'firebase-admin';
import { logger } from '../utils/logger';

export interface PushNotificationData {
  token: string;
  title: string;
  body: string;
  metadata?: Record<string, any>;
}

export class PushNotificationService {
  private app: admin.app.App;

  constructor() {
    try {
      // Initialize Firebase Admin SDK
      if (!admin.apps.length) {
        const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
        
        if (serviceAccount) {
          const serviceAccountJson = JSON.parse(serviceAccount);
          this.app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccountJson),
            projectId: process.env.FIREBASE_PROJECT_ID
          });
        } else {
          // Use default credentials (for local development)
          this.app = admin.initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID
          });
        }
      } else {
        this.app = admin.app();
      }
    } catch (error) {
      logger.warn('Firebase not configured, push notifications will be disabled');
      this.app = null as any;
    }
  }

  async sendPushNotification(data: PushNotificationData): Promise<{ success: boolean; message: string; messageId?: string }> {
    try {
      if (!this.app) {
        throw new Error('Push notification service not configured');
      }

      const message = {
        token: data.token,
        notification: {
          title: data.title,
          body: data.body,
        },
        data: data.metadata || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const result = await this.app.messaging().send(message);

      logger.info(`Push notification sent successfully: ${result}`);

      return {
        success: true,
        message: 'Push notification sent successfully',
        messageId: result
      };
    } catch (error) {
      logger.error('Failed to send push notification:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  async sendBulkPushNotifications(notifications: PushNotificationData[]): Promise<{ success: boolean; results: any[] }> {
    try {
      if (!this.app) {
        throw new Error('Push notification service not configured');
      }

      const messages = notifications.map(notification => ({
        token: notification.token,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.metadata || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      }));

      const result = await this.app.messaging().sendAll(messages);

      logger.info(`Bulk push notifications sent: ${result.successCount}/${notifications.length} successful`);

      return {
        success: result.successCount === notifications.length,
        results: result.responses.map((response, index) => ({
          token: notifications[index].token,
          success: response.success,
          message: response.success ? 'Sent successfully' : response.error?.message || 'Unknown error',
          messageId: response.messageId
        }))
      };
    } catch (error) {
      logger.error('Failed to send bulk push notifications:', error);
      return {
        success: false,
        results: notifications.map(notification => ({
          token: notification.token,
          success: false,
          message: error.message
        }))
      };
    }
  }

  async sendToTopic(topic: string, data: Omit<PushNotificationData, 'token'>): Promise<{ success: boolean; message: string; messageId?: string }> {
    try {
      if (!this.app) {
        throw new Error('Push notification service not configured');
      }

      const message = {
        topic,
        notification: {
          title: data.title,
          body: data.body,
        },
        data: data.metadata || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const result = await this.app.messaging().send(message);

      logger.info(`Topic notification sent successfully to ${topic}: ${result}`);

      return {
        success: true,
        message: 'Topic notification sent successfully',
        messageId: result
      };
    } catch (error) {
      logger.error('Failed to send topic notification:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  async subscribeToTopic(tokens: string[], topic: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.app) {
        throw new Error('Push notification service not configured');
      }

      const result = await this.app.messaging().subscribeToTopic(tokens, topic);

      logger.info(`Subscribed ${tokens.length} tokens to topic ${topic}: ${result.successCount} successful`);

      return {
        success: result.successCount === tokens.length,
        message: `${result.successCount}/${tokens.length} tokens subscribed successfully`
      };
    } catch (error) {
      logger.error('Failed to subscribe to topic:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.app) {
        throw new Error('Push notification service not configured');
      }

      const result = await this.app.messaging().unsubscribeFromTopic(tokens, topic);

      logger.info(`Unsubscribed ${tokens.length} tokens from topic ${topic}: ${result.successCount} successful`);

      return {
        success: result.successCount === tokens.length,
        message: `${result.successCount}/${tokens.length} tokens unsubscribed successfully`
      };
    } catch (error) {
      logger.error('Failed to unsubscribe from topic:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  async verifyToken(token: string): Promise<boolean> {
    try {
      if (!this.app) {
        return false;
      }

      // You can implement token verification logic here
      // For now, just return true if the service is configured
      return true;
    } catch (error) {
      logger.error('Failed to verify push token:', error);
      return false;
    }
  }
} 