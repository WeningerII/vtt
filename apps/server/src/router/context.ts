import { IncomingMessage, ServerResponse } from "http";
import { PrismaClient } from "@prisma/client";
import { User, AuthSession } from "@vtt/auth";

// Extend IncomingMessage to include auth info
export interface AuthenticatedRequest extends IncomingMessage {
  user?: User;
  session?: AuthSession;
}

export interface RouteContext {
  req: AuthenticatedRequest;
  res: ServerResponse;
  prisma: PrismaClient;
  url: URL;
  // Optional path parameters extracted from the matched route, e.g. { id: "123" }
  params?: Record<string, string>;
  // Correlation ID for the current request, also returned as X-Request-ID header
  requestId: string;
  // CSRF token for the current request
  csrfToken?: string;
}

export interface RouteHandler {
  (ctx: RouteContext): Promise<void> | void;
}

export interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
}

export type Next = () => Promise<void>;

export interface Middleware {
  (_ctx: RouteContext, _next: Next): Promise<void>;
}

// Re-export for compatibility
export type Context = RouteContext;
