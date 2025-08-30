# Billing & Subscription API

The Billing API handles subscription management, payment processing, invoicing, and usage tracking through Stripe integration.

## Subscription Management

### Get Current Subscription
Retrieve user's current subscription details.

```http
GET /billing/subscription
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true,
  "subscription": {
    "id": "sub_1234567890",
    "userId": "user_abc123",
    "planId": "premium",
    "status": "active",
    "currentPeriodStart": "2024-12-01T00:00:00Z",
    "currentPeriodEnd": "2025-01-01T00:00:00Z",
    "cancelAtPeriodEnd": false,
    "createdAt": "2024-12-01T00:00:00Z"
  }
}
```

### Create Subscription
Subscribe to a plan with payment method.

```http
POST /billing/subscription
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "planId": "premium",
  "paymentMethodId": "pm_1234567890"
}
```

**Response**
```json
{
  "success": true,
  "subscription": {
    "id": "sub_1234567890",
    "userId": "user_abc123",
    "planId": "premium",
    "status": "active",
    "currentPeriodStart": "2024-12-01T00:00:00Z",
    "currentPeriodEnd": "2025-01-01T00:00:00Z",
    "cancelAtPeriodEnd": false
  }
}
```

### Update Subscription
Change subscription plan (with prorated billing).

```http
PUT /billing/subscription
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "planId": "enterprise"
}
```

**Response**
```json
{
  "success": true,
  "subscription": {
    "id": "sub_1234567890",
    "planId": "enterprise",
    "status": "active",
    "proration": {
      "amount": 1500,
      "currency": "usd",
      "description": "Proration for plan upgrade"
    }
  }
}
```

### Cancel Subscription
Cancel subscription (at period end or immediately).

```http
DELETE /billing/subscription?immediate=false
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true,
  "subscription": {
    "id": "sub_1234567890",
    "status": "active",
    "cancelAtPeriodEnd": true,
    "canceledAt": "2024-12-15T10:30:00Z",
    "currentPeriodEnd": "2025-01-01T00:00:00Z"
  }
}
```

### Reactivate Subscription
Reactivate a canceled subscription before period end.

```http
POST /billing/subscription/reactivate
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true,
  "subscription": {
    "id": "sub_1234567890",
    "status": "active",
    "cancelAtPeriodEnd": false,
    "canceledAt": null
  }
}
```

## Payment Methods

### List Payment Methods
Get user's saved payment methods.

```http
GET /billing/payment-methods
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true,
  "paymentMethods": [
    {
      "id": "pm_1234567890",
      "type": "card",
      "card": {
        "brand": "visa",
        "last4": "4242",
        "expMonth": 12,
        "expYear": 2025
      },
      "isDefault": true,
      "createdAt": "2024-12-01T00:00:00Z"
    }
  ]
}
```

### Add Payment Method
Add new payment method (requires Stripe Payment Method ID).

```http
POST /billing/payment-methods
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "paymentMethodId": "pm_9876543210",
  "setAsDefault": true
}
```

**Response**
```json
{
  "success": true,
  "paymentMethod": {
    "id": "pm_9876543210",
    "type": "card",
    "card": {
      "brand": "mastercard",
      "last4": "1234",
      "expMonth": 6,
      "expYear": 2026
    },
    "isDefault": true
  }
}
```

### Update Payment Method
Update payment method billing address.

```http
PUT /billing/payment-methods/pm_1234567890
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "billingAddress": {
    "line1": "123 Main St",
    "line2": "Apt 4B",
    "city": "San Francisco",
    "state": "CA",
    "postalCode": "94105",
    "country": "US"
  }
}
```

**Response**
```json
{
  "success": true,
  "paymentMethod": {
    "id": "pm_1234567890",
    "billingAddress": {
      "line1": "123 Main St",
      "line2": "Apt 4B",
      "city": "San Francisco",
      "state": "CA",
      "postalCode": "94105",
      "country": "US"
    }
  }
}
```

### Remove Payment Method
Delete a payment method.

```http
DELETE /billing/payment-methods/pm_1234567890
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true
}
```

### Set Default Payment Method
Make a payment method the default.

```http
POST /billing/payment-methods/pm_1234567890/default
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true
}
```

## Invoices & Billing History

### List Invoices
Get user's invoice history.

