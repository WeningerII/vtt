/**
 * CORS Configuration
 * Production-ready CORS settings with environment-based configuration
 */

export interface CorsConfig {
  origin: string | string[] | boolean;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

/**
 * Get CORS configuration based on environment
 */
export function getCorsConfig(): CorsConfig {
  const env = process.env.NODE_ENV || "development";

  // Parse allowed origins from environment variable
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
    : [];

  if (env === "production") {
    return {
      origin: allowedOrigins.length > 0 ? allowedOrigins : false,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-CSRF-Token",
        "X-Request-ID",
        "X-Request-Time",
      ],
      exposedHeaders: [
        "X-Request-ID",
        "X-CSRF-Token",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
      ],
      credentials: true,
      maxAge: 86400, // 24 hours
    };
  }

  // Development configuration - more permissive
  return {
    origin: true, // Allow all origins in development
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-CSRF-Token",
      "X-Request-ID",
      "Accept",
      "Origin",
      "X-Request-Time",
    ],
    exposedHeaders: [
      "X-Request-ID",
      "X-CSRF-Token",
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
    ],
    credentials: true,
    maxAge: 3600, // 1 hour in development
  };
}

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(origin: string | undefined, config: CorsConfig): boolean {
  if (!origin) {return false;}

  if (config.origin === true) {return true;}
  if (config.origin === false) {return false;}

  if (typeof config.origin === "string") {
    return origin === config.origin;
  }

  if (Array.isArray(config.origin)) {
    return config.origin.includes(origin);
  }

  return false;
}
