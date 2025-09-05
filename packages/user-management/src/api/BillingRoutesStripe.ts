/**
 * Billing API routes with direct Stripe integration - cleaner implementation
 */
import { Router, Request, Response } from "express";
import { logger } from "@vtt/logging";
import { z } from "zod";
import { StripeService } from "../services/StripeService";
import { UserManager } from "../UserManager";
import { authenticateUser } from "./middleware/auth";
import Stripe from "stripe";

// Validation schemas
const createSubscriptionSchema = z.object({
  priceId: z.string(),
  paymentMethodId: z.string().optional(),
});

const updateSubscriptionSchema = z.object({
  priceId: z.string().optional(),
  cancel_at_period_end: z.boolean().optional(),
});

const addPaymentMethodSchema = z.object({
  paymentMethodId: z.string(),
});

export class BillingRoutesStripe {
  private router: Router;

  constructor(
    private stripeService: StripeService,
    private userManager: UserManager
  ) {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // All billing routes require authentication except webhook
    this.router.post('/webhook', this.handleWebhook.bind(this));
    
    // Apply auth middleware to all other routes
    this.router.use(authenticateUser(this.userManager));

    // Subscription management
    this.router.get("/subscription", this.getSubscription.bind(this));
    this.router.post("/subscription", this.createSubscription.bind(this));
    this.router.put("/subscription/:subscriptionId", this.updateSubscription.bind(this));
    this.router.delete("/subscription/:subscriptionId", this.cancelSubscription.bind(this));
    this.router.post("/subscription/:subscriptionId/reactivate", this.reactivateSubscription.bind(this));

    // Payment methods
    this.router.get("/payment-methods", this.getPaymentMethods.bind(this));
    this.router.post("/payment-methods", this.addPaymentMethod.bind(this));
    this.router.delete("/payment-methods/:paymentMethodId", this.removePaymentMethod.bind(this));
    this.router.put("/payment-methods/:paymentMethodId/default", this.setDefaultPaymentMethod.bind(this));

    // Invoices
    this.router.get("/invoices", this.getInvoices.bind(this));
    this.router.get("/invoices/:invoiceId", this.getInvoice.bind(this));
    this.router.post("/invoices/:invoiceId/pay", this.retryInvoicePayment.bind(this));
    this.router.get("/invoices/:invoiceId/pdf", this.getInvoicePDF.bind(this));

    // Available plans/prices
    this.router.get("/prices", this.getPrices.bind(this));
    this.router.get("/products", this.getProducts.bind(this));

    // Billing portal
    this.router.post("/portal-session", this.createPortalSession.bind(this));
  }

  getRouter(): Router {
    return this.router;
  }

