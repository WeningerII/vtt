import { logger } from "@vtt/logging";

/**
 * NPC Behavior System
 * Handles AI-driven NPC behaviors, decision making, and interactions
 */

export interface NPCPersonality {
  id: string;
  name: string;
  traits: {
    aggression: number; // 0-1
    curiosity: number;
    loyalty: number;
    intelligence: number;
    courage: number;
    empathy: number;
  };
  motivations: string[];
  fears: string[];
  goals: NPCGoal[];
  relationships: Map<string, number>; // entityId -> relationship value (-1 to 1)
}

export interface NPCGoal {
  id: string;
  type: "survival" | "combat" | "social" | "exploration" | "protection" | "acquisition";
  priority: number; // 0-1
  target?: string; // Entity ID
  location?: { x: number; y: number };
  condition?: string; // When goal is complete
  isComplete: boolean;
  isActive: boolean;
}

export interface NPCBehaviorState {
  currentGoal: string | null;
  mood: "calm" | "alert" | "aggressive" | "fearful" | "curious" | "friendly";
  alertLevel: number; // 0-1
  lastThreatTime: number;
  lastInteractionTime: number;
  memory: NPCMemory[];
}

export interface NPCMemory {
  id: string;
  type: "threat" | "ally" | "location" | "event";
  entityId?: string;
  location?: { x: number; y: number };
  description: string;
  importance: number; // 0-1
  timestamp: number;
  decay: number; // How quickly memory fades
}

export interface BehaviorAction {
  id: string;
  type: "movement" | "combat" | "social" | "utility";
  name: string;
  description: string;
  execute: (npc: NPCActor, context: BehaviorContext) => Promise<ActionResult>;
  canExecute: (npc: NPCActor, context: BehaviorContext) => boolean;
  priority: number;
  cooldown?: number; // ms
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
  position: { x: number; y: number };
  facing: number; // degrees
  isActive: boolean;
  lastActionTime: number;
  actionCooldowns: Map<string, number>;
}

export interface BehaviorContext {
  scene: {
    id: string;
    width: number;
    height: number;
    walls: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  };
  visibleEntities: Array<{
    id: string;
    type: "pc" | "npc" | "object";
    position: { x: number; y: number };
    isHostile: boolean;
    distance: number;
  }>;
  nearbyItems: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    distance: number;
  }>;
  gameState: {
    inCombat: boolean;
    turnBased: boolean;
    timeOfDay: "dawn" | "day" | "dusk" | "night";
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
  duration?: number; // How long action takes
}

export class NPCBehaviorSystem {
  private npcs: Map<string, NPCActor> = new Map();
  private behaviors: Map<string, BehaviorAction[]> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private lastUpdate: number = 0;
  private changeListeners: Array<(_event: BehaviorEvent) => void> = [];

  constructor() {
    this.initializeDefaultBehaviors();
    this.startUpdateLoop();
  }

  /**
   * Register NPC with behavior system
   */
  registerNPC(npc: NPCActor): void {
    this.npcs.set(npc.id, npc);

    // Initialize behavior state if not present
    if (!npc.behaviorState) {
      npc.behaviorState = {
        currentGoal: null,
        mood: "calm",
        alertLevel: 0,
        lastThreatTime: 0,
        lastInteractionTime: 0,
        memory: [],
      };
    }

    this.emitEvent({
      type: "npc-registered",
      data: { npcId: npc.id, npc },
    });
  }

  /**
   * Update NPC behavior
   */
  async updateNPC(npcId: string, context: BehaviorContext): Promise<void> {
    const npc = this.npcs.get(npcId);
    if (!npc || !npc.isActive) return;

    try {
      // Update NPC perception and memory
      this.updatePerception(npc, context);
      this.updateMemory(npc, context);

      // Update mood and state
      this.updateMoodAndState(npc, context);

      // Select and execute best action
      const action = await this.selectBestAction(npc, context);
      if (action) {
        await this.executeAction(npc, action, context);
      }
    } catch (error) {
      logger.error(`Error updating NPC ${npcId}:`, error);
      this.emitEvent({
        type: "npc-error",
        data: { npcId, error: error.message },
      });
    }
  }

