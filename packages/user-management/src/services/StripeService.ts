/**
 * Direct Stripe integration service - replaces custom BillingManager abstraction
 */
import Stripe from 'stripe';
import { logger } from '@vtt/logging';

export class StripeService {
  private stripe: Stripe;

  constructor(
    private readonly secretKey: string,
    private readonly webhookSecret: string
  ) {
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-08-27.basil', // Latest API version for Sept 2025
      typescript: true,
    });
  }

  // Customer management
  async createCustomer(email: string, name?: string, metadata?: Record<string, string>): Promise<Stripe.Customer> {
    const params: Stripe.CustomerCreateParams = { email };
    if (name) {params.name = name;}
    if (metadata) {params.metadata = metadata;}
    return await this.stripe.customers.create(params);
  }

  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    return await this.stripe.customers.retrieve(customerId) as Stripe.Customer;
  }

  async updateCustomer(customerId: string, params: Stripe.CustomerUpdateParams): Promise<Stripe.Customer> {
    return await this.stripe.customers.update(customerId, params);
  }

  // Subscription management
  async createSubscription(params: Stripe.SubscriptionCreateParams): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.create(params);
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.retrieve(subscriptionId);
  }

  async updateSubscription(subscriptionId: string, params: Stripe.SubscriptionUpdateParams): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.update(subscriptionId, params);
  }

  async cancelSubscription(subscriptionId: string, immediate = false): Promise<Stripe.Subscription> {
    if (immediate) {
      return await this.stripe.subscriptions.cancel(subscriptionId);
    } else {
      return await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }
  }

  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }

  async listActiveSubscriptions(customerId: string): Promise<Stripe.Subscription[]> {
    const subscriptions = await this.stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
    });
    return subscriptions.data;
  }

  // Payment method management
  async attachPaymentMethod(paymentMethodId: string, customerId: string): Promise<Stripe.PaymentMethod> {
    return await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return await this.stripe.paymentMethods.detach(paymentMethodId);
  }

  async listPaymentMethods(customerId: string, type: Stripe.PaymentMethodListParams.Type = 'card'): Promise<Stripe.PaymentMethod[]> {
    const paymentMethods = await this.stripe.paymentMethods.list({
      customer: customerId,
      type,
    });
    return paymentMethods.data;
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<Stripe.Customer> {
    return await this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  }

  // Invoice management
  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    return await this.stripe.invoices.retrieve(invoiceId);
  }

  async listInvoices(customerId?: string, limit = 20): Promise<Stripe.Invoice[]> {
    const params: Stripe.InvoiceListParams = { limit };
    if (customerId) {params.customer = customerId;}
    const invoices = await this.stripe.invoices.list(params);
    return invoices.data;
  }

  async retryInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    return await this.stripe.invoices.pay(invoiceId);
  }

  async downloadInvoicePDF(invoiceId: string): Promise<Buffer> {
    // Get the invoice PDF URL
    const invoice = await this.stripe.invoices.retrieve(invoiceId);
    if (!invoice.invoice_pdf) {
      throw new Error('Invoice PDF not available');
    }

    // Download the PDF
    const response = await fetch(invoice.invoice_pdf);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // Usage records for metered billing
  // Note: Usage records API may vary by Stripe version - implement as needed
  // async createUsageRecord(subscriptionItemId: string, quantity: number, timestamp?: number): Promise<any> {
  //   return await this.stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
  //     quantity,
  //     timestamp: timestamp || Math.floor(Date.now() / 1000),
  //   });
  // }

  // Billing portal
  async createPortalSession(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    return await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  // Products and prices
  async listProducts(active = true): Promise<Stripe.Product[]> {
    const products = await this.stripe.products.list({
      active,
    });
    return products.data;
  }

  async getProduct(productId: string): Promise<Stripe.Product> {
    return await this.stripe.products.retrieve(productId);
  }

  async listPrices(productId?: string, active = true): Promise<Stripe.Price[]> {
    const params: Stripe.PriceListParams = { active };
    if (productId) {params.product = productId;}
    const prices = await this.stripe.prices.list(params);
    return prices.data;
  }

  // Webhook handling
  verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (error) {
      logger.error('Webhook signature verification failed:', { error: error instanceof Error ? error.message : String(error) });
      throw new Error('Invalid webhook signature');
    }
  }

  // Error handling utility
  isStripeError(error: any): error is Stripe.errors.StripeError {
    return error && error.type && error.type.startsWith('Stripe');
  }

  handleStripeError(error: Stripe.errors.StripeError): { message: string; code?: string } {
    logger.error('Stripe error:', {
      type: error.type,
      code: error.code,
      message: error.message,
    });

    return {
      message: error.message,
      ...(error.code && { code: error.code }),
    };
  }
}
