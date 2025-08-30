/**
 * Minimal AI package exports for server compatibility
 */
export declare class AIRegistry {
    private providers;
    register(p: AIProvider): void;
    get(name: string): AIProvider | undefined;
    list(): AIProvider[];
    byCapability(cap: "textToImage" | "depth" | "segmentation"): AIProvider[];
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
    textToImage(req: TextToImageRequest, ctx?: AIContext): Promise<TextToImageResult>;
    depth(req: DepthRequest, ctx?: AIContext): Promise<DepthResult>;
    segmentation(req: SegmentationRequest, ctx?: AIContext): Promise<SegmentationResult>;
}
export type AIContext = {
    traceId?: string;
    budgetUSD?: number;
    timeoutMs?: number;
    signal?: AbortSignal;
};
export interface ProviderCallMeta {
    provider: string;
    model?: string;
    costUSD?: number;
    latencyMs?: number;
}
export type ImageDataRef = {
    uri: string;
    width?: number;
    height?: number;
    mimeType?: string;
};
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
export interface AIProvider {
    name: string;
    capabilities(): Array<"textToImage" | "depth" | "segmentation">;
    textToImage?(req: TextToImageRequest, ctx?: AIContext): Promise<TextToImageResult>;
    depth?(req: DepthRequest, ctx?: AIContext): Promise<DepthResult>;
    segmentation?(req: SegmentationRequest, ctx?: AIContext): Promise<SegmentationResult>;
}
export declare class DummyProvider implements AIProvider {
    name: "dummy";
    capabilities(): Array<"textToImage" | "depth" | "segmentation">;
    textToImage(req: TextToImageRequest): Promise<TextToImageResult>;
    depth(_: DepthRequest): Promise<DepthResult>;
    segmentation(_: SegmentationRequest): Promise<SegmentationResult>;
}
export declare function createDefaultAIRouter(policy?: RoutingPolicy): AIRouter;
//# sourceMappingURL=index.d.ts.map