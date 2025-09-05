/**
 * Legacy Provider Implementations - Stub versions for compatibility
 */
import { AIProvider, AICapability, HealthStatus } from '../types';

export class OpenAIProvider implements AIProvider {
  name = "openai" as const;
  version = "1.0.0";

  constructor(private config: { apiKey: string; baseUrl?: string }) {}

  capabilities(): AICapability[] {
    return [
      {
        type: 'text',
        subtype: 'generation',
        models: [{
          id: 'gpt-3.5-turbo',
          displayName: 'GPT-3.5 Turbo',
          contextWindow: 4096,
          maxOutputTokens: 1000,
          pricing: { input: 0.001, output: 0.002, currency: 'USD', lastUpdated: new Date() }
        }]
      }
    ];
  }

  async healthCheck(): Promise<HealthStatus> {
    return { status: 'healthy', lastCheck: new Date() };
  }

  async textToImage(): Promise<any> {
    throw new Error('OpenAI textToImage not implemented in stub');
  }

  async generateText(): Promise<any> {
    throw new Error('OpenAI generateText not implemented in stub');
  }
}

export class AnthropicProvider implements AIProvider {
  name = "anthropic" as const;
  version = "1.0.0";

  constructor(private config: { apiKey: string; baseUrl?: string }) {}

  capabilities(): AICapability[] {
    return [
      {
        type: 'text',
        subtype: 'generation',
        models: [{
          id: 'claude-3',
          displayName: 'Claude 3',
          contextWindow: 200000,
          maxOutputTokens: 4000,
          pricing: { input: 0.003, output: 0.015, currency: 'USD', lastUpdated: new Date() }
        }]
      }
    ];
  }

  async healthCheck(): Promise<HealthStatus> {
    return { status: 'healthy', lastCheck: new Date() };
  }

  async generateText(): Promise<any> {
    throw new Error('Anthropic generateText not implemented in stub');
  }
}

export class StabilityAIProvider implements AIProvider {
  name = "stability-ai" as const;
  version = "1.0.0";

  constructor(private config: { apiKey: string; baseUrl?: string; model?: string }) {}

  capabilities(): AICapability[] {
    return [
      {
        type: 'image',
        subtype: 'generation',
        models: [{
          id: 'stable-diffusion-xl',
          displayName: 'Stable Diffusion XL',
          contextWindow: 1000,
          maxOutputTokens: 0,
          pricing: { input: 0.04, output: 0, currency: 'USD', lastUpdated: new Date() }
        }]
      }
    ];
  }

  async healthCheck(): Promise<HealthStatus> {
    return { status: 'healthy', lastCheck: new Date() };
  }

  async textToImage(): Promise<any> {
    throw new Error('StabilityAI textToImage not implemented in stub');
  }
}

export class HuggingFaceProvider implements AIProvider {
  name = "huggingface" as const;
  version = "1.0.0";

  constructor(private config: { apiKey: string; baseUrl?: string }) {}

  capabilities(): AICapability[] {
    return [
      {
        type: 'text',
        subtype: 'generation',
        models: [{
          id: 'mistral-7b',
          displayName: 'Mistral 7B',
          contextWindow: 8192,
          maxOutputTokens: 2000,
          pricing: { input: 0.0002, output: 0.0002, currency: 'USD', lastUpdated: new Date() }
        }]
      }
    ];
  }

  async healthCheck(): Promise<HealthStatus> {
    return { status: 'healthy', lastCheck: new Date() };
  }

  async generateText(): Promise<any> {
    throw new Error('HuggingFace generateText not implemented in stub');
  }
}

export class ReplicateProvider implements AIProvider {
  name = "replicate" as const;
  version = "1.0.0";

  constructor(private apiKey: string) {}

  capabilities(): AICapability[] {
    return [
      {
        type: 'image',
        subtype: 'generation',
        models: [{
          id: 'sdxl',
          displayName: 'SDXL on Replicate',
          contextWindow: 1000,
          maxOutputTokens: 0,
          pricing: { input: 0.0023, output: 0, currency: 'USD', lastUpdated: new Date() }
        }]
      }
    ];
  }

  async healthCheck(): Promise<HealthStatus> {
    return { status: 'healthy', lastCheck: new Date() };
  }

  async textToImage(): Promise<any> {
    throw new Error('Replicate textToImage not implemented in stub');
  }
}

export function createProviders(config: any) {
  const providers: AIProvider[] = [];
  
  if (config.openai?.apiKey) {
    providers.push(new OpenAIProvider(config.openai));
  }
  
  if (config.anthropic?.apiKey) {
    providers.push(new AnthropicProvider(config.anthropic));
  }
  
  if (config.stability?.apiKey) {
    providers.push(new StabilityAIProvider(config.stability));
  }
  
  if (config.huggingface?.apiKey) {
    providers.push(new HuggingFaceProvider(config.huggingface));
  }
  
  if (config.replicate?.apiKey) {
    providers.push(new ReplicateProvider(config.replicate.apiKey));
  }
  
  return providers;
}
