import { EntityId, CombatStore } from "../components/Combat";
import { HealthStore } from "../components/Health";
import { StatsStore } from "../components/Stats";
import { LegendaryAction } from "../adapters/MonsterStatblockAdapter";
import { AILearningSystem, ActionOutcome, QValueState } from "./AILearningSystem";

export interface MonsterAIData {
  challengeRating?: number;
  type?: string;
  abilities?: {
    strength?: number;
    dexterity?: number;
    constitution?: number;
    intelligence?: number;
    wisdom?: number;
    charisma?: number;
  };
  spellcasting?: {
    level: number;
    ability: string;
    saveDC: number;
    attackBonus: number;
    slots?: Record<string, number>;
    spells: Record<string, string[]>;
  };
  legendaryActions?: LegendaryAction[];
  actions?: Array<{
    name: string;
    description: string;
    attackBonus?: number;
    damage?: {
      diceExpression: string;
      damageType: string;
    };
    saveDC?: number;
    saveAbility?: string;
    range?: number;
    targets?: number;
  }>;
}

export interface AIDecision {
  entityId: EntityId;
  action: "attack" | "spell" | "move" | "legendary_action" | "wait";
  targetId?: EntityId;
  spellId?: string;
  legendaryActionName?: string;
  priority: number;
}

export interface AIBehavior {
  aggressiveness: number; // 0-1: how likely to attack vs defensive actions
  intelligence: number; // 0-1: how tactical the decisions are
  selfPreservation: number; // 0-1: how much it prioritizes staying alive
  spellPreference: number; // 0-1: preference for spells over attacks
}

export class MonsterAISystem {
  private combatStore: CombatStore;
  private healthStore: HealthStore;
  private statsStore: StatsStore;
  private behaviors: Map<EntityId, AIBehavior> = new Map();
  private monsterData: Map<EntityId, MonsterAIData> = new Map(); // Store monster statblock data
  private learningSystem: AILearningSystem;
  private lastActions: Map<EntityId, { decision: AIDecision; timestamp: number }> = new Map();

  constructor(
    combatStore: CombatStore,
    healthStore: HealthStore,
    statsStore: StatsStore,
    learningSystem?: AILearningSystem,
  ) {
    this.combatStore = combatStore;
    this.healthStore = healthStore;
    this.statsStore = statsStore;
    this.learningSystem = learningSystem || new AILearningSystem();
  }

  registerMonster(
    entityId: EntityId,
    monsterData: MonsterAIData,
    behavior?: Partial<AIBehavior>,
  ): void {
    this.monsterData.set(entityId, monsterData);

    // Default behavior based on monster type/CR
    const defaultBehavior: AIBehavior = {
      aggressiveness: this.calculateAggressiveness(monsterData),
      intelligence: this.calculateIntelligence(monsterData),
      selfPreservation: this.calculateSelfPreservation(monsterData),
      spellPreference: this.calculateSpellPreference(monsterData),
    };

    this.behaviors.set(entityId, { ...defaultBehavior, ...behavior });
  }

