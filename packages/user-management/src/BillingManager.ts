/**
 * Comprehensive billing and subscription management with Stripe integration
 */

import { EventEmitter } from 'events';
import { logger } from '@vtt/logging';
import type { Buffer } from 'node:buffer';

import Stripe from 'stripe';
import { UserManager, User } from './UserManager';

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: 'free' | 'basic' | 'premium' | 'enterprise';
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  limits: {
    maxCampaigns: number;
    maxPlayersPerGame: number;
    maxStorageGB: number;
    maxAssets: number;
    canUseCustomAssets: boolean;
    canUseAdvancedFeatures: boolean;
  };
  stripeProductId: string;
  stripePriceId: string;
  active: boolean;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: 'active' | 'cancelled' | 'past_due' | 'trialing' | 'incomplete' | 'unpaid';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invoice {
  id: string;
  userId: string;
  subscriptionId: string;
  stripeInvoiceId: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  paidAt?: Date;
  dueDate: Date;
  periodStart: Date;
  periodEnd: Date;
  downloadUrl?: string;
  createdAt: Date;
}

export interface PaymentMethod {
  id: string;
  userId: string;
  stripePaymentMethodId: string;
  type: 'card' | 'bank_account' | 'sepa_debit';
  brand?: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  createdAt: Date;
}

export interface UsageRecord {
  id: string;
  userId: string;
  subscriptionId: string;
  metric: 'storage' | 'campaigns' | 'players' | 'assets';
  quantity: number;
  timestamp: Date;
  period: string; // YYYY-MM format
}

export interface BillingManagerConfig {
  stripe: {
    secretKey: string;
    webhookSecret: string;
    publishableKey: string;
  };
  plans: SubscriptionPlan[];
  trialPeriodDays: number;
  gracePeriodDays: number;
  invoiceSettings: {
    daysUntilDue: number;
    footer?: string;
    customFields?: Array<{
      name: string;
      value: string;
    }>;
  };
}

export class BillingManager extends EventEmitter {
  private config: BillingManagerConfig;
  private stripe: Stripe;
  private userManager: UserManager;
  private subscriptions = new Map<string, Subscription>();
  private invoices = new Map<string, Invoice>();
  private paymentMethods = new Map<string, PaymentMethod>();
  private usageRecords = new Map<string, UsageRecord[]>();

