/**
 * Minimal server configuration for testing and debugging
 * This bypasses broken modules to get the server running
 */

import http from 'http';
import { URL } from 'url';
import { Router } from './router/router';
import type { Context } from './router/types';

// Import working middleware
import { corsMiddleware } from './middleware/cors';
import { csrfMiddleware, csrfTokenInjection } from './middleware/csrf';
import { loggingMiddleware } from './middleware/logging';
import { errorHandler } from './middleware/error';

// Import minimal routes
import { authRouter } from './routes/auth';

const PORT = process.env.PORT || 3000;
const router = new Router();

// Mount critical middleware
router.use(corsMiddleware);
router.use(csrfMiddleware);
router.use(csrfTokenInjection);
router.use(loggingMiddleware);

// Mount auth routes (most critical)
router.post('/api/auth/login', authRouter.login);
router.post('/api/auth/logout', authRouter.logout);
router.get('/api/auth/session', authRouter.session);
router.post('/api/auth/register', authRouter.register);

// Health check endpoint
router.get('/api/health', async (ctx: Context) => {
  ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
  ctx.res.end(JSON.stringify({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  }));
});

// Test endpoint for debugging hanging requests
router.get('/api/test', async (ctx: Context) => {
  console.log('Test endpoint hit');
  ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
  ctx.res.end(JSON.stringify({ 
    message: 'Test successful',
    headers: ctx.req.headers,
    method: ctx.req.method,
    url: ctx.req.url
  }));
});

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  
  const ctx: Context = {
    req,
    res,
    url,
    state: {},
    csrfToken: undefined
  };

  try {
    // Try to handle with router
    const handled = await router.handle(ctx);
    
    if (!handled) {
      // Not found
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  } catch (error) {
    // Error handling
    console.error('Server error:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Minimal server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /api/health - Health check');
  console.log('  GET  /api/test - Test endpoint'); 
  console.log('  POST /api/auth/login - Login');
  console.log('  POST /api/auth/logout - Logout');
  console.log('  GET  /api/auth/session - Get session');
  console.log('  POST /api/auth/register - Register');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
