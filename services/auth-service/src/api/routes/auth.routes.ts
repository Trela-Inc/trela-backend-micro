import { Router } from 'express';
import { AuthController } from '../../controllers/AuthController';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { rateLimitMiddleware } from '../../middlewares/rateLimitMiddleware';

const router = Router();
const authController = new AuthController();

// Health check
router.get('/health', authController.healthCheck.bind(authController));

// Public routes
router.post('/register', 
  rateLimitMiddleware('register', 5, 15 * 60 * 1000), // 5 requests per 15 minutes
  authController.register.bind(authController)
);

router.post('/login', 
  rateLimitMiddleware('login', 10, 15 * 60 * 1000), // 10 requests per 15 minutes
  authController.login.bind(authController)
);

router.post('/refresh-token', 
  rateLimitMiddleware('refresh', 20, 15 * 60 * 1000), // 20 requests per 15 minutes
  authController.refreshToken.bind(authController)
);

router.post('/request-password-reset', 
  rateLimitMiddleware('password-reset', 3, 60 * 60 * 1000), // 3 requests per hour
  authController.requestPasswordReset.bind(authController)
);

router.post('/reset-password', 
  rateLimitMiddleware('password-reset', 5, 60 * 60 * 1000), // 5 requests per hour
  authController.resetPassword.bind(authController)
);

router.post('/verify-token', 
  rateLimitMiddleware('verify', 50, 15 * 60 * 1000), // 50 requests per 15 minutes
  authController.verifyToken.bind(authController)
);

// Protected routes
router.post('/logout', 
  authMiddleware,
  authController.logout.bind(authController)
);

router.get('/profile', 
  authMiddleware,
  authController.getProfile.bind(authController)
);

export default router;