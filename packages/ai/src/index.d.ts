/**
 * Advanced AI package with comprehensive behavior trees, state machines,
 * pathfinding, and intelligent agent systems for AAA game parity.
 */
export { NodeStatus, BehaviorNode, SequenceNode, SelectorNode, ParallelNode, InverterNode, RepeatNode, RetryNode, TimeoutNode, ActionNode, ConditionNode, Blackboard, BehaviorTree, BehaviorTreeBuilder, createBehaviorTreeBuilder, type BlackboardData, type BehaviorTreeConfig, } from "./BehaviorTree";
export { State, StateMachine, HierarchicalStateMachine, IdleState, DelayState, ConditionalState, StateMachineBuilder, createStateMachine, createHierarchicalStateMachine, type StateContext, type StateTransition, } from "./StateMachine";
export { Grid, AStar, FlowField, PathfindingManager, worldToGrid, gridToWorld, simplifyPath, type Vector2, type PathfindingNode, type PathfindingOptions, type PathfindingResult, } from "./Pathfinding";
export { Agent, AgentManager, createBasicAgentConfig, createFastAgentConfig, type AgentConfig, type AgentPerception, type Goal, type AgentMemory, } from "./Agent";
export declare class UtilityAI {
    evaluate(options: Record<string, number>): string | undefined;
}
/**
 * Legacy AI-driven NPC behavior system (maintained for compatibility)
 */
export interface LegacyNPCPersonality {
    aggression: number;
    intelligence: number;
    caution: number;
    loyalty: number;
}
export interface LegacyNPCGoal {
    type: "attack" | "defend" | "flee" | "support" | "investigate" | "patrol";
    priority: number;
    target?: string;
    position?: {
        x: number;
        y: number;
    };
}
export declare class AIBehaviorEngine {
    private utilityAI;
    evaluateActions(npcId: string, personality: LegacyNPCPersonality, goals: LegacyNPCGoal[], gameState: any): string;
}
/**
 * Provider-agnostic AI adapter interfaces and simple router.
 * These allow us to remain model-agnostic and enforce observability and
 * cost/timeout controls at the orchestration layer.
 */
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
export declare class DummyProvider implements AIProvider {
    name: "dummy";
    capabilities(): Array<"textToImage" | "depth" | "segmentation">;
    textToImage(req: TextToImageRequest): Promise<TextToImageResult>;
    depth(_: DepthRequest): Promise<DepthResult>;
    segmentation(_: SegmentationRequest): Promise<SegmentationResult>;
}
export declare function createDefaultAIRouter(_policy?: RoutingPolicy): AIRouter;
export { AIEntity, NPCArchetypes, type AIEntityState, type GameStateSnapshot, } from "./npc/AIEntity";
export * from './NPCBehaviorSystem';
export * from './ContentGenerator';
export type { NPCPersonality, NPCGoal, NPCBehaviorState, NPCMemory, BehaviorAction, NPCActor, BehaviorContext, ActionResult, BehaviorEvent } from './NPCBehaviorSystem';
export type { GenerationTemplate, GenerationParameter, GeneratedContent, EncounterData, NPCData, LocationData } from './ContentGenerator';
export { StabilityProvider, type StabilityProviderOptions } from "./providers/stability";
export { OpenAIProvider, type OpenAIProviderOptions } from "./providers/openai";
export { AnthropicProvider, type AnthropicProviderOptions } from "./providers/anthropic";
//# sourceMappingURL=index.d.ts.map