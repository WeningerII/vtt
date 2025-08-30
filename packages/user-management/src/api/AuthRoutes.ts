/**
 * Authentication API routes
 */
import { Router, Request, Response } from 'express';
import { logger } from '@vtt/logging';
import { z } from 'zod';
import { UserManager } from '../UserManager';
import { NotificationManager } from '../NotificationManager';
import { rateLimit } from 'express-rate-limit';

// Validation schemas
const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  timezone: z.string().optional(),
  acceptedTerms: z.boolean().refine(val => val === true, {
    message: "Must accept terms and conditions"
  })
});

const loginSchema = z.object({
  identifier: z.string(), // username or email
  password: z.string(),
  rememberMe: z.boolean().optional()
});

const resetPasswordSchema = z.object({
  email: z.string().email()
});

const confirmResetSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8)
});

const verifyEmailSchema = z.object({
  token: z.string()
});

const refreshTokenSchema = z.object({
  refreshToken: z.string()
});

// Rate limiting middleware
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 registration attempts per hour
  message: { error: 'Too many registration attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export class AuthRoutes {
  private router: Router;
  private userManager: UserManager;
  private notificationManager: NotificationManager;

  constructor(userManager: UserManager, notificationManager: NotificationManager) {
    this.router = Router();
    this.userManager = userManager;
    this.notificationManager = notificationManager;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // User registration
    this.router.post('/register', registerLimiter, this.register.bind(this));
    
    // User login
    this.router.post('/login', authLimiter, this.login.bind(this));
    
    // User logout
    this.router.post('/logout', this.logout.bind(this));
    
    // Refresh token
    this.router.post('/refresh', this.refreshToken.bind(this));
    
    // Password reset request
    this.router.post('/reset-password', this.resetPassword.bind(this));
    
    // Password reset confirmation
    this.router.post('/reset-password/confirm', this.confirmResetPassword.bind(this));
    
    // Email verification
    this.router.post('/verify-email', this.verifyEmail.bind(this));
    
    // Resend email verification
    this.router.post('/verify-email/resend', authLimiter, this.resendEmailVerification.bind(this));
    
    // Get current user
    this.router.get('/me', this.getCurrentUser.bind(this));
    
    // Update user profile
    this.router.put('/me', this.updateProfile.bind(this));
    
    // Change password
    this.router.put('/me/password', this.changePassword.bind(this));
  }

  private async register(req: Request, res: Response): Promise<void> {
    try {
      const data = registerSchema.parse(req.body);
      
      const result = await this.userManager.createUser({
        username: data.username,
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        timezone: data.timezone
      });

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      // Send welcome email and verification
      const user = result.user!;
      await this.notificationManager.sendWelcomeEmail(user.id);
      
      if (!user.emailVerified) {
        await this.userManager.sendEmailVerification(user.id);
      }

      res.status(201).json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          emailVerified: user.emailVerified
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      
      logger.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async login(req: Request, res: Response): Promise<void> {
    try {
      const data = loginSchema.parse(req.body);
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const result = await this.userManager.login(
        data.identifier,
        data.password,
        clientIp,
        userAgent,
        data.rememberMe
      );

      if (!result.success) {
        res.status(401).json({ error: result.error });
        return;
      }

      const session = result.session!;
      const user = result.user!;

      // Set HTTP-only cookie for session
      res.cookie('sessionToken', session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: session.expiresAt.getTime() - Date.now()
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          emailVerified: user.emailVerified,
          role: user.role,
          subscription: user.subscription
        },
        session: {
          id: session.id,
          expiresAt: session.expiresAt
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      
      logger.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async logout(req: Request, res: Response): Promise<void> {
    try {
      const sessionToken = req.cookies.sessionToken || req.headers.authorization?.replace('Bearer ', '');
      
      if (sessionToken) {
        await this.userManager.logout(sessionToken);
      }

      res.clearCookie('sessionToken');
      res.json({ success: true });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const data = refreshTokenSchema.parse(req.body);
      
      const result = await this.userManager.refreshSession(data.refreshToken);
      
      if (!result.success) {
        res.status(401).json({ error: result.error });
        return;
      }

      const session = result.session!;

      // Update HTTP-only cookie
      res.cookie('sessionToken', session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: session.expiresAt.getTime() - Date.now()
      });

      res.json({
        success: true,
        session: {
          id: session.id,
          expiresAt: session.expiresAt
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      
      logger.error('Token refresh error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const data = resetPasswordSchema.parse(req.body);
      
      const _result = await this.userManager.requestPasswordReset(data.email);
      
      // Always return success to prevent email enumeration
      res.json({ 
        success: true, 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      
      logger.error('Password reset error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async confirmResetPassword(req: Request, res: Response): Promise<void> {
    try {
      const data = confirmResetSchema.parse(req.body);
      
      const result = await this.userManager.resetPassword(data.token, data.newPassword);
      
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({ success: true, message: 'Password successfully reset.' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      
      logger.error('Password reset confirmation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const data = verifyEmailSchema.parse(req.body);
      
      const result = await this.userManager.verifyEmail(data.token);
      
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({ success: true, message: 'Email successfully verified.' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      
      logger.error('Email verification error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async resendEmailVerification(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user; // Set by auth middleware
      
      if (!user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (user.emailVerified) {
        res.status(400).json({ error: 'Email already verified' });
        return;
      }

      await this.userManager.sendEmailVerification(user.id);
      
      res.json({ 
        success: true, 
        message: 'Verification email sent.' 
      });
    } catch (error) {
      logger.error('Resend verification error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user; // Set by auth middleware
      
      if (!user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          emailVerified: user.emailVerified,
          role: user.role,
          subscription: user.subscription,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt
        }
      });
    } catch (error) {
      logger.error('Get current user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      
      if (!user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const updateData = z.object({
        firstName: z.string().min(1).max(50).optional(),
        lastName: z.string().min(1).max(50).optional(),
        timezone: z.string().optional()
      }).parse(req.body);

      const result = await this.userManager.updateUser(user.id, updateData);
      
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({
        success: true,
        user: result.user
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      
      logger.error('Update profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      
      if (!user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const data = z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(8)
      }).parse(req.body);

      const result = await this.userManager.changePassword(
        user.id, 
        data.currentPassword, 
        data.newPassword
      );
      
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({ success: true, message: 'Password changed successfully.' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      
      logger.error('Change password error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}
