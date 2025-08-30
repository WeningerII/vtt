/**
 * @vtt/user-management - Comprehensive user accounts, billing, and subscription management
 *
 * This package provides complete user management functionality including authentication,
 * billing integration with Stripe, and multi-channel notifications.
 */

// Core managers
export { UserManager } from "./UserManager";
export { BillingManager } from "./BillingManager";
export { NotificationManager } from "./NotificationManager";

// Types and interfaces
export type {
  User,
  Session,
  LoginAttempt,
  PasswordResetRequest,
  EmailVerification,
  UserManagerConfig,
} from "./UserManager";

export type {
  SubscriptionPlan,
  Subscription,
  Invoice,
  PaymentMethod,
  UsageRecord,
  BillingManagerConfig,
} from "./BillingManager";

export type {
  NotificationTemplate,
  EmailNotification,
  PushNotification,
  InAppNotification,
  NotificationPreferences,
  NotificationManagerConfig,
} from "./NotificationManager";

// Utility functions
export const _UserManagementUtils = {
  /**
   * Create a complete user management suite
   */
  createUserManagementSuite: async (config: {
    userManager: any;
    billing: any;
    notifications: any;
  }) => {
    const { UserManager } = await import("./UserManager");
    const { BillingManager } = await import("./BillingManager");
    const { NotificationManager } = await import("./NotificationManager");

    const userManager = new UserManager(config.userManager);
    const billingManager = new BillingManager(config.billing, userManager);
    const notificationManager = new NotificationManager(config.notifications, userManager);

    // Wire up event handlers
    userManager.on("userCreated", async (user: any) => {
      await notificationManager.sendWelcomeEmail(user.id);
    });

    userManager.on("passwordResetRequested", async (user: any, _token: string) => {
      await notificationManager.sendPasswordResetEmail(user.id, token);
    });

    userManager.on("emailVerificationSent", async (user: any, _token: string) => {
      await notificationManager.sendEmailVerification(user.id, token);
    });

    billingManager.on("subscriptionCreated", async (subscription: any) => {
      await notificationManager.sendInApp(
        subscription.userId,
        "success",
        "Subscription Active",
        "Your subscription has been activated successfully!",
      );
    });

    billingManager.on("invoicePaymentFailed", async (invoice: any) => {
      await notificationManager.sendEmail(invoice.userId, "payment-failed", {
        amount: invoice.amount,
        currency: invoice.currency,
        retryUrl: "/billing/retry-payment",
      });
    });

    return {
      userManager,
      billingManager,
      notificationManager,
    };
  },

  /**
   * Default subscription plans
   */
  getDefaultSubscriptionPlans: (): any[] => [
    {
      id: "free",
      name: "Free",
      tier: "free",
      price: 0,
      currency: "usd",
      interval: "month",
      features: ["2 campaigns", "4 players per game", "1GB storage", "50 assets", "Basic features"],
      limits: {
        maxCampaigns: 2,
        maxPlayersPerGame: 4,
        maxStorageGB: 1,
        maxAssets: 50,
        canUseCustomAssets: false,
        canUseAdvancedFeatures: false,
      },
      stripeProductId: "",
      stripePriceId: "",
      active: true,
    },
    {
      id: "basic",
      name: "Basic",
      tier: "basic",
      price: 9.99,
      currency: "usd",
      interval: "month",
      features: [
        "5 campaigns",
        "8 players per game",
        "5GB storage",
        "500 assets",
        "Custom assets",
        "Priority support",
      ],
      limits: {
        maxCampaigns: 5,
        maxPlayersPerGame: 8,
        maxStorageGB: 5,
        maxAssets: 500,
        canUseCustomAssets: true,
        canUseAdvancedFeatures: false,
      },
      stripeProductId: "prod_basic",
      stripePriceId: "price_basic_monthly",
      active: true,
    },
    {
      id: "premium",
      name: "Premium",
      tier: "premium",
      price: 19.99,
      currency: "usd",
      interval: "month",
      features: [
        "20 campaigns",
        "12 players per game",
        "25GB storage",
        "5,000 assets",
        "Custom assets",
        "Advanced features",
        "API access",
        "Premium support",
      ],
      limits: {
        maxCampaigns: 20,
        maxPlayersPerGame: 12,
        maxStorageGB: 25,
        maxAssets: 5000,
        canUseCustomAssets: true,
        canUseAdvancedFeatures: true,
      },
      stripeProductId: "prod_premium",
      stripePriceId: "price_premium_monthly",
      active: true,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      tier: "enterprise",
      price: 49.99,
      currency: "usd",
      interval: "month",
      features: [
        "Unlimited campaigns",
        "Unlimited players",
        "100GB storage",
        "Unlimited assets",
        "Custom assets",
        "All advanced features",
        "Full API access",
        "Dedicated support",
        "Custom integrations",
      ],
      limits: {
        maxCampaigns: -1,
        maxPlayersPerGame: -1,
        maxStorageGB: 100,
        maxAssets: -1,
        canUseCustomAssets: true,
        canUseAdvancedFeatures: true,
      },
      stripeProductId: "prod_enterprise",
      stripePriceId: "price_enterprise_monthly",
      active: true,
    },
  ],

  /**
   * Default notification templates
   */
  getDefaultNotificationTemplates: (): any[] => [
    {
      id: "welcome",
      name: "Welcome Email",
      type: "email",
      subject: "Welcome to {{ appName }}!",
      htmlTemplate: `
        <h1>Welcome, {{ firstName }}!</h1>
        <p>Thank you for joining {{ appName }}. We're excited to have you on board!</p>
        <p>Your username is: <strong>{{ username }}</strong></p>
        <p><a href="{{ loginUrl }}">Get started by logging in</a></p>
        <p>If you have any questions, don't hesitate to reach out to our support team.</p>
      `,
      textTemplate: `
        Welcome, {{ firstName }}!
        
        Thank you for joining {{ appName }}. We're excited to have you on board!
        
        Your username is: {{ username }}
        
        Get started by logging in: {{ loginUrl }}
        
        If you have any questions, don't hesitate to reach out to our support team.
      `,
      variables: ["firstName", "username", "appName", "loginUrl"],
      category: "account",
      active: true,
    },
    {
      id: "password-reset",
      name: "Password Reset",
      type: "email",
      subject: "Reset your password",
      htmlTemplate: `
        <h1>Password Reset Request</h1>
        <p>Hi {{ firstName }},</p>
        <p>We received a request to reset your password. Click the link below to create a new password:</p>
        <p><a href="{{ resetUrl }}">Reset Password</a></p>
        <p>This link will expire in {{ expiresIn }}.</p>
        <p>If you didn't request this reset, please ignore this email.</p>
      `,
      textTemplate: `
        Password Reset Request
        
        Hi {{ firstName }},
        
        We received a request to reset your password. Visit this link to create a new password:
        {{ resetUrl }}
        
        This link will expire in {{ expiresIn }}.
        
        If you didn't request this reset, please ignore this email.
      `,
      variables: ["firstName", "resetUrl", "expiresIn"],
      category: "account",
      active: true,
    },
    {
      id: "email-verification",
      name: "Email Verification",
      type: "email",
      subject: "Verify your email address",
      htmlTemplate: `
        <h1>Verify Your Email</h1>
        <p>Hi {{ firstName }},</p>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="{{ verificationUrl }}">Verify Email</a></p>
        <p>If you didn't create this account, please ignore this email.</p>
      `,
      textTemplate: `
        Verify Your Email
        
        Hi {{ firstName }},
        
        Please verify your email address by visiting this link:
        {{ verificationUrl }}
        
        If you didn't create this account, please ignore this email.
      `,
      variables: ["firstName", "verificationUrl"],
      category: "account",
      active: true,
    },
    {
      id: "game-invite",
      name: "Game Invitation",
      type: "email",
      subject: "You're invited to play {{ gameTitle }}!",
      htmlTemplate: `
        <h1>Game Invitation</h1>
        <p>{{ inviterName }} has invited you to play <strong>{{ gameTitle }}</strong>!</p>
        <p>Click below to accept or decline the invitation:</p>
        <p>
          <a href="{{ acceptUrl }}" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Accept</a>
          <a href="{{ declineUrl }}" style="background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Decline</a>
        </p>
        <p>Game link: <a href="{{ gameUrl }}">{{ gameUrl }}</a></p>
      `,
      textTemplate: `
        Game Invitation
        
        {{ inviterName }} has invited you to play {{ gameTitle }}!
        
        Accept: {{ acceptUrl }}
        Decline: {{ declineUrl }}
        
        Game link: {{ gameUrl }}
      `,
      variables: ["inviterName", "gameTitle", "acceptUrl", "declineUrl", "gameUrl"],
      category: "game",
      active: true,
    },
    {
      id: "payment-failed",
      name: "Payment Failed",
      type: "email",
      subject: "Payment failed - Action required",
      htmlTemplate: `
        <h1>Payment Failed</h1>
        <p>We were unable to process your payment of {{ amount }} {{ currency }}.</p>
        <p>Please update your payment method to continue using our service.</p>
        <p><a href="{{ retryUrl }}">Update Payment Method</a></p>
        <p>If you have any questions, please contact our support team.</p>
      `,
      textTemplate: `
        Payment Failed
        
        We were unable to process your payment of {{ amount }} {{ currency }}.
        
        Please update your payment method to continue using our service.
        
        Update Payment Method: {{ retryUrl }}
        
        If you have any questions, please contact our support team.
      `,
      variables: ["amount", "currency", "retryUrl"],
      category: "billing",
      active: true,
    },
  ],

  /**
   * Validate email format
   */
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Validate password strength
   */
  validatePasswordStrength: (
    password: string,
  ): {
    valid: boolean;
    errors: string[];
    score: number;
  } => {
    const errors: string[] = [];
    let score = 0;

    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    } else {
      score += 1;
    }

    if (password.length >= 12) {
      score += 1;
    }

    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      errors.push("Password must contain at least one lowercase letter");
    }

    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      errors.push("Password must contain at least one uppercase letter");
    }

    if (/\d/.test(password)) {
      score += 1;
    } else {
      errors.push("Password must contain at least one number");
    }

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score += 1;
    } else {
      errors.push("Password must contain at least one special character");
    }

    return {
      valid: errors.length === 0,
      errors,
      score: Math.min(score, 5),
    };
  },

  /**
   * Generate secure random token
   */
  generateSecureToken: (length: number = 32): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  /**
   * Format currency amount
   */
  formatCurrency: (amount: number, currency: string = "USD"): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  },

  /**
   * Calculate subscription prorations
   */
  calculateProration: (
    oldPrice: number,
    newPrice: number,
    daysRemaining: number,
    totalDays: number,
  ): number => {
    const oldDailyRate = oldPrice / totalDays;
    const newDailyRate = newPrice / totalDays;
    const unusedAmount = oldDailyRate * daysRemaining;
    const newAmount = newDailyRate * daysRemaining;
    return newAmount - unusedAmount;
  },
};

