/**
 * Billing API routes
 */
import { Router, Request, Response } from 'express';
import { logger } from '@vtt/logging';
import { z } from 'zod';
import { BillingManager } from '../BillingManager';
import { UserManager } from '../UserManager';
import { authenticateUser } from './middleware/auth';

// Validation schemas
const createSubscriptionSchema = z.object({
  planId: z.string(),
  paymentMethodId: z.string()
});

const updateSubscriptionSchema = z.object({
  planId: z.string()
});

const addPaymentMethodSchema = z.object({
  paymentMethodId: z.string(),
  setAsDefault: z.boolean().optional()
});

const updatePaymentMethodSchema = z.object({
  billingAddress: z.object({
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    state: z.string().optional(),
    postalCode: z.string(),
    country: z.string()
  }).optional()
});

export class BillingRoutes {
  private router: Router;
  private billingManager: BillingManager;
  private userManager: UserManager;

  constructor(billingManager: BillingManager, userManager: UserManager) {
    this.router = Router();
    this.billingManager = billingManager;
    this.userManager = userManager;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // All billing routes require authentication
    this.router.use(authenticateUser(this.userManager));

    // Subscription management
    this.router.get('/subscription', this.getSubscription.bind(this));
    this.router.post('/subscription', this.createSubscription.bind(this));
    this.router.put('/subscription', this.updateSubscription.bind(this));
    this.router.delete('/subscription', this.cancelSubscription.bind(this));
    this.router.post('/subscription/reactivate', this.reactivateSubscription.bind(this));

    // Payment methods
    this.router.get('/payment-methods', this.getPaymentMethods.bind(this));
    this.router.post('/payment-methods', this.addPaymentMethod.bind(this));
    this.router.put('/payment-methods/:paymentMethodId', this.updatePaymentMethod.bind(this));
    this.router.delete('/payment-methods/:paymentMethodId', this.removePaymentMethod.bind(this));
    this.router.post('/payment-methods/:paymentMethodId/default', this.setDefaultPaymentMethod.bind(this));

    // Invoices and billing history
    this.router.get('/invoices', this.getInvoices.bind(this));
    this.router.get('/invoices/:invoiceId', this.getInvoice.bind(this));
    this.router.get('/invoices/:invoiceId/download', this.downloadInvoice.bind(this));
    this.router.post('/invoices/:invoiceId/retry', this.retryInvoicePayment.bind(this));

    // Usage tracking
    this.router.get('/usage', this.getUsage.bind(this));
    this.router.get('/usage/current-period', this.getCurrentPeriodUsage.bind(this));

    // Available plans
    this.router.get('/plans', this.getAvailablePlans.bind(this));
    this.router.get('/plans/:planId', this.getPlan.bind(this));

    // Billing portal
    this.router.post('/portal-session', this.createPortalSession.bind(this));

    // Webhook endpoint (no auth required)
    this.router.post('/webhook', this.handleWebhook.bind(this));
  }

