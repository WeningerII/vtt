/**
 * Notification API routes
 */
import { Router, Request, Response } from 'express';
import { logger } from '@vtt/logging';
import { z } from 'zod';
import { NotificationManager } from '../NotificationManager';
import { UserManager } from '../UserManager';
import { authenticateUser } from './middleware/auth';

// Validation schemas
const updatePreferencesSchema = z.object({
  email: z.object({
    enabled: z.boolean(),
    account: z.boolean().optional(),
    game: z.boolean().optional(),
    billing: z.boolean().optional(),
    system: z.boolean().optional(),
    marketing: z.boolean().optional()
  }).optional(),
  push: z.object({
    enabled: z.boolean(),
    account: z.boolean().optional(),
    game: z.boolean().optional(),
    billing: z.boolean().optional(),
    system: z.boolean().optional()
  }).optional(),
  inApp: z.object({
    enabled: z.boolean(),
    account: z.boolean().optional(),
    game: z.boolean().optional(),
    billing: z.boolean().optional(),
    system: z.boolean().optional()
  }).optional()
});

const sendInviteSchema = z.object({
  emails: z.array(z.string().email()).max(10),
  gameId: z.string(),
  message: z.string().max(500).optional()
});

const markAsReadSchema = z.object({
  notificationIds: z.array(z.string()).max(100)
});

export class NotificationRoutes {
  private router: Router;
  private notificationManager: NotificationManager;
  private userManager: UserManager;

  constructor(notificationManager: NotificationManager, userManager: UserManager) {
    this.router = Router();
    this.notificationManager = notificationManager;
    this.userManager = userManager;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // All notification routes require authentication
    this.router.use(authenticateUser(this.userManager));

    // Notification preferences
    this.router.get('/preferences', this.getPreferences.bind(this));
    this.router.put('/preferences', this.updatePreferences.bind(this));

    // In-app notifications
    this.router.get('/in-app', this.getInAppNotifications.bind(this));
    this.router.get('/in-app/unread-count', this.getUnreadCount.bind(this));
    this.router.post('/in-app/mark-read', this.markNotificationsAsRead.bind(this));
    this.router.post('/in-app/:notificationId/read', this.markNotificationAsRead.bind(this));
    this.router.delete('/in-app/:notificationId', this.deleteNotification.bind(this));
    this.router.post('/in-app/clear-all', this.clearAllNotifications.bind(this));

    // Game invitations
    this.router.post('/invites/send', this.sendGameInvites.bind(this));

    // Email management
    this.router.post('/email/test', this.sendTestEmail.bind(this));
    this.router.get('/email/unsubscribe', this.handleUnsubscribe.bind(this));
    this.router.post('/email/resubscribe', this.handleResubscribe.bind(this));

    // Push notification management
    this.router.post('/push/register-device', this.registerPushDevice.bind(this));
    this.router.delete('/push/device/:deviceId', this.unregisterPushDevice.bind(this));
    this.router.post('/push/test', this.sendTestPush.bind(this));

    // Notification history and analytics
    this.router.get('/history', this.getNotificationHistory.bind(this));
    this.router.get('/analytics', this.getNotificationAnalytics.bind(this));
  }

