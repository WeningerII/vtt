/**
 * Environment Configuration Abstraction Layer
 * Provides a unified interface for managing configuration across different environments and cloud providers
 */

export interface CloudProviderConfig {
  provider: 'aws' | 'gcp' | 'azure' | 'local';
  region: string;
  credentials?: {
    accessKeyId?: string | undefined;
    secretAccessKey?: string | undefined;
    projectId?: string | undefined;
    serviceAccountKey?: string | undefined;
    subscriptionId?: string | undefined;
    tenantId?: string | undefined;
    clientId?: string | undefined;
    clientSecret?: string | undefined;
  } | undefined;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  maxConnections: number;
  connectionTimeout: number;
  provider: 'postgresql' | 'mysql' | 'sqlite';
}

export interface CacheConfig {
  host: string;
  port: number;
  password?: string | undefined;
  database: number;
  keyPrefix: string;
  ttl: number;
  provider: 'redis' | 'memcached' | 'memory';
}

export interface StorageConfig {
  provider: 'aws-s3' | 'gcp-storage' | 'azure-blob' | 'minio' | 'local';
  endpoint?: string | undefined;
  bucket: string;
  region?: string | undefined;
  accessKeyId?: string | undefined;
  secretAccessKey?: string | undefined;
  cdnUrl?: string | undefined;
  maxFileSize: number;
  allowedTypes: string[];
}

export interface AIProviderConfig {
  enabled: boolean;
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
  timeout: number;
  maxRetries: number;
  rateLimitPerMinute: number;
  priority: number;
}

export interface AIProvidersConfig {
  openai: AIProviderConfig;
  anthropic: AIProviderConfig;
  google: AIProviderConfig;
  openrouter: AIProviderConfig;
  stability: AIProviderConfig;
  replicate: AIProviderConfig;
  huggingface: AIProviderConfig;
}

export interface SecurityConfig {
  jwtSecret: string;
  sessionSecret: string;
  encryptionKey: string;
  corsOrigins: string[];
  rateLimitWindow: number;
  rateLimitMax: number;
  enableHsts: boolean;
  enableCsp: boolean;
}

export interface MonitoringConfig {
  enabled: boolean;
  provider: 'prometheus' | 'datadog' | 'newrelic' | 'custom';
  endpoint?: string | undefined;
  apiKey?: string | undefined;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  metricsEnabled: boolean;
  tracingEnabled: boolean;
}

export interface EnvironmentConfiguration {
  environment: 'development' | 'staging' | 'production' | 'test';
  cloud: CloudProviderConfig;
  server: {
    port: number;
    host: string;
    protocol: 'http' | 'https';
    domain?: string | undefined;
  };
  database: DatabaseConfig;
  cache: CacheConfig;
  storage: StorageConfig;
  ai: AIProvidersConfig;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
}

export class EnvironmentConfigManager {
  private config: EnvironmentConfiguration;
  private readonly defaultConfig: Partial<EnvironmentConfiguration>;

  constructor() {
    this.defaultConfig = {
      server: {
        port: 8080,
        host: '0.0.0.0',
        protocol: 'http'
      },
      security: {
        corsOrigins: ['*'],
        rateLimitWindow: 60000,
        rateLimitMax: 100,
        enableHsts: true,
        enableCsp: true,
        jwtSecret: '',
        sessionSecret: '',
        encryptionKey: ''
      },
      monitoring: {
        enabled: true,
        provider: 'prometheus',
        logLevel: 'info',
        metricsEnabled: true,
        tracingEnabled: false
      }
    };
    
    this.config = this.loadConfiguration();
  }

  private loadConfiguration(): EnvironmentConfiguration {
    const env = process.env.NODE_ENV || 'development';
    
    // Base configuration
    const config: EnvironmentConfiguration = {
      environment: env as any,
      cloud: this.loadCloudConfig(),
      server: this.loadServerConfig(),
      database: this.loadDatabaseConfig(),
      cache: this.loadCacheConfig(),
      storage: this.loadStorageConfig(),
      ai: this.loadAIProvidersConfig(),
      security: this.loadSecurityConfig(),
      monitoring: this.loadMonitoringConfig()
    };

    return this.mergeWithDefaults(config);
  }

