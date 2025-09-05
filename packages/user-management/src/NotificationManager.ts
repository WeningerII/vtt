/**
 * Comprehensive notification system for email and push notifications
 */

import { EventEmitter } from "events";
import { logger } from "@vtt/logging";
import nodemailer, { Transporter } from "nodemailer";
import { UserManager, User } from "./UserManager";

export interface NotificationTemplate {
  id: string;
  name: string;
  type: "email" | "push" | "in_app";
  subject: string;
  htmlTemplate: string;
  textTemplate: string;
  variables: string[];
  category: "account" | "game" | "billing" | "system" | "marketing";
  active: boolean;
}

export interface EmailNotification {
  id: string;
  userId: string;
  templateId: string;
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  status: "pending" | "sent" | "failed" | "bounced";
  sentAt?: Date;
  failureReason?: string;
  opens: number;
  clicks: number;
  createdAt: Date;
}

export interface PushNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  status: "pending" | "sent" | "failed";
  sentAt?: Date;
  failureReason?: string;
  createdAt: Date;
}

export interface InAppNotification {
  id: string;
  userId: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
  read: boolean;
  readAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

export interface NotificationPreferences {
  userId: string;
  email: {
    enabled: boolean;
    gameInvites: boolean;
    gameUpdates: boolean;
    friendRequests: boolean;
    systemUpdates: boolean;
    billing: boolean;
    marketing: boolean;
  };
  push: {
    enabled: boolean;
    gameInvites: boolean;
    gameUpdates: boolean;
    friendRequests: boolean;
    systemUpdates: boolean;
  };
  inApp: {
    enabled: boolean;
    gameInvites: boolean;
    gameUpdates: boolean;
    friendRequests: boolean;
    systemUpdates: boolean;
  };
}

export interface NotificationManagerConfig {
  email: {
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
    from: {
      name: string;
      address: string;
    };
    replyTo?: string;
    unsubscribeUrl?: string;
  };
  push: {
    vapidKeys?: {
      publicKey: string;
      privateKey: string;
    };
    fcm?: {
      serverKey: string;
    };
  };
  templates: NotificationTemplate[];
  retryAttempts: number;
  retryDelay: number;
  batchSize: number;
  rateLimits: {
    emailPerHour: number;
    pushPerHour: number;
  };
}

export class NotificationManager extends EventEmitter {
  private config: NotificationManagerConfig;
  private userManager: UserManager;
  private emailTransporter: Transporter;
  private templates = new Map<string, NotificationTemplate>();
  private emailNotifications = new Map<string, EmailNotification>();
  private pushNotifications = new Map<string, PushNotification>();
  private inAppNotifications = new Map<string, InAppNotification>();
  private preferences = new Map<string, NotificationPreferences>();
  private sendQueue: Array<{ type: "email" | "push"; notificationId: string }> = [];
  private processing = false;

  constructor(config: NotificationManagerConfig, userManager: UserManager) {
    super();
    this.config = config;
    this.userManager = userManager;

    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransport(config.email.smtp);

    // Load templates
    config.templates.forEach((template) => {
      this.templates.set(template.id, template);
    });

    // Start processing queue
    this.startQueueProcessor();
  }

  // Template management
  addTemplate(template: NotificationTemplate): void {
    this.templates.set(template.id, template);
    this.emit("templateAdded", template);
  }

  updateTemplate(templateId: string, updates: Partial<NotificationTemplate>): void {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    Object.assign(template, updates);
    this.emit("templateUpdated", template);
  }

  getTemplate(templateId: string): NotificationTemplate | undefined {
    return this.templates.get(templateId);
  }

  // Notification preferences
  getUserPreferences(userId: string): NotificationPreferences {
    return this.preferences.get(userId) || this.getDefaultPreferences(userId);
  }

  updateUserPreferences(userId: string, updates: Partial<NotificationPreferences>): void {
    const current = this.getUserPreferences(userId);
    const updated = { ...current, ...updates };
    this.preferences.set(userId, updated);
    this.emit("preferencesUpdated", userId, updated);
  }

  private getDefaultPreferences(userId: string): NotificationPreferences {
    return {
      userId,
      email: {
        enabled: true,
        gameInvites: true,
        gameUpdates: true,
        friendRequests: true,
        systemUpdates: true,
        billing: true,
        marketing: false,
      },
      push: {
        enabled: true,
        gameInvites: true,
        gameUpdates: false,
        friendRequests: true,
        systemUpdates: false,
      },
      inApp: {
        enabled: true,
        gameInvites: true,
        gameUpdates: true,
        friendRequests: true,
        systemUpdates: true,
      },
    };
  }