  constructor(config: BillingManagerConfig, userManager: UserManager) {
    super();
    this.config = config;
    this.userManager = userManager;
    this.stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2023-10-16'
    });
  }

  // Customer management
  async createStripeCustomer(user: User): Promise<string> {
    const customer = await this.stripe.customers.create({
      email: user.email,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
      metadata: {
        userId: user.id,
        username: user.username
      }
    });

    this.emit('customerCreated', user, customer);
    return customer.id;
  }

  async getOrCreateStripeCustomer(userId: string): Promise<string> {
    const user = this.userManager.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user already has a customer ID in their subscription
    const userSubscription = Array.from(this.subscriptions.values()).find(s => s.userId === userId);
    if (userSubscription) {
      return userSubscription.stripeCustomerId;
    }

    // Create new customer
    return await this.createStripeCustomer(user);
  }

  // Subscription management
  async createSubscription(
    userId: string,
    planId: string,
    paymentMethodId?: string,
    couponId?: string
  ): Promise<Subscription> {
    const user = this.userManager.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const plan = this.config.plans.find(p => p.id === planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    const customerId = await this.getOrCreateStripeCustomer(userId);

    // Attach payment method if provided
    if (paymentMethodId) {
      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });

      // Set as default payment method
      await this.stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });
    }

    const subscriptionData: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [{
        price: plan.stripePriceId
      }],
      trial_period_days: this.config.trialPeriodDays,
      collection_method: 'charge_automatically',
      metadata: {
        userId,
        planId
      }
    };

    if (couponId) {
      subscriptionData.coupon = couponId;
    }

    const stripeSubscription = await this.stripe.subscriptions.create(subscriptionData);

    const subscription: Subscription = {
      id: this.generateId(),
      userId,
      planId,
      stripeSubscriptionId: stripeSubscription.id,
      stripeCustomerId: customerId,
      status: stripeSubscription.status as Subscription['status'],
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : undefined,
      trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.subscriptions.set(subscription.id, subscription);

    // Update user subscription info
    this.userManager.updateSubscription(
      userId,
      plan.tier,
      subscription.id,
      subscription.currentPeriodEnd
    );

    this.emit('subscriptionCreated', subscription, user);
    return subscription;
  }

  async updateSubscription(subscriptionId: string, newPlanId: string): Promise<Subscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const newPlan = this.config.plans.find(p => p.id === newPlanId);
    if (!newPlan) {
      throw new Error('Plan not found');
    }

    // Update Stripe subscription
    const stripeSubscription = await this.stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    
    await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      items: [{
        id: stripeSubscription.items.data[0].id,
        price: newPlan.stripePriceId
      }],
      proration_behavior: 'create_prorations'
    });

    // Update local subscription
    subscription.planId = newPlanId;
    subscription.updatedAt = new Date();

    // Update user limits
    this.userManager.updateSubscription(
      subscription.userId,
      newPlan.tier,
      subscription.id,
      subscription.currentPeriodEnd
    );

    this.emit('subscriptionUpdated', subscription);
    return subscription;
  }

  async cancelSubscription(subscriptionId: string, immediately: boolean = false): Promise<Subscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (immediately) {
      await this.stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
      subscription.status = 'cancelled';
      subscription.cancelledAt = new Date();
    } else {
      await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true
      });
      subscription.cancelAtPeriodEnd = true;
    }

    subscription.updatedAt = new Date();

    this.emit('subscriptionCancelled', subscription, immediately);
    return subscription;
  }

  async reactivateSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.status !== 'cancelled' && !subscription.cancelAtPeriodEnd) {
      throw new Error('Subscription is not cancelled');
    }

    // Reactivate in Stripe
    await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false
    });

    subscription.cancelAtPeriodEnd = false;
    subscription.cancelledAt = undefined;
    subscription.updatedAt = new Date();

    this.emit('subscriptionReactivated', subscription);
    return subscription;
  }

  // Payment method management
  async addPaymentMethod(userId: string, paymentMethodId: string): Promise<PaymentMethod> {
    const customerId = await this.getOrCreateStripeCustomer(userId);

    // Attach payment method to customer
    const stripePaymentMethod = await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId
    });

    // Check if this should be the default payment method
    const existingMethods = Array.from(this.paymentMethods.values()).filter(pm => pm.userId === userId);
    const isDefault = existingMethods.length === 0;

    if (isDefault) {
      await this.stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });
    }

    const paymentMethod: PaymentMethod = {
      id: this.generateId(),
      userId,
      stripePaymentMethodId: paymentMethodId,
      type: stripePaymentMethod.type as PaymentMethod['type'],
      brand: stripePaymentMethod.card?.brand,
      last4: stripePaymentMethod.card?.last4,
      expiryMonth: stripePaymentMethod.card?.exp_month,
      expiryYear: stripePaymentMethod.card?.exp_year,
      isDefault,
      createdAt: new Date()
    };

    this.paymentMethods.set(paymentMethod.id, paymentMethod);
    this.emit('paymentMethodAdded', paymentMethod);

    return paymentMethod;
  }

  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    const paymentMethod = Array.from(this.paymentMethods.values()).find(
      pm => pm.stripePaymentMethodId === paymentMethodId
    );

    if (!paymentMethod) {
      throw new Error('Payment method not found');
    }

    // Detach from Stripe
    await this.stripe.paymentMethods.detach(paymentMethodId);

    this.paymentMethods.delete(paymentMethod.id);
    this.emit('paymentMethodRemoved', paymentMethod);
  }

  async setDefaultPaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    const customerId = await this.getOrCreateStripeCustomer(userId);

    // Update in Stripe
    await this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });

    // Update local records
    const userPaymentMethods = Array.from(this.paymentMethods.values()).filter(pm => pm.userId === userId);
    
    for (const pm of userPaymentMethods) {
      pm.isDefault = pm.stripePaymentMethodId === paymentMethodId;
    }

    this.emit('defaultPaymentMethodChanged', userId, paymentMethodId);
  }

  // Invoice management
  async getInvoices(userId: string, limit: number = 10): Promise<Invoice[]> {
    const userInvoices = Array.from(this.invoices.values())
      .filter(invoice => invoice.userId === userId)
      .sort((_a, _b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);

    return userInvoices;
  }

  async getInvoiceDownloadUrl(invoiceId: string): Promise<string> {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const stripeInvoice = await this.stripe.invoices.retrieve(invoice.stripeInvoiceId);
    return stripeInvoice.invoice_pdf || '';
  }

  // Usage tracking
  async recordUsage(userId: string, metric: UsageRecord['metric'], quantity: number): Promise<void> {
    const user = this.userManager.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const subscription = Array.from(this.subscriptions.values()).find(s => s.userId === userId);
    if (!subscription) {
      return; // No subscription, no usage tracking needed
    }

    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const usageRecord: UsageRecord = {
      id: this.generateId(),
      userId,
      subscriptionId: subscription.id,
      metric,
      quantity,
      timestamp: now,
      period
    };

    const userUsage = this.usageRecords.get(userId) || [];
    userUsage.push(usageRecord);
    this.usageRecords.set(userId, userUsage);

    this.emit('usageRecorded', usageRecord);
  }

  async getUsage(userId: string, period?: string): Promise<Record<string, number>> {
    const userUsage = this.usageRecords.get(userId) || [];
    const now = new Date();
    const currentPeriod = period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const periodUsage = userUsage.filter(record => record.period === currentPeriod);

    return periodUsage.reduce((acc, record) => {
      acc[record.metric] = (acc[record.metric] || 0) + record.quantity;
      return acc;
    }, {} as Record<string, number>);
  }

  // Webhook handling
  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.config.stripe.webhookSecret
      );
    } catch (error) {
      throw new Error(`Webhook signature verification failed: ${error}`);
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'payment_method.attached':
        await this.handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
        break;

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    this.emit('webhookProcessed', event);
  }

  private async handleSubscriptionChange(stripeSubscription: Stripe.Subscription): Promise<void> {
    const userId = stripeSubscription.metadata.userId;
    const planId = stripeSubscription.metadata.planId;

    if (!userId || !planId) {
      logger.warn('Missing metadata in subscription:', stripeSubscription.id);
      return;
    }

    let subscription = Array.from(this.subscriptions.values()).find(
      s => s.stripeSubscriptionId === stripeSubscription.id
    );

    if (!subscription) {
      // Create new subscription record
      subscription = {
        id: this.generateId(),
        userId,
        planId,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: stripeSubscription.customer as string,
        status: stripeSubscription.status as Subscription['status'],
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : undefined,
        trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.subscriptions.set(subscription.id, subscription);
    } else {
      // Update existing subscription
      subscription.status = stripeSubscription.status as Subscription['status'];
      subscription.currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
      subscription.currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
      subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;
      subscription.updatedAt = new Date();
    }

    // Update user subscription info
    const plan = this.config.plans.find(p => p.id === planId);
    if (plan) {
      this.userManager.updateSubscription(
        userId,
        plan.tier,
        subscription.id,
        subscription.currentPeriodEnd
      );
    }

    this.emit('subscriptionWebhookProcessed', subscription);
  }

  private async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription): Promise<void> {
    const subscription = Array.from(this.subscriptions.values()).find(
      s => s.stripeSubscriptionId === stripeSubscription.id
    );

    if (subscription) {
      subscription.status = 'cancelled';
      subscription.cancelledAt = new Date();
      subscription.updatedAt = new Date();

      // Downgrade user to free tier
      this.userManager.updateSubscription(subscription.userId, 'free');

      this.emit('subscriptionDeleted', subscription);
    }
  }

  private async handleInvoicePaymentSucceeded(stripeInvoice: Stripe.Invoice): Promise<void> {
    await this.syncInvoice(stripeInvoice);
    this.emit('invoicePaymentSucceeded', stripeInvoice);
  }

  private async handleInvoicePaymentFailed(stripeInvoice: Stripe.Invoice): Promise<void> {
    await this.syncInvoice(stripeInvoice);
    this.emit('invoicePaymentFailed', stripeInvoice);
  }

  private async handlePaymentMethodAttached(stripePaymentMethod: Stripe.PaymentMethod): Promise<void> {
    // This would sync the payment method if needed
    this.emit('paymentMethodAttached', stripePaymentMethod);
  }

  private async syncInvoice(stripeInvoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = stripeInvoice.subscription as string;
    const subscription = Array.from(this.subscriptions.values()).find(
      s => s.stripeSubscriptionId === subscriptionId
    );

    if (!subscription) {
      return;
    }

    const invoice: Invoice = {
      id: this.generateId(),
      userId: subscription.userId,
      subscriptionId: subscription.id,
      stripeInvoiceId: stripeInvoice.id,
      amount: stripeInvoice.amount_paid / 100, // Convert from cents
      currency: stripeInvoice.currency,
      status: stripeInvoice.status as Invoice['status'],
      paidAt: stripeInvoice.status_transitions.paid_at ? new Date(stripeInvoice.status_transitions.paid_at * 1000) : undefined,
      dueDate: new Date(stripeInvoice.due_date! * 1000),
      periodStart: new Date(stripeInvoice.period_start * 1000),
      periodEnd: new Date(stripeInvoice.period_end * 1000),
      downloadUrl: stripeInvoice.invoice_pdf || undefined,
      createdAt: new Date()
    };

    this.invoices.set(invoice.id, invoice);
  }

  // Utility methods
  getSubscriptionPlans(): SubscriptionPlan[] {
    return this.config.plans.filter(plan => plan.active);
  }

  getUserSubscription(userId: string): Subscription | undefined {
    return Array.from(this.subscriptions.values()).find(s => s.userId === userId);
  }

  getUserPaymentMethods(userId: string): PaymentMethod[] {
    return Array.from(this.paymentMethods.values()).filter(pm => pm.userId === userId);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // Analytics and reporting
  getBillingStats(): {
    totalSubscriptions: number;
    activeSubscriptions: number;
    revenue: {
      monthly: number;
      yearly: number;
    };
    subscriptionsByTier: Record<string, number>;
    churnRate: number;
  } {
    const subscriptions = Array.from(this.subscriptions.values());
    const activeSubscriptions = subscriptions.filter(s => s.status === 'active');

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const monthlyInvoices = Array.from(this.invoices.values()).filter(
      i => i.status === 'paid' && i.paidAt && i.paidAt >= monthStart
    );

    const yearlyInvoices = Array.from(this.invoices.values()).filter(
      i => i.status === 'paid' && i.paidAt && i.paidAt >= yearStart
    );

    const subscriptionsByTier = activeSubscriptions.reduce((acc, sub) => {
      const plan = this.config.plans.find(p => p.id === sub.planId);
      if (plan) {
        acc[plan.tier] = (acc[plan.tier] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: activeSubscriptions.length,
      revenue: {
        monthly: monthlyInvoices.reduce((_sum, _inv) => sum + inv.amount, 0),
        yearly: yearlyInvoices.reduce((_sum, _inv) => sum + inv.amount, 0)
      },
      subscriptionsByTier,
      churnRate: 0 // Would calculate based on historical data
    };
  }
}
