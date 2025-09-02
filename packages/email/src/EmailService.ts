/**
 * Comprehensive Email Service with Multiple Provider Support
 */
import nodemailer from 'nodemailer';
import { EventEmitter } from 'events';
import { logger } from '@vtt/logging';
import * as path from 'path';
import * as fs from 'fs';

export interface EmailConfig {
  provider: 'smtp' | 'sendgrid' | 'mailgun' | 'ses';
  baseUrl?: string;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  sendgrid?: {
    apiKey: string;
  };
  mailgun?: {
    apiKey: string;
    domain: string;
  };
  ses?: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  };
  defaultFrom: string;
  defaultFromName: string;
  replyTo?: string;
  maxRetries: number;
  retryDelay: number;
}

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
  encoding?: string;
}

export interface EmailTemplate {
  subject: string;
  htmlContent: string;
  textContent: string;
  variables?: Record<string, any>;
}

export interface SendEmailOptions {
  to: EmailAddress | EmailAddress[];
  cc?: EmailAddress | EmailAddress[];
  bcc?: EmailAddress | EmailAddress[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  template?: string;
  templateVariables?: Record<string, any>;
  priority?: 'high' | 'normal' | 'low';
  deliveryTime?: Date;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retryCount?: number;
}

export class EmailService extends EventEmitter {
  private config: EmailConfig;
  private transporter: any;
  private templates = new Map<string, EmailTemplate>();
  private emailQueue: Array<{ options: SendEmailOptions; resolve: Function; reject: Function }> = [];
  private isProcessing = false;

