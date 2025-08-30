/**
 * Minimal JavaScript server for testing middleware chain
 */

const http = require('http');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;

// Simple CORS middleware
const corsMiddleware = async (ctx, next) => {
  const origin = ctx.req.headers.origin || '*';
  ctx.res.setHeader('Access-Control-Allow-Origin', origin);
  ctx.res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  ctx.res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
  ctx.res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (ctx.req.method === 'OPTIONS') {
    ctx.res.writeHead(204);
    ctx.res.end();
    return;
  }
  
  await next();
};

// Simple logging middleware
const loggingMiddleware = async (ctx, next) => {
  const start = Date.now();
  console.log(`→ ${ctx.req.method} ${ctx.req.url}`);
  
  await next();
  
  const duration = Date.now() - start;
  console.log(`← ${ctx.req.method} ${ctx.req.url} ${ctx.res.statusCode} ${duration}ms`);
};

// Simple router
class Router {
  constructor() {
    this.routes = [];
    this.middlewares = [];
  }
  
  use(middleware) {
    this.middlewares.push(middleware);
  }
  
  get(path, handler) {
    this.routes.push({ method: 'GET', path, handler });
  }
  
  post(path, handler) {
    this.routes.push({ method: 'POST', path, handler });
  }
  
  async handle(ctx) {
    // Execute middlewares
    let index = 0;
    const next = async () => {
      if (index >= this.middlewares.length) {
        // Find and execute route handler
        for (const route of this.routes) {
          if (route.method === ctx.req.method && route.path === ctx.url.pathname) {
            await route.handler(ctx);
            return true;
          }
        }
        return false;
      }
      const middleware = this.middlewares[index++];
      await middleware(ctx, next);
    };
    
    await next();
    
    // Check if any route handled the request
    for (const route of this.routes) {
      if (route.method === ctx.req.method && route.path === ctx.url.pathname) {
        return true;
      }
    }
    return false;
  }
}

const router = new Router();

// Mount middleware
router.use(corsMiddleware);
router.use(loggingMiddleware);

// Health check endpoint
router.get('/api/health', async (ctx) => {
  ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
  ctx.res.end(JSON.stringify({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  }));
});

// Test endpoint for debugging
router.get('/api/test', async (ctx) => {
  console.log('Test endpoint hit - sending response');
  ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
  ctx.res.end(JSON.stringify({ 
    message: 'Test successful',
    method: ctx.req.method,
    url: ctx.req.url,
    headers: ctx.req.headers
  }));
});

// Echo endpoint for testing POST requests
router.post('/api/echo', async (ctx) => {
  let body = '';
  ctx.req.on('data', chunk => {
    body += chunk.toString();
  });
  
  ctx.req.on('end', () => {
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ 
      message: 'Echo successful',
      body: body,
      headers: ctx.req.headers
    }));
  });
});

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  
  const ctx = {
    req,
    res,
    url,
    state: {}
  };

  try {
    const handled = await router.handle(ctx);
    
    if (!handled) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  } catch (error) {
    console.error('Server error:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Minimal test server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /api/health - Health check');
  console.log('  GET  /api/test   - Test endpoint');
  console.log('  POST /api/echo   - Echo POST data');
  console.log('');
  console.log('Test with:');
  console.log(`  curl http://localhost:${PORT}/api/health`);
  console.log(`  curl http://localhost:${PORT}/api/test`);
  console.log(`  curl -X POST -d '{"test":"data"}' http://localhost:${PORT}/api/echo`);
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
  console.log('\nSIGINT received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
