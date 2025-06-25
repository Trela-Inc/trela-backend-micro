import { eq, and, desc, gte } from 'drizzle-orm';
import { db } from '../config/database';
import { 
  notifications, 
  notificationTemplates, 
  userNotificationPreferences, 
  notificationLogs 
} from '../models/schema';
import { eventBus } from '../config/event-bus';
import { logger } from '../utils/logger';
import { EmailService } from './EmailService';
import { SMSService } from './SMSService';
import { PushNotificationService } from './PushNotificationService';

export interface CreateNotificationData {
  userId: string;
  type: 'email' | 'sms' | 'push' | 'in-app';
  templateName?: string;
  subject?: string;
  content: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  scheduledAt?: Date;
  metadata?: Record<string, any>;
}

export interface CreateTemplateData {
  name: string;
  type: 'email' | 'sms' | 'push' | 'in-app';
  subject?: string;
  content: string;
  variables?: Record<string, any>;
}

export interface UpdatePreferencesData {
  userId: string;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  pushEnabled?: boolean;
  inAppEnabled?: boolean;
  emailAddress?: string;
  phoneNumber?: string;
  pushToken?: string;
  preferences?: Record<string, any>;
}

export class NotificationService {
  private emailService: EmailService;
  private smsService: SMSService;
  private pushService: PushNotificationService;

  constructor() {
    this.emailService = new EmailService();
    this.smsService = new SMSService();
    this.pushService = new PushNotificationService();
  }

  async createNotification(data: CreateNotificationData): Promise<any> {
    try {
      let templateId = null;
      let finalSubject = data.subject;
      let finalContent = data.content;

      // If template is provided, get template and process variables
      if (data.templateName) {
        const template = await this.getTemplateByName(data.templateName);
        if (template) {
          templateId = template.id;
          finalSubject = this.processTemplate(template.subject || '', data.metadata || {});
          finalContent = this.processTemplate(template.content, data.metadata || {});
        }
      }

      // Create notification record
      const [notification] = await db.insert(notifications).values({
        userId: data.userId,
        templateId,
        type: data.type,
        subject: finalSubject,
        content: finalContent,
        priority: data.priority || 'normal',
        scheduledAt: data.scheduledAt,
        metadata: data.metadata,
      }).returning();

      // If scheduled for future, don't send immediately
      if (data.scheduledAt && data.scheduledAt > new Date()) {
        logger.info(`Notification scheduled for future: ${notification.id}`);
        return notification;
      }

      // Send notification immediately
      await this.sendNotification(notification);

      // Publish notification sent event
      await eventBus.publishEvent('notification.events', 'sent', {
        notificationId: notification.id,
        userId: notification.userId,
        type: notification.type,
        timestamp: new Date().toISOString()
      });

      logger.info(`Notification created and sent: ${notification.id}`);
      return notification;
    } catch (error) {
      logger.error('Failed to create notification:', error);
      throw error;
    }
  }

  async sendNotification(notification: any): Promise<void> {
    try {
      // Check user preferences
      const preferences = await this.getUserPreferences(notification.userId);
      if (!preferences) {
        throw new Error('User notification preferences not found');
      }

      // Check if notification type is enabled for user
      const isEnabled = this.isNotificationTypeEnabled(notification.type, preferences);
      if (!isEnabled) {
        await this.updateNotificationStatus(notification.id, 'skipped', 'User has disabled this notification type');
        return;
      }

      // Send based on type
      let result;
      switch (notification.type) {
        case 'email':
          result = await this.emailService.sendEmail({
            to: preferences.emailAddress,
            subject: notification.subject || 'Notification',
            content: notification.content,
            metadata: notification.metadata
          });
          break;
        case 'sms':
          result = await this.smsService.sendSMS({
            to: preferences.phoneNumber,
            message: notification.content,
            metadata: notification.metadata
          });
          break;
        case 'push':
          result = await this.pushService.sendPushNotification({
            token: preferences.pushToken,
            title: notification.subject || 'Notification',
            body: notification.content,
            metadata: notification.metadata
          });
          break;
        case 'in-app':
          result = { success: true, message: 'In-app notification stored' };
          break;
        default:
          throw new Error(`Unsupported notification type: ${notification.type}`);
      }

      // Update notification status
      const status = result.success ? 'sent' : 'failed';
      await this.updateNotificationStatus(notification.id, status, result.message);

      // Log the event
      await this.logNotificationEvent(notification.id, status, result.message, result);

      logger.info(`Notification sent successfully: ${notification.id}`);
    } catch (error) {
      logger.error('Failed to send notification:', error);
      await this.updateNotificationStatus(notification.id, 'failed', error.message);
      await this.logNotificationEvent(notification.id, 'failed', error.message);
      throw error;
    }
  }

