/**
 * Enhanced AI package with modern provider support and intelligent routing
 */

// Core AI types and interfaces
export * from './types';

// Modern provider implementations
export * from './providers/RealProviders';
export * from './providers/anthropic-claude4';
export * from './providers/google-gemini';
export * from './providers/azure-openai';
export * from './providers/CircuitBreakerProvider';

// Legacy provider implementations (for backward compatibility)
export * from './providers/openai';
export * from './providers/anthropic';
export * from './providers/stability';

// Model mapping and intelligent routing
export * from './model-mapper';

// Circuit breaker and reliability  
export { CircuitBreaker } from './circuit-breaker';

// VTT-specific content generation
export * from './vtt-content-generator';

// Content generation
export * from './ContentGenerator';

// Agent and NPC systems
export * from './Agent';
export * from './npc/AIEntity';
export * from './NPCBehaviorSystem';

// Pathfinding and spatial AI
export * from './Pathfinding';

// Behavior systems
export * from './BehaviorTree';
export * from './StateMachine';

// Campaign and encounter management
export * from './campaign/CampaignAssistant';
export * from './encounter/EncounterGenerator';

// Procedural content generation
export { ProceduralBehaviorGenerator } from './ProceduralBehaviorGenerator';

// AI Integration Systems
export { DynamicNPCManager } from './DynamicNPCManager';
export { VisionAIIntegration } from './VisionAIIntegration';
export { AIContentCache } from './AIContentCache';
export { UnifiedAISystem } from './UnifiedAISystem';

// Type-Safe AI Integration (Production Ready)
export { TypeSafeDynamicNPCManager } from './TypeSafeDynamicNPCManager';
export * from './types/AIIntegration';

// Production examples and utilities
export * from './examples/production-setup';

import {
  AIProvider,
  AICapability,
  AIContext,
  TextGenerationRequest,
  TextGenerationResult,
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageAnalysisRequest,
  ImageAnalysisResult,
  AudioGenerationRequest,
  AudioGenerationResult,
  EmbeddingRequest,
  EmbeddingResult,
  HealthStatus,
  TaskConstraints,
  ModelSelection
} from './types';
import { ModelMapper } from './model-mapper';

// Enhanced AI Registry with capability detection
export class AIRegistry {
  private providers = new Map<string, AIProvider>();
  private modelMapper = new ModelMapper();

  register(provider: AIProvider): void {
    this.providers.set(provider.name, provider);
  }

  unregister(name: string): boolean {
    return this.providers.delete(name);
  }

