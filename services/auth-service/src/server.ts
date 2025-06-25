import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { eventBus } from './config/event-bus';
import { logger } from './utils/logger';
import authRoutes from './api/routes/auth.routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

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
app.use('/api/auth', authRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Auth Service',
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

    // Start listening for events
    await eventBus.consumeEvents('auth.user.registered', async (message) => {
      logger.info('Received user registered event:', message);
      // Handle user registered event
    });

    await eventBus.consumeEvents('auth.user.login', async (message) => {
      logger.info('Received user login event:', message);
      // Handle user login event
    });

    await eventBus.consumeEvents('auth.user.logout', async (message) => {
      logger.info('Received user logout event:', message);
      // Handle user logout event
    });

    await eventBus.consumeEvents('auth.password.reset', async (message) => {
      logger.info('Received password reset event:', message);
      // Handle password reset event
    });

    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`Auth service running on port ${PORT}`);
      logger.info(`Health check available at http://localhost:${PORT}/api/auth/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();