  async createTemplate(data: CreateTemplateData): Promise<any> {
    try {
      const [template] = await db.insert(notificationTemplates).values({
        name: data.name,
        type: data.type,
        subject: data.subject,
        content: data.content,
        variables: data.variables,
      }).returning();

      // Publish template created event
      await eventBus.publishEvent('notification.events', 'template.created', {
        templateId: template.id,
        name: template.name,
        type: template.type,
        timestamp: new Date().toISOString()
      });

      logger.info(`Template created: ${template.id}`);
      return template;
    } catch (error) {
      logger.error('Failed to create template:', error);
      throw error;
    }
  }

  async getTemplateByName(name: string): Promise<any> {
    try {
      const result = await db.select()
        .from(notificationTemplates)
        .where(
          and(
            eq(notificationTemplates.name, name),
            eq(notificationTemplates.isActive, true)
          )
        );

      return result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.error('Failed to get template:', error);
      throw error;
    }
  }

  async updateUserPreferences(data: UpdatePreferencesData): Promise<any> {
    try {
      const existingPreferences = await db.select()
        .from(userNotificationPreferences)
        .where(eq(userNotificationPreferences.userId, data.userId));

      if (existingPreferences.length > 0) {
        // Update existing preferences
        const [updated] = await db.update(userNotificationPreferences)
          .set({
            emailEnabled: data.emailEnabled,
            smsEnabled: data.smsEnabled,
            pushEnabled: data.pushEnabled,
            inAppEnabled: data.inAppEnabled,
            emailAddress: data.emailAddress,
            phoneNumber: data.phoneNumber,
            pushToken: data.pushToken,
            preferences: data.preferences,
            updatedAt: new Date()
          })
          .where(eq(userNotificationPreferences.userId, data.userId))
          .returning();

        // Publish preferences updated event
        await eventBus.publishEvent('notification.events', 'preferences.updated', {
          userId: data.userId,
          timestamp: new Date().toISOString()
        });

        return updated;
      } else {
        // Create new preferences
        const [newPreferences] = await db.insert(userNotificationPreferences).values({
          userId: data.userId,
          emailEnabled: data.emailEnabled ?? true,
          smsEnabled: data.smsEnabled ?? true,
          pushEnabled: data.pushEnabled ?? true,
          inAppEnabled: data.inAppEnabled ?? true,
          emailAddress: data.emailAddress,
          phoneNumber: data.phoneNumber,
          pushToken: data.pushToken,
          preferences: data.preferences,
        }).returning();

        return newPreferences;
      }
    } catch (error) {
      logger.error('Failed to update user preferences:', error);
      throw error;
    }
  }

  async getUserPreferences(userId: string): Promise<any> {
    try {
      const result = await db.select()
        .from(userNotificationPreferences)
        .where(eq(userNotificationPreferences.userId, userId));

      return result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.error('Failed to get user preferences:', error);
      throw error;
    }
  }

