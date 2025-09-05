import { Middleware } from "../router/types";
import { logger } from "@vtt/logging";
import { HttpError } from "../utils/json";

// Security headers for error responses
const SECURITY_HEADERS = {
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
} as const;

// Error message sanitization for production
const sanitizeErrorMessage = (error: unknown, isDevelopment: boolean): string => {
  if (error instanceof HttpError) {
    return error.message;
  }

  if (isDevelopment && error instanceof Error) {
    return error.message;
  }

  // Generic message for production to avoid information disclosure
  return "Internal server error";
};

// Rate limiting for error responses (simple in-memory implementation)
const errorRateLimit = new Map<string, { count: number; resetTime: number }>();
const MAX_ERRORS_PER_IP = 50;
const RATE_LIMIT_WINDOW = 60000; // 1 minute

const isRateLimited = (clientIP: string): boolean => {
  const now = Date.now();
  const record = errorRateLimit.get(clientIP);

  if (!record || now > record.resetTime) {
    errorRateLimit.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }

  if (record.count >= MAX_ERRORS_PER_IP) {
    return true;
  }

  record.count++;
  return false;
};

export const errorMiddleware: Middleware = async (ctx, _next) => {
  const startTime = Date.now();

  try {
    await _next();
  } catch (error) {
    const rid = ctx.requestId;
    const clientIP = ctx.req.socket.remoteAddress || "unknown";
    const isDevelopment = process.env.NODE_ENV === "development";

    // Rate limiting check
    if (isRateLimited(clientIP)) {
      if (!ctx.res.headersSent) {
        ctx.res.writeHead(429, SECURITY_HEADERS);
        ctx.res.end(
          JSON.stringify({
            error: "Too many errors from this IP",
            requestId: rid,
            retryAfter: 60,
          }),
        );
      }
      return;
    }

    // Enhanced error logging with performance metrics
    const duration = Date.now() - startTime;
    const errorDetails =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: isDevelopment ? error.stack : undefined,
          }
        : String(error);

    logger.error(
      `[error] rid=${rid} ${ctx.req.method} ${ctx.url.pathname} (${duration}ms) from ${clientIP}`,
      typeof errorDetails === "string" ? { message: errorDetails } : errorDetails,
    );

    if (!ctx.res.headersSent) {
      // Set security headers and request ID
      const headers = { ...SECURITY_HEADERS };
      if (rid) {headers["X-Request-ID"] = rid;}

      if (error instanceof HttpError) {
        // Validate status code to prevent header injection
        const status = Math.max(400, Math.min(599, error.status));
        ctx.res.writeHead(status, headers);

        const response = {
          error: sanitizeErrorMessage(error, isDevelopment),
          requestId: rid,
          ...(error.details && isDevelopment ? { details: error.details } : {}),
        };

        ctx.res.end(JSON.stringify(response));
        return;
      }

      // Generic server error
      ctx.res.writeHead(500, headers);
      ctx.res.end(
        JSON.stringify({
          error: sanitizeErrorMessage(error, isDevelopment),
          requestId: rid,
          ...(isDevelopment &&
            error instanceof Error && {
              details: error.message,
              stack: error.stack?.split("\n").slice(0, 10), // Limit stack trace length
            }),
        }),
      );
    }
  }
};