// Constants
export const _USER_ROLES = {
  USER: "user",
  MODERATOR: "moderator",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
} as const;

export const _SUBSCRIPTION_TIERS = {
  FREE: "free",
  BASIC: "basic",
  PREMIUM: "premium",
  ENTERPRISE: "enterprise",
} as const;

export const _NOTIFICATION_CATEGORIES = {
  ACCOUNT: "account",
  GAME: "game",
  BILLING: "billing",
  SYSTEM: "system",
  MARKETING: "marketing",
} as const;

export const _DEFAULT_LIMITS = {
  FREE: {
    maxCampaigns: 2,
    maxPlayersPerGame: 4,
    maxStorageGB: 1,
    maxAssets: 50,
    canUseCustomAssets: false,
    canUseAdvancedFeatures: false,
  },
  BASIC: {
    maxCampaigns: 5,
    maxPlayersPerGame: 8,
    maxStorageGB: 5,
    maxAssets: 500,
    canUseCustomAssets: true,
    canUseAdvancedFeatures: false,
  },
  PREMIUM: {
    maxCampaigns: 20,
    maxPlayersPerGame: 12,
    maxStorageGB: 25,
    maxAssets: 5000,
    canUseCustomAssets: true,
    canUseAdvancedFeatures: true,
  },
  ENTERPRISE: {
    maxCampaigns: -1,
    maxPlayersPerGame: -1,
    maxStorageGB: 100,
    maxAssets: -1,
    canUseCustomAssets: true,
    canUseAdvancedFeatures: true,
  },
};

// Version information
export const _VERSION = "1.0.0";
export const _PACKAGE_NAME = "@vtt/user-management";