  decideTurn(entityId: EntityId, allEntities: EntityId[]): AIDecision {
    const behavior = this.behaviors.get(entityId);
    const monsterData = this.monsterData.get(entityId);

    if (!behavior || !monsterData) {
      return { entityId, action: "wait", priority: 0 };
    }

    const health = this.healthStore.get(entityId);
    const combat = this.combatStore.get(entityId);

    if (!health || !combat) {
      return { entityId, action: "wait", priority: 0 };
    }

    // Calculate health percentage for decision making
    const healthPercent = health.current / health.max;

    // Find potential targets (enemies)
    const potentialTargets = this.findTargets(entityId, allEntities);

    // Get adaptive behavior based on learning
    const adaptiveBehavior = this.learningSystem.getAdaptiveBehavior(entityId, behavior);

    // Create state for learning system
    const currentState: QValueState = {
      healthPercentage: healthPercent,
      enemyCount: potentialTargets.length,
      allyCount: allEntities.length - potentialTargets.length - 1, // -1 for self
      actionPoints: combat.actionPoints,
      hasAdvantage: allEntities.length > potentialTargets.length,
    };

    // Available actions for learning
    const availableActions: string[] = [];

    // Decide on primary action
    const decisions: AIDecision[] = [];

    // Consider attacking
    if (potentialTargets.length > 0 && combat.actionPoints > 0) {
      availableActions.push("attack");
      const attackDecision = this.evaluateAttack(
        entityId,
        potentialTargets,
        adaptiveBehavior,
        healthPercent,
      );
      if (attackDecision) {
        decisions.push(attackDecision);
      }
    }

    // Consider spellcasting
    if (monsterData.spellcasting && combat.actionPoints > 0) {
      availableActions.push("spell");
      const spellDecision = this.evaluateSpellcast(
        entityId,
        potentialTargets,
        adaptiveBehavior,
        healthPercent,
      );
      if (spellDecision) {
        decisions.push(spellDecision);
      }
    }

    // Consider movement (tactical repositioning)
    availableActions.push("move");
    const moveDecision = this.evaluateMovement(
      entityId,
      potentialTargets,
      adaptiveBehavior,
      healthPercent,
    );
    if (moveDecision) {
      decisions.push(moveDecision);
    }

    // Use learning system to potentially override decision
    if (availableActions.length > 0) {
      const learnedAction = this.learningSystem.getBestAction(
        entityId,
        currentState,
        availableActions,
      );
      const learnedDecision = decisions.find((d) => d.action === learnedAction);
      if (learnedDecision) {
        this.recordDecision(entityId, learnedDecision);
        return learnedDecision;
      }
    }

    // Return highest priority decision or wait
    const sortedDecisions = decisions.sort((a, b) => b.priority - a.priority);
    const bestDecision: AIDecision =
      sortedDecisions.length > 0 && sortedDecisions[0]
        ? sortedDecisions[0]
        : { entityId, action: "wait", priority: 0 };

    this.recordDecision(entityId, bestDecision);
    return bestDecision;
  }

  decideLegendaryAction(entityId: EntityId, allEntities: EntityId[]): AIDecision | null {
    const monsterData = this.monsterData.get(entityId);
    const combat = this.combatStore.get(entityId);

    if (
      !monsterData?.legendaryActions ||
      !combat ||
      !this.combatStore.hasLegendaryActions(entityId)
    ) {
      return null;
    }

    const remaining = this.combatStore.getLegendaryActionsRemaining(entityId);
    if (remaining <= 0) {
      return null;
    }

    // Simple AI: use cheapest available legendary action
    const availableActions = monsterData.legendaryActions.filter(
      (action: LegendaryAction) => action.cost <= remaining,
    );

    if (availableActions.length === 0) {
      return null;
    }

    // Prefer attack actions, then movement
    const preferredAction =
      availableActions.find((action: LegendaryAction) =>
        action.name.toLowerCase().includes("attack"),
      ) || availableActions[0];

    const potentialTargets = this.findTargets(entityId, allEntities);
    const targetId = potentialTargets.length > 0 ? potentialTargets[0] : undefined;

    return {
      entityId,
      action: "legendary_action",
      targetId: targetId || 0, // Provide default value for required targetId
      legendaryActionName: preferredAction.name,
      priority: 7, // High priority for legendary actions
    };
  }

  private calculateAggressiveness(monsterData: MonsterAIData): number {
    // Base on challenge rating and monster type
    const cr = monsterData.challengeRating || 1;
    let aggressiveness = Math.min(0.3 + cr * 0.1, 1.0);

    // Adjust based on monster type
    if (monsterData.type?.toLowerCase().includes("undead")) {
      aggressiveness += 0.2;
    }
    if (monsterData.type?.toLowerCase().includes("fiend")) {
      aggressiveness += 0.3;
    }
    if (monsterData.type?.toLowerCase().includes("beast")) {
      aggressiveness += 0.1;
    }

    return Math.min(aggressiveness, 1.0);
  }

  private calculateIntelligence(monsterData: MonsterAIData): number {
    const intScore = monsterData.abilities?.intelligence || 10;
    return Math.max(0.1, Math.min((intScore - 3) / 15, 1.0));
  }

