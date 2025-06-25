import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../config/database';
import { users, sessions, refreshTokens, passwordResetTokens } from '../models/schema';
import { eventBus } from '../config/event-bus';
import { logger } from '../utils/logger';

export interface UserRegistrationData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

export interface LoginData {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  private readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';

  async registerUser(data: UserRegistrationData): Promise<any> {
    try {
      // Check if user already exists
      const existingUser = await db.select().from(users).where(eq(users.email, data.email));
      
      if (existingUser.length > 0) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(data.password, saltRounds);

      // Create user
      const [newUser] = await db.insert(users).values({
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || 'user',
      }).returning();

      // Publish user registered event
      await eventBus.publishEvent('auth.events', 'user.registered', {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        timestamp: new Date().toISOString()
      });

      logger.info(`User registered successfully: ${newUser.email}`);
      
      return {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        isEmailVerified: newUser.isEmailVerified
      };
    } catch (error) {
      logger.error('Registration failed:', error);
      throw error;
    }
  }

  async loginUser(data: LoginData): Promise<AuthTokens> {
    try {
      // Find user
      const userResult = await db.select().from(users).where(eq(users.email, data.email));
      
      if (userResult.length === 0) {
        throw new Error('Invalid credentials');
      }

      const user = userResult[0];

      // Check if user is active
      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      // Generate tokens
      const accessToken = jwt.sign(
        { 
          id: user.id, 
          email: user.email, 
          role: user.role 
        },
        this.JWT_SECRET,
        { expiresIn: this.ACCESS_TOKEN_EXPIRY }
      );

      const refreshToken = jwt.sign(
        { 
          id: user.id, 
          type: 'refresh' 
        },
        this.JWT_REFRESH_SECRET,
        { expiresIn: this.REFRESH_TOKEN_EXPIRY }
      );

      // Store refresh token
      await db.insert(refreshTokens).values({
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      // Create session
      await db.insert(sessions).values({
        userId: user.id,
        token: accessToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      });

      // Update last login
      await db.update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, user.id));

      // Publish login event
      await eventBus.publishEvent('auth.events', 'user.login', {
        userId: user.id,
        email: user.email,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        timestamp: new Date().toISOString()
      });

      logger.info(`User logged in successfully: ${user.email}`);

      return {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60 // 15 minutes in seconds
      };
    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  }

  async refreshToken(token: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(token, this.JWT_REFRESH_SECRET) as any;
      
      // Check if token exists and is not revoked
      const tokenResult = await db.select()
        .from(refreshTokens)
        .where(
          and(
            eq(refreshTokens.token, token),
            eq(refreshTokens.isRevoked, false)
          )
        );

      if (tokenResult.length === 0) {
        throw new Error('Invalid refresh token');
      }

      const refreshTokenRecord = tokenResult[0];

      // Check if token is expired
      if (new Date() > refreshTokenRecord.expiresAt) {
        throw new Error('Refresh token expired');
      }

      // Get user
      const userResult = await db.select().from(users).where(eq(users.id, decoded.id));
      
      if (userResult.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult[0];

      // Generate new tokens
      const newAccessToken = jwt.sign(
        { 
          id: user.id, 
          email: user.email, 
          role: user.role 
        },
        this.JWT_SECRET,
        { expiresIn: this.ACCESS_TOKEN_EXPIRY }
      );

      const newRefreshToken = jwt.sign(
        { 
          id: user.id, 
          type: 'refresh' 
        },
        this.JWT_REFRESH_SECRET,
        { expiresIn: this.REFRESH_TOKEN_EXPIRY }
      );

      // Revoke old refresh token
      await db.update(refreshTokens)
        .set({ isRevoked: true })
        .where(eq(refreshTokens.id, refreshTokenRecord.id));

      // Store new refresh token
      await db.insert(refreshTokens).values({
        userId: user.id,
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // Create new session
      await db.insert(sessions).values({
        userId: user.id,
        token: newAccessToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      logger.info(`Token refreshed successfully for user: ${user.email}`);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 15 * 60
      };
    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw error;
    }
  }

  async logoutUser(userId: string, accessToken: string): Promise<void> {
    try {
      // Revoke all refresh tokens for user
      await db.update(refreshTokens)
        .set({ isRevoked: true })
        .where(eq(refreshTokens.userId, userId));

      // Deactivate session
      await db.update(sessions)
        .set({ isActive: false })
        .where(eq(sessions.token, accessToken));

      // Publish logout event
      await eventBus.publishEvent('auth.events', 'user.logout', {
        userId,
        timestamp: new Date().toISOString()
      });

      logger.info(`User logged out successfully: ${userId}`);
    } catch (error) {
      logger.error('Logout failed:', error);
      throw error;
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    try {
      const userResult = await db.select().from(users).where(eq(users.email, email));
      
      if (userResult.length === 0) {
        // Don't reveal if user exists or not
        return;
      }

      const user = userResult[0];
      const resetToken = uuidv4();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store reset token
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token: resetToken,
        expiresAt,
      });

      // Publish password reset event
      await eventBus.publishEvent('auth.events', 'password.reset', {
        userId: user.id,
        email: user.email,
        resetToken,
        expiresAt: expiresAt.toISOString(),
        timestamp: new Date().toISOString()
      });

      logger.info(`Password reset requested for: ${email}`);
    } catch (error) {
      logger.error('Password reset request failed:', error);
      throw error;
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      // Find valid reset token
      const tokenResult = await db.select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, token),
            eq(passwordResetTokens.isUsed, false)
          )
        );

      if (tokenResult.length === 0) {
        throw new Error('Invalid or expired reset token');
      }

      const resetTokenRecord = tokenResult[0];

      // Check if token is expired
      if (new Date() > resetTokenRecord.expiresAt) {
        throw new Error('Reset token expired');
      }

      // Hash new password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update user password
      await db.update(users)
        .set({ 
          passwordHash,
          updatedAt: new Date()
        })
        .where(eq(users.id, resetTokenRecord.userId));

      // Mark token as used
      await db.update(passwordResetTokens)
        .set({ isUsed: true })
        .where(eq(passwordResetTokens.id, resetTokenRecord.id));

      // Revoke all refresh tokens for user
      await db.update(refreshTokens)
        .set({ isRevoked: true })
        .where(eq(refreshTokens.userId, resetTokenRecord.userId));

      // Deactivate all sessions for user
      await db.update(sessions)
        .set({ isActive: false })
        .where(eq(sessions.userId, resetTokenRecord.userId));

      logger.info(`Password reset successfully for user: ${resetTokenRecord.userId}`);
    } catch (error) {
      logger.error('Password reset failed:', error);
      throw error;
    }
  }

  async verifyToken(token: string): Promise<any> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as any;
      
      // Check if session is active
      const sessionResult = await db.select()
        .from(sessions)
        .where(
          and(
            eq(sessions.token, token),
            eq(sessions.isActive, true)
          )
        );

      if (sessionResult.length === 0) {
        throw new Error('Invalid or expired session');
      }

      const session = sessionResult[0];

      // Check if session is expired
      if (new Date() > session.expiresAt) {
        throw new Error('Session expired');
      }

      // Get user
      const userResult = await db.select().from(users).where(eq(users.id, decoded.id));
      
      if (userResult.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult[0];

      if (!user.isActive) {
        throw new Error('User account is deactivated');
      }

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified
      };
    } catch (error) {
      logger.error('Token verification failed:', error);
      throw error;
    }
  }

  async getUserById(userId: string): Promise<any> {
    try {
      const userResult = await db.select().from(users).where(eq(users.id, userId));
      
      if (userResult.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult[0];
      
      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
    } catch (error) {
      logger.error('Get user failed:', error);
      throw error;
    }
  }
}