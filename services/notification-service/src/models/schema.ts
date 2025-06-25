import { pgTable, text, timestamp, uuid, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Notification templates table
export const notificationTemplates = pgTable('notification_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  type: text('type').notNull(), // email, sms, push, in-app
  subject: text('subject'),
  content: text('content').notNull(),
  variables: jsonb('variables'), // JSON object for template variables
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Notifications table
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  templateId: uuid('template_id').references(() => notificationTemplates.id),
  type: text('type').notNull(), // email, sms, push, in-app
  subject: text('subject'),
  content: text('content').notNull(),
  status: text('status').default('pending').notNull(), // pending, sent, failed, delivered
  priority: text('priority').default('normal').notNull(), // low, normal, high, urgent
  scheduledAt: timestamp('scheduled_at'),
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  metadata: jsonb('metadata'), // Additional data like email, phone, etc.
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').default(0).notNull(),
  maxRetries: integer('max_retries').default(3).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User notification preferences table
export const userNotificationPreferences = pgTable('user_notification_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique(),
  emailEnabled: boolean('email_enabled').default(true).notNull(),
  smsEnabled: boolean('sms_enabled').default(true).notNull(),
  pushEnabled: boolean('push_enabled').default(true).notNull(),
  inAppEnabled: boolean('in_app_enabled').default(true).notNull(),
  emailAddress: text('email_address'),
  phoneNumber: text('phone_number'),
  pushToken: text('push_token'),
  preferences: jsonb('preferences'), // JSON object for specific notification preferences
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Notification logs table for tracking
export const notificationLogs = pgTable('notification_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  notificationId: uuid('notification_id').references(() => notifications.id, { onDelete: 'cascade' }).notNull(),
  event: text('event').notNull(), // sent, delivered, failed, opened, clicked
  status: text('status').notNull(),
  message: text('message'),
  metadata: jsonb('metadata'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Relations
export const notificationTemplatesRelations = relations(notificationTemplates, ({ many }) => ({
  notifications: many(notifications),
}));

export const notificationsRelations = relations(notifications, ({ one, many }) => ({
  template: one(notificationTemplates, {
    fields: [notifications.templateId],
    references: [notificationTemplates.id],
  }),
  logs: many(notificationLogs),
}));

export const notificationLogsRelations = relations(notificationLogs, ({ one }) => ({
  notification: one(notifications, {
    fields: [notificationLogs.notificationId],
    references: [notifications.id],
  }),
})); 