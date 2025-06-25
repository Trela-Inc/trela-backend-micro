import { Router } from 'express';
import { NotificationController } from '../../controllers/NotificationController';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { rateLimitMiddleware } from '../../middlewares/rateLimitMiddleware';

const router = Router();
const notificationController = new NotificationController();

// Health check
router.get('/health', notificationController.healthCheck.bind(notificationController));

// Notification routes
router.post('/send', 
  authMiddleware,
  rateLimitMiddleware('send-notification', 100, 15 * 60 * 1000), // 100 requests per 15 minutes
  notificationController.sendNotification.bind(notificationController)
);

router.post('/send-bulk', 
  authMiddleware,
  rateLimitMiddleware('bulk-notification', 10, 15 * 60 * 1000), // 10 requests per 15 minutes
  notificationController.sendBulkNotifications.bind(notificationController)
);

router.get('/user/:userId', 
  authMiddleware,
  rateLimitMiddleware('get-notifications', 200, 15 * 60 * 1000), // 200 requests per 15 minutes
  notificationController.getUserNotifications.bind(notificationController)
);

router.get('/:notificationId', 
  authMiddleware,
  rateLimitMiddleware('get-notification', 200, 15 * 60 * 1000), // 200 requests per 15 minutes
  notificationController.getNotification.bind(notificationController)
);

// Template routes
router.post('/templates', 
  authMiddleware,
  rateLimitMiddleware('create-template', 20, 15 * 60 * 1000), // 20 requests per 15 minutes
  notificationController.createTemplate.bind(notificationController)
);

router.get('/templates/:name', 
  authMiddleware,
  rateLimitMiddleware('get-template', 100, 15 * 60 * 1000), // 100 requests per 15 minutes
  notificationController.getTemplate.bind(notificationController)
);

// User preferences routes
router.get('/preferences/:userId', 
  authMiddleware,
  rateLimitMiddleware('get-preferences', 100, 15 * 60 * 1000), // 100 requests per 15 minutes
  notificationController.getUserPreferences.bind(notificationController)
);

router.put('/preferences/:userId', 
  authMiddleware,
  rateLimitMiddleware('update-preferences', 50, 15 * 60 * 1000), // 50 requests per 15 minutes
  notificationController.updateUserPreferences.bind(notificationController)
);

// Admin routes
router.post('/retry-failed', 
  authMiddleware,
  rateLimitMiddleware('retry-failed', 5, 15 * 60 * 1000), // 5 requests per 15 minutes
  notificationController.retryFailedNotifications.bind(notificationController)
);

router.post('/process-scheduled', 
  authMiddleware,
  rateLimitMiddleware('process-scheduled', 5, 15 * 60 * 1000), // 5 requests per 15 minutes
  notificationController.processScheduledNotifications.bind(notificationController)
);

export default router; 