import type { Context } from "../router/types";
import { getCorsConfig, isOriginAllowed } from "../config/cors";

/**
 * CORS middleware
 * Handles Cross-Origin Resource Sharing with production-ready configuration
 */
export async function corsMiddleware(ctx: Context, next: () => Promise<void>): Promise<void> {
  const config = getCorsConfig();
  const requestOrigin = ctx.req.headers.origin;

  // Check if origin is allowed
  if (config.origin === true) {
    // Allow all origins (development mode)
    ctx.res.setHeader("Access-Control-Allow-Origin", requestOrigin || "*");
  } else if (isOriginAllowed(requestOrigin, config)) {
    // Set specific allowed origin
    ctx.res.setHeader("Access-Control-Allow-Origin", requestOrigin!);
  } else if (config.origin === false) {
    // CORS disabled - don't set any headers
  } else {
    // Origin not allowed - don't set Access-Control-Allow-Origin
  }

  // Always set these headers for allowed origins
  if (ctx.res.hasHeader("Access-Control-Allow-Origin")) {
    ctx.res.setHeader("Access-Control-Allow-Methods", config.methods.join(","));
    ctx.res.setHeader("Access-Control-Allow-Headers", config.allowedHeaders.join(","));
    ctx.res.setHeader("Access-Control-Expose-Headers", config.exposedHeaders.join(","));
    ctx.res.setHeader("Access-Control-Max-Age", config.maxAge.toString());

    if (config.credentials) {
      ctx.res.setHeader("Access-Control-Allow-Credentials", "true");
    }
  }

  // Handle preflight requests
  if (ctx.req.method === "OPTIONS") {
    ctx.res.writeHead(204);
    ctx.res.end();
    return;
  }

  return next();
}
