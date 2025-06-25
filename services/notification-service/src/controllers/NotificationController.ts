import { Request, Response } from 'express';
import { NotificationService } from '../services/NotificationService';
import { logger } from '../utils/logger';

export class NotificationController {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  async sendNotification(req: Request, res: Response): Promise<void> {
    try {
      const { userId, type, templateName, subject, content, priority, scheduledAt, metadata } = req.body;

      // Validation
      if (!userId || !type || !content) {
        res.status(400).json({
          success: false,
          message: 'userId, type, and content are required'
        });
        return;
      }

      if (!['email', 'sms', 'push', 'in-app'].includes(type)) {
        res.status(400).json({
          success: false,
          message: 'Invalid notification type. Must be email, sms, push, or in-app'
        });
        return;
      }

      if (priority && !['low', 'normal', 'high', 'urgent'].includes(priority)) {
        res.status(400).json({
          success: false,
          message: 'Invalid priority. Must be low, normal, high, or urgent'
        });
        return;
      }

      const notification = await this.notificationService.createNotification({
        userId,
        type,
        templateName,
        subject,
        content,
        priority,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        metadata
      });

      res.status(201).json({
        success: true,
        message: 'Notification created successfully',
        data: notification
      });
    } catch (error) {
      logger.error('Send notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async sendBulkNotifications(req: Request, res: Response): Promise<void> {
    try {
      const { notifications } = req.body;

      if (!Array.isArray(notifications) || notifications.length === 0) {
        res.status(400).json({
          success: false,
          message: 'notifications array is required and must not be empty'
        });
        return;
      }

      const results = [];
      for (const notificationData of notifications) {
        try {
          const notification = await this.notificationService.createNotification(notificationData);
          results.push({
            success: true,
            notificationId: notification.id,
            message: 'Notification created successfully'
          });
        } catch (error) {
          results.push({
            success: false,
            error: error.message,
            data: notificationData
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      res.status(200).json({
        success: true,
        message: `Bulk notifications processed: ${successCount}/${notifications.length} successful`,
        data: results
      });
    } catch (error) {
      logger.error('Bulk notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { name, type, subject, content, variables } = req.body;

      // Validation
      if (!name || !type || !content) {
        res.status(400).json({
          success: false,
          message: 'name, type, and content are required'
        });
        return;
      }

      if (!['email', 'sms', 'push', 'in-app'].includes(type)) {
        res.status(400).json({
          success: false,
          message: 'Invalid template type. Must be email, sms, push, or in-app'
        });
        return;
      }

      const template = await this.notificationService.createTemplate({
        name,
        type,
        subject,
        content,
        variables
      });

      res.status(201).json({
        success: true,
        message: 'Template created successfully',
        data: template
      });
    } catch (error) {
      logger.error('Create template error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async getTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params;

      if (!name) {
        res.status(400).json({
          success: false,
          message: 'Template name is required'
        });
        return;
      }

      const template = await this.notificationService.getTemplateByName(name);

      if (!template) {
        res.status(404).json({
          success: false,
          message: 'Template not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Template retrieved successfully',
        data: template
      });
    } catch (error) {
      logger.error('Get template error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async updateUserPreferences(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const preferences = req.body;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
        return;
      }

      const updatedPreferences = await this.notificationService.updateUserPreferences({
        userId,
        ...preferences
      });

      res.status(200).json({
        success: true,
        message: 'User preferences updated successfully',
        data: updatedPreferences
      });
    } catch (error) {
      logger.error('Update user preferences error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async getUserPreferences(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
        return;
      }

      const preferences = await this.notificationService.getUserPreferences(userId);

      if (!preferences) {
        res.status(404).json({
          success: false,
          message: 'User preferences not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'User preferences retrieved successfully',
        data: preferences
      });
    } catch (error) {
      logger.error('Get user preferences error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async getUserNotifications(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
        return;
      }

      const notifications = await this.notificationService.getNotificationsByUser(
        userId,
        parseInt(limit as string),
        parseInt(offset as string)
      );

      res.status(200).json({
        success: true,
        message: 'User notifications retrieved successfully',
        data: notifications,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          count: notifications.length
        }
      });
    } catch (error) {
      logger.error('Get user notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async getNotification(req: Request, res: Response): Promise<void> {
    try {
      const { notificationId } = req.params;

      if (!notificationId) {
        res.status(400).json({
          success: false,
          message: 'Notification ID is required'
        });
        return;
      }

      const notification = await this.notificationService.getNotificationById(notificationId);

      if (!notification) {
        res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Notification retrieved successfully',
        data: notification
      });
    } catch (error) {
      logger.error('Get notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async retryFailedNotifications(req: Request, res: Response): Promise<void> {
    try {
      await this.notificationService.retryFailedNotifications();

      res.status(200).json({
        success: true,
        message: 'Failed notifications retry process completed'
      });
    } catch (error) {
      logger.error('Retry failed notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async processScheduledNotifications(req: Request, res: Response): Promise<void> {
    try {
      await this.notificationService.processScheduledNotifications();

      res.status(200).json({
        success: true,
        message: 'Scheduled notifications processing completed'
      });
    } catch (error) {
      logger.error('Process scheduled notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        message: 'Notification service is healthy',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Health check error:', error);
      res.status(500).json({
        success: false,
        message: 'Service unhealthy'
      });
    }
  }
} 