  private updatePerception(npc: NPCActor, context: BehaviorContext): void {
    const currentTime = Date.now();

    // Check for threats and allies
    for (const entity of context.visibleEntities) {
      if (entity.distance <= npc.stats.detectionRange) {
        const relationship = npc.personality.relationships.get(entity.id) || 0;

        // Create or update memory
        const existingMemory = npc.behaviorState.memory.find((m) => m.entityId === entity.id);
        if (existingMemory) {
          existingMemory.timestamp = currentTime;
        } else {
          npc.behaviorState.memory.push({
            id: `memory-${currentTime}-${Math.random().toString(36).substr(2, 9)}`,
            type: entity.isHostile || relationship < -0.3 ? "threat" : "ally",
            entityId: entity.id,
            location: entity.position,
            description: `${entity.type === "pc" ? "Player" : "NPC"} at ${entity.position.x}, ${entity.position.y}`,
            importance: entity.isHostile ? 0.8 : Math.abs(relationship),
            timestamp: currentTime,
            decay: 0.1,
          });
        }

        // Update threat detection
        if (entity.isHostile && entity.distance < npc.stats.detectionRange * 0.5) {
          npc.behaviorState.lastThreatTime = currentTime;
          npc.behaviorState.alertLevel = Math.min(1, npc.behaviorState.alertLevel + 0.3);
        }
      }
    }
  }

  private updateMemory(npc: NPCActor, _context: BehaviorContext): void {
    const currentTime = Date.now();
    const memoryDecayRate = 1000 * 60 * 5; // 5 minutes

    // Decay old memories
    npc.behaviorState.memory = npc.behaviorState.memory.filter((memory) => {
      const age = currentTime - memory.timestamp;
      memory.importance -= memory.decay * (age / memoryDecayRate);
      return memory.importance > 0.1;
    });

    // Limit memory to prevent overflow
    if (npc.behaviorState.memory.length > 20) {
      npc.behaviorState.memory.sort((_a, _b) => b.importance - a.importance);
      npc.behaviorState.memory = npc.behaviorState.memory.slice(0, 20);
    }
  }

  private updateMoodAndState(npc: NPCActor, context: BehaviorContext): void {
    const currentTime = Date.now();
    const timeSinceThreal = currentTime - npc.behaviorState.lastThreatTime;

    // Update alert level over time
    if (timeSinceThreal > 30000) {
      // 30 seconds
      npc.behaviorState.alertLevel = Math.max(0, npc.behaviorState.alertLevel - 0.1);
    }

    // Determine mood based on alert level and personality
    if (npc.behaviorState.alertLevel > 0.7) {
      npc.behaviorState.mood = npc.personality.traits.courage > 0.6 ? "aggressive" : "fearful";
    } else if (npc.behaviorState.alertLevel > 0.3) {
      npc.behaviorState.mood = "alert";
    } else if (npc.personality.traits.curiosity > 0.7 && Math.random() < 0.1) {
      npc.behaviorState.mood = "curious";
    } else {
      npc.behaviorState.mood = "calm";
    }

    // Update goals based on current state
    this.updateGoals(npc, context);
  }

  private updateGoals(npc: NPCActor, _context: BehaviorContext): void {
    // Activate survival goal if health is low
    const healthPercentage = npc.stats.health / npc.stats.maxHealth;
    if (healthPercentage < 0.3) {
      const survivalGoal = npc.personality.goals.find((g) => g.type === "survival");
      if (survivalGoal) {
        survivalGoal.isActive = true;
        survivalGoal.priority = 0.9;
        npc.behaviorState.currentGoal = survivalGoal.id;
      }
    }

    // Activate combat goal if threatened
    if (npc.behaviorState.alertLevel > 0.5 && npc.behaviorState.mood === "aggressive") {
      const combatGoal = npc.personality.goals.find((g) => g.type === "combat");
      if (combatGoal) {
        combatGoal.isActive = true;
        combatGoal.priority = 0.8;
        npc.behaviorState.currentGoal = combatGoal.id;
      }
    }

    // Select highest priority active goal
    const activeGoals = npc.personality.goals.filter((g) => g.isActive && !g.isComplete);
    if (activeGoals.length > 0) {
      activeGoals.sort((_a, _b) => b.priority - a.priority);
      npc.behaviorState.currentGoal = activeGoals[0].id;
    }
  }

