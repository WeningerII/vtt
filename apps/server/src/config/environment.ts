import { logger } from '@vtt/logging';

/**
 * Environment configuration for VTT server
 */

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  jwtSecret: string;
  refreshSecret: string;
  clientUrl: string;
  corsOrigin: string[];
  database: {
    url: string;
    maxConnections: number;
  };
  oauth: {
    discord: {
      clientId: string;
      clientSecret: string;
      callbackURL: string;
      scope: string[];
    };
    google: {
      clientId: string;
      clientSecret: string;
      callbackURL: string;
      scope: string[];
    };
  };
  session: {
    secret: string;
    maxAge: number;
  };
  storage: {
    assetsPath: string;
    maxFileSize: number;
    allowedTypes: string[];
  };
  websocket: {
    heartbeatInterval: number;
    maxConnections: number;
  };
  ai: {
    provider: string;
    apiKey?: string;
    endpoint?: string;
  };
}

/**
 * Load and validate environment configuration
 */
export function loadConfig(): ServerConfig {
  const requiredEnvVars = [
    'JWT_SECRET',
    'REFRESH_SECRET',
    'SESSION_SECRET',
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET'
  ];

  // Check for required environment variables in production
  if (process.env.NODE_ENV === 'production') {
    const missing = requiredEnvVars.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  const config: ServerConfig = {
    port: Number(process.env.PORT) || 8080,
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-key',
    refreshSecret: process.env.REFRESH_SECRET || 'dev-refresh-secret-key',
    clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
    corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    
    database: {
      url: process.env.DATABASE_URL || 'file:./dev.db',
      maxConnections: Number(process.env.DB_MAX_CONNECTIONS) || 10
    },

    oauth: {
      discord: {
        clientId: process.env.DISCORD_CLIENT_ID || '',
        clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
        callbackURL: process.env.DISCORD_CALLBACK_URL || `${process.env.SERVER_URL || 'http://localhost:8080'}/auth/discord/callback`,
        scope: ['identify', 'email']
      },
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        callbackURL: process.env.GOOGLE_CALLBACK_URL || `${process.env.SERVER_URL || 'http://localhost:8080'}/auth/google/callback`,
        scope: ['profile', 'email']
      }
    },

    session: {
      secret: process.env.SESSION_SECRET || 'dev-session-secret',
      maxAge: Number(process.env.SESSION_MAX_AGE) || 7 * 24 * 60 * 60 * 1000 // 7 days
    },

    storage: {
      assetsPath: process.env.ASSETS_PATH || './uploads',
      maxFileSize: Number(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB
      allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'audio/mpeg', 'audio/wav', 'audio/ogg',
        'application/pdf'
      ]
    },

    websocket: {
      heartbeatInterval: Number(process.env.WS_HEARTBEAT_INTERVAL) || 30000, // 30s
      maxConnections: Number(process.env.WS_MAX_CONNECTIONS) || 1000
    },

    ai: {
      provider: process.env.AI_PROVIDER || 'mock',
      ...(process.env.AI_API_KEY && { apiKey: process.env.AI_API_KEY }),
      ...(process.env.AI_ENDPOINT && { endpoint: process.env.AI_ENDPOINT })
    }
  };

  // Validate configuration
  validateConfig(config);
  
  return config;
}

/**
 * Validate loaded configuration
 */
function validateConfig(config: ServerConfig): void {
  if (config.port < 1 || config.port > 65535) {
    throw new Error('Invalid port number');
  }

  if (config.jwtSecret.length < 32 && config.nodeEnv === 'production') {
    throw new Error('JWT secret must be at least 32 characters in production');
  }

  if (config.corsOrigin.length === 0) {
    throw new Error('At least one CORS origin must be specified');
  }

  if (!config.database.url) {
    throw new Error('Database URL is required');
  }

  logger.info('✅ Configuration validated successfully');
}

/**
 * Get configuration for specific service
 */
export function getServiceConfig<T extends keyof ServerConfig>(service: T, config: ServerConfig): ServerConfig[T] {
  return config[service];
}

// Export singleton instance
export const _serverConfig = loadConfig();