  private async getSubscription(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      
      // Get user's customer ID from database
      const userRecord = this.userManager.getUser(user.id);
      if (!userRecord || !userRecord.subscriptionId) {
        res.json({ subscription: null });
        return;
      }

      // Get subscription directly using stored subscription ID
      let subscription: Stripe.Subscription | null = null;
      if (userRecord.subscriptionId) {
        try {
          subscription = await this.stripeService.getSubscription(userRecord.subscriptionId);
        } catch (error) {
          logger.error('Error fetching subscription', { error: error instanceof Error ? error.message : String(error) });
        }
      }

      res.json({ subscription });
    } catch (error) {
      logger.error('Error getting subscription:', { error: error instanceof Error ? error.message : String(error) });
      if (this.stripeService.isStripeError(error)) {
        const { message } = this.stripeService.handleStripeError(error);
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  private async createSubscription(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const data = createSubscriptionSchema.parse(req.body);

      // Get or create Stripe customer
      const userRecord = this.userManager.getUser(user.id);
      if (!userRecord) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Create customer (we'll store the subscription ID in the user record)
      const customerName = userRecord.firstName && userRecord.lastName ? 
        `${userRecord.firstName} ${userRecord.lastName}` : undefined;
      const customer = await this.stripeService.createCustomer(
        userRecord.email,
        customerName
      );
      const customerId = customer.id;

      // Create subscription
      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: data.priceId }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      };

      if (data.paymentMethodId) {
        await this.stripeService.attachPaymentMethod(data.paymentMethodId, customerId);
        subscriptionParams.default_payment_method = data.paymentMethodId;
      }

      const subscription = await this.stripeService.createSubscription(subscriptionParams);

      // Update user record with subscription ID
      this.userManager.updateSubscription(
        user.id,
        'basic', // Default tier - you may want to determine this from the price
        subscription.id
      );

      res.json({ 
        subscription,
        clientSecret: subscription.latest_invoice && 
          typeof subscription.latest_invoice === 'object' &&
          'payment_intent' in subscription.latest_invoice && 
          subscription.latest_invoice.payment_intent &&
          typeof subscription.latest_invoice.payment_intent === 'object' &&
          'client_secret' in subscription.latest_invoice.payment_intent ?
          subscription.latest_invoice.payment_intent.client_secret : undefined
      });
    } catch (error) {
      logger.error('Error creating subscription:', { error: error instanceof Error ? error.message : String(error) });
      if (this.stripeService.isStripeError(error)) {
        const { message } = this.stripeService.handleStripeError(error);
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  private async updateSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { subscriptionId } = req.params;
      if (!subscriptionId) {
        res.status(400).json({ error: 'Subscription ID is required' });
        return;
      }
      const data = updateSubscriptionSchema.parse(req.body);

      const updateParams: Stripe.SubscriptionUpdateParams = {};
      
      if (data.priceId) {
        // Update the subscription items
        const subscription = await this.stripeService.getSubscription(subscriptionId);
        const currentItem = subscription.items.data[0];
        if (!currentItem) {
          res.status(400).json({ error: 'No subscription items found' });
          return;
        }
        
        updateParams.items = [{
          id: currentItem.id,
          price: data.priceId,
        }];
      }

      if (typeof data.cancel_at_period_end === 'boolean') {
        updateParams.cancel_at_period_end = data.cancel_at_period_end;
      }

      const subscription = await this.stripeService.updateSubscription(subscriptionId, updateParams);
      res.json({ subscription });
    } catch (error) {
      logger.error('Error updating subscription:', { error: error instanceof Error ? error.message : String(error) });
      if (this.stripeService.isStripeError(error)) {
        const { message } = this.stripeService.handleStripeError(error);
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  private async cancelSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { subscriptionId } = req.params;
      if (!subscriptionId) {
        res.status(400).json({ error: 'Subscription ID is required' });
        return;
      }
      const { immediate } = req.body;

      const subscription = await this.stripeService.cancelSubscription(subscriptionId, immediate);
      res.json({ subscription });
    } catch (error) {
      logger.error('Error cancelling subscription:', { error: error instanceof Error ? error.message : String(error) });
      if (this.stripeService.isStripeError(error)) {
        const { message } = this.stripeService.handleStripeError(error);
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  private async reactivateSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { subscriptionId } = req.params;
      if (!subscriptionId) {
        res.status(400).json({ error: 'Subscription ID is required' });
        return;
      }
      const subscription = await this.stripeService.reactivateSubscription(subscriptionId);
      res.json({ subscription });
    } catch (error) {
      logger.error('Error reactivating subscription:', { error: error instanceof Error ? error.message : String(error) });
      if (this.stripeService.isStripeError(error)) {
        const { message } = this.stripeService.handleStripeError(error);
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  private async getPaymentMethods(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const userRecord = this.userManager.getUser(user.id);
      
      if (!userRecord?.subscriptionId) {
        res.json({ paymentMethods: [] });
        return;
      }

      // Get subscription to find customer ID
      const subscription = await this.stripeService.getSubscription(userRecord.subscriptionId);
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
      const paymentMethods = await this.stripeService.listPaymentMethods(customerId);
      res.json({ paymentMethods });
    } catch (error) {
      logger.error('Error getting payment methods:', { error: error instanceof Error ? error.message : String(error) });
      if (this.stripeService.isStripeError(error)) {
        const { message } = this.stripeService.handleStripeError(error);
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  private async addPaymentMethod(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const data = addPaymentMethodSchema.parse(req.body);
      const userRecord = this.userManager.getUser(user.id);
      
      if (!userRecord?.subscriptionId) {
        res.status(400).json({ error: 'No subscription found' });
        return;
      }

      // Get subscription to find customer ID
      const subscription = await this.stripeService.getSubscription(userRecord.subscriptionId);
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
      const paymentMethod = await this.stripeService.attachPaymentMethod(
        data.paymentMethodId, 
        customerId
      );
      res.json({ paymentMethod });
    } catch (error) {
      logger.error('Error adding payment method:', { error: error instanceof Error ? error.message : String(error) });
      if (this.stripeService.isStripeError(error)) {
        const { message } = this.stripeService.handleStripeError(error);
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  private async removePaymentMethod(req: Request, res: Response): Promise<void> {
    try {
      const { paymentMethodId } = req.params;
      if (!paymentMethodId) {
        res.status(400).json({ error: 'Payment method ID is required' });
        return;
      }
      const paymentMethod = await this.stripeService.detachPaymentMethod(paymentMethodId);
      res.json({ paymentMethod });
    } catch (error) {
      logger.error('Error removing payment method:', { error: error instanceof Error ? error.message : String(error) });
      if (this.stripeService.isStripeError(error)) {
        const { message } = this.stripeService.handleStripeError(error);
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  private async setDefaultPaymentMethod(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { paymentMethodId } = req.body;
      const userRecord = this.userManager.getUser(user.id);
      
      if (!userRecord?.subscriptionId) {
        res.status(400).json({ error: 'No active subscription found' });
        return;
      }
      
      if (!paymentMethodId) {
        res.status(400).json({ error: 'Payment method ID is required' });
        return;
      }

      // Get subscription to find customer ID
      const subscription = await this.stripeService.getSubscription(userRecord.subscriptionId);
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
      const customer = await this.stripeService.setDefaultPaymentMethod(
        customerId,
        paymentMethodId
      );
      res.json({ customer });
    } catch (error) {
      logger.error('Error setting default payment method:', { error: error instanceof Error ? error.message : String(error) });
      if (this.stripeService.isStripeError(error)) {
        const { message } = this.stripeService.handleStripeError(error);
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  private async getInvoices(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const userRecord = this.userManager.getUser(user.id);
      
      if (!userRecord?.subscriptionId) {
        res.json({ invoices: [] });
        return;
      }

      // Get subscription to find customer ID
      const subscription = await this.stripeService.getSubscription(userRecord.subscriptionId);
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const invoices = await this.stripeService.listInvoices(customerId, limit);
      res.json({ invoices });
    } catch (error) {
      logger.error('Error getting invoices:', { error: error instanceof Error ? error.message : String(error) });
      if (this.stripeService.isStripeError(error)) {
        const { message } = this.stripeService.handleStripeError(error);
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  private async getInvoice(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId } = req.params;
      if (!invoiceId) {
        res.status(400).json({ error: 'Invoice ID is required' });
        return;
      }
      const invoice = await this.stripeService.getInvoice(invoiceId);
      res.json({ invoice });
    } catch (error) {
      logger.error('Error getting invoice:', { error: error instanceof Error ? error.message : String(error) });
      if (this.stripeService.isStripeError(error)) {
        const { message } = this.stripeService.handleStripeError(error);
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  private async retryInvoicePayment(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId } = req.params;
      if (!invoiceId) {
        res.status(400).json({ error: 'Invoice ID is required' });
        return;
      }
      const invoice = await this.stripeService.retryInvoice(invoiceId);
      res.json({ invoice });
    } catch (error) {
      logger.error('Error retrying invoice payment:', { error: error instanceof Error ? error.message : String(error) });
      if (this.stripeService.isStripeError(error)) {
        const { message } = this.stripeService.handleStripeError(error);
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  private async getInvoicePDF(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId } = req.params;
      if (!invoiceId) {
        res.status(400).json({ error: 'Invoice ID is required' });
        return;
      }
      const pdfBuffer = await this.stripeService.downloadInvoicePDF(invoiceId);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoiceId}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      logger.error('Error getting invoice PDF:', { error: error instanceof Error ? error.message : String(error) });
      if (this.stripeService.isStripeError(error)) {
        const { message } = this.stripeService.handleStripeError(error);
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  private async getPrices(req: Request, res: Response): Promise<void> {
    try {
      const productId = req.query.product as string;
      const prices = await this.stripeService.listPrices(productId);
      res.json({ prices });
    } catch (error) {
      logger.error('Error getting prices:', { error: error instanceof Error ? error.message : String(error) });
      if (this.stripeService.isStripeError(error)) {
        const { message } = this.stripeService.handleStripeError(error);
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  private async getProducts(req: Request, res: Response): Promise<void> {
    try {
      const products = await this.stripeService.listProducts();
      res.json({ products });
    } catch (error) {
      logger.error('Error getting products:', { error: error instanceof Error ? error.message : String(error) });
      if (this.stripeService.isStripeError(error)) {
        const { message } = this.stripeService.handleStripeError(error);
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  private async createPortalSession(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { returnUrl } = req.body;
      const userRecord = this.userManager.getUser(user.id);
      
      if (!userRecord?.subscriptionId) {
        res.status(400).json({ error: 'No subscription found' });
        return;
      }

      // Get subscription to find customer ID
      const subscription = await this.stripeService.getSubscription(userRecord.subscriptionId);
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
      const session = await this.stripeService.createPortalSession(
        customerId,
        returnUrl || `${req.protocol}://${req.get('host')}/dashboard`
      );
      res.json({ url: session.url });
    } catch (error) {
      logger.error('Error creating portal session:', { error: error instanceof Error ? error.message : String(error) });
      if (this.stripeService.isStripeError(error)) {
        const { message } = this.stripeService.handleStripeError(error);
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  private async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const payload = req.body;

      const event = this.stripeService.verifyWebhookSignature(payload, signature);

      // Handle different webhook events
      switch (event.type) {
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
        default:
          logger.info('Unhandled webhook event:', { eventType: event.type });
      }

      res.json({ received: true });
    } catch (error) {
      logger.error('Webhook error:', { error: error instanceof Error ? error.message : String(error) });
      res.status(400).json({ error: 'Webhook error' });
    }
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    logger.info('Invoice payment succeeded', { invoiceId: invoice.id, customerId: invoice.customer });
    // Add your business logic here
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    logger.info('Invoice payment failed', { invoiceId: invoice.id, customerId: invoice.customer });
    // Add your business logic here (e.g., send notification, update user status)
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    logger.info('Subscription updated', { subscriptionId: subscription.id, status: subscription.status });
    // Add your business logic here
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    logger.info('Subscription deleted', { subscriptionId: subscription.id });
    // Add your business logic here (e.g., revoke access, send notification)
  }
}