  private loadCloudConfig(): CloudProviderConfig {
    const provider = (process.env.CLOUD_PROVIDER || 'local') as CloudProviderConfig['provider'];
    const region = process.env.CLOUD_REGION || 'us-east-1';

    const credentials: CloudProviderConfig['credentials'] = {};

    switch (provider) {
      case 'aws':
        credentials.accessKeyId = process.env.AWS_ACCESS_KEY_ID || undefined;
        credentials.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || undefined;
        break;
      case 'gcp':
        credentials.projectId = process.env.GOOGLE_PROJECT_ID || undefined;
        credentials.serviceAccountKey = process.env.GOOGLE_APPLICATION_CREDENTIALS || undefined;
        break;
      case 'azure':
        credentials.subscriptionId = process.env.AZURE_SUBSCRIPTION_ID || undefined;
        credentials.tenantId = process.env.AZURE_TENANT_ID || undefined;
        credentials.clientId = process.env.AZURE_CLIENT_ID || undefined;
        credentials.clientSecret = process.env.AZURE_CLIENT_SECRET || undefined;
        break;
    }

    return { provider, region, credentials };
  }

  private loadServerConfig() {
    return {
      port: parseInt(process.env.PORT || '8080', 10),
      host: process.env.HOST || '0.0.0.0',
      protocol: (process.env.PROTOCOL || 'http') as 'http' | 'https',
      domain: process.env.DOMAIN_NAME || undefined
    };
  }