  // Email notifications
  async sendEmail(
    userId: string,
    templateId: string,
    variables: Record<string, any> = {},
    options: {
      to?: string;
      subject?: string;
      priority?: "high" | "normal" | "low";
    } = {},
  ): Promise<string> {
    const user = this.userManager.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const template = this.getTemplate(templateId);
    if (!template || template.type !== "email") {
      throw new Error("Email template not found");
    }

    const preferences = this.getUserPreferences(userId);
    if (!preferences.email.enabled) {
      throw new Error("Email notifications disabled for user");
    }

    // Check category-specific preferences
    if (!this.canSendEmailForCategory(preferences, template.category)) {
      throw new Error(`Email notifications disabled for category: ${template.category}`);
    }

    const notification: EmailNotification = {
      id: this.generateId(),
      userId,
      templateId,
      to: options.to || user.email,
      subject: options.subject || this.renderTemplate(template.subject, variables),
      htmlContent: this.renderTemplate(template.htmlTemplate, variables),
      textContent: this.renderTemplate(template.textTemplate, variables),
      status: "pending",
      opens: 0,
      clicks: 0,
      createdAt: new Date(),
    };

    this.emailNotifications.set(notification.id, notification);
    this.addToQueue("email", notification.id);

    this.emit("emailQueued", notification);
    return notification.id;
  }

  private async sendEmailNotification(notificationId: string): Promise<void> {
    const notification = this.emailNotifications.get(notificationId);
    if (!notification) {
      return;
    }

    try {
      const mailOptions = {
        from: `${this.config.email.from.name} <${this.config.email.from.address}>`,
        to: notification.to,
        subject: notification.subject,
        html: this.addTrackingToEmail(notification.htmlContent, notification.id),
        text: notification.textContent,
        replyTo: this.config.email.replyTo,
        headers: this.config.email.unsubscribeUrl
          ? {
              "List-Unsubscribe": `<${this.config.email.unsubscribeUrl}?userId=${notification.userId}>`,
            }
          : undefined,
      };

      await this.emailTransporter.sendMail(mailOptions);

      notification.status = "sent";
      notification.sentAt = new Date();

      this.emit("emailSent", notification);
    } catch (error) {
      notification.status = "failed";
      notification.failureReason = error instanceof Error ? error.message : "Unknown error";

      this.emit("emailFailed", notification, error);
      throw error;
    }
  }

  // Push notifications
  async sendPush(
    userId: string,
    title: string,
    body: string,
    options: {
      icon?: string;
      badge?: string;
      data?: Record<string, any>;
      priority?: "high" | "normal" | "low";
    } = {},
  ): Promise<string> {
    const user = this.userManager.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const preferences = this.getUserPreferences(userId);
    if (!preferences.push.enabled) {
      throw new Error("Push notifications disabled for user");
    }

    const notification: PushNotification = {
      id: this.generateId(),
      userId,
      title,
      body,
      ...(options.icon && { icon: options.icon }),
      ...(options.badge && { badge: options.badge }),
      ...(options.data && { data: options.data }),
      status: "pending",
      createdAt: new Date(),
    };

    this.pushNotifications.set(notification.id, notification);
    this.addToQueue("push", notification.id);

    this.emit("pushQueued", notification);
    return notification.id;
  }

  private async sendPushNotification(notificationId: string): Promise<void> {
    const notification = this.pushNotifications.get(notificationId);
    if (!notification) {
      return;
    }

    try {
      // This would integrate with FCM, VAPID, or other push services
      // For now, just mark as sent
      notification.status = "sent";
      notification.sentAt = new Date();

      this.emit("pushSent", notification);
    } catch (error) {
      notification.status = "failed";
      notification.failureReason = error instanceof Error ? error.message : "Unknown error";

      this.emit("pushFailed", notification, error);
      throw error;
    }
  }

  // In-app notifications
  async sendInApp(
    userId: string,
    type: InAppNotification["type"],
    title: string,
    message: string,
    options: {
      actionUrl?: string;
      actionText?: string;
      expiresAt?: Date;
    } = {},
  ): Promise<string> {
    const user = this.userManager.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const preferences = this.getUserPreferences(userId);
    if (!preferences.inApp.enabled) {
      throw new Error("In-app notifications disabled for user");
    }

    const notification: InAppNotification = {
      id: this.generateId(),
      userId,
      type,
      title,
      message,
      ...(options.actionUrl && { actionUrl: options.actionUrl }),
      ...(options.actionText && { actionText: options.actionText }),
      read: false,
      ...(options.expiresAt && { expiresAt: options.expiresAt }),
      createdAt: new Date(),
    };

    this.inAppNotifications.set(notification.id, notification);
    this.emit("inAppNotificationCreated", notification);

    return notification.id;
  }

