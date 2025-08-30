import { Middleware } from "../router/types";

// Adds common security headers. Adjust CSP as needed for your deployment.
export const securityHeadersMiddleware: Middleware = async (ctx, _next) => {
  // Basic hardening
  ctx.res.setHeader("X-Content-Type-Options", "nosniff");
  ctx.res.setHeader("X-Frame-Options", "DENY");
  ctx.res.setHeader("Referrer-Policy", "no-referrer");
  ctx.res.setHeader("X-XSS-Protection", "0"); // modern browsers rely on CSP

  // HSTS (only make sense behind HTTPS). You can disable via env if needed.
  if ((process.env.HSTS ?? "true").toLowerCase() === "true") {
    ctx.res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains"); // 180 days
  }

  // Adaptive CSP based on endpoint
  let csp: string;
  if (ctx.url.pathname === "/docs") {
    // Relaxed CSP for Swagger UI documentation
    csp =
      process.env.CSP_DOCS ??
      "default-src 'self'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "script-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "font-src 'self' data:; " +
        "frame-ancestors 'none'; " +
        "base-uri 'self'";
  } else {
    // Strict CSP for API endpoints
    csp = process.env.CSP ?? "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";
  }

  ctx.res.setHeader("Content-Security-Policy", csp);

  await _next();
};
