/**
 * Real AI Provider Implementations
 * Production-ready integrations with actual AI services
 */

import { AnthropicClaude4Provider } from './anthropic-claude4';
import { GeminiProvider } from './google-gemini';
import { AzureOpenAIProvider } from './azure-openai';
import { CircuitBreakerProvider } from './CircuitBreakerProvider';
import { AIProvider, CircuitBreakerConfig } from '../types';
import { ModelMapper } from '../model-mapper';

// Enhanced Circuit Breaker Configuration
const defaultCircuitBreakerConfig: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60000, // 1 minute
  monitoringWindowMs: 300000, // 5 minutes
  halfOpenMaxCalls: 3
};

// Provider Factory with Circuit Breaker Integration
export class ProviderFactory {
  private static instance: ProviderFactory;
  private modelMapper: ModelMapper;
  private circuitBreakerConfig: CircuitBreakerConfig;

  private constructor(config?: Partial<CircuitBreakerConfig>) {
    this.modelMapper = new ModelMapper();
    this.circuitBreakerConfig = { ...defaultCircuitBreakerConfig, ...config };
  }

  static getInstance(config?: Partial<CircuitBreakerConfig>): ProviderFactory {
    if (!ProviderFactory.instance) {
      ProviderFactory.instance = new ProviderFactory(config);
    }
    return ProviderFactory.instance;
  }

  createAnthropicProvider(options: {
    apiKey: string;
    baseURL?: string;
    defaultModel?: string;
  }): AIProvider {
    const provider = new AnthropicClaude4Provider(options);
    return new CircuitBreakerProvider(provider, this.circuitBreakerConfig);
  }

  createGeminiProvider(options: {
    apiKey: string;
    baseURL?: string;
    projectId?: string;
    defaultModel?: string;
  }): AIProvider {
    const provider = new GeminiProvider(options);
    return new CircuitBreakerProvider(provider, this.circuitBreakerConfig);
  }

  createAzureOpenAIProvider(options: {
    apiKey: string;
    endpoint: string;
    deployments: Record<string, any>;
    registrationKey?: string;
    apiVersion?: string;
  }): AIProvider {
    const provider = new AzureOpenAIProvider(options);
    return new CircuitBreakerProvider(provider, this.circuitBreakerConfig);
  }

  getModelMapper(): ModelMapper {
    return this.modelMapper;
  }
}

// Production Provider Registry
export class ProductionProviderRegistry {
  private providers = new Map<string, AIProvider>();
  private factory: ProviderFactory;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.factory = ProviderFactory.getInstance(config);
  }

  registerProvider(name: string, provider: AIProvider): void {
    this.providers.set(name, provider);
  }

  getProvider(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  getAllProviders(): Map<string, AIProvider> {
    return new Map(this.providers);
  }

  async initializeFromConfig(config: ProviderConfig): Promise<void> {
    if (config.anthropic?.apiKey) {
      const options: any = { apiKey: config.anthropic.apiKey };
      if (config.anthropic.baseURL) {options.baseURL = config.anthropic.baseURL;}
      if (config.anthropic.defaultModel) {options.defaultModel = config.anthropic.defaultModel;}
      
      const provider = this.factory.createAnthropicProvider(options);
      this.registerProvider('anthropic', provider);
    }

    if (config.google?.apiKey) {
      const options: any = { apiKey: config.google.apiKey };
      if (config.google.baseURL) {options.baseURL = config.google.baseURL;}
      if (config.google.projectId) {options.projectId = config.google.projectId;}
      if (config.google.defaultModel) {options.defaultModel = config.google.defaultModel;}
      
      const provider = this.factory.createGeminiProvider(options);
      this.registerProvider('google', provider);
    }

    if (config.azure?.apiKey && config.azure?.endpoint) {
      const options: any = {
        apiKey: config.azure.apiKey,
        endpoint: config.azure.endpoint,
        deployments: config.azure.deployments || {}
      };
      if (config.azure.registrationKey) {options.registrationKey = config.azure.registrationKey;}
      if (config.azure.apiVersion) {options.apiVersion = config.azure.apiVersion;}
      
      const provider = this.factory.createAzureOpenAIProvider(options);
      this.registerProvider('azure', provider);
    }
  }

  async healthCheckAll(): Promise<Record<string, { status: string; latency?: number }>> {
    const results: Record<string, { status: string; latency?: number }> = {};
    
    for (const [name, provider] of this.providers) {
      try {
        const health = await provider.healthCheck();
        const result: any = { status: health.status };
        if (health.latency !== undefined) {result.latency = health.latency;}
        results[name] = result;
      } catch (error) {
        results[name] = {
          status: 'error'
        };
      }
    }
    
    return results;
  }
}