  private async selectBestAction(
    npc: NPCActor,
    context: BehaviorContext,
  ): Promise<BehaviorAction | null> {
    const npcBehaviors = this.behaviors.get(npc.id) || this.behaviors.get("default") || [];
    const availableActions = npcBehaviors.filter((action) => {
      // Check cooldown
      const cooldown = npc.actionCooldowns.get(action.id) || 0;
      if (Date.now() < cooldown) return false;

      // Check if action can be executed
      return action.canExecute(npc, context);
    });

    if (availableActions.length === 0) return null;

    // Score actions based on current goals and personality
    const scoredActions = availableActions.map((action) => ({
      action,
      score: this.calculateActionScore(action, npc, context),
    }));

    // Sort by score and add some randomness
    scoredActions.sort((_a, _b) => b.score - a.score);

    // Select from top 3 actions with weighted probability
    const topActions = scoredActions.slice(0, 3);
    const totalScore = topActions.reduce((_sum, _item) => sum + item.score, 0);

    if (totalScore === 0) return null;

    let random = Math.random() * totalScore;
    for (const item of topActions) {
      random -= item.score;
      if (random <= 0) {
        return item.action;
      }
    }

    return topActions[0]?.action || null;
  }

  private calculateActionScore(
    action: BehaviorAction,
    npc: NPCActor,
    _context: BehaviorContext,
  ): number {
    let score = action.priority;

    // Adjust score based on current goal
    const currentGoal = npc.personality.goals.find((g) => g.id === npc.behaviorState.currentGoal);
    if (currentGoal) {
      switch (currentGoal.type) {
        case "survival":
          if (action.type === "utility" && action.name.includes("heal")) score += 0.5;
          if (action.type === "movement" && action.name.includes("flee")) score += 0.3;
          break;
        case "combat":
          if (action.type === "combat") score += 0.4;
          break;
        case "social":
          if (action.type === "social") score += 0.3;
          break;
        case "exploration":
          if (action.type === "movement" && action.name.includes("explore")) score += 0.2;
          break;
      }
    }

    // Adjust score based on mood
    switch (npc.behaviorState.mood) {
      case "aggressive":
        if (action.type === "combat") score += 0.3;
        break;
      case "fearful":
        if (action.name.includes("flee") || action.name.includes("hide")) score += 0.4;
        if (action.type === "combat") score -= 0.3;
        break;
      case "curious":
        if (action.name.includes("investigate") || action.name.includes("explore")) score += 0.2;
        break;
    }

    // Adjust score based on personality traits
    if (action.type === "combat") {
      score *= npc.personality.traits.aggression;
    }
    if (action.name.includes("help") || action.name.includes("protect")) {
      score *= npc.personality.traits.empathy;
    }

    return Math.max(0, score);
  }

  private async executeAction(
    npc: NPCActor,
    action: BehaviorAction,
    context: BehaviorContext,
  ): Promise<void> {
    try {
      const result = await action.execute(npc, context);

      npc.lastActionTime = Date.now();

      // Set cooldown
      if (action.cooldown) {
        npc.actionCooldowns.set(action.id, Date.now() + action.cooldown);
      }

      this.emitEvent({
        type: "action-executed",
        data: {
          npcId: npc.id,
          actionId: action.id,
          actionName: action.name,
          result,
        },
      });
    } catch (error) {
      logger.error(`Error executing action ${action.id} for NPC ${npc.id}:`, error);
    }
  }