  constructor(config: EmailConfig) {
    super();
    this.config = config;
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter based on provider
   */
  private async initializeTransporter(): Promise<void> {
    try {
      switch (this.config.provider) {
        case 'smtp':
          this.transporter = nodemailer.createTransport({
            host: this.config.smtp!.host,
            port: this.config.smtp!.port,
            secure: this.config.smtp!.secure,
            auth: this.config.smtp!.auth,
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
          });
          break;

        case 'sendgrid':
          this.transporter = nodemailer.createTransport({
            service: 'SendGrid',
            auth: {
              user: 'apikey',
              pass: this.config.sendgrid!.apiKey,
            },
          });
          break;

        case 'mailgun':
          const mg = require('nodemailer-mailgun-transport');
          this.transporter = nodemailer.createTransport(mg({
            auth: {
              api_key: this.config.mailgun!.apiKey,
              domain: this.config.mailgun!.domain,
            },
          }));
          break;

        case 'ses':
          const aws = require('aws-sdk');
          this.transporter = nodemailer.createTransport({
            SES: new aws.SES({
              accessKeyId: this.config.ses!.accessKeyId,
              secretAccessKey: this.config.ses!.secretAccessKey,
              region: this.config.ses!.region,
            }),
          });
          break;

        default:
          throw new Error(`Unsupported email provider: ${this.config.provider}`);
      }

      // Verify transporter
      await this.transporter.verify();
      logger.info(`Email service initialized with provider: ${this.config.provider}`);

    } catch (error) {
      logger.error('Failed to initialize email transporter:', error);
      throw error;
    }
  }

  /**
   * Register email template
   */
  registerTemplate(name: string, template: EmailTemplate): void {
    this.templates.set(name, template);
    logger.debug(`Email template registered: ${name}`);
  }

  /**
   * Send email with comprehensive options
   */
  async sendEmail(options: SendEmailOptions): Promise<EmailResult> {
    return new Promise((resolve, reject) => {
      this.emailQueue.push({ options, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process email queue with retry logic
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.emailQueue.length === 0) return;

    this.isProcessing = true;

    while (this.emailQueue.length > 0) {
      const { options, resolve, reject } = this.emailQueue.shift()!;

      try {
        const result = await this.sendEmailInternal(options);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Internal email sending with retry logic
   */
  private async sendEmailInternal(options: SendEmailOptions, retryCount = 0): Promise<EmailResult> {
    try {
      // Prepare email content
      const emailContent = await this.prepareEmailContent(options);

      // Send email
      const result = await this.transporter.sendMail(emailContent);

      this.emit('emailSent', {
        messageId: result.messageId,
        to: options.to,
        subject: options.subject,
        retryCount,
      });

      return {
        success: true,
        messageId: result.messageId,
        retryCount,
      };

    } catch (error) {
      logger.error(`Email send failed (attempt ${retryCount + 1}):`, error);

      // Retry logic
      if (retryCount < this.config.maxRetries) {
        await this.delay(this.config.retryDelay * Math.pow(2, retryCount));
        return await this.sendEmailInternal(options, retryCount + 1);
      }

      this.emit('emailFailed', {
        error,
        to: options.to,
        subject: options.subject,
        finalRetryCount: retryCount,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryCount,
      };
    }
  }

  /**
   * Prepare email content with template support
   */
  private async prepareEmailContent(options: SendEmailOptions): Promise<any> {
    let html = options.html;
    let text = options.text;
    let subject = options.subject;

    // Process template if specified
    if (options.template) {
      const template = this.templates.get(options.template);
      if (!template) {
        throw new Error(`Email template not found: ${options.template}`);
      }

      const variables = { ...template.variables, ...options.templateVariables };
      
      html = this.processTemplate(template.htmlContent, variables);
      text = this.processTemplate(template.textContent, variables);
      subject = this.processTemplate(template.subject, variables);
    }

    // Format recipients
    const formatAddress = (addr: EmailAddress | EmailAddress[]) => {
      if (Array.isArray(addr)) {
        return addr.map(a => a.name ? `${a.name} <${a.email}>` : a.email).join(', ');
      }
      return addr.name ? `${addr.name} <${addr.email}>` : addr.email;
    };

    return {
      from: `${this.config.defaultFromName} <${this.config.defaultFrom}>`,
      to: formatAddress(options.to),
      cc: options.cc ? formatAddress(options.cc) : undefined,
      bcc: options.bcc ? formatAddress(options.bcc) : undefined,
      replyTo: this.config.replyTo,
      subject,
      html,
      text,
      attachments: options.attachments,
      headers: options.headers,
      priority: options.priority,
      date: options.deliveryTime,
    };
  }

  /**
   * Process template variables
   */
  private processTemplate(content: string, variables: Record<string, any>): string {
    let processed = content;
    
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, String(value));
    });

    return processed;
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(to: EmailAddress, token: string, baseUrl: string): Promise<EmailResult> {
    const verificationUrl = `${baseUrl}/auth/verify-email?token=${token}`;
    
    return this.sendEmail({
      to,
      subject: 'Verify your email address',
      template: 'email-verification',
      templateVariables: {
        recipientName: to.name || to.email,
        verificationUrl,
        baseUrl: baseUrl
      }
    });
  }

  /**
   * Send password reset confirmation email
   */
  async sendPasswordResetConfirmation(email: string, username: string): Promise<void> {
    const template = this.templates.get('password-reset');
    if (!template) {
      throw new Error('Password reset template not found');
    }
    
    await this.sendEmail({
      to: { email, name: username },
      subject: 'Password Reset Successful',
      html: template.htmlContent.replace('{{username}}', username),
      text: template.textContent.replace('{{username}}', username)
    });
  }

  /**
   * Send password reset request email
   */
  async sendPasswordResetEmail(email: string, username: string, resetToken: string, resetUrl: string): Promise<void> {
    const templatePath = path.join(__dirname, '../templates', 'password-reset.html');
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    
    const data = {
      username,
      resetUrl: `${resetUrl}?token=${resetToken}`,
      resetToken,
    };

    let html = templateContent;
    Object.keys(data).forEach(key => {
      const placeholder = `{{${key}}}`;
      html = html.replace(new RegExp(placeholder, 'g'), data[key] as string);
    });
    
    const baseUrl = this.config.baseUrl || process.env.BASE_URL || 'http://localhost:3000';
    html = html.replace(/{{baseUrl}}/g, baseUrl);

    await this.sendEmail({
      to: { email, name: username },
      subject: 'Password Reset Request',
      html,
      text: templateContent
        .replace('{{username}}', username)
        .replace('{{resetUrl}}', `${resetUrl}?token=${resetToken}`)
        .replace('{{resetToken}}', resetToken)
    });
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(to: EmailAddress, userData: any): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject: 'Welcome to VTT Platform!',
      template: 'welcome',
      templateVariables: {
        recipientName: userData.firstName || userData.username,
        username: userData.username,
        dashboardUrl: `${this.config.baseUrl || process.env.BASE_URL || 'http://localhost:3000'}/dashboard`
      }
    });
  }

  /**
   * Bulk send emails
   */
  async sendBulkEmails(emails: SendEmailOptions[]): Promise<EmailResult[]> {
    const results = await Promise.allSettled(
      emails.map(email => this.sendEmail(email))
    );

    return results.map(result => 
      result.status === 'fulfilled' 
        ? result.value 
        : { success: false, error: result.reason.message }
    );
  }

  /**
   * Get email delivery statistics
   */
  getStats(): {
    sent: number;
    failed: number;
    queued: number;
  } {
    return {
      sent: this.listenerCount('emailSent'),
      failed: this.listenerCount('emailFailed'),
      queued: this.emailQueue.length,
    };
  }

  /**
   * Test email connectivity
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.transporter.verify();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