  getInAppNotifications(userId: string, includeRead: boolean = false): InAppNotification[] {
    const now = new Date();
    return Array.from(this.inAppNotifications.values())
      .filter((notification) => {
        if (notification.userId !== userId) {return false;}
        if (!includeRead && notification.read) {return false;}
        if (notification.expiresAt && notification.expiresAt < now) {return false;}
        return true;
      })
      .sort((_a, _b) => _b.createdAt.getTime() - _a.createdAt.getTime());
  }

  markInAppNotificationAsRead(notificationId: string, userId: string): void {
    const notification = this.inAppNotifications.get(notificationId);
    if (!notification || notification.userId !== userId) {
      throw new Error("Notification not found");
    }

    if (!notification.read) {
      notification.read = true;
      notification.readAt = new Date();
      this.emit("inAppNotificationRead", notification);
    }
  }

  // Get unread notification count for user
  getUnreadCount(userId: string): number {
    return Array.from(this.inAppNotifications.values())
      .filter(notification => notification.userId === userId && !notification.read)
      .length;
  }

  // Mark multiple notifications as read
  async markAsRead(userId: string, notificationId?: string): Promise<void> {
    if (notificationId) {
      // Mark specific notification as read
      this.markInAppNotificationAsRead(notificationId, userId);
    } else {
      // Mark all unread notifications as read
      Array.from(this.inAppNotifications.values())
        .filter(n => n.userId === userId && !n.read)
        .forEach(notification => {
          notification.read = true;
          notification.readAt = new Date();
          this.emit("inAppNotificationRead", notification);
        });
    }
  }

  // Delete in-app notification
  async deleteInAppNotification(userId: string, notificationId: string): Promise<void> {
    const notification = this.inAppNotifications.get(notificationId);
    if (!notification || notification.userId !== userId) {
      throw new Error("Notification not found");
    }

    this.inAppNotifications.delete(notificationId);
    this.emit("inAppNotificationDeleted", { notificationId, userId });
  }

  // Clear in-app notifications
  async clearInAppNotifications(userId: string, onlyRead: boolean = false): Promise<void> {
    const toDelete: string[] = [];
    
    for (const [id, notification] of this.inAppNotifications.entries()) {
      if (notification.userId === userId) {
        if (!onlyRead || notification.read) {
          toDelete.push(id);
        }
      }
    }

    toDelete.forEach(id => this.inAppNotifications.delete(id));
    this.emit("inAppNotificationsCleared", { userId, count: toDelete.length, onlyRead });
  }

  // Queue processing
  private addToQueue(type: "email" | "push", notificationId: string): void {
    this.sendQueue.push({ type, notificationId });

    if (!this.processing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.sendQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.sendQueue.length > 0) {
      const batch = this.sendQueue.splice(0, this.config.batchSize);

      await Promise.allSettled(
        batch.map(async ({ type, notificationId }) => {
          try {
            if (type === "email") {
              await this.sendEmailNotification(notificationId);
            } else if (type === "push") {
              await this.sendPushNotification(notificationId);
            }
          } catch (error) {
            logger.error(`Failed to send ${type} notification:`, {
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              type,
              notificationId
            });
          }
        }),
      );

      // Rate limiting delay
      if (this.sendQueue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
      }
    }

    this.processing = false;
  }

  private startQueueProcessor(): void {
    setInterval(() => {
      if (!this.processing && this.sendQueue.length > 0) {
        this.processQueue();
      }
    }, 5000); // Check every 5 seconds
  }

  // Template rendering
  private renderTemplate(template: string, variables: Record<string, any>): string {
    let rendered = template;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
      rendered = rendered.replace(regex, String(value));
    }

    return rendered;
  }

  private addTrackingToEmail(htmlContent: string, notificationId: string): string {
    // Add tracking pixel for open tracking
    const trackingPixel = `<img src="/api/notifications/track/open/${notificationId}" width="1" height="1" style="display:none;" />`;

    // Add click tracking to links
    const trackedContent = htmlContent.replace(
      /<a\s+([^>]*href\s*=\s*["']([^"']+)["'][^>]*)>/gi,
      (match, _attributes, originalUrl) => {
        const trackingUrl = `/api/notifications/track/click/${notificationId}?url=${encodeURIComponent(originalUrl)}`;
        return match.replace(originalUrl, trackingUrl);
      },
    );

    return trackedContent + trackingPixel;
  }

