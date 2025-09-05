/**
 * Authentication Routes
 */
import { Router } from 'express';
import { AuthManager } from '../auth/auth-manager';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const authManager = new AuthManager(prisma, {
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiration: '1h',
  refreshTokenExpiration: '7d',
  bcryptRounds: 12
});

export const authRouter = Router();

// Register endpoint
authRouter.post('/register', async (req, res) => {
  try {
    const { email, username, displayName, password } = req.body;

    if (!email || !username || !displayName || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const result = await authManager.register({
      email,
      username,
      displayName,
      password
    });

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      user: result.user,
      tokens: {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Registration failed' 
    });
  }
});

// Login endpoint
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await authManager.login({ email, password });

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      user: result.user,
      tokens: {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ 
      error: error instanceof Error ? error.message : 'Login failed' 
    });
  }
});

// Get current user endpoint
authRouter.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const user = await authManager.verifyAccessToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// Refresh token endpoint
authRouter.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const cookieToken = req.cookies?.refreshToken;
    
    const token = refreshToken || cookieToken;
    if (!token) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    const tokens = await authManager.refreshTokens(token);

    // Set new refresh token as httpOnly cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ tokens });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ 
      error: error instanceof Error ? error.message : 'Token refresh failed' 
    });
  }
});

// Logout endpoint
authRouter.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const cookieToken = req.cookies?.refreshToken;
    
    const token = refreshToken || cookieToken;
    if (token) {
      await authManager.logout(token);
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

export { authManager };
