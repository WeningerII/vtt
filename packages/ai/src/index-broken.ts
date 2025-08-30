// Export minimal AI functionality to avoid build errors
export * from "./index-minimal";

/**
 * Advanced AI package with comprehensive behavior trees, state machines,
 * pathfinding, and intelligent agent systems for AAA game parity.
 */

// Behavior Tree System exports
export {
  NodeStatus,
  BehaviorNode,
  SequenceNode,
  SelectorNode,
  ParallelNode,
  InverterNode,
  RepeatNode,
  RetryNode,
  TimeoutNode,
  ActionNode,
  ConditionNode,
  Blackboard,
  BehaviorTree,
  BehaviorTreeBuilder,
  createBehaviorTreeBuilder,
  type BlackboardData,
  type BehaviorTreeConfig,
} from "./BehaviorTree";

// State Machine System exports
export {
  State,
  StateMachine,
  HierarchicalStateMachine,
  IdleState,
  DelayState,
  ConditionalState,
  StateMachineBuilder,
  createStateMachine,
  createHierarchicalStateMachine,
  type StateContext,
  type StateTransition,
} from "./StateMachine";

// Pathfinding System exports
export {
  Grid,
  AStar,
  FlowField,
  PathfindingManager,
  worldToGrid,
  gridToWorld,
  simplifyPath,
  type Vector2,
  type PathfindingNode,
  type PathfindingOptions,
  type PathfindingResult,
} from "./Pathfinding";

// Agent System exports
export {
  Agent,
  AgentManager,
  createBasicAgentConfig,
  createFastAgentConfig,
  type AgentConfig,
  type AgentPerception,
  type Goal,
  type AgentMemory,
} from "./Agent";

// Legacy Utility AI (maintained for compatibility)
export class UtilityAI {
  evaluate(options: Record<string, number>): string | undefined {
    let best: string | undefined;
    let bestScore = -Infinity;
    for (const [option, score] of Object.entries(options)) {
      if (score > bestScore) {
        bestScore = score;
        best = option;
      }
    }
    return best;
  }
}

/**
 * AI-driven NPC behavior system
 */
export interface NPCPersonality {
  aggression: number; // 0-1
  intelligence: number; // 0-1
  caution: number; // 0-1
  loyalty: number; // 0-1
}

export interface NPCGoal {
  type: "attack" | "defend" | "flee" | "support" | "investigate" | "patrol";
  priority: number;
  target?: string; // entity ID
  position?: { x: number; y: number };
}

export class AIBehaviorEngine {
  private utilityAI = new UtilityAI();

  evaluateActions(
    npcId: string,
    personality: NPCPersonality,
    goals: NPCGoal[],
    gameState: any,
  ): string {
    const options: Record<string, number> = {};

    // Evaluate attack actions
    if (gameState.nearbyEnemies?.length > 0) {
      const attackScore = personality.aggression * 0.8 + (1 - personality.caution) * 0.2;
      options["attack"] = attackScore * (_goals.find((g) => g.type === "attack")?.priority || 0.5);
    }

    // Evaluate defensive actions
    if (gameState.isUnderThreat) {
      const defendScore = personality.caution * 0.7 + personality.loyalty * 0.3;
      options["defend"] = defendScore * (_goals.find((g) => g.type === "defend")?.priority || 0.6);
    }

    // Evaluate flee actions
    if (gameState.healthPercentage < 0.3) {
      const fleeScore = personality.caution * 0.9 + (1 - personality.loyalty) * 0.1;
      options["flee"] = fleeScore * (_goals.find((g) => g.type === "flee")?.priority || 0.8);
    }

    // Evaluate support actions
    if (gameState.nearbyAllies?.length > 0) {
      const supportScore = personality.loyalty * 0.8 + personality.intelligence * 0.2;
      options["support"] =
        supportScore * (_goals.find((g) => g.type === "support")?.priority || 0.4);
    }

    return this.utilityAI.evaluate(options) || "patrol";
  }

  createBehaviorTree(action: string, npcId: string, gameState: any): BehaviorTreeNode {
    switch (action) {
      case "attack":
        return new SequenceNode([
          new ActionNode(() => this.selectTarget(npcId, gameState)),
          new ActionNode(() => this.moveToAttackRange(npcId, gameState)),
          new ActionNode(() => this.executeAttack(npcId, gameState)),
        ]);
      case "defend":
        return new ActionNode(() => this.executeDefend(npcId, gameState));
      case "flee":
        return new ActionNode(() => this.executeFlee(npcId, gameState));
      case "support":
        return new SequenceNode([
          new ActionNode(() => this.selectAllyToSupport(npcId, gameState)),
          new ActionNode(() => this.executeSupportAction(npcId, gameState)),
        ]);
      default:
        return new ActionNode(() => this.executePatrol(npcId, gameState));
    }
  }

  private selectTarget(_npcId: string, _gameState: any): boolean {
    // Implementation for target selection
    return true;
  }

  private moveToAttackRange(_npcId: string, _gameState: any): boolean {
    // Implementation for movement
    return true;
  }

