/**
 * Advanced AI package with comprehensive behavior trees, state machines,
 * pathfinding, and intelligent agent systems for AAA game parity.
 */
// Behavior Tree System exports
export { NodeStatus, BehaviorNode, SequenceNode, SelectorNode, ParallelNode, InverterNode, RepeatNode, RetryNode, TimeoutNode, ActionNode, ConditionNode, Blackboard, BehaviorTree, BehaviorTreeBuilder, createBehaviorTreeBuilder, } from "./BehaviorTree";
// State Machine System exports
export { State, StateMachine, HierarchicalStateMachine, IdleState, DelayState, ConditionalState, StateMachineBuilder, createStateMachine, createHierarchicalStateMachine, } from "./StateMachine";
// Pathfinding System exports
export { Grid, AStar, FlowField, PathfindingManager, worldToGrid, gridToWorld, simplifyPath, } from "./Pathfinding";
// Agent System exports
export { Agent, AgentManager, createBasicAgentConfig, createFastAgentConfig, } from "./Agent";
// Legacy Utility AI (maintained for compatibility)
export class UtilityAI {
    evaluate(options) {
        let best;
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
// Legacy AI Engine (use NPCBehaviorSystem for new implementations)
export class AIBehaviorEngine {
    constructor() {
        this.utilityAI = new UtilityAI();
    }
    evaluateActions(npcId, personality, goals, gameState) {
        const options = {};
        // Evaluate attack actions
        if (gameState.nearbyEnemies?.length > 0) {
            const attackScore = personality.aggression * 0.8 + (1 - personality.caution) * 0.2;
            options["attack"] = attackScore * (goals.find((g) => g.type === "attack")?.priority || 0.5);
        }
        // Evaluate defensive actions
        if (gameState.isUnderThreat) {
            const defendScore = personality.caution * 0.7 + personality.loyalty * 0.3;
            options["defend"] = defendScore * (goals.find((g) => g.type === "defend")?.priority || 0.6);
        }
        // Evaluate flee actions
        if (gameState.healthPercentage < 0.3) {
            const fleeScore = personality.caution * 0.9 + (1 - personality.loyalty) * 0.1;
            options["flee"] = fleeScore * (goals.find((g) => g.type === "flee")?.priority || 0.8);
        }
        // Evaluate support actions
        if (gameState.nearbyAllies?.length > 0) {
            const supportScore = personality.loyalty * 0.8 + personality.intelligence * 0.2;
            options["support"] =
                supportScore * (goals.find((g) => g.type === "support")?.priority || 0.4);
        }
        return this.utilityAI.evaluate(options) || "patrol";
    }
}
export class AIRegistry {
    constructor() {
        this.providers = new Map();
    }
    register(p) {
        this.providers.set(p.name, p);
    }
    get(name) {
        return this.providers.get(name);
    }
    list() {
        return [...this.providers.values()];
    }
    byCapability(cap) {
        return this.list().filter((p) => p.capabilities().includes(cap));
    }
}
export class AIRouter {
    constructor(registry, policy = {}) {
        this.registry = registry;
        this.policy = policy;
    }
    pick(cap) {
        const candidates = this.registry
            .byCapability(cap)
            .filter((p) => !(this.policy.forbid ?? []).includes(p.name));
        if (candidates.length === 0)
            throw new Error(`No providers registered with capability ${cap}`);
        const preferred = (this.policy.preferred ?? []).find((n) => candidates.some((c) => c.name === n));
        if (preferred)
            return candidates.find((c) => c.name === preferred);
        const weights = candidates.map((c) => ({ p: c, w: this.policy.weights?.[c.name] ?? 1 }));
        const total = weights.reduce((s, x) => s + x.w, 0);
        let r = Math.random() * total;
        for (const { p, w } of weights) {
            r -= w;
            if (r <= 0)
                return p;
        }
        return candidates[0];
    }
    async textToImage(req, ctx) {
        const p = this.pick("textToImage");
        if (!p.textToImage)
            throw new Error(`Provider ${p.name} lacks textToImage`);
        return p.textToImage(req, ctx);
    }
    async depth(req, ctx) {
        const p = this.pick("depth");
        if (!p.depth)
            throw new Error(`Provider ${p.name} lacks depth`);
        return p.depth(req, ctx);
    }
    async segmentation(req, ctx) {
        const p = this.pick("segmentation");
        if (!p.segmentation)
            throw new Error(`Provider ${p.name} lacks segmentation`);
        return p.segmentation(req, ctx);
    }
}
export class DummyProvider {
    constructor() {
        this.name = "dummy";
    }
    capabilities() {
        return ["textToImage", "depth", "segmentation"];
    }
    async textToImage(req) {
        const start = Date.now();
        const w = req.width ?? 512;
        const h = req.height ?? 512;
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>` +
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
    async depth(_) {
        const start = Date.now();
        // 1x1 white pixel placeholder as a depth map
        const uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
        return {
            provider: this.name,
            model: "dummy-depth",
            costUSD: 0,
            latencyMs: Date.now() - start,
            depth: { uri, mimeType: "image/png" },
        };
    }
    async segmentation(_) {
        const start = Date.now();
        // 1x1 transparent pixel placeholder as a mask
        const uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottQAAAABJRU5ErkJggg==";
        return {
            provider: this.name,
            model: "dummy-seg",
            costUSD: 0,
            latencyMs: Date.now() - start,
            mask: { uri, mimeType: "image/png" },
            classes: Record<string, unknown>,
        };
    }
}
export function createDefaultAIRouter(policy) {
    const registry = new AIRegistry();
    registry.register(new DummyProvider());
    return new AIRouter(registry, policy);
}
// NPC AI System
export { AIEntity, NPCArchetypes, } from "./npc/AIEntity";
// NPC Behavior System
export * from './NPCBehaviorSystem';
export * from './ContentGenerator';
// Providers
export { StabilityProvider } from "./providers/stability";
export { OpenAIProvider } from "./providers/openai";
export { AnthropicProvider } from "./providers/anthropic";
//# sourceMappingURL=index.js.map