  private async getPreferences(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      
      const preferences = this.notificationManager.getUserPreferences(user.id);

      res.json({
        success: true,
        preferences
      });
    } catch (error) {
      logger.error('Get preferences error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async updatePreferences(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const data = updatePreferencesSchema.parse(req.body);

      await this.notificationManager.updateUserPreferences(user.id, data);

      res.json({
        success: true,
        message: 'Preferences updated successfully'
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      
      logger.error('Update preferences error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getInAppNotifications(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const includeRead = req.query.includeRead === 'true';
      const limit = parseInt(req.query.limit as string) || 50;

      const notifications = this.notificationManager.getInAppNotifications(user.id, includeRead)
        .slice(0, limit);

      res.json({
        success: true,
        notifications
      });
    } catch (error) {
      logger.error('Get in-app notifications error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      
      const count = this.notificationManager.getUnreadCount(user.id);

      res.json({
        success: true,
        count
      });
    } catch (error) {
      logger.error('Get unread count error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async markNotificationsAsRead(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const data = markAsReadSchema.parse(req.body);

      for (const notificationId of data.notificationIds) {
        await this.notificationManager.markAsRead(user.id, notificationId);
      }

      res.json({
        success: true,
        message: `Marked ${data.notificationIds.length} notifications as read`
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      
      logger.error('Mark notifications as read error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async markNotificationAsRead(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { notificationId  } = req.params;

      await this.notificationManager.markAsRead(user.id, notificationId);

      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (error) {
      logger.error('Mark notification as read error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async deleteNotification(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { notificationId  } = req.params;

      await this.notificationManager.deleteInAppNotification(user.id, notificationId);

      res.json({
        success: true,
        message: 'Notification deleted'
      });
    } catch (error) {
      logger.error('Delete notification error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async clearAllNotifications(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const onlyRead = req.query.onlyRead === 'true';

      await this.notificationManager.clearInAppNotifications(user.id, onlyRead);

      res.json({
        success: true,
        message: onlyRead ? 'Read notifications cleared' : 'All notifications cleared'
      });
    } catch (error) {
      logger.error('Clear notifications error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async sendGameInvites(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const data = sendInviteSchema.parse(req.body);

      const results = [];
      
      for (const email of data.emails) {
        try {
          await this.notificationManager.sendGameInvite(
            user.id,
            email,
            data.gameId,
            data.message
          );
          results.push({ email, success: true });
        } catch (error) {
          results.push({ email, success: false, error: error.message });
        }
      }

      res.json({
        success: true,
        results,
        sent: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      
      logger.error('Send game invites error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async sendTestEmail(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;

      await this.notificationManager.sendEmail(
        user.id,
        'test-email',
        {
          userName: `${user.firstName} ${user.lastName}`,
          testTime: new Date().toISOString()
        }
      );

      res.json({
        success: true,
        message: 'Test email sent'
      });
    } catch (error) {
      logger.error('Send test email error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleUnsubscribe(req: Request, res: Response): Promise<void> {
    try {
      const { userId,  category  } = req.query;

      if (!userId) {
        res.status(400).json({ error: 'User ID required' });
        return;
      }

      const preferences = this.notificationManager.getUserPreferences(userId as string);
      
      if (category && typeof category === 'string') {
        // Unsubscribe from specific category
        if (preferences.email[category as keyof typeof preferences.email] !== undefined) {
          preferences.email[category as keyof typeof preferences.email] = false;
        }
      } else {
        // Unsubscribe from all emails
        preferences.email.enabled = false;
      }

      await this.notificationManager.updateUserPreferences(userId as string, { email: preferences.email });

      res.json({
        success: true,
        message: 'Successfully unsubscribed'
      });
    } catch (error) {
      logger.error('Unsubscribe error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleResubscribe(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { category  } = req.body;

      const preferences = this.notificationManager.getUserPreferences(user.id);
      
      if (category && typeof category === 'string') {
        // Resubscribe to specific category
        if (preferences.email[category as keyof typeof preferences.email] !== undefined) {
          preferences.email[category as keyof typeof preferences.email] = true;
        }
      } else {
        // Resubscribe to all emails
        preferences.email.enabled = true;
      }

      await this.notificationManager.updateUserPreferences(user.id, { email: preferences.email });

      res.json({
        success: true,
        message: 'Successfully resubscribed'
      });
    } catch (error) {
      logger.error('Resubscribe error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async registerPushDevice(req: Request, res: Response): Promise<void> {
    try {
      const _user = (req as any).user;
      const { deviceToken,  deviceType  } = req.body;

      if (!deviceToken || !deviceType) {
        res.status(400).json({ error: 'Device token and type required' });
        return;
      }

      // Store device token for push notifications
      // This would typically be stored in a database
      
      res.json({
        success: true,
        message: 'Device registered for push notifications'
      });
    } catch (error) {
      logger.error('Register push device error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async unregisterPushDevice(req: Request, res: Response): Promise<void> {
    try {
      const _user = (req as any).user;
      const { _deviceId  } = req.params;

      // Remove device token from database
      
      res.json({
        success: true,
        message: 'Device unregistered from push notifications'
      });
    } catch (error) {
      logger.error('Unregister push device error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async sendTestPush(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;

      await this.notificationManager.sendPush(
        user.id,
        'Test Notification',
        'This is a test push notification',
        {
          icon: '/icon-192x192.png'
        }
      );

      res.json({
        success: true,
        message: 'Test push notification sent'
      });
    } catch (error) {
      logger.error('Send test push error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getNotificationHistory(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const type = req.query.type as string;

      const history = await this.notificationManager.getNotificationHistory(
        user.id,
        { limit, offset, type }
      );

      res.json({
        success: true,
        history
      });
    } catch (error) {
      logger.error('Get notification history error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getNotificationAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const analytics = await this.notificationManager.getNotificationAnalytics(
        user.id,
        startDate,
        endDate
      );

      res.json({
        success: true,
        analytics
      });
    } catch (error) {
      logger.error('Get notification analytics error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}
