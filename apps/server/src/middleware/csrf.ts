import crypto from "crypto";
import type { Context, Next } from "../router/types";

const CSRF_TOKEN_LENGTH = 32;
const CSRF_HEADER = "x-csrf-token";
const CSRF_COOKIE = "csrf-token";

/**
 * Generate a cryptographically secure CSRF token
 */
function generateToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

/**
 * CSRF protection middleware
 * Implements Double Submit Cookie pattern for CSRF protection
 */
export async function csrfMiddleware(ctx: Context, next: Next): Promise<void> {
  const method = ctx.req.method?.toUpperCase();

  // Skip CSRF check for safe methods
  if (["GET", "HEAD", "OPTIONS"].includes(method || "")) {
    // Generate and set CSRF token for safe methods
    const existingToken = getCookie(ctx.req.headers.cookie, CSRF_COOKIE);
    if (!existingToken) {
      const newToken = generateToken();
      setCookie(ctx.res, CSRF_COOKIE, newToken, {
        httpOnly: false, // Must be accessible to JavaScript
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });
      ctx.csrfToken = newToken;
    } else {
      ctx.csrfToken = existingToken;
    }
    return next();
  }

  // For state-changing methods, validate CSRF token
  const cookieToken = getCookie(ctx.req.headers.cookie, CSRF_COOKIE);
  const headerToken = ctx.req.headers[CSRF_HEADER] as string;

  if (!cookieToken || !headerToken) {
    ctx.res.writeHead(403, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "CSRF token missing" }));
    return;
  }

  if (cookieToken !== headerToken) {
    ctx.res.writeHead(403, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "CSRF token mismatch" }));
    return;
  }

  ctx.csrfToken = cookieToken;
  return next();
}

/**
 * Helper function to get cookie value
 */
function getCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [key, value] = cookie.split("=");
    if (key === name) {
      return value || null;
    }
  }
  return null;
}

/**
 * Helper function to set cookie
 */
function setCookie(
  res: any,
  name: string,
  value: string,
  options: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "strict" | "lax" | "none";
    path?: string;
    maxAge?: number;
  } = {},
): void {
  const parts = [`${name}=${value}`];

  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);

  const existingCookies = res.getHeader("Set-Cookie") || [];
  const cookies = Array.isArray(existingCookies) ? existingCookies : [existingCookies];
  cookies.push(parts.join("; "));

  res.setHeader("Set-Cookie", cookies);
}

/**
 * Middleware to inject CSRF token into response for client access
 */
export async function csrfTokenMiddleware(ctx: Context, next: Next): Promise<void> {
  await next();

  // Add CSRF token to response headers for client to read
  if (ctx.csrfToken) {
    ctx.res.setHeader("X-CSRF-Token", ctx.csrfToken);
  }
}
