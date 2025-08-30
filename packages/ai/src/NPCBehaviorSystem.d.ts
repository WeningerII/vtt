/**
 * NPC Behavior System
 * Handles AI-driven NPC behaviors, decision making, and interactions
 */
export interface NPCPersonality {
    id: string;
    name: string;
    traits: {
        aggression: number;
        curiosity: number;
        loyalty: number;
        intelligence: number;
        courage: number;
        empathy: number;
    };
    motivations: string[];
    fears: string[];
    goals: NPCGoal[];
    relationships: Map<string, number>;
}
export interface NPCGoal {
    id: string;
    type: 'survival' | 'combat' | 'social' | 'exploration' | 'protection' | 'acquisition';
    priority: number;
    target?: string;
    location?: {
        x: number;
        y: number;
    };
    condition?: string;
    isComplete: boolean;
    isActive: boolean;
}
export interface NPCBehaviorState {
    currentGoal: string | null;
    mood: 'calm' | 'alert' | 'aggressive' | 'fearful' | 'curious' | 'friendly';
    alertLevel: number;
    lastThreatTime: number;
    lastInteractionTime: number;
    memory: NPCMemory[];
}
export interface NPCMemory {
    id: string;
    type: 'threat' | 'ally' | 'location' | 'event';
    entityId?: string;
    location?: {
        x: number;
        y: number;
    };
    description: string;
    importance: number;
    timestamp: number;
    decay: number;
}
export interface BehaviorAction {
    id: string;
    type: 'movement' | 'combat' | 'social' | 'utility';
    name: string;
    description: string;
    execute: (_npc: NPCActor, _context: BehaviorContext) => Promise<ActionResult>;
    canExecute: (_npc: NPCActor, _context: BehaviorContext) => boolean;
    priority: number;
    cooldown?: number;
}
export interface NPCActor {
    id: string;
    tokenId: string;
    name: string;
    personality: NPCPersonality;
    behaviorState: NPCBehaviorState;
    stats: {
        health: number;
        maxHealth: number;
        speed: number;
        attackRange: number;
        detectionRange: number;
        intelligence: number;
    };
    position: {
        x: number;
        y: number;
    };
    facing: number;
    isActive: boolean;
    lastActionTime: number;
    actionCooldowns: Map<string, number>;
}
export interface BehaviorContext {
    scene: {
        id: string;
        width: number;
        height: number;
        walls: Array<{
            x1: number;
            y1: number;
            x2: number;
            y2: number;
        }>;
    };
    visibleEntities: Array<{
        id: string;
        type: 'pc' | 'npc' | 'object';
        position: {
            x: number;
            y: number;
        };
        isHostile: boolean;
        distance: number;
    }>;
    nearbyItems: Array<{
        id: string;
        type: string;
        position: {
            x: number;
            y: number;
        };
        distance: number;
    }>;
    gameState: {
        inCombat: boolean;
        turnBased: boolean;
        timeOfDay: 'dawn' | 'day' | 'dusk' | 'night';
        weather: string;
    };
    playerActions: Array<{
        playerId: string;
        action: string;
        target?: string;
        timestamp: number;
    }>;
}
export interface ActionResult {
    success: boolean;
    message?: string;
    effects?: Array<{
        type: string;
        target: string;
        value: any;
    }>;
    duration?: number;
}
export declare class NPCBehaviorSystem {
    private npcs;
    private behaviors;
    private updateInterval;
    private lastUpdate;
    private changeListeners;
    constructor();
    /**
     * Register NPC with behavior system
     */
    registerNPC(npc: NPCActor): void;
    /**
     * Update NPC behavior
     */
    updateNPC(npcId: string, context: BehaviorContext): Promise<void>;
    private updatePerception;
    private updateMemory;
    private updateMoodAndState;
    private updateGoals;
    private selectBestAction;
    private calculateActionScore;
    private executeAction;
    private initializeDefaultBehaviors;
    private startUpdateLoop;
    /**
     * Register custom behavior for specific NPC
     */
    registerCustomBehavior(npcId: string, behaviors: BehaviorAction[]): void;
    /**
     * Get NPC by ID
     */
    getNPC(npcId: string): NPCActor | undefined;
    /**
     * Get all active NPCs
     */
    getActiveNPCs(): NPCActor[];
    /**
     * Cleanup
     */
    dispose(): void;
    addEventListener(_listener: (event: BehaviorEvent) => void): void;
    removeEventListener(_listener: (event: BehaviorEvent) => void): void;
    private emitEvent;
}
export type BehaviorEvent = {
    type: 'npc-registered';
    data: {
        npcId: string;
        npc: NPCActor;
    };
} | {
    type: 'npc-unregistered';
    data: {
        npcId: string;
    };
} | {
    type: 'action-executed';
    data: {
        npcId: string;
        actionId: string;
        actionName: string;
        result: ActionResult;
    };
} | {
    type: 'behaviors-registered';
    data: {
        npcId: string;
        behaviorCount: number;
    };
} | {
    type: 'npc-error';
    data: {
        npcId: string;
        error: string;
    };
};
//# sourceMappingURL=NPCBehaviorSystem.d.ts.map