  private calculateSelfPreservation(monsterData: MonsterAIData): number {
    const wisScore = monsterData.abilities?.wisdom || 10;
    return Math.max(0.2, Math.min((wisScore - 5) / 15, 0.8));
  }

  private calculateSpellPreference(monsterData: MonsterAIData): number {
    return monsterData.spellcasting ? 0.6 : 0.1;
  }

  private findTargets(entityId: EntityId, allEntities: EntityId[]): EntityId[] {
    // Simple targeting: find all other entities (in real implementation, would filter by hostility)
    return allEntities.filter((id) => {
      if (id === entityId) {
        return false;
      }
      const health = this.healthStore.get(id);
      return health !== undefined && health !== null && health.current > 0;
    });
  }

  private evaluateAttack(
    entityId: EntityId,
    targets: EntityId[],
    behavior: AIBehavior,
    healthPercent: number,
  ): AIDecision | null {
    if (targets.length === 0) {
      return null;
    }

    // Choose target based on AI behavior
    const targetId = this.selectBestTarget(entityId, targets, behavior);

    const priority =
      behavior.aggressiveness * 8 + (healthPercent > 0.3 ? 2 : -2) + behavior.intelligence * 2;

    return {
      entityId,
      action: "attack",
      targetId,
      priority,
    };
  }

  private evaluateSpellcast(
    entityId: EntityId,
    targets: EntityId[],
    behavior: AIBehavior,
    healthPercent: number,
  ): AIDecision | null {
    if (targets.length === 0) {
      return null;
    }

    const targetId = this.selectBestTarget(entityId, targets, behavior);

    const priority =
      behavior.spellPreference * 9 + behavior.intelligence * 3 + (healthPercent < 0.5 ? 3 : 0); // Prefer spells when low health

    return {
      entityId,
      action: "spell",
      targetId,
      spellId: "generic_spell", // In real implementation, would choose specific spell
      priority,
    };
  }

  private evaluateMovement(
    entityId: EntityId,
    targets: EntityId[],
    behavior: AIBehavior,
    healthPercent: number,
  ): AIDecision | null {
    const movePriority =
      behavior.selfPreservation * (1 - healthPercent) * 6 + behavior.intelligence * 2;

    // Only consider movement if health is low or very tactical
    if (movePriority < 4) {
      return null;
    }

    return {
      entityId,
      action: "move",
      priority: movePriority,
    };
  }

  private selectBestTarget(
    entityId: EntityId,
    targets: EntityId[],
    behavior: AIBehavior,
  ): EntityId {
    if (targets.length === 1) {
      return targets[0]!;
    }

    // Intelligent monsters prefer low-health targets, aggressive ones prefer closest/strongest
    if (behavior.intelligence > 0.6) {
      // Target lowest health percentage
      return targets.reduce((best, current) => {
        const bestHealth = this.healthStore.get(best);
        const currentHealth = this.healthStore.get(current);

        if (!bestHealth || !currentHealth) {
          return best;
        }

        const bestPercent = bestHealth.current / bestHealth.max;
        const currentPercent = currentHealth.current / currentHealth.max;

        return currentPercent < bestPercent ? current : best;
      });
    } else {
      // Random target for less intelligent creatures
      return targets[Math.floor(Math.random() * targets.length)]!;
    }
  }

  /**
   * Record a decision for learning
   */
  private recordDecision(entityId: EntityId, decision: AIDecision): void {
    this.lastActions.set(entityId, {
      decision,
      timestamp: Date.now(),
    });
  }

  /**
   * Report action outcome for learning
   */
  reportActionOutcome(entityId: EntityId, outcome: ActionOutcome): void {
    const lastAction = this.lastActions.get(entityId);
    if (lastAction) {
      this.learningSystem.recordOutcome(entityId, lastAction.decision, outcome);
    }
  }

  /**
   * Get learning statistics
   */
  getLearningStats() {
    return this.learningSystem.getStats();
  }

  /**
   * Reset learning for an entity
   */
  resetEntityLearning(entityId: EntityId): void {
    this.learningSystem.resetEntityLearning(entityId);
    this.lastActions.delete(entityId);
  }
}