  private loadDatabaseConfig(): DatabaseConfig {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (databaseUrl) {
      // Parse DATABASE_URL
      const url = new URL(databaseUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port, 10) || 5432,
        database: url.pathname.slice(1),
        username: url.username,
        password: url.password,
        ssl: url.searchParams.get('sslmode') === 'require',
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
        connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000', 10),
        provider: 'postgresql'
      };
    }

    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'vtt',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000', 10),
      provider: 'postgresql'
    };
  }

  private loadCacheConfig(): CacheConfig {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      database: parseInt(process.env.REDIS_DB || '0', 10),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'vtt:',
      ttl: parseInt(process.env.CACHE_TTL || '3600', 10),
      provider: 'redis'
    };
  }

  private loadStorageConfig(): StorageConfig {
    const provider = (process.env.STORAGE_PROVIDER || 'minio') as StorageConfig['provider'];
    
    return {
      provider,
      endpoint: process.env.MINIO_ENDPOINT || process.env.STORAGE_ENDPOINT || undefined,
      bucket: process.env.STORAGE_BUCKET || 'vtt-assets',
      region: process.env.STORAGE_REGION || undefined,
      accessKeyId: process.env.MINIO_ROOT_USER || process.env.STORAGE_ACCESS_KEY || undefined,
      secretAccessKey: process.env.MINIO_ROOT_PASSWORD || process.env.STORAGE_SECRET_KEY || undefined,
      cdnUrl: process.env.CDN_URL || undefined,
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // 50MB
      allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'image/*,audio/*,video/*').split(',')
    };
  }

  private loadAIProvidersConfig(): AIProvidersConfig {
    const defaultAIConfig: AIProviderConfig = {
      enabled: false,
      timeout: parseInt(process.env.AI_DEFAULT_TIMEOUT || '30000', 10),
      maxRetries: parseInt(process.env.AI_DEFAULT_MAX_RETRIES || '3', 10),
      rateLimitPerMinute: parseInt(process.env.AI_DEFAULT_RATE_LIMIT || '60', 10),
      priority: 1
    };

    return {
      openai: {
        ...defaultAIConfig,
        enabled: !!process.env.OPENAI_API_KEY,
        apiKey: process.env.OPENAI_API_KEY || undefined,
        priority: 3
      },
      anthropic: {
        ...defaultAIConfig,
        enabled: !!process.env.ANTHROPIC_API_KEY,
        apiKey: process.env.ANTHROPIC_API_KEY || undefined,
        priority: 4
      },
      google: {
        ...defaultAIConfig,
        enabled: !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
        apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || undefined,
        priority: 2
      },
      openrouter: {
        ...defaultAIConfig,
        enabled: !!process.env.OPENROUTER_API_KEY,
        apiKey: process.env.OPENROUTER_API_KEY || undefined,
        priority: 5
      },
      stability: {
        ...defaultAIConfig,
        enabled: !!process.env.STABILITY_API_KEY,
        apiKey: process.env.STABILITY_API_KEY || undefined,
        priority: 2
      },
      replicate: {
        ...defaultAIConfig,
        enabled: !!process.env.REPLICATE_API_TOKEN,
        apiKey: process.env.REPLICATE_API_TOKEN || undefined,
        priority: 2,
        rateLimitPerMinute: 30
      },
      huggingface: {
        ...defaultAIConfig,
        enabled: !!process.env.HUGGINGFACE_API_KEY,
        apiKey: process.env.HUGGINGFACE_API_KEY || undefined,
        priority: 2,
        rateLimitPerMinute: 20
      }
    };
  }

  private loadSecurityConfig(): SecurityConfig {
    return {
      jwtSecret: process.env.JWT_SECRET || this.generateSecret(),
      sessionSecret: process.env.SESSION_SECRET || this.generateSecret(),
      encryptionKey: process.env.ENCRYPTION_KEY || this.generateSecret(),
      corsOrigins: (process.env.CORS_ORIGINS || '*').split(','),
      rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
      rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      enableHsts: process.env.ENABLE_HSTS !== 'false',
      enableCsp: process.env.ENABLE_CSP !== 'false'
    };
  }

  private loadMonitoringConfig(): MonitoringConfig {
    return {
      enabled: process.env.MONITORING_ENABLED !== 'false',
      provider: (process.env.MONITORING_PROVIDER || 'prometheus') as MonitoringConfig['provider'],
      endpoint: process.env.MONITORING_ENDPOINT || undefined,
      apiKey: process.env.MONITORING_API_KEY || undefined,
      logLevel: (process.env.LOG_LEVEL || 'info') as MonitoringConfig['logLevel'],
      metricsEnabled: process.env.METRICS_ENABLED !== 'false',
      tracingEnabled: process.env.TRACING_ENABLED === 'true'
    };
  }

  private mergeWithDefaults(config: EnvironmentConfiguration): EnvironmentConfiguration {
    return {
      ...config,
      server: { ...this.defaultConfig.server, ...config.server },
      security: { ...this.defaultConfig.security, ...config.security },
      monitoring: { ...this.defaultConfig.monitoring, ...config.monitoring }
    };
  }

  private generateSecret(): string {
    if (this.config?.environment === 'production') {
      throw new Error('Security secrets must be explicitly set in production environment');
    }
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  public getConfig(): EnvironmentConfiguration {
    return this.config;
  }

  public get<T extends keyof EnvironmentConfiguration>(key: T): EnvironmentConfiguration[T] {
    return this.config[key];
  }

  public isDevelopment(): boolean {
    return this.config.environment === 'development';
  }

  public isProduction(): boolean {
    return this.config.environment === 'production';
  }

  public isTest(): boolean {
    return this.config.environment === 'test';
  }

  public reload(): void {
    this.config = this.loadConfiguration();
  }

  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate production requirements
    if (this.isProduction()) {
      if (!this.config.security.jwtSecret || this.config.security.jwtSecret.length < 32) {
        errors.push('JWT_SECRET must be at least 32 characters in production');
      }
      if (!this.config.security.sessionSecret || this.config.security.sessionSecret.length < 32) {
        errors.push('SESSION_SECRET must be at least 32 characters in production');
      }
      if (!this.config.database.password) {
        errors.push('Database password is required in production');
      }
      if (this.config.security.corsOrigins.includes('*')) {
        errors.push('CORS origins should not include "*" in production');
      }
    }

    // Validate database configuration
    if (!this.config.database.host) {
      errors.push('Database host is required');
    }

    // Validate at least one AI provider is configured
    const aiProviders = Object.values(this.config.ai);
    if (!aiProviders.some(provider => provider.enabled)) {
      errors.push('At least one AI provider must be configured');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Singleton instance
export const _environmentConfig = new EnvironmentConfigManager();