// Configuration interface
export interface ProviderConfig {
  anthropic?: {
    apiKey: string;
    baseURL?: string;
    defaultModel?: string;
  };
  google?: {
    apiKey: string;
    baseURL?: string;
    projectId?: string;
    defaultModel?: string;
  };
  azure?: {
    apiKey: string;
    endpoint: string;
    deployments?: Record<string, any>;
    registrationKey?: string;
    apiVersion?: string;
  };
  circuitBreaker?: Partial<CircuitBreakerConfig>;
}

// Intelligent Provider Router with Fallback
export class IntelligentProviderRouter {
  private registry: ProductionProviderRegistry;
  private modelMapper: ModelMapper;
  private providerHealthCache = new Map<string, { status: string; lastCheck: number }>();
  private healthCheckInterval = 30000; // 30 seconds

  constructor(registry: ProductionProviderRegistry) {
    this.registry = registry;
    this.modelMapper = ProviderFactory.getInstance().getModelMapper();
    this.startHealthMonitoring();
  }

  async selectProvider(
    category: string,
    constraints?: { excludeProviders?: string[]; maxCost?: number; maxLatency?: number }
  ): Promise<{ provider: AIProvider; fallbacks: AIProvider[] }> {
    const fallbackChain = this.modelMapper.getFallbackChain(category);
    const availableProviders = fallbackChain.filter(name => {
      if (constraints?.excludeProviders?.includes(name)) {return false;}
      const health = this.providerHealthCache.get(name);
      return !health || health.status === 'healthy';
    });

    if (availableProviders.length === 0) {
      throw new Error(`No healthy providers available for category: ${category}`);
    }

    const primaryProviderName = availableProviders[0];
    const primaryProvider = this.registry.getProvider(primaryProviderName!);
    
    if (!primaryProvider) {
      throw new Error(`Provider ${primaryProviderName} not found in registry`);
    }

    const fallbackProviders = availableProviders.slice(1)
      .map(name => this.registry.getProvider(name))
      .filter((p): p is AIProvider => p !== undefined);

    return {
      provider: primaryProvider,
      fallbacks: fallbackProviders
    };
  }

  private startHealthMonitoring(): void {
    setInterval(async () => {
      const healthResults = await this.registry.healthCheckAll();
      for (const [name, health] of Object.entries(healthResults)) {
        this.providerHealthCache.set(name, {
          status: health.status,
          lastCheck: Date.now()
        });
      }
    }, this.healthCheckInterval);
  }

  getHealthStatus(): Record<string, { status: string; lastCheck: number }> {
    return Object.fromEntries(this.providerHealthCache);
  }
}

// Export all provider classes
export {
  AnthropicClaude4Provider,
  GeminiProvider,
  AzureOpenAIProvider,
  CircuitBreakerProvider
};

// Export legacy providers for backward compatibility
export {
  OpenAIProvider,
  AnthropicProvider,
  StabilityAIProvider,
  HuggingFaceProvider,
  ReplicateProvider,
  createProviders
} from './legacy-providers';

// Export model mapper
export { ModelMapper } from '../model-mapper';

// Convenience function for quick setup
export async function createProductionAISystem(config: ProviderConfig): Promise<{
  registry: ProductionProviderRegistry;
  router: IntelligentProviderRouter;
  modelMapper: ModelMapper;
}> {
  const registry = new ProductionProviderRegistry(config.circuitBreaker);
  await registry.initializeFromConfig(config);
  
  const router = new IntelligentProviderRouter(registry);
  const modelMapper = ProviderFactory.getInstance().getModelMapper();

  return { registry, router, modelMapper };
}
