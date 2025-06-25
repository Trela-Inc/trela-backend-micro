import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { eventBus } from './config/event-bus';
import { logger } from './utils/logger';
import { NotificationService } from './services/NotificationService';
import notificationRoutes from './api/routes/notification.routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;
const notificationService = new NotificationService();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Routes
app.use('/api/notifications', notificationRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Notification Service',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await eventBus.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await eventBus.disconnect();
  process.exit(0);
});

// Start server
const startServer = async () => {
  try {
    // Connect to event bus
    await eventBus.connect();
    logger.info('Event bus connected successfully');

    // Start listening for events from auth service
    await eventBus.consumeEvents('notification.send', async (message) => {
      logger.info('Received notification send event:', message);
      try {
        await notificationService.createNotification(message.data);
      } catch (error) {
        logger.error('Failed to process notification send event:', error);
      }
    });

    await eventBus.consumeEvents('notification.bulk.send', async (message) => {
      logger.info('Received bulk notification send event:', message);
      try {
        for (const notificationData of message.data.notifications) {
          await notificationService.createNotification(notificationData);
        }
      } catch (error) {
        logger.error('Failed to process bulk notification send event:', error);
      }
    });

    await eventBus.consumeEvents('notification.template.create', async (message) => {
      logger.info('Received template create event:', message);
      try {
        await notificationService.createTemplate(message.data);
      } catch (error) {
        logger.error('Failed to process template create event:', error);
      }
    });

    await eventBus.consumeEvents('notification.preferences.update', async (message) => {
      logger.info('Received preferences update event:', message);
      try {
        await notificationService.updateUserPreferences(message.data);
      } catch (error) {
        logger.error('Failed to process preferences update event:', error);
      }
    });

    // Listen for events from auth service
    await eventBus.consumeEvents('auth.user.registered', async (message) => {
      logger.info('Received user registered event from auth service:', message);
      try {
        await notificationService.handleUserRegisteredEvent(message);
      } catch (error) {
        logger.error('Failed to handle user registered event:', error);
      }
    });

    await eventBus.consumeEvents('auth.user.login', async (message) => {
      logger.info('Received user login event from auth service:', message);
      try {
        await notificationService.handleUserLoginEvent(message);
      } catch (error) {
        logger.error('Failed to handle user login event:', error);
      }
    });

    await eventBus.consumeEvents('auth.password.reset', async (message) => {
      logger.info('Received password reset event from auth service:', message);
      try {
        await notificationService.handlePasswordResetEvent(message);
      } catch (error) {
        logger.error('Failed to handle password reset event:', error);
      }
    });

    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`Notification service running on port ${PORT}`);
      logger.info(`Health check available at http://localhost:${PORT}/api/notifications/health`);
    });

    // Start background tasks
    setInterval(async () => {
      try {
        await notificationService.processScheduledNotifications();
      } catch (error) {
        logger.error('Failed to process scheduled notifications:', error);
      }
    }, 60000); // Check every minute

    setInterval(async () => {
      try {
        await notificationService.retryFailedNotifications();
      } catch (error) {
        logger.error('Failed to retry failed notifications:', error);
      }
    }, 300000); // Retry every 5 minutes

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
