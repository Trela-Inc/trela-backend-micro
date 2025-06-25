import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Simple in-memory rate limiting store
// In production, use Redis or a proper rate limiting library
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const rateLimitMiddleware = (key: string, maxRequests: number, windowMs: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const clientId = req.ip || 'unknown';
      const rateLimitKey = `${key}:${clientId}`;
      const now = Date.now();

      const rateLimit = rateLimitStore.get(rateLimitKey);

      if (!rateLimit || now > rateLimit.resetTime) {
        // First request or window expired
        rateLimitStore.set(rateLimitKey, {
          count: 1,
          resetTime: now + windowMs
        });
        next();
        return;
      }

      if (rateLimit.count >= maxRequests) {
        // Rate limit exceeded
        const retryAfter = Math.ceil((rateLimit.resetTime - now) / 1000);
        
        res.status(429).json({
          success: false,
          message: 'Rate limit exceeded',
          retryAfter,
          limit: maxRequests,
          windowMs
        });
        return;
      }

      // Increment count
      rateLimit.count++;
      next();
    } catch (error) {
      logger.error('Rate limiting error:', error);
      // If rate limiting fails, allow the request to proceed
      next();
    }
  };
}; 