  private async getSubscription(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      
      const subscription = await this.billingManager.getSubscription(user.id);
      
      if (!subscription) {
        res.json({ success: true, subscription: null });
        return;
      }

      res.json({
        success: true,
        subscription: {
          id: subscription.id,
          userId: subscription.userId,
          planId: subscription.planId,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          createdAt: subscription.createdAt,
          updatedAt: subscription.updatedAt
        }
      });
    } catch (error) {
      logger.error('Get subscription error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async createSubscription(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const data = createSubscriptionSchema.parse(req.body);

      const result = await this.billingManager.createSubscription(
        user.id,
        data.planId,
        data.paymentMethodId
      );

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.status(201).json({
        success: true,
        subscription: result.subscription
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      
      logger.error('Create subscription error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async updateSubscription(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const data = updateSubscriptionSchema.parse(req.body);

      const result = await this.billingManager.updateSubscription(user.id, data.planId);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({
        success: true,
        subscription: result.subscription
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      
      logger.error('Update subscription error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async cancelSubscription(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const immediate = req.query.immediate === 'true';

      const result = await this.billingManager.cancelSubscription(user.id, immediate);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({
        success: true,
        subscription: result.subscription
      });
    } catch (error) {
      logger.error('Cancel subscription error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async reactivateSubscription(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;

      const result = await this.billingManager.reactivateSubscription(user.id);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({
        success: true,
        subscription: result.subscription
      });
    } catch (error) {
      logger.error('Reactivate subscription error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getPaymentMethods(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;

      const paymentMethods = await this.billingManager.getPaymentMethods(user.id);

      res.json({
        success: true,
        paymentMethods: paymentMethods.map(pm => ({
          id: pm.id,
          type: pm.type,
          card: pm.card,
          isDefault: pm.isDefault,
          createdAt: pm.createdAt
        }))
      });
    } catch (error) {
      logger.error('Get payment methods error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async addPaymentMethod(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const data = addPaymentMethodSchema.parse(req.body);

      const result = await this.billingManager.addPaymentMethod(
        user.id,
        data.paymentMethodId,
        data.setAsDefault
      );

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.status(201).json({
        success: true,
        paymentMethod: result.paymentMethod
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      
      logger.error('Add payment method error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async updatePaymentMethod(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { paymentMethodId  } = req.params;
      const data = updatePaymentMethodSchema.parse(req.body);

      const result = await this.billingManager.updatePaymentMethod(
        user.id,
        paymentMethodId,
        data
      );

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({
        success: true,
        paymentMethod: result.paymentMethod
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      
      logger.error('Update payment method error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async removePaymentMethod(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { paymentMethodId  } = req.params;

      const result = await this.billingManager.removePaymentMethod(user.id, paymentMethodId);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('Remove payment method error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async setDefaultPaymentMethod(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { paymentMethodId  } = req.params;

      const result = await this.billingManager.setDefaultPaymentMethod(user.id, paymentMethodId);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('Set default payment method error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getInvoices(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const invoices = await this.billingManager.getInvoices(user.id, limit, offset);

      res.json({
        success: true,
        invoices: invoices.map(invoice => ({
          id: invoice.id,
          subscriptionId: invoice.subscriptionId,
          amount: invoice.amount,
          currency: invoice.currency,
          status: invoice.status,
          periodStart: invoice.periodStart,
          periodEnd: invoice.periodEnd,
          dueDate: invoice.dueDate,
          createdAt: invoice.createdAt
        }))
      });
    } catch (error) {
      logger.error('Get invoices error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getInvoice(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { invoiceId  } = req.params;

      const invoice = await this.billingManager.getInvoice(user.id, invoiceId);

      if (!invoice) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      res.json({
        success: true,
        invoice
      });
    } catch (error) {
      logger.error('Get invoice error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async downloadInvoice(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { invoiceId  } = req.params;

      const pdfBuffer = await this.billingManager.getInvoicePDF(user.id, invoiceId);

      if (!pdfBuffer) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoiceId}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      logger.error('Download invoice error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async retryInvoicePayment(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { invoiceId  } = req.params;

      const result = await this.billingManager.retryInvoicePayment(user.id, invoiceId);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('Retry invoice payment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getUsage(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const usage = await this.billingManager.getUsage(user.id, startDate, endDate);

      res.json({
        success: true,
        usage
      });
    } catch (error) {
      logger.error('Get usage error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getCurrentPeriodUsage(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;

      const usage = await this.billingManager.getCurrentPeriodUsage(user.id);

      res.json({
        success: true,
        usage
      });
    } catch (error) {
      logger.error('Get current period usage error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getAvailablePlans(req: Request, res: Response): Promise<void> {
    try {
      const plans = await this.billingManager.getAvailablePlans();

      res.json({
        success: true,
        plans: plans.map(plan => ({
          id: plan.id,
          name: plan.name,
          tier: plan.tier,
          price: plan.price,
          currency: plan.currency,
          interval: plan.interval,
          features: plan.features,
          limits: plan.limits,
          active: plan.active
        }))
      });
    } catch (error) {
      logger.error('Get available plans error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getPlan(req: Request, res: Response): Promise<void> {
    try {
      const { planId  } = req.params;

      const plan = await this.billingManager.getPlan(planId);

      if (!plan) {
        res.status(404).json({ error: 'Plan not found' });
        return;
      }

      res.json({
        success: true,
        plan
      });
    } catch (error) {
      logger.error('Get plan error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async createPortalSession(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;

      const portalUrl = await this.billingManager.createPortalSession(user.id);

      res.json({
        success: true,
        portalUrl
      });
    } catch (error) {
      logger.error('Create portal session error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.get('stripe-signature');
      
      if (!signature) {
        res.status(400).json({ error: 'Missing signature' });
        return;
      }

      await this.billingManager.handleWebhook(req.body, signature);

      res.json({ received: true });
    } catch (error) {
      logger.error('Webhook error:', error);
      res.status(400).json({ error: 'Webhook processing failed' });
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}
