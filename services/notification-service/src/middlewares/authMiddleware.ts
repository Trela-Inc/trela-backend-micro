import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// For notification service, we'll use a simple token verification
// In a real implementation, you might want to call the auth service or use JWT directly
export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Authorization header is required'
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Token is required'
      });
      return;
    }

    // For now, we'll just check if token exists
    // In a real implementation, you would verify the JWT token here
    // or make a call to the auth service to verify the token
    
    // Mock user for now - in real implementation, decode JWT to get user info
    (req as any).user = {
      id: 'mock-user-id',
      email: 'mock@example.com',
      role: 'user'
    };

    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
}; 