  // Utility methods
  private canSendEmailForCategory(preferences: NotificationPreferences, category: string): boolean {
    switch (category) {
      case "game":
        return preferences.email.gameInvites || preferences.email.gameUpdates;
      case "account":
        return preferences.email.friendRequests;
      case "system":
        return preferences.email.systemUpdates;
      case "billing":
        return preferences.email.billing;
      case "marketing":
        return preferences.email.marketing;
      default:
        return true;
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // Analytics and reporting
  // Get notification history with pagination and filtering
  async getNotificationHistory(userId: string, options: {
    limit?: number;
    offset?: number;
    type?: string;
  } = {}): Promise<{
    notifications: Array<EmailNotification | PushNotification | InAppNotification>;
    total: number;
  }> {
    const { limit = 50, offset = 0, type } = options;
    
    // Combine all notifications for the user
    const allNotifications: Array<EmailNotification | PushNotification | InAppNotification> = [
      ...Array.from(this.emailNotifications.values()).filter(n => n.userId === userId),
      ...Array.from(this.pushNotifications.values()).filter(n => n.userId === userId),
      ...Array.from(this.inAppNotifications.values()).filter(n => n.userId === userId)
    ];

    // Filter by type if specified
    let filteredNotifications = allNotifications;
    if (type) {
      filteredNotifications = allNotifications.filter(n => {
        if (type === 'email') {return 'htmlContent' in n;}
        if (type === 'push') {return 'title' in n && 'body' in n;}
        if (type === 'in_app') {return 'type' in n && 'message' in n;}
        return false;
      });
    }

    // Sort by creation date (newest first)
    filteredNotifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const paginatedNotifications = filteredNotifications.slice(offset, offset + limit);

    return {
      notifications: paginatedNotifications,
      total: filteredNotifications.length
    };
  }

  // Get detailed notification analytics
  async getNotificationAnalytics(userId: string, startDate?: Date, endDate?: Date): Promise<{
    overview: {
      totalSent: number;
      totalDelivered: number;
      totalOpened: number;
      totalClicked: number;
      deliveryRate: number;
      openRate: number;
      clickRate: number;
    };
    byType: {
      email: { sent: number; opened: number; clicked: number; };
      push: { sent: number; delivered: number; };
      inApp: { created: number; read: number; };
    };
    byPeriod: Array<{
      date: string;
      sent: number;
      opened: number;
      clicked: number;
    }>;
  }> {
    // Filter notifications by date range
    const filterByDate = <T extends { createdAt: Date; userId: string }>(notifications: T[]): T[] => {
      return notifications.filter(n => {
        if (startDate && n.createdAt < startDate) {return false;}
        if (endDate && n.createdAt > endDate) {return false;}
        return n.userId === userId;
      });
    };

    const emails = filterByDate(Array.from(this.emailNotifications.values()));
    const pushes = filterByDate(Array.from(this.pushNotifications.values()));
    const inApps = filterByDate(Array.from(this.inAppNotifications.values()));

    // Calculate email metrics
    const emailsSent = emails.filter(e => e.status === 'sent').length;
    const emailsOpened = emails.filter(e => e.opens > 0).length;
    const emailsClicked = emails.filter(e => e.clicks > 0).length;

    // Calculate push metrics
    const pushSent = pushes.filter(p => p.status === 'sent').length;

    // Calculate in-app metrics
    const inAppRead = inApps.filter(n => n.read).length;

    // Calculate overall metrics
    const totalSent = emails.length + pushes.length;
    const totalDelivered = emailsSent + pushSent;
    const totalOpened = emailsOpened;
    const totalClicked = emailsClicked;

    // Generate daily breakdown
    const dailyStats = new Map<string, { sent: number; opened: number; clicked: number }>();
    
    [...emails, ...pushes].forEach(notification => {
      const dateKey = notification.createdAt.toISOString().split('T')[0];
      if (dateKey && !dailyStats.has(dateKey)) {
        dailyStats.set(dateKey, { sent: 0, opened: 0, clicked: 0 });
      }
      const stats = dateKey ? dailyStats.get(dateKey) : null;
      if (stats) {
        stats.sent++;
        
        if ('opens' in notification) {
          if (notification.opens > 0) {stats.opened++;}
          if (notification.clicks > 0) {stats.clicked++;}
        }
      }
    });

    return {
      overview: {
        totalSent,
        totalDelivered,
        totalOpened,
        totalClicked,
        deliveryRate: totalSent > 0 ? totalDelivered / totalSent : 0,
        openRate: totalDelivered > 0 ? totalOpened / totalDelivered : 0,
        clickRate: totalOpened > 0 ? totalClicked / totalOpened : 0
      },
      byType: {
        email: { sent: emailsSent, opened: emailsOpened, clicked: emailsClicked },
        push: { sent: pushSent, delivered: pushSent },
        inApp: { created: inApps.length, read: inAppRead }
      },
      byPeriod: Array.from(dailyStats.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, stats]) => ({ date, ...stats }))
    };
  }