  async getNotificationsByUser(userId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
    try {
      const result = await db.select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);

      return result;
    } catch (error) {
      logger.error('Failed to get user notifications:', error);
      throw error;
    }
  }

  async getNotificationById(notificationId: string): Promise<any> {
    try {
      const result = await db.select()
        .from(notifications)
        .where(eq(notifications.id, notificationId));

      return result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.error('Failed to get notification:', error);
      throw error;
    }
  }

  async updateNotificationStatus(notificationId: string, status: string, errorMessage?: string): Promise<void> {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date()
      };

      if (status === 'sent') {
        updateData.sentAt = new Date();
      } else if (status === 'delivered') {
        updateData.deliveredAt = new Date();
      } else if (status === 'failed') {
        updateData.errorMessage = errorMessage;
        updateData.retryCount = notifications.retryCount + 1;
      }

      await db.update(notifications)
        .set(updateData)
        .where(eq(notifications.id, notificationId));
    } catch (error) {
      logger.error('Failed to update notification status:', error);
      throw error;
    }
  }

  async logNotificationEvent(notificationId: string, event: string, message: string, metadata?: any): Promise<void> {
    try {
      await db.insert(notificationLogs).values({
        notificationId,
        event,
        status: event,
        message,
        metadata
      });
    } catch (error) {
      logger.error('Failed to log notification event:', error);
    }
  }

  async retryFailedNotifications(): Promise<void> {
    try {
      const failedNotifications = await db.select()
        .from(notifications)
        .where(
          and(
            eq(notifications.status, 'failed'),
            notifications.retryCount < notifications.maxRetries
          )
        );

      for (const notification of failedNotifications) {
        try {
          await this.sendNotification(notification);
        } catch (error) {
          logger.error(`Failed to retry notification ${notification.id}:`, error);
        }
      }

      logger.info(`Retried ${failedNotifications.length} failed notifications`);
    } catch (error) {
      logger.error('Failed to retry failed notifications:', error);
      throw error;
    }
  }

  async processScheduledNotifications(): Promise<void> {
    try {
      const scheduledNotifications = await db.select()
        .from(notifications)
        .where(
          and(
            eq(notifications.status, 'pending'),
            gte(notifications.scheduledAt, new Date())
          )
        );

      for (const notification of scheduledNotifications) {
        try {
          await this.sendNotification(notification);
        } catch (error) {
          logger.error(`Failed to process scheduled notification ${notification.id}:`, error);
        }
      }

      logger.info(`Processed ${scheduledNotifications.length} scheduled notifications`);
    } catch (error) {
      logger.error('Failed to process scheduled notifications:', error);
      throw error;
    }
  }

  private processTemplate(template: string, variables: Record<string, any>): string {
    let processed = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      processed = processed.replace(new RegExp(placeholder, 'g'), String(value));
    }
    return processed;
  }

  private isNotificationTypeEnabled(type: string, preferences: any): boolean {
    switch (type) {
      case 'email':
        return preferences.emailEnabled && preferences.emailAddress;
      case 'sms':
        return preferences.smsEnabled && preferences.phoneNumber;
      case 'push':
        return preferences.pushEnabled && preferences.pushToken;
      case 'in-app':
        return preferences.inAppEnabled;
      default:
        return false;
    }
  }

  // Event handlers for consuming events from other services
  async handleUserRegisteredEvent(event: any): Promise<void> {
    try {
      // Send welcome notification
      await this.createNotification({
        userId: event.data.userId,
        type: 'email',
        templateName: 'welcome_email',
        metadata: {
          email: event.data.email,
          firstName: event.data.firstName
        }
      });

      logger.info(`Welcome notification sent for user: ${event.data.userId}`);
    } catch (error) {
      logger.error('Failed to handle user registered event:', error);
    }
  }

  async handleUserLoginEvent(event: any): Promise<void> {
    try {
      // Send login notification if suspicious activity detected
      if (event.data.ipAddress && event.data.userAgent) {
        // Here you could add logic to detect suspicious login patterns
        // For now, just log the event
        logger.info(`User login event processed: ${event.data.userId}`);
      }
    } catch (error) {
      logger.error('Failed to handle user login event:', error);
    }
  }

  async handlePasswordResetEvent(event: any): Promise<void> {
    try {
      // Send password reset email
      await this.createNotification({
        userId: event.data.userId,
        type: 'email',
        templateName: 'password_reset',
        metadata: {
          email: event.data.email,
          resetToken: event.data.resetToken,
          expiresAt: event.data.expiresAt
        }
      });

      logger.info(`Password reset notification sent for user: ${event.data.userId}`);
    } catch (error) {
      logger.error('Failed to handle password reset event:', error);
    }
  }
} 