```http
GET /billing/invoices?limit=20&offset=0
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true,
  "invoices": [
    {
      "id": "inv_1234567890",
      "subscriptionId": "sub_abc123",
      "amount": 1999,
      "currency": "usd",
      "status": "paid",
      "periodStart": "2024-12-01T00:00:00Z",
      "periodEnd": "2025-01-01T00:00:00Z",
      "dueDate": "2024-12-01T00:00:00Z",
      "createdAt": "2024-12-01T00:00:00Z"
    }
  ]
}
```

### Get Invoice Details
Get detailed invoice information.

```http
GET /billing/invoices/inv_1234567890
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true,
  "invoice": {
    "id": "inv_1234567890",
    "subscriptionId": "sub_abc123",
    "amount": 1999,
    "currency": "usd",
    "status": "paid",
    "description": "Premium Plan - December 2024",
    "lineItems": [
      {
        "description": "Premium Plan",
        "amount": 1999,
        "quantity": 1
      }
    ],
    "tax": 0,
    "total": 1999,
    "periodStart": "2024-12-01T00:00:00Z",
    "periodEnd": "2025-01-01T00:00:00Z",
    "dueDate": "2024-12-01T00:00:00Z",
    "paidAt": "2024-12-01T00:15:00Z",
    "hostedInvoiceUrl": "https://invoice.stripe.com/i/acct_123/invst_456"
  }
}
```

### Download Invoice PDF
Download invoice as PDF file.

```http
GET /billing/invoices/inv_1234567890/download
Authorization: Bearer <session_token>
```

**Response**
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="invoice-inv_1234567890.pdf"`
- Binary PDF data

### Retry Failed Payment
Retry payment for failed invoice.

```http
POST /billing/invoices/inv_1234567890/retry
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true
}
```

## Usage Tracking

### Get Usage Summary
Get current billing period usage.

```http
GET /billing/usage/current-period
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true,
  "usage": {
    "periodStart": "2024-12-01T00:00:00Z",
    "periodEnd": "2025-01-01T00:00:00Z",
    "metrics": {
      "campaigns": {
        "used": 5,
        "limit": 20,
        "unit": "count"
      },
      "storage": {
        "used": 12.5,
        "limit": 25.0,
        "unit": "GB"
      },
      "assets": {
        "used": 1250,
        "limit": 5000,
        "unit": "count"
      },
      "apiCalls": {
        "used": 15420,
        "limit": 50000,
        "unit": "count"
      }
    }
  }
}
```

### Get Historical Usage
Get usage data for date range.

```http
GET /billing/usage?startDate=2024-11-01&endDate=2024-12-01
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true,
  "usage": [
    {
      "date": "2024-11-01",
      "campaigns": 3,
      "storage": 8.2,
      "assets": 850,
      "apiCalls": 12500
    },
    {
      "date": "2024-11-02",
      "campaigns": 3,
      "storage": 8.5,
      "assets": 875,
      "apiCalls": 13200
    }
  ]
}
```

## Subscription Plans

### List Available Plans
Get all subscription plans.

```http
GET /billing/plans
```

**Response**
```json
{
  "success": true,
  "plans": [
    {
      "id": "free",
      "name": "Free",
      "tier": "free",
      "price": 0,
      "currency": "usd",
      "interval": "month",
      "features": [
        "2 campaigns",
        "4 players per game",
        "1GB storage",
        "50 assets",
        "Basic features"
      ],
      "limits": {
        "maxCampaigns": 2,
        "maxPlayersPerGame": 4,
        "maxStorageGB": 1,
        "maxAssets": 50,
        "canUseCustomAssets": false,
        "canUseAdvancedFeatures": false
      },
      "active": true
    },
    {
      "id": "premium",
      "name": "Premium",
      "tier": "premium",
      "price": 19.99,
      "currency": "usd",
      "interval": "month",
      "features": [
        "20 campaigns",
        "12 players per game",
        "25GB storage",
        "5,000 assets",
        "Custom assets",
        "Advanced features",
        "API access",
        "Premium support"
      ],
      "limits": {
        "maxCampaigns": 20,
        "maxPlayersPerGame": 12,
        "maxStorageGB": 25,
        "maxAssets": 5000,
        "canUseCustomAssets": true,
        "canUseAdvancedFeatures": true
      },
      "active": true
    }
  ]
}
```

### Get Plan Details
Get specific plan information.

```http
GET /billing/plans/premium
```

**Response**
```json
{
  "success": true,
  "plan": {
    "id": "premium",
    "name": "Premium",
    "tier": "premium",
    "price": 19.99,
    "currency": "usd",
    "interval": "month",
    "description": "Perfect for serious game masters and content creators",
    "features": [
      "20 campaigns",
      "12 players per game", 
      "25GB storage",
      "5,000 assets",
      "Custom assets",
      "Advanced features",
      "API access",
      "Premium support"
    ],
    "limits": {
      "maxCampaigns": 20,
      "maxPlayersPerGame": 12,
      "maxStorageGB": 25,
      "maxAssets": 5000,
      "canUseCustomAssets": true,
      "canUseAdvancedFeatures": true
    }
  }
}
```

## Customer Portal

### Create Portal Session
Generate Stripe Customer Portal session URL.

```http
POST /billing/portal-session
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true,
  "portalUrl": "https://billing.stripe.com/session/acct_123/bcs_456"
}
```

## Webhooks

### Webhook Endpoint
Stripe webhooks are automatically handled at:

```http
POST /billing/webhook
Content-Type: application/json
Stripe-Signature: <stripe_signature>
```

Supported webhook events:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `payment_method.attached`

## Error Responses

### Billing Errors
```json
{
  "error": "payment_required",
  "message": "A valid payment method is required to subscribe to this plan"
}
```

```json
{
  "error": "subscription_not_found",
  "message": "No active subscription found for this user"
}
```

```json
{
  "error": "plan_not_found", 
  "message": "The specified subscription plan does not exist"
}
```

### Payment Errors
```json
{
  "error": "card_declined",
  "message": "Your card was declined",
  "code": "card_declined",
  "decline_code": "insufficient_funds"
}
```

```json
{
  "error": "payment_method_required",
  "message": "Please add a payment method before subscribing"
}
```

## SDK Examples

### JavaScript Client
```javascript
const { VTTClient } = require('@vtt-platform/js-sdk');

