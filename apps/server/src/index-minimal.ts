/**
 * Minimal server configuration for testing and debugging
 * This bypasses broken modules to get the server running
 */

import http from "http";
import { URL } from "url";
import { Router } from "./router/router";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import type { Context } from "./router/types";

// Import working middleware
import { corsMiddleware } from "./middleware/cors";
import { csrfMiddleware } from "./middleware/csrf";
import { loggingMiddleware } from "./middleware/logging";

// Import minimal routes
import { authRouter } from "./routes/auth";

const PORT = process.env.PORT || 3000;
const router = new Router();
const prisma = new PrismaClient();

// Mount critical middleware
router.use(corsMiddleware);
router.use(csrfMiddleware);
router.use(loggingMiddleware);

// Error handling middleware - implement inline
router.use(async (ctx: Context) => {
  if (!ctx.res.headersSent) {
    ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

// Mount auth routes (most critical)
// Note: authRouter is an Express router, not individual handlers
// We need to mount it properly or extract the handlers
router.use(async (ctx: Context) => {
  // For now, implement basic auth endpoints directly
  const { pathname } = new URL(ctx.req.url || '', `http://${ctx.req.headers.host}`);
  const method = ctx.req.method;
  
  if (pathname === '/api/auth/login' && method === 'POST') {
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ 
      success: true,
      user: { id: '1', email: 'test@example.com', username: 'testuser' },
      tokens: { accessToken: 'test-token' }
    }));
  } else if (pathname === '/api/auth/register' && method === 'POST') {
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ 
      success: true,
      user: { id: '1', email: 'test@example.com', username: 'testuser' },
      tokens: { accessToken: 'test-token' }
    }));
  } else if (pathname === '/api/auth/logout' && method === 'POST') {
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ success: true, message: 'Logged out' }));
  } else if (pathname === '/api/auth/session' && method === 'GET') {
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ 
      authenticated: false,
      user: null
    }));
  }
});

// Health check endpoint
router.get("/api/health", async (ctx: Context) => {
  ctx.res.writeHead(200, { "Content-Type": "application/json" });
  ctx.res.end(
    JSON.stringify({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }),
  );
});

// Test endpoint for debugging hanging requests
router.get("/api/test", async (ctx: Context) => {
  // Test endpoint accessed
  ctx.res.writeHead(200, { "Content-Type": "application/json" });
  ctx.res.end(
    JSON.stringify({
      message: "Test successful",
      headers: ctx.req.headers,
      method: ctx.req.method,
      url: ctx.req.url,
    }),
  );
});

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  const ctx: Context = {
    req: req as Context['req'],
    res,
    url,
    prisma,
    requestId: uuidv4(),
  };

  try {
    // Try to handle with router
    const handled = await router.handle(ctx);

    if (!handled) {
      // Not found
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
  } catch (error) {
    // Error handling
    // Server error occurred
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }
});

// Start server
server.listen(PORT, () => {
  // Minimal server started on port ${PORT}
  // Available endpoints: health, test, auth routes
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  // SIGTERM received, closing server
  server.close(() => {
    // Server closed
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  // SIGINT received, closing server
  server.close(() => {
    // Server closed
    process.exit(0);
  });
});
