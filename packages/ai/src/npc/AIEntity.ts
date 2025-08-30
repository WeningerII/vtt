/**
 * AI-driven NPC entity that integrates with the ECS system
 */

import { AIBehaviorEngine, NPCPersonality, NPCGoal, BehaviorTreeNode } from '../index';
import { logger } from '@vtt/logging';

export interface AIAction {
  type: 'move' | 'attack' | 'defend' | 'support' | 'interact';
  target?: { x: number; y: number };
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
  thinkInterval: number; // ms between AI decisions
  position: { x: number; y: number };
  health: number;
  maxHealth: number;
  isDefending: boolean;
  lastAction?: AIAction;
  cooldowns: Map<string, number>;
}

export interface GameStateSnapshot {
  nearbyEnemies: Array<{ id: string; distance: number; health: number }>;
  nearbyAllies: Array<{ id: string; distance: number; health: number }>;
  isUnderThreat: boolean;
  healthPercentage: number;
  position: { x: number; y: number };
  canMove: boolean;
  canAttack: boolean;
}

export class AIEntity {
  private behaviorEngine = new AIBehaviorEngine();
  private state: AIEntityState;
  private entityId: string;

  constructor(
    id: string,
    personality: NPCPersonality,
    initialGoals: NPCGoal[] = [],
    thinkInterval: number = 1000
  ) {
    this.entityId = id;
    this.state = {
      id,
      personality,
      goals: initialGoals,
      currentAction: 'patrol',
      lastThinkTime: 0,
      thinkInterval,
      position: { x: 0, y: 0 },
      health: 100,
      maxHealth: 100,
      isDefending: false,
      cooldowns: new Map(),
    };
  }

  /**
   * Main AI update loop - called each frame/tick
   */
  update(gameState: GameStateSnapshot, _deltaTime: number): void {
    const now = Date.now();
    
    // Only think at specified intervals to avoid excessive computation
    if (now - this.state.lastThinkTime >= this.state.thinkInterval) {
      this.think(gameState);
      this.state.lastThinkTime = now;
    }

    // Execute current behavior tree
    if (this.state.behaviorTree) {
      this.state.behaviorTree.tick();
    }
  }

  /**
   * Execute behavior tree and take actions
   */
  private think(gameState: GameStateSnapshot): void {
    if (!this.state.behaviorTree) return;

    // Evaluate current situation and update goals
    this.evaluateGoals(gameState);

    // Execute behavior tree (simplified for now)
    const action = this.selectAction(gameState);
    
    // Queue any actions that resulted from behavior execution
    if (action) {
      this.queueAction(action);
    }
  }

  /**
   * Simple action selection based on game state
   */
  private selectAction(gameState: GameStateSnapshot): AIAction | null {
    // Simple AI logic - can be expanded with behavior trees later
    if (gameState.isUnderThreat && gameState.nearbyEnemies.length > 0) {
      const enemy = gameState.nearbyEnemies[0];
      if (enemy && this.state.personality.aggression > 0.5) {
        return {
          type: 'attack',
          targetId: enemy.id,
          priority: 10,
          data: { weapon: 'melee' }
        };
      } else {
        return {
          type: 'defend',
          priority: 8,
          data: Record<string, any>
        };
      }
    }
    
    // Default patrol behavior
    return {
      type: 'move',
      target: { x: Math.random() * 100, y: Math.random() * 100 },
      priority: 1,
      data: Record<string, any>
    };
  }

  /**
   * Evaluate and update goals based on current situation
   */
  private evaluateGoals(gameState: GameStateSnapshot): void {
    // Update goals based on game state
    if (gameState.isUnderThreat) {
      this.setGoal({ type: 'defend', priority: 10, target: 'self' });
    } else if (gameState.healthPercentage < 0.3) {
      this.setGoal({ type: 'support', priority: 8, target: 'self' });
    }
  }

  /**
   * Queue an action for execution
   */
  private queueAction(action: AIAction): void {
    this.state.lastAction = action;
    // Actions will be executed by the game session
  }

  /**
   * Execute actual game actions based on AI decisions
   */
  executeAction(action: AIAction, gameSession: any): void {
    switch (action.type) {
      case 'move':
        this.executeMovement(action, gameSession);
        break;
      case 'attack':
        this.executeAttack(action, gameSession);
        break;
      case 'defend':
        this.executeDefense(action, gameSession);
        break;
      case 'support':
        this.executeSupport(action, gameSession);
        break;
      case 'interact':
        this.executeInteraction(action, gameSession);
        break;
      default:
        logger.warn(`Unknown AI action type: ${action.type}`);
    }
  }

