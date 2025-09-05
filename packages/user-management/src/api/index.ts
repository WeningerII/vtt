/**
 * User Management API - Main router and configuration
 */
import { Router } from "express";
import { UserManager } from "../UserManager";
import { StripeService } from "../services/StripeService";
import { NotificationManager } from "../NotificationManager";
import { AuthRoutes } from "./AuthRoutes";
import { BillingRoutesStripe } from "./BillingRoutesStripe";
import { NotificationRoutes } from "./NotificationRoutes";

export interface UserManagementApiConfig {
  userManager: UserManager;
  stripeService: StripeService;
  notificationManager: NotificationManager;
}

/**
 * Creates a complete user management API router
 */
export function createUserManagementApi(config: UserManagementApiConfig): Router {
  const router = Router();

  // Create route handlers
  const authRoutes = new AuthRoutes(config.userManager, config.notificationManager);
  const billingRoutes = new BillingRoutesStripe(config.stripeService, config.userManager);
  const notificationRoutes = new NotificationRoutes(config.notificationManager, config.userManager);

  // Mount routes
  router.use("/auth", authRoutes.getRouter());
  router.use("/billing", billingRoutes.getRouter());
  router.use("/notifications", notificationRoutes.getRouter());

  // Health check endpoint
  router.get("/health", (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        userManager: "active",
        stripeService: "active",
        notificationManager: "active",
      },
    });
  });

  // API info endpoint
  router.get("/info", (req, res) => {
    res.json({
      name: "VTT User Management API",
      version: "1.0.0",
      endpoints: {
        auth: [
          "POST /auth/register",
          "POST /auth/login",
          "POST /auth/logout",
          "POST /auth/refresh",
          "POST /auth/reset-password",
          "POST /auth/reset-password/confirm",
          "POST /auth/verify-email",
          "POST /auth/verify-email/resend",
          "GET /auth/me",
          "PUT /auth/me",
          "PUT /auth/me/password",
        ],
        billing: [
          "GET /billing/subscription",
          "POST /billing/subscription",
          "PUT /billing/subscription",
          "DELETE /billing/subscription",
          "POST /billing/subscription/reactivate",
          "GET /billing/payment-methods",
          "POST /billing/payment-methods",
          "PUT /billing/payment-methods/:id",
          "DELETE /billing/payment-methods/:id",
          "GET /billing/invoices",
          "GET /billing/usage",
          "GET /billing/plans",
          "POST /billing/portal-session",
          "POST /billing/webhook",
        ],
        notifications: [
          "GET /notifications/preferences",
          "PUT /notifications/preferences",
          "GET /notifications/in-app",
          "GET /notifications/in-app/unread-count",
          "POST /notifications/in-app/mark-read",
          "POST /notifications/invites/send",
          "POST /notifications/email/test",
          "GET /notifications/email/unsubscribe",
          "POST /notifications/push/register-device",
          "GET /notifications/history",
        ],
      },
    });
  });

  return router;
}

// Export route classes for individual use
export { AuthRoutes } from "./AuthRoutes";
export { BillingRoutesStripe } from "./BillingRoutesStripe";
export { NotificationRoutes } from "./NotificationRoutes";
export {
  authenticateUser,
  requireRole,
  requireEmailVerification,
  requireSubscription,
  optionalAuth,
} from "./middleware/auth";