const client = new VTTClient({
  sessionToken: 'your-session-token'
});

// Get current subscription
const subscription = await client.billing.getSubscription();
console.log('Current plan:', subscription.planId);

// Subscribe to premium plan
const newSubscription = await client.billing.createSubscription({
  planId: 'premium',
  paymentMethodId: 'pm_1234567890'
});

// Get usage data
const usage = await client.billing.getCurrentUsage();
console.log('Campaigns used:', usage.campaigns.used, '/', usage.campaigns.limit);

// List invoices
const invoices = await client.billing.getInvoices({ limit: 10 });
invoices.forEach(invoice => {
  console.log(`Invoice ${invoice.id}: $${invoice.amount / 100} - ${invoice.status}`);
});
```

### React Billing Component
```jsx
import { useBilling } from '@vtt-platform/react-components';

function BillingDashboard() {
  const { 
    subscription, 
    usage, 
    invoices, 
    plans,
    updateSubscription,
    loading 
  } = useBilling();

  const handleUpgrade = async (planId) => {
    await updateSubscription(planId);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="billing-dashboard">
      <div className="current-plan">
        <h2>Current Plan: {subscription?.planId}</h2>
        <p>Status: {subscription?.status}</p>
        <p>Renews: {subscription?.currentPeriodEnd}</p>
      </div>

      <div className="usage">
        <h3>Usage This Period</h3>
        <div>Campaigns: {usage.campaigns.used}/{usage.campaigns.limit}</div>
        <div>Storage: {usage.storage.used}GB/{usage.storage.limit}GB</div>
      </div>

      <div className="plans">
        <h3>Available Plans</h3>
        {plans.map(plan => (
          <div key={plan.id} className="plan-card">
            <h4>{plan.name}</h4>
            <p>${plan.price}/month</p>
            <button onClick={() => handleUpgrade(plan.id)}>
              {subscription?.planId === plan.id ? 'Current Plan' : 'Upgrade'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Testing

### Test Cards (Stripe)
Development environment accepts Stripe test cards:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Insufficient Funds**: `4000 0000 0000 9995`
- **3D Secure**: `4000 0025 0000 3155`

### Webhook Testing
Use Stripe CLI to forward webhooks to local development:
```bash
stripe listen --forward-to localhost:3000/billing/webhook
```

---

For more information, see the [Main API Documentation](./README.md).
