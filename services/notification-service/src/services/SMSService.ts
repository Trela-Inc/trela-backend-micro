import twilio from 'twilio';
import { logger } from '../utils/logger';

export interface SMSData {
  to: string;
  message: string;
  metadata?: Record<string, any>;
}

export class SMSService {
  private client: twilio.Twilio;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      logger.warn('Twilio credentials not configured, SMS service will be disabled');
      this.client = null as any;
    } else {
      this.client = twilio(accountSid, authToken);
    }
  }

  async sendSMS(data: SMSData): Promise<{ success: boolean; message: string; messageId?: string }> {
    try {
      if (!this.client) {
        throw new Error('SMS service not configured');
      }

      const result = await this.client.messages.create({
        body: data.message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: data.to
      });

      logger.info(`SMS sent successfully to ${data.to}: ${result.sid}`);

      return {
        success: true,
        message: 'SMS sent successfully',
        messageId: result.sid
      };
    } catch (error) {
      logger.error('Failed to send SMS:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  async sendBulkSMS(smsList: SMSData[]): Promise<{ success: boolean; results: any[] }> {
    const results = [];

    for (const sms of smsList) {
      try {
        const result = await this.sendSMS(sms);
        results.push({
          to: sms.to,
          success: result.success,
          message: result.message,
          messageId: result.messageId
        });
      } catch (error) {
        results.push({
          to: sms.to,
          success: false,
          message: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.info(`Bulk SMS sent: ${successCount}/${smsList.length} successful`);

    return {
      success: successCount === smsList.length,
      results
    };
  }

  async verifyPhoneNumber(phoneNumber: string): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }

      // You can implement phone number verification logic here
      // For now, just check if it's a valid format
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      return phoneRegex.test(phoneNumber);
    } catch (error) {
      logger.error('Failed to verify phone number:', error);
      return false;
    }
  }
} 