  getNotificationStats(userId?: string): {
    emailsSent: number;
    emailsOpened: number;
    emailsClicked: number;
    pushSent: number;
    inAppCreated: number;
    inAppRead: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
  } {
    const emails = Array.from(this.emailNotifications.values()).filter(
      (n) => !userId || n.userId === userId,
    );

    const pushes = Array.from(this.pushNotifications.values()).filter(
      (n) => !userId || n.userId === userId,
    );

    const inApps = Array.from(this.inAppNotifications.values()).filter(
      (n) => !userId || n.userId === userId,
    );

    const emailsSent = emails.filter((e) => e.status === "sent").length;
    const emailsOpened = emails.filter((e) => e.opens > 0).length;
    const emailsClicked = emails.filter((e) => e.clicks > 0).length;
    const pushSent = pushes.filter((p) => p.status === "sent").length;
    const inAppRead = inApps.filter((n) => n.read).length;

    return {
      emailsSent,
      emailsOpened,
      emailsClicked,
      pushSent,
      inAppCreated: inApps.length,
      inAppRead,
      deliveryRate: emailsSent > 0 ? emailsSent / emails.length : 0,
      openRate: emailsSent > 0 ? emailsOpened / emailsSent : 0,
      clickRate: emailsOpened > 0 ? emailsClicked / emailsOpened : 0,
    };
  }

  // Tracking endpoints (would be handled by API routes)
  trackEmailOpen(notificationId: string): void {
    const notification = this.emailNotifications.get(notificationId);
    if (notification) {
      notification.opens++;
      this.emit("emailOpened", notification);
    }
  }

  trackEmailClick(notificationId: string): void {
    const notification = this.emailNotifications.get(notificationId);
    if (notification) {
      notification.clicks++;
      this.emit("emailClicked", notification);
    }
  }

  // Enhanced sendGameInvite method with proper signature
  async sendGameInvite(
    userId: string,
    recipientEmail: string,
    gameId: string,
    message: string,
  ): Promise<void> {
    const user = this.userManager.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await this.sendEmail(userId, "game-invite", {
      gameTitle: `Game ${gameId}`,
      inviterName: user.firstName || user.username,
      gameUrl: `/games/${gameId}`,
      acceptUrl: `/games/${gameId}?accept=true`,
      declineUrl: `/games/${gameId}?decline=true`,
      message,
      recipientEmail,
    });

    await this.sendPush(
      userId,
      "Game Invitation",
      `${user.firstName || user.username} invited you to play a game`,
      {
        data: { gameId, type: "game_invite" },
      },
    );
  }

  // Bulk operations
  async sendWelcomeEmail(userId: string): Promise<void> {
    const user = this.userManager.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await this.sendEmail(userId, "welcome", {
      firstName: user.firstName || user.username,
      username: user.username,
      loginUrl: "/login",
    });
  }

  async sendPasswordResetEmail(userId: string, resetToken: string): Promise<void> {
    const user = this.userManager.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await this.sendEmail(userId, "password-reset", {
      firstName: user.firstName || user.username,
      resetUrl: `/reset-password?token=${resetToken}`,
      expiresIn: "24 hours",
    });
  }

  async sendEmailVerification(userId: string, verificationToken: string): Promise<void> {
    const user = this.userManager.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await this.sendEmail(userId, "email-verification", {
      firstName: user.firstName || user.username,
      verificationUrl: `/verify-email?token=${verificationToken}`,
    });
  }


  // Cleanup
  async cleanupOldNotifications(days: number = 30): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    // Clean up old email notifications
    for (const [id, notification] of this.emailNotifications.entries()) {
      if (notification.createdAt < cutoff && notification.status !== "pending") {
        this.emailNotifications.delete(id);
      }
    }

    // Clean up old push notifications
    for (const [id, notification] of this.pushNotifications.entries()) {
      if (notification.createdAt < cutoff && notification.status !== "pending") {
        this.pushNotifications.delete(id);
      }
    }

    // Clean up expired in-app notifications
    const now = new Date();
    for (const [id, notification] of this.inAppNotifications.entries()) {
      if (notification.expiresAt && notification.expiresAt < now) {
        this.inAppNotifications.delete(id);
      }
    }

    this.emit("notificationsCleanedUp", { cutoff, current: now });
  }
}
