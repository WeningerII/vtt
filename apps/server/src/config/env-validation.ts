/**
 * Environment Variable Validation
 * 
 * Validates required environment variables at application startup.
 * Fails fast in production if critical secrets are missing or using defaults.
 */

import { logger as pinoLogger } from "@vtt/logging";

// Fallback logger in case @vtt/logging isn't loaded yet
const logger = pinoLogger || {
  info: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.log.bind(console),
};

interface EnvVar {
  name: string;
  required: boolean;
  production: boolean; // Must be set in production
  validate?: (value: string | undefined) => boolean;
  default?: string;
  sensitive?: boolean; // Don't log value
}

const ENV_VARS: EnvVar[] = [
  // Database
  {
    name: "DATABASE_URL",
    required: true,
    production: true,
    validate: (v) => !!v && v.startsWith("postgresql://"),
    sensitive: true,
  },
  
  // Redis
  {
    name: "REDIS_URL",
    required: false,
    production: true,
    validate: (v) => !v || v.startsWith("redis://") || v.startsWith("rediss://"),
    sensitive: true,
  },
  
  // Server
  {
    name: "PORT",
    required: false,
    production: false,
    default: "8080",
    validate: (v) => !v || !isNaN(Number(v)),
  },
  {
    name: "NODE_ENV",
    required: true,
    production: true,
    validate: (v) => ["development", "production", "test"].includes(v || ""),
  },
  {
    name: "API_BASE_URL",
    required: true,
    production: true,
    validate: (v) => !!v && (v.startsWith("http://") || v.startsWith("https://")),
  },
  {
    name: "CLIENT_URL",
    required: true,
    production: true,
    validate: (v) => !!v && (v.startsWith("http://") || v.startsWith("https://")),
  },
  {
    name: "CORS_ORIGIN",
    required: true,
    production: true,
  },
  
  // Security & Auth
  {
    name: "JWT_SECRET",
    required: true,
    production: true,
    validate: (v) => {
      if (!v) {
        return false;
      }
      // Must not be the default dev secret
      if (v === "dev-secret-change-in-production") {
        return false;
      }
      // Must be at least 32 characters
      return v.length >= 32;
    },
    sensitive: true,
  },
  {
    name: "REFRESH_SECRET",
    required: true,
    production: true,
    validate: (v) => {
      if (!v) {
        return false;
      }
      if (v === "dev-secret-change-in-production") {
        return false;
      }
      return v.length >= 32;
    },
    sensitive: true,
  },
  {
    name: "SESSION_SECRET",
    required: true,
    production: true,
    validate: (v) => {
      if (!v) {
        return false;
      }
      if (v === "dev-session-secret-change-in-production") {
        return false;
      }
      return v.length >= 32;
    },
    sensitive: true,
  },
  
  // OAuth (optional but validated if present)
  {
    name: "DISCORD_CLIENT_ID",
    required: false,
    production: false,
    sensitive: false,
  },
  {
    name: "DISCORD_CLIENT_SECRET",
    required: false,
    production: false,
    sensitive: true,
  },
  {
    name: "GOOGLE_CLIENT_ID",
    required: false,
    production: false,
    sensitive: false,
  },
  {
    name: "GOOGLE_CLIENT_SECRET",
    required: false,
    production: false,
    sensitive: true,
  },
  
  // AI Providers (at least one recommended)
  {
    name: "OPENAI_API_KEY",
    required: false,
    production: false,
    sensitive: true,
  },
  {
    name: "ANTHROPIC_API_KEY",
    required: false,
    production: false,
    sensitive: true,
  },
  {
    name: "GOOGLE_API_KEY",
    required: false,
    production: false,
    sensitive: true,
  },
  {
    name: "OPENROUTER_API_KEY",
    required: false,
    production: false,
    sensitive: true,
  },
];

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate all environment variables
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === "production";

  logger.info("Validating environment variables...");

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name];
    const isEmpty = !value || value.trim() === "";

    // Check required variables
    if (envVar.required && isEmpty) {
      errors.push(`Missing required environment variable: ${envVar.name}`);
      continue;
    }

    // Check production-required variables
    if (isProduction && envVar.production && isEmpty) {
      errors.push(`Missing required environment variable for production: ${envVar.name}`);
      continue;
    }

    // Skip validation if empty and not required
    if (isEmpty) {
      continue;
    }

    // Run custom validation
    if (envVar.validate && !envVar.validate(value)) {
      errors.push(`Invalid value for environment variable: ${envVar.name}`);
      continue;
    }

    // Log successful validation (mask sensitive values)
    if (envVar.sensitive) {
      logger.debug(`✓ ${envVar.name}: [REDACTED]`);
    } else {
      logger.debug(`✓ ${envVar.name}: ${value}`);
    }
  }

  // Check for at least one AI provider
  const hasAIProvider = [
    process.env.OPENAI_API_KEY,
    process.env.ANTHROPIC_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.OPENROUTER_API_KEY,
  ].some((key) => key && key.trim() !== "");

  if (!hasAIProvider) {
    warnings.push(
      "No AI provider API keys configured. Character generation features will not work. " +
      "Set at least one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, OPENROUTER_API_KEY"
    );
  }

  // Check for OAuth configuration completeness
  if (process.env.DISCORD_CLIENT_ID && !process.env.DISCORD_CLIENT_SECRET) {
    warnings.push("DISCORD_CLIENT_ID is set but DISCORD_CLIENT_SECRET is missing. Discord OAuth will not work.");
  }
  if (process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_SECRET) {
    warnings.push("GOOGLE_CLIENT_ID is set but GOOGLE_CLIENT_SECRET is missing. Google OAuth will not work.");
  }

  // Log results
  if (errors.length > 0) {
    logger.error("❌ Environment validation failed:");
    errors.forEach((error) => logger.error(`  - ${error}`));
  }

  if (warnings.length > 0) {
    logger.warn("⚠️  Environment validation warnings:");
    warnings.forEach((warning) => logger.warn(`  - ${warning}`));
  }

  if (errors.length === 0 && warnings.length === 0) {
    logger.info("✅ Environment validation passed");
  }

  return {
    success: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate environment and exit if critical errors in production
 */
export function validateEnvironmentOrExit(): void {
  const result = validateEnvironment();

  if (!result.success) {
    if (process.env.NODE_ENV === "production") {
      logger.error("❌ FATAL: Environment validation failed in production. Exiting.");
      logger.error("Please review ENV_VARIABLES.md and set all required variables.");
      process.exit(1);
    } else {
      logger.error("❌ Environment validation failed in development mode.");
      logger.error("Application may not function correctly.");
      logger.error("Please review ENV_VARIABLES.md and set required variables.");
    }
  }

  if (result.warnings.length > 0 && process.env.NODE_ENV !== "test") {
    logger.warn("⚠️  Some optional features may not work due to missing configuration.");
  }
}

/**
 * Get a required environment variable or throw
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable not set: ${name}`);
  }
  return value;
}

/**
 * Get an optional environment variable with default
 */
export function getOptionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === "test";
}