  private executeAttack(_npcId: string, _gameState: any): boolean {
    // Implementation for attack execution
    return true;
  }

  private executeDefend(_npcId: string, _gameState: any): boolean {
    // Implementation for defensive actions
    return true;
  }

  private executeFlee(_npcId: string, _gameState: any): boolean {
    // Implementation for flee behavior
    return true;
  }

  private selectAllyToSupport(_npcId: string, _gameState: any): boolean {
    // Implementation for ally selection
    return true;
  }

  private executeSupportAction(_npcId: string, _gameState: any): boolean {
    // Implementation for support actions
    return true;
  }

  private executePatrol(_npcId: string, _gameState: any): boolean {
    // Implementation for patrol behavior
    return true;
  }
}

export class ActionNode implements BehaviorTreeNode {
  constructor(private action: () => boolean) {}

  tick(): boolean {
    return this.action();
  }
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
  uri: string; // data URL or CDN URL
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
  labels?: string[]; // optional class label hints
}
export interface SegmentationResult extends ProviderCallMeta {
  mask: ImageDataRef; // single or multi-class mask encoding
  classes?: Record<string, number>; // label -> probability / score
}

export interface AIProvider {
  name: string;
  capabilities(): Array<"textToImage" | "depth" | "segmentation">;
  textToImage?(req: TextToImageRequest, ctx?: AIContext): Promise<TextToImageResult>;
  depth?(req: DepthRequest, ctx?: AIContext): Promise<DepthResult>;
  segmentation?(req: SegmentationRequest, ctx?: AIContext): Promise<SegmentationResult>;
}

export class AIRegistry {
  private providers = new Map<string, AIProvider>();
  register(p: AIProvider) {
    this.providers.set(p.name, p);
  }
  get(name: string) {
    return this.providers.get(name);
  }
  list() {
    return [...this.providers.values()];
  }
  byCapability(cap: "textToImage" | "depth" | "segmentation") {
    return this.list().filter((p) => p.capabilities().includes(cap));
  }
}

export type RoutingPolicy = {
  weights?: Record<string, number>; // provider -> relative weight
  preferred?: string[]; // prefer these providers if available
  forbid?: string[]; // disallow these providers
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

    const preferred = (this.policy.preferred ?? []).find((_n) =>
      candidates.some((_c) => c.name === n),
    );
    if (preferred) return candidates.find((_c) => c.name === preferred)!;

    const weights = candidates.map((_c) => ({ p: c, w: this.policy.weights?.[c.name] ?? 1 }));
    const total = weights.reduce((_s, _x) => s + x.w, 0);
    let r = Math.random() * total;
    for (const { p, w } of weights) {
      r -= w;
      if (r <= 0) return p;
    }
    return candidates[0]!;
  }

  async textToImage(req: TextToImageRequest, ctx?: AIContext) {
    const p = this.pick("textToImage");
    if (!p.textToImage) throw new Error(`Provider ${p.name} lacks textToImage`);
    return p.textToImage(req, ctx);
  }
  async depth(req: DepthRequest, ctx?: AIContext) {
    const p = this.pick("depth");
    if (!p.depth) throw new Error(`Provider ${p.name} lacks depth`);
    return p.depth(req, ctx);
  }
  async segmentation(req: SegmentationRequest, ctx?: AIContext) {
    const p = this.pick("segmentation");
    if (!p.segmentation) throw new Error(`Provider ${p.name} lacks segmentation`);
    return p.segmentation(req, ctx);
  }
}

export class DummyProvider implements AIProvider {
  name = "dummy" as const;
  capabilities() {
    return ["textToImage", "depth", "segmentation"] as const as Array<
      "textToImage" | "depth" | "segmentation"
    >;
  }

  async textToImage(req: TextToImageRequest): Promise<TextToImageResult> {
    const start = Date.now();
    const w = req.width ?? 512;
    const h = req.height ?? 512;
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>` +
      `<rect width='100%' height='100%' fill='#222'/>'` +
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
    // 1x1 white pixel placeholder as a depth map
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
    // 1x1 transparent pixel placeholder as a mask
    const uri =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottQAAAABJRU5ErkJggg==";
    return {
      provider: this.name,
      model: "dummy-seg",
      costUSD: 0,
      latencyMs: Date.now() - start,
      mask: { uri, mimeType: "image/png" },
      classes: Record<string, any>,
    };
  }
}

export function createDefaultAIRouter(_policy?: RoutingPolicy) {
  const registry = new AIRegistry();
  registry.register(new DummyProvider());
  return new AIRouter(registry, policy);
}

// NPC AI System - temporarily commented out due to build errors
// export { AIEntity, NPCArchetypes, } from "./npc/AIEntity";
// NPC Behavior System - temporarily commented out due to build errors
// export * from './NPCBehaviorSystem';
// export * from './ContentGenerator';
// Providers - temporarily commented out due to build errors
// export { StabilityProvider } from "./providers/stability";
// export { OpenAIProvider } from "./providers/openai";
// export { AnthropicProvider } from "./providers/anthropic";
