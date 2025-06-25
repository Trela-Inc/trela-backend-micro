import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

export interface EmailData {
  to: string;
  subject: string;
  content: string;
  metadata?: Record<string, any>;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(data: EmailData): Promise<{ success: boolean; message: string; messageId?: string }> {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: data.to,
        subject: data.subject,
        html: data.content,
        text: this.stripHtml(data.content),
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.info(`Email sent successfully to ${data.to}: ${result.messageId}`);

      return {
        success: true,
        message: 'Email sent successfully',
        messageId: result.messageId
      };
    } catch (error) {
      logger.error('Failed to send email:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  async sendBulkEmail(emails: EmailData[]): Promise<{ success: boolean; results: any[] }> {
    const results = [];

    for (const email of emails) {
      try {
        const result = await this.sendEmail(email);
        results.push({
          to: email.to,
          success: result.success,
          message: result.message,
          messageId: result.messageId
        });
      } catch (error) {
        results.push({
          to: email.to,
          success: false,
          message: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.info(`Bulk email sent: ${successCount}/${emails.length} successful`);

    return {
      success: successCount === emails.length,
      results
    };
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified');
      return true;
    } catch (error) {
      logger.error('Email service connection failed:', error);
      return false;
    }
  }
} 