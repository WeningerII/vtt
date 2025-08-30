/**
 * AI-driven NPC entity that integrates with the ECS system
 */
import { NPCPersonality, NPCGoal, BehaviorTreeNode } from "../index";
export interface AIAction {
  type: "move" | "attack" | "defend" | "support" | "interact";
  target?: {
    x: number;
    y: number;
  };
  targetId?: string;
  priority: number;
  data?: any;
}
export interface AIEntityState {
  id: string;
  personality: NPCPersonality;
  goals: NPCGoal[];
  currentAction: string;
  behaviorTree?: BehaviorTreeNode;
  lastThinkTime: number;
  thinkInterval: number;
  position: {
    x: number;
    y: number;
  };
  health: number;
  maxHealth: number;
  isDefending: boolean;
  lastAction?: AIAction;
  cooldowns: Map<string, number>;
}
export interface GameStateSnapshot {
  nearbyEnemies: Array<{
    id: string;
    distance: number;
    health: number;
  }>;
  nearbyAllies: Array<{
    id: string;
    distance: number;
    health: number;
  }>;
  isUnderThreat: boolean;
  healthPercentage: number;
  position: {
    x: number;
    y: number;
  };
  canMove: boolean;
  canAttack: boolean;
}
export declare class AIEntity {
  private behaviorEngine;
  private state;
  private entityId;
  constructor(
    id: string,
    personality: NPCPersonality,
    initialGoals?: NPCGoal[],
    thinkInterval?: number,
  );
  /**
   * Main AI update loop - called each frame/tick
   */
  update(gameState: GameStateSnapshot, deltaTime: number): void;
  /**
   * Execute behavior tree and take actions
   */
  private think;
  /**
   * Simple action selection based on game state
   */
  private selectAction;
  /**
   * Evaluate and update goals based on current situation
   */
  private evaluateGoals;
  /**
   * Queue an action for execution
   */
  private queueAction;
  /**
   * Execute actual game actions based on AI decisions
   */
  executeAction(action: AIAction, gameSession: any): void;
  private executeMovement;
  private executeAttack;
  private executeDefense;
  private executeSupport;
  private executeInteraction;
  private calculateDamage;
  /**
   * Add or update a goal for this AI entity
   */
  setGoal(goal: NPCGoal): void;
  /**
   * Remove a goal
   */
  removeGoal(goalType: NPCGoal["type"]): void;
  /**
   * Get current AI state for debugging/monitoring
   */
  getState(): Readonly<AIEntityState>;
  /**
   * Update personality traits (for character development)
   */
  updatePersonality(updates: Partial<NPCPersonality>): void;
  /**
   * Force immediate re-evaluation of actions
   */
  forceThink(gameState: GameStateSnapshot): void;
  /**
   * Get the current queued action
   */
  getQueuedAction(): AIAction | null;
  /**
   * Clear the current queued action
   */
  clearQueuedAction(): void;
  /**
   * Update entity position
   */
  updatePosition(position: { x: number; y: number }): void;
  /**
   * Update entity health
   */
  updateHealth(health: number): void;
}
/**
 * Factory for creating common NPC archetypes
 */
export declare class NPCArchetypes {
  static createGuard(): NPCPersonality;
  static createBerserker(): NPCPersonality;
  static createScout(): NPCPersonality;
  static createHealer(): NPCPersonality;
  static createWildcard(): NPCPersonality;
}
//# sourceMappingURL=AIEntity.d.ts.map
