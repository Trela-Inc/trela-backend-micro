import amqp, { Channel, Connection } from 'amqplib';
import { logger } from '../utils/logger';

export class EventBus {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private readonly url: string;

  constructor() {
    this.url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  }

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();
      
      // Declare exchanges
      await this.channel.assertExchange('auth.events', 'topic', { durable: true });
      await this.channel.assertExchange('user.events', 'topic', { durable: true });
      
      // Declare queues
      await this.channel.assertQueue('auth.user.registered', { durable: true });
      await this.channel.assertQueue('auth.user.login', { durable: true });
      await this.channel.assertQueue('auth.user.logout', { durable: true });
      await this.channel.assertQueue('auth.password.reset', { durable: true });
      
      // Bind queues to exchanges
      await this.channel.bindQueue('auth.user.registered', 'auth.events', 'user.registered');
      await this.channel.bindQueue('auth.user.login', 'auth.events', 'user.login');
      await this.channel.bindQueue('auth.user.logout', 'auth.events', 'user.logout');
      await this.channel.bindQueue('auth.password.reset', 'auth.events', 'password.reset');
      
      logger.info('Event bus connected successfully');
    } catch (error) {
      logger.error('Failed to connect to event bus:', error);
      throw error;
    }
  }

  async publishEvent(exchange: string, routingKey: string, message: any): Promise<void> {
    if (!this.channel) {
      throw new Error('Event bus not connected');
    }

    try {
      const messageBuffer = Buffer.from(JSON.stringify({
        id: this.generateEventId(),
        timestamp: new Date().toISOString(),
        data: message
      }));

      this.channel.publish(exchange, routingKey, messageBuffer, {
        persistent: true,
        contentType: 'application/json'
      });

      logger.info(`Event published: ${exchange}.${routingKey}`);
    } catch (error) {
      logger.error('Failed to publish event:', error);
      throw error;
    }
  }

  async consumeEvents(queue: string, handler: (message: any) => Promise<void>): Promise<void> {
    if (!this.channel) {
      throw new Error('Event bus not connected');
    }

    try {
      await this.channel.consume(queue, async (msg) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            await handler(content);
            this.channel?.ack(msg);
          } catch (error) {
            logger.error('Error processing message:', error);
            this.channel?.nack(msg, false, true);
          }
        }
      });

      logger.info(`Started consuming events from queue: ${queue}`);
    } catch (error) {
      logger.error('Failed to consume events:', error);
      throw error;
    }
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      logger.info('Event bus disconnected');
    } catch (error) {
      logger.error('Error disconnecting event bus:', error);
    }
  }
}

export const eventBus = new EventBus(); 