  private initializeDefaultBehaviors(): void {
    const defaultBehaviors: BehaviorAction[] = [
      // Wander behavior
      {
        id: "wander",
        type: "movement",
        name: "Wander",
        description: "Move randomly around the area",
        execute: async (npc, _context) => {
          const angle = Math.random() * Math.PI * 2;
          const distance = 50 + Math.random() * 100;
          const newX = npc.position.x + Math.cos(angle) * distance;
          const newY = npc.position.y + Math.sin(angle) * distance;

          return {
            success: true,
            effects: [{ type: "position", target: npc.id, value: { x: newX, y: newY } }],
            duration: 2000,
          };
        },
        canExecute: (npc, _context) => npc.behaviorState.mood === "calm",
        priority: 0.2,
      },

      // Flee behavior
      {
        id: "flee",
        type: "movement",
        name: "Flee",
        description: "Move away from threats",
        execute: async (npc, context) => {
          const threats = context.visibleEntities.filter((e) => e.isHostile);
          if (threats.length === 0) return { success: false };

          // Calculate average threat position
          let avgThreatX = 0,
            avgThreatY = 0;
          threats.forEach((threat) => {
            avgThreatX += threat.position.x;
            avgThreatY += threat.position.y;
          });
          avgThreatX /= threats.length;
          avgThreatY /= threats.length;

          // Move away from threats
          const dx = npc.position.x - avgThreatX;
          const dy = npc.position.y - avgThreatY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          const fleeDistance = npc.stats.speed * 1.5;
          const ratio = fleeDistance / Math.max(distance, 1);

          return {
            success: true,
            effects: [
              {
                type: "position",
                target: npc.id,
                value: {
                  x: npc.position.x + dx * ratio,
                  y: npc.position.y + dy * ratio,
                },
              },
            ],
            duration: 1000,
          };
        },
        canExecute: (npc, context) =>
          npc.behaviorState.mood === "fearful" && context.visibleEntities.some((e) => e.isHostile),
        priority: 0.8,
      },

      // Attack behavior
      {
        id: "attack_nearest_threat",
        type: "combat",
        name: "Attack Nearest Threat",
        description: "Attack the closest hostile entity",
        execute: async (npc, context) => {
          const threats = context.visibleEntities.filter(
            (e) => e.isHostile && e.distance <= npc.stats.attackRange,
          );

          if (threats.length === 0) return { success: false };

          threats.sort((_a, _b) => a.distance - b.distance);
          const target = threats[0];

          const hitChance = 0.7;
          const damage = 10 + Math.floor(Math.random() * 10);
          const hit = Math.random() < hitChance;

          return {
            success: hit,
            message: hit
              ? `${npc.name} attacks ${target.id} for ${damage} damage!`
              : `${npc.name} misses ${target.id}!`,
            effects: hit ? [{ type: "damage", target: target.id, value: damage }] : [],
            duration: 1500,
          };
        },
        canExecute: (npc, context) =>
          npc.behaviorState.mood === "aggressive" &&
          context.visibleEntities.some((e) => e.isHostile && e.distance <= npc.stats.attackRange),
        priority: 0.7,
        cooldown: 2000,
      },
    ];

    this.behaviors.set("default", defaultBehaviors);
  }

  private startUpdateLoop(): void {
    this.updateInterval = setInterval(() => {
      // Update loop implementation would go here
    }, 1000); // Update every second
  }

  /**
   * Register custom behavior for specific NPC
   */
  registerCustomBehavior(npcId: string, behaviors: BehaviorAction[]): void {
    this.behaviors.set(npcId, behaviors);

    this.emitEvent({
      type: "behaviors-registered",
      data: { npcId, behaviorCount: behaviors.length },
    });
  }

  /**
   * Get NPC by ID
   */
  getNPC(npcId: string): NPCActor | undefined {
    return this.npcs.get(npcId);
  }

  /**
   * Get all active NPCs
   */
  getActiveNPCs(): NPCActor[] {
    return Array.from(this.npcs.values()).filter((npc) => npc.isActive);
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.npcs.clear();
    this.behaviors.clear();
    this.changeListeners = [];
  }

  // Event system
  addEventListener(_listener: (event: BehaviorEvent) => void): void {
    this.changeListeners.push(listener);
  }

  removeEventListener(_listener: (event: BehaviorEvent) => void): void {
    const index = this.changeListeners.indexOf(listener);
    if (index > -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  private emitEvent(event: BehaviorEvent): void {
    this.changeListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        logger.error("Behavior event listener error:", error);
      }
    });
  }
}

// Event types
export type BehaviorEvent =
  | { type: "npc-registered"; data: { npcId: string; npc: NPCActor } }
  | { type: "npc-unregistered"; data: { npcId: string } }
  | {
      type: "action-executed";
      data: { npcId: string; actionId: string; actionName: string; result: ActionResult };
    }
  | { type: "behaviors-registered"; data: { npcId: string; behaviorCount: number } }
  | { type: "npc-error"; data: { npcId: string; error: string } };