  private executeMovement(action: AIAction, gameSession: any): void {
    if (!action.target) return;
    
    // Calculate path to target position
    const targetPos = action.target;
    const currentPos = { x: this.state.position.x, y: this.state.position.y };
    
    // Simple movement toward target (could be enhanced with pathfinding)
    const dx = targetPos.x - currentPos.x;
    const dy = targetPos.y - currentPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      const moveSpeed = 30; // pixels per update
      const moveX = (dx / distance) * moveSpeed;
      const moveY = (dy / distance) * moveSpeed;
      
      this.state.position.x += moveX;
      this.state.position.y += moveY;
      
      // Update entity in game world
      gameSession.updateEntityPosition(this.entityId, this.state.position);
    }
  }

  private executeAttack(action: AIAction, gameSession: any): void {
    if (!action.targetId) return;
    
    // Queue combat action
    gameSession.queueCombatAction({
      sourceId: this.entityId,
      targetId: action.targetId,
      type: 'attack',
      weapon: action.data?.weapon || 'melee',
      damage: this.calculateDamage(action.data?.weapon)
    });
  }

  private executeDefense(action: AIAction, gameSession: any): void {
    // Set defensive stance
    this.state.isDefending = true;
    
    // Apply defensive modifiers
    gameSession.applyEntityEffect(this.entityId, {
      type: 'defense_bonus',
      value: 2,
      duration: 1 // 1 turn
    });
  }

  private executeSupport(action: AIAction, gameSession: any): void {
    if (!action.targetId) return;
    
    // Cast support spell or ability
    gameSession.queueCombatAction({
      sourceId: this.entityId,
      targetId: action.targetId,
      type: 'support',
      ability: action.data?.ability || 'heal',
      value: action.data?.value || 10
    });
  }

  private executeInteraction(action: AIAction, gameSession: any): void {
    if (!action.targetId) return;
    
    // Interact with object or character
    gameSession.queueInteraction({
      sourceId: this.entityId,
      targetId: action.targetId,
      type: action.data?.interactionType || 'talk',
      message: action.data?.message
    });
  }

  private calculateDamage(weapon?: string): number {
    // Simple damage calculation based on weapon and personality
    const baseDamage = weapon === 'ranged' ? 8 : 6;
    const aggressionBonus = Math.floor(this.state.personality.aggression * 4);
    return baseDamage + aggressionBonus + Math.floor(Math.random() * 4);
  }

  /**
   * Add or update a goal for this AI entity
   */
  setGoal(goal: NPCGoal): void {
    const existingIndex = this.state.goals.findIndex(g => g.type === goal.type);
    if (existingIndex >= 0) {
      this.state.goals[existingIndex] = goal;
    } else {
      this.state.goals.push(goal);
    }
  }

  /**
   * Remove a goal
   */
  removeGoal(goalType: NPCGoal['type']): void {
    this.state.goals = this.state.goals.filter(g => g.type !== goalType);
  }

  /**
   * Get current AI state for debugging/monitoring
   */
  getState(): Readonly<AIEntityState> {
    return this.state;
  }

  /**
   * Update personality traits (for character development)
   */
  updatePersonality(updates: Partial<NPCPersonality>): void {
    this.state.personality = { ...this.state.personality, ...updates };
  }

  /**
   * Force immediate re-evaluation of actions
   */
  forceThink(gameState: GameStateSnapshot): void {
    this.think(gameState);
  }

  /**
   * Get the current queued action
   */
  getQueuedAction(): AIAction | null {
    return this.state.lastAction || null;
  }

  /**
   * Clear the current queued action
   */
  clearQueuedAction(): void {
    delete this.state.lastAction;
  }

  // getState() defined above returns readonly view

  /**
   * Update entity position
   */
  updatePosition(position: { x: number; y: number }): void {
    this.state.position = position;
  }

  /**
   * Update entity health
   */
  updateHealth(health: number): void {
    this.state.health = Math.max(0, Math.min(this.state.maxHealth, health));
  }
}

/**
 * Factory for creating common NPC archetypes
 */
export class NPCArchetypes {
  static createGuard(): NPCPersonality {
    return {
      aggression: 0.6,
      intelligence: 0.5,
      caution: 0.8,
      loyalty: 0.9,
    };
  }

  static createBerserker(): NPCPersonality {
    return {
      aggression: 0.9,
      intelligence: 0.3,
      caution: 0.2,
      loyalty: 0.6,
    };
  }

  static createScout(): NPCPersonality {
    return {
      aggression: 0.3,
      intelligence: 0.8,
      caution: 0.9,
      loyalty: 0.7,
    };
  }

  static createHealer(): NPCPersonality {
    return {
      aggression: 0.2,
      intelligence: 0.7,
      caution: 0.7,
      loyalty: 0.9,
    };
  }

  static createWildcard(): NPCPersonality {
    return {
      aggression: Math.random(),
      intelligence: Math.random(),
      caution: Math.random(),
      loyalty: Math.random(),
    };
  }
}
