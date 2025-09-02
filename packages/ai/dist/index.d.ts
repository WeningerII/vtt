/**
 * Enhanced AI package with modern provider support and intelligent routing
 */
export * from './types';
export * from './providers/RealProviders';
export * from './providers/anthropic-claude4';
export * from './providers/google-gemini';
export * from './providers/azure-openai';
export * from './providers/CircuitBreakerProvider';
export * from './providers/openai';
export * from './providers/anthropic';
export * from './providers/stability';
export * from './model-mapper';
export { CircuitBreaker } from './circuit-breaker';
export * from './vtt-content-generator';
export * from './ContentGenerator';
export * from './Agent';
export * from './npc/AIEntity';
export * from './NPCBehaviorSystem';
export * from './Pathfinding';
export * from './BehaviorTree';
export * from './StateMachine';
export * from './campaign/CampaignAssistant';
export * from './encounter/EncounterGenerator';
export { ProceduralBehaviorGenerator } from './ProceduralBehaviorGenerator';
export { DynamicNPCManager } from './DynamicNPCManager';
export { VisionAIIntegration } from './VisionAIIntegration';
export { AIContentCache } from './AIContentCache';
export { UnifiedAISystem } from './UnifiedAISystem';
export { TypeSafeDynamicNPCManager } from './TypeSafeDynamicNPCManager';
export * from './types/AIIntegration';
export * from './examples/production-setup';
import { AIProvider, AICapability, AIContext, TextGenerationRequest, TextGenerationResult, ImageGenerationRequest, ImageGenerationResult, HealthStatus, TaskConstraints } from './types';
export declare class AIRegistry {
    private providers;
    private modelMapper;
    register(provider: AIProvider): void;
    unregister(name: string): boolean;
    get(name: string): AIProvider | undefined;
    list(): AIProvider[];
    byCapability(capability: string): AIProvider[];
    listByCapability(capabilityType: string): AIProvider[];
    findProvidersForTask(requiredCapabilities: string[]): string[];
    getBestProviderForTask(requiredCapabilities: string[], constraints?: TaskConstraints): string | null;
    healthCheckAll(): Promise<Record<string, HealthStatus>>;
}
export type RoutingPolicy = {
    weights?: Record<string, number>;
    preferred?: string[];
    forbid?: string[];
};
export declare class AIRouter {
    private registry;
    private policy;
    constructor(registry: AIRegistry, policy?: RoutingPolicy);
    private pick;
    generateText(req: TextGenerationRequest, ctx?: AIContext): Promise<TextGenerationResult>;
    generateImage(req: ImageGenerationRequest, ctx?: AIContext): Promise<ImageGenerationResult>;
    textToImage(req: TextToImageRequest, ctx?: AIContext): Promise<TextToImageResult>;
    depth(req: DepthRequest, ctx?: AIContext): Promise<DepthResult>;
    segmentation(req: SegmentationRequest, ctx?: AIContext): Promise<SegmentationResult>;
}
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
export interface LegacyAIProvider {
    name: string;
    capabilities(): Array<"textToImage" | "depth" | "segmentation">;
    textToImage?(req: TextToImageRequest, ctx?: AIContext): Promise<TextToImageResult>;
    depth?(req: DepthRequest, ctx?: AIContext): Promise<DepthResult>;
    segmentation?(req: SegmentationRequest, ctx?: AIContext): Promise<SegmentationResult>;
}
export declare class DummyProvider implements AIProvider {
    name: "dummy";
    version: string;
    capabilities(): AICapability[];
    healthCheck(): Promise<HealthStatus>;
    textToImage(req: TextToImageRequest): Promise<TextToImageResult>;
    depth(_: DepthRequest): Promise<DepthResult>;
    segmentation(_: SegmentationRequest): Promise<SegmentationResult>;
}
export declare function createDefaultAIRouter(policy?: RoutingPolicy): AIRouter;
export declare function createEnhancedAIRouter(providers?: AIProvider[], policy?: RoutingPolicy): AIRouter;
//# sourceMappingURL=index.d.ts.map