  get(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  list(): AIProvider[] {
    return [...this.providers.values()];
  }

  // Legacy compatibility method
  byCapability(capability: string): AIProvider[] {
    return this.listByCapability(capability);
  }

  listByCapability(capabilityType: string): AIProvider[] {
    return this.list().filter(provider => 
      provider.capabilities().some(cap => 
        cap.type === capabilityType || 
        cap.subtype === capabilityType ||
        cap.models.some(model => 
          model.features?.some(feature => feature.name === capabilityType)
        )
      )
    );
  }

  findProvidersForTask(requiredCapabilities: string[]): string[] {
    const providers: string[] = [];
    
    for (const provider of this.list()) {
      const caps = provider.capabilities();
      const hasAllCapabilities = requiredCapabilities.every(required =>
        caps.some(cap => 
          cap.type === required || 
          cap.subtype === required ||
          cap.models.some(model =>
            model.features?.some(feature => feature.name === required)
          )
        )
      );
      
      if (hasAllCapabilities) {
        providers.push(provider.name);
      }
    }
    
    return providers;
  }

  getBestProviderForTask(
    requiredCapabilities: string[],
    constraints?: TaskConstraints
  ): string | null {
    const availableProviders = this.list().map(p => p.name);
    const category = this.modelMapper.getBestCategoryForTask(requiredCapabilities, constraints);
    
    if (!category) return null;
    
    const preferredProviders = this.modelMapper.getProviderPreference(
      category,
      availableProviders,
      constraints
    );
    
    return preferredProviders?.[0] || null;
  }

  async healthCheckAll(): Promise<Record<string, HealthStatus>> {
    const results: Record<string, HealthStatus> = {};
    
    await Promise.all(
      this.list().map(async provider => {
        try {
          results[provider.name] = await provider.healthCheck();
        } catch (error) {
          results[provider.name] = {
            status: 'unhealthy',
            lastCheck: new Date(),
            details: {
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          };
        }
      })
    );
    
    return results;
  }
}

export type RoutingPolicy = {
  weights?: Record<string, number>;
  preferred?: string[];
  forbid?: string[];
};

export class AIRouter {
  constructor(
    private registry: AIRegistry,
    private policy: RoutingPolicy = {},
  ) {}

  private pick(cap: "textToImage" | "depth" | "segmentation"): AIProvider {
    const candidates = this.registry
      .byCapability(cap)
      .filter((p) => !(this.policy.forbid ?? []).includes(p.name));

    if (candidates.length === 0) throw new Error(`No providers registered with capability ${cap}`);

    const preferred = (this.policy.preferred ?? []).find((n) =>
      candidates.some((c) => c.name === n),
    );
    if (preferred) {
      const found = candidates.find((c) => c.name === preferred);
      if (found) return found;
    }

    const weights = candidates.map((c) => ({
      p: c,
      w: this.policy.weights?.[c.name] ?? 1,
    }));
    const total = weights.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;
    for (const { p, w } of weights) {
      r -= w;
      if (r <= 0) return p;
    }
    return candidates[0]!; // Safe because we checked candidates.length > 0 above
  }

  // Enhanced routing methods for modern providers
  async generateText(req: TextGenerationRequest, ctx?: AIContext): Promise<TextGenerationResult> {
    const constraints: TaskConstraints = {};
    if (ctx?.budgetUSD !== undefined) constraints.maxCost = ctx.budgetUSD;
    if (ctx?.timeoutMs !== undefined) constraints.maxLatency = ctx.timeoutMs;
    
    const provider = this.registry.getBestProviderForTask(['text'], constraints);
    
    if (!provider) throw new Error('No suitable text generation provider available');
    
    const p = this.registry.get(provider);
    if (!p?.generateText) throw new Error(`Provider ${provider} lacks text generation`);
    
    return p.generateText(req, ctx);
  }

  async generateImage(req: ImageGenerationRequest, ctx?: AIContext): Promise<ImageGenerationResult> {
    const provider = this.registry.getBestProviderForTask(['image-generation']);
    
    if (!provider) throw new Error('No suitable image generation provider available');
    
    const p = this.registry.get(provider);
    if (!p?.generateImage) throw new Error(`Provider ${provider} lacks image generation`);
    
    return p.generateImage(req, ctx);
  }

  // Legacy methods for backward compatibility
  async textToImage(req: TextToImageRequest, ctx?: AIContext): Promise<TextToImageResult> {
    const p = this.pick("textToImage") as any;
    if (!p.textToImage) throw new Error(`Provider ${p.name} lacks textToImage`);
    return p.textToImage(req, ctx);
  }

  async depth(req: DepthRequest, ctx?: AIContext): Promise<DepthResult> {
    const p = this.pick("depth") as any;
    if (!p.depth) throw new Error(`Provider ${p.name} lacks depth`);
    return p.depth(req, ctx);
  }

  async segmentation(req: SegmentationRequest, ctx?: AIContext): Promise<SegmentationResult> {
    const p = this.pick("segmentation") as any;
    if (!p.segmentation) throw new Error(`Provider ${p.name} lacks segmentation`);
    return p.segmentation(req, ctx);
  }
}

// Legacy type definitions for backward compatibility
import { ProviderCallMeta, ImageDataRef } from './types';

export interface TextToImageRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
}

export interface TextToImageResult extends ProviderCallMeta {
  image: ImageDataRef;
}

export interface DepthRequest {
  image: ImageDataRef;
}

export interface DepthResult extends ProviderCallMeta {
  depth: ImageDataRef;
}

export interface SegmentationRequest {
  image: ImageDataRef;
  labels?: string[];
}

export interface SegmentationResult extends ProviderCallMeta {
  mask: ImageDataRef;
  classes?: Record<string, number>;
}

// Legacy provider interface for compatibility
export interface LegacyAIProvider {
  name: string;
  capabilities(): Array<"textToImage" | "depth" | "segmentation">;
  textToImage?(req: TextToImageRequest, ctx?: AIContext): Promise<TextToImageResult>;
  depth?(req: DepthRequest, ctx?: AIContext): Promise<DepthResult>;
  segmentation?(req: SegmentationRequest, ctx?: AIContext): Promise<SegmentationResult>;
}

// Dummy provider for testing
export class DummyProvider implements AIProvider {
  name = "dummy" as const;
  version = "1.0.0";

  capabilities(): AICapability[] {
    return [
      {
        type: 'image',
        subtype: 'generation',
        models: [{
          id: 'dummy-svg',
          displayName: 'Dummy SVG Generator',
          contextWindow: 1000,
          maxOutputTokens: 0,
          pricing: { input: 0, output: 0, currency: 'USD', lastUpdated: new Date() }
        }]
      }
    ];
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      lastCheck: new Date()
    };
  }

  async textToImage(req: TextToImageRequest): Promise<TextToImageResult> {
    const start = Date.now();
    const w = req.width ?? 512;
    const h = req.height ?? 512;
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>` +
      `<rect width='100%' height='100%' fill='#222'/>` +
      `<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#fff' font-size='16'>${(req.prompt || "prompt").slice(0, 64)}</text>` +
      `</svg>`;
    const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    return {
      provider: this.name,
      model: "dummy-svg",
      costUSD: 0,
      latencyMs: Date.now() - start,
      image: { uri, width: w, height: h, mimeType: "image/svg+xml" },
    };
  }

  async depth(_: DepthRequest): Promise<DepthResult> {
    const start = Date.now();
    const uri =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
    return {
      provider: this.name,
      model: "dummy-depth",
      costUSD: 0,
      latencyMs: Date.now() - start,
      depth: { uri, mimeType: "image/png" },
    };
  }

  async segmentation(_: SegmentationRequest): Promise<SegmentationResult> {
    const start = Date.now();
    const uri =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottQAAAABJRU5ErkJggg==";
    return {
      provider: this.name,
      model: "dummy-seg",
      costUSD: 0,
      latencyMs: Date.now() - start,
      mask: { uri, mimeType: "image/png" },
      classes: {},
    };
  }
}

// Factory functions
export function createDefaultAIRouter(policy?: RoutingPolicy): AIRouter {
  const registry = new AIRegistry();
  registry.register(new DummyProvider());
  return new AIRouter(registry, policy);
}

export function createEnhancedAIRouter(
  providers: AIProvider[] = [],
  policy?: RoutingPolicy
): AIRouter {
  const registry = new AIRegistry();
  
  // Register provided providers
  providers.forEach(provider => registry.register(provider));
  
  // Add dummy provider as fallback if no providers given
  if (providers.length === 0) {
    registry.register(new DummyProvider());
  }
  
  return new AIRouter(registry, policy);
}
