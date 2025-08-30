import { logger } from "@vtt/logging";

/**
 * Combat Management System
 * Handles initiative, turn order, combat rounds, and automated calculations
 */

export interface Combatant {
  id: string;
  tokenId?: string;
  name: string;
  type: "pc" | "npc" | "monster";
  initiative: number;
  initiativeModifier: number;
  maxHitPoints: number;
  currentHitPoints: number;
  temporaryHitPoints: number;
  armorClass: number;
  conditions: string[];
  isActive: boolean;
  isVisible: boolean;
  isDefeated: boolean;
  userId?: string; // For player characters
  actions: {
    action: boolean;
    bonusAction: boolean;
    reaction: boolean;
    movement: number;
    maxMovement: number;
  };
  resources: Record<string, { current: number; max: number }>;
  savingThrows: Record<string, number>;
  skills: Record<string, number>;
  stats: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
}

export interface CombatRound {
  number: number;
  startTime: number;
  endTime?: number;
  events: CombatEvent[];
}

export interface CombatEvent {
  id: string;
  type: "damage" | "healing" | "condition" | "death" | "action" | "movement" | "spell" | "attack";
  timestamp: number;
  combatantId: string;
  targetIds?: string[];
  description: string;
  data: any;
}

export interface CombatState {
  id: string;
  name: string;
  status: "preparing" | "active" | "paused" | "ended";
  currentRound: number;
  currentTurn: number;
  turnStartTime: number;
  combatants: Combatant[];
  rounds: CombatRound[];
  settings: CombatSettings;
}

export interface CombatSettings {
  initiativeType: "standard" | "group" | "side";
  turnTimer: number; // seconds, 0 = no timer
  autoAdvance: boolean;
  showInitiative: boolean;
  showHealth: boolean;
  allowDelayedActions: boolean;
  automaticDamageApplication: boolean;
}

export class CombatManager {
  private combatState: CombatState | null = null;
  private turnTimer: any | null = null;
  private eventListeners: Array<(_event: CombatManagerEvent) => void> = [];

  constructor() {
    // Initialize with default state
  }

  /**
   * Start new combat encounter
   */
  startCombat(
    name: string,
    combatants: Omit<Combatant, "id" | "actions" | "isActive">[],
    settings: Partial<CombatSettings> = {},
  ): CombatState {
    // Roll initiative for all combatants
    const processedCombatants = combatants.map((combatant) => ({
      ...combatant,
      id: this.generateCombatantId(),
      initiative: this.rollInitiative(combatant.initiativeModifier),
      actions: {
        action: true,
        bonusAction: true,
        reaction: true,
        movement: combatant.stats ? this.calculateMovementSpeed(combatant as any) : 30,
        maxMovement: combatant.stats ? this.calculateMovementSpeed(combatant as any) : 30,
      },
      isActive: false,
    }));

    // Sort by initiative (highest first, then by dexterity modifier)
    processedCombatants.sort((a, b) => {
      if (b.initiative !== a.initiative) {
        return b.initiative - a.initiative;
      }
      return (
        this.getDexterityModifier(b.stats?.dexterity || 10) -
        this.getDexterityModifier(a.stats?.dexterity || 10)
      );
    });

    // Create combat state
    this.combatState = {
      id: this.generateCombatId(),
      name,
      status: "active",
      currentRound: 1,
      currentTurn: 0,
      turnStartTime: Date.now(),
      combatants: processedCombatants,
      rounds: [
        {
          number: 1,
          startTime: Date.now(),
          events: [],
        },
      ],
      settings: {
        initiativeType: "standard",
        turnTimer: 0,
        autoAdvance: false,
        showInitiative: true,
        showHealth: true,
        allowDelayedActions: false,
        automaticDamageApplication: true,
        ...settings,
      },
    };

    // Activate first combatant
    if (processedCombatants.length > 0) {
      if (processedCombatants[0]) {
        processedCombatants[0].isActive = true;
      }
      this.startTurnTimer();
    }

    this.emitEvent({
      type: "combat-started",
      data: { combat: this.combatState },
    });

    return this.combatState;
  }

  /**
   * End combat encounter
   */
  endCombat(): void {
    if (!this.combatState) return;

    this.combatState.status = "ended";
    this.stopTurnTimer();

    // Mark current round as ended
    const currentRound = this.getCurrentRound();
    if (currentRound && !currentRound.endTime) {
      currentRound.endTime = Date.now();
    }

    this.emitEvent({
      type: "combat-ended",
      data: { combat: this.combatState },
    });

    this.combatState = null;
  }

  /**
   * Advance to next turn
   */
  nextTurn(): void {
    if (!this.combatState || this.combatState.status !== "active") return;

    // Deactivate current combatant
    const currentCombatant = this.getCurrentCombatant();
    if (currentCombatant) {
      currentCombatant.isActive = false;
    }

    // Advance turn
    this.combatState.currentTurn++;

    // Check if we need to start a new round
    if (this.combatState.currentTurn >= this.combatState.combatants.length) {
      this.startNewRound();
      return;
    }

    // Activate next combatant
    const nextCombatant = this.combatState.combatants[this.combatState.currentTurn];
    if (nextCombatant) {
      nextCombatant.isActive = true;
      this.resetCombatantActions(nextCombatant);

      // Emit event with the new current combatant
      this.emitEvent({
        type: "turn-advanced",
        data: {
          combat: this.combatState!,
          currentCombatant: nextCombatant,
        },
      });
    }

    this.combatState.turnStartTime = Date.now();
    this.startTurnTimer();
  }

  /**
   * Start new combat round
   */
  private startNewRound(): void {
    if (!this.combatState) return;

    // End current round
    const currentRound = this.getCurrentRound();
    if (currentRound) {
      currentRound.endTime = Date.now();
    }

    // Start new round
    this.combatState.currentRound++;
    this.combatState.currentTurn = 0;

    // Create new round
    const newRound: CombatRound = {
      number: this.combatState.currentRound,
      startTime: Date.now(),
      events: [],
    };
    this.combatState.rounds.push(newRound);

    // Reset all combatant actions and process effects
    this.combatState.combatants.forEach((combatant) => {
      this.resetCombatantActions(combatant);
      this.processEndOfRoundEffects(combatant);
    });

    // Activate first combatant
    const firstCombatant = this.combatState.combatants[0];
    if (firstCombatant) {
      firstCombatant.isActive = true;
    }

    this.combatState.turnStartTime = Date.now();
    this.startTurnTimer();

    this.emitEvent({
      type: "round-started",
      data: {
        combat: this.combatState,
        round: newRound,
      },
    });
  }

  /**
   * Apply damage to combatant
   */
  applyDamage(
    combatantId: string,
    damage: number,
    damageType: string = "untyped",
    source?: string,
  ): void {
    const combatant = this.getCombatant(combatantId);
    if (!combatant) return;

    // Calculate actual damage (resistances, immunities, etc.)
    const actualDamage = this.calculateActualDamage(combatant, damage, damageType);

    // Apply temporary hit points first
    let remainingDamage = actualDamage;
    if (combatant.temporaryHitPoints > 0) {
      const tempHpReduction = Math.min(combatant.temporaryHitPoints, remainingDamage);
      combatant.temporaryHitPoints -= tempHpReduction;
      remainingDamage -= tempHpReduction;
    }

    // Apply remaining damage to hit points
    combatant.currentHitPoints = Math.max(0, combatant.currentHitPoints - remainingDamage);

    // Check for death/unconsciousness
    if (combatant.currentHitPoints === 0 && !combatant.isDefeated) {
      this.handleCombatantDefeated(combatant);
    }

    // Log damage event
    this.logCombatEvent({
      type: "damage",
      combatantId,
      description: `${combatant.name} takes ${actualDamage} ${damageType} damage${source ? ` from ${source}` : ""}`,
      data: {
        damage: actualDamage,
        damageType,
        source,
        remainingHp: combatant.currentHitPoints,
      },
    });

    this.emitEvent({
      type: "damage-applied",
      data: { combatantId, damage: actualDamage, combatant },
    });
  }

  /**
   * Apply healing to combatant
   */
  applyHealing(combatantId: string, healing: number, source?: string): void {
    const combatant = this.getCombatant(combatantId);
    if (!combatant) return;

    const actualHealing = Math.min(healing, combatant.maxHitPoints - combatant.currentHitPoints);
    combatant.currentHitPoints += actualHealing;

    // Log healing event
    this.logCombatEvent({
      type: "healing",
      combatantId,
      description: `${combatant.name} heals ${actualHealing} hit points${source ? ` from ${source}` : ""}`,
      data: {
        healing: actualHealing,
        source,
        currentHp: combatant.currentHitPoints,
      },
    });

    this.emitEvent({
      type: "healing-applied",
      data: { combatantId, healing: actualHealing, combatant },
    });
  }

  /**
   * Add condition to combatant
   */
  addCondition(combatantId: string, condition: string, duration?: number, source?: string): void {
    const combatant = this.getCombatant(combatantId);
    if (!combatant || combatant.conditions.includes(condition)) return;

    combatant.conditions.push(condition);

    this.logCombatEvent({
      type: "condition",
      combatantId,
      description: `${combatant.name} gains condition: ${condition}${duration ? ` (${duration} rounds)` : ""}`,
      data: {
        condition,
        duration,
        source,
        added: true,
      },
    });

    this.emitEvent({
      type: "condition-added",
      data: { combatantId, condition, combatant },
    });
  }

  /**
   * Remove condition from combatant
   */
  removeCondition(combatantId: string, condition: string): void {
    const combatant = this.getCombatant(combatantId);
    if (!combatant) return;

    const index = combatant.conditions.indexOf(condition);
    if (index > -1) {
      combatant.conditions.splice(index, 1);

      this.logCombatEvent({
        type: "condition",
        combatantId,
        description: `${combatant.name} loses condition: ${condition}`,
        data: {
          condition,
          added: false,
        },
      });

      this.emitEvent({
        type: "condition-removed",
        data: { combatantId, condition, combatant },
      });
    }
  }

  /**
   * Make attack roll
   */
  makeAttackRoll(
    attackerId: string,
    targetId: string,
    attackBonus: number,
    damage: { dice: string; bonus: number; type: string },
    options: { advantage?: boolean; disadvantage?: boolean; critical?: number } = {},
  ): {
    hit: boolean;
    critical: boolean;
    attackRoll: number;
    damageRoll?: number;
  } {
    const attacker = this.getCombatant(attackerId);
    const target = this.getCombatant(targetId);

    if (!attacker || !target) {
      throw new Error("Invalid combatant IDs");
    }

    // Roll attack
    const attackRoll = this.rollD20(options.advantage, options.disadvantage);
    const totalAttack = attackRoll + attackBonus;

    // Check for critical hit
    const criticalThreshold = options.critical || 20;
    const isCritical = attackRoll >= criticalThreshold;

    // Check if attack hits
    const hits = totalAttack >= target.armorClass || isCritical;

    let damageRoll: number | undefined;

    if (hits) {
      // Roll damage
      damageRoll = this.rollDamage(damage.dice, damage.bonus, isCritical);

      // Apply damage if automatic damage application is enabled
      if (this.combatState?.settings.automaticDamageApplication) {
        this.applyDamage(targetId, damageRoll, damage.type, attacker.name);
      }
    }

    // Log attack event
    this.logCombatEvent({
      type: "attack",
      combatantId: attackerId,
      targetIds: [targetId],
      description: `${attacker.name} attacks ${target.name}: ${totalAttack} vs AC ${target.armorClass} - ${hits ? "HIT" : "MISS"}${isCritical ? " (CRITICAL)" : ""}`,
      data: {
        attackRoll,
        totalAttack,
        targetAC: target.armorClass,
        hit: hits,
        critical: isCritical,
        damageRoll,
        damageType: damage.type,
      },
    });

    return {
      hit: hits,
      critical: isCritical,
      attackRoll,
      ...(damageRoll !== undefined ? { damageRoll } : Record<string, any>),
    };
  }

  /**
   * Make saving throw
   */
  makeSavingThrow(
    combatantId: string,
    ability: string,
    dc: number,
    options: { advantage?: boolean; disadvantage?: boolean } = {},
  ): { success: boolean; roll: number; total: number } {
    const combatant = this.getCombatant(combatantId);
    if (!combatant) {
      throw new Error("Invalid combatant ID");
    }

    const roll = this.rollD20(options.advantage, options.disadvantage);
    const modifier =
      combatant.savingThrows[ability] || this.getAbilityModifier(combatant.stats, ability);
    const total = roll + modifier;
    const success = total >= dc;

    this.logCombatEvent({
      type: "action",
      combatantId,
      description: `${combatant.name} makes a ${ability} saving throw: ${total} vs DC ${dc} - ${success ? "SUCCESS" : "FAILURE"}`,
      data: {
        savingThrow: true,
        ability,
        roll,
        modifier,
        total,
        dc,
        success,
      },
    });

    return { success, roll, total };
  }

  /**
   * Use combatant action
   */
  useAction(combatantId: string, actionType: "action" | "bonusAction" | "reaction"): boolean {
    const combatant = this.getCombatant(combatantId);
    if (!combatant || !combatant.actions[actionType]) {
      return false;
    }

    combatant.actions[actionType] = false;

    this.emitEvent({
      type: "action-used",
      data: { combatantId, actionType, combatant },
    });

    return true;
  }

  /**
   * Move combatant
   */
  moveCombatant(combatantId: string, distance: number): boolean {
    const combatant = this.getCombatant(combatantId);
    if (!combatant || combatant.actions.movement < distance) {
      return false;
    }

    combatant.actions.movement -= distance;

    this.logCombatEvent({
      type: "movement",
      combatantId,
      description: `${combatant.name} moves ${distance} feet`,
      data: {
        distance,
        remainingMovement: combatant.actions.movement,
      },
    });

    return true;
  }

  // Helper methods
  private rollInitiative(modifier: number): number {
    return this.rollD20() + modifier;
  }

  private rollD20(advantage = false, disadvantage = false): number {
    if (advantage && disadvantage) {
      return Math.floor(Math.random() * 20) + 1;
    } else if (advantage) {
      const roll1 = Math.floor(Math.random() * 20) + 1;
      const roll2 = Math.floor(Math.random() * 20) + 1;
      return Math.max(roll1, roll2);
    } else if (disadvantage) {
      const roll1 = Math.floor(Math.random() * 20) + 1;
      const roll2 = Math.floor(Math.random() * 20) + 1;
      return Math.min(roll1, roll2);
    } else {
      return Math.floor(Math.random() * 20) + 1;
    }
  }

  private rollDamage(dice: string, bonus: number, critical = false): number {
    // Simple dice rolling - parse dice notation like "2d6", "1d8+3"
    const match = dice.match(/(\d+)d(\d+)/);
    if (!match) return bonus;

    const numDice = parseInt(match[1] || "1");
    const diceSides = parseInt(match[2] || "6");

    let total = 0;
    const rollCount = critical ? numDice * 2 : numDice;

    for (let i = 0; i < rollCount; i++) {
      total += Math.floor(Math.random() * diceSides) + 1;
    }

    return total + bonus;
  }

  private calculateActualDamage(combatant: Combatant, damage: number, _damageType: string): number {
    // Simplified damage calculation - would need to check resistances/immunities
    return damage;
  }

  private calculateMovementSpeed(_combatant: Combatant): number {
    // Base movement speed calculation
    return 30; // Default 30 feet
  }

  private getDexterityModifier(dexterity: number): number {
    return Math.floor((dexterity - 10) / 2);
  }

  private getAbilityModifier(stats: Combatant["stats"], ability: string): number {
    const score = stats[ability as keyof typeof stats] || 10;
    return Math.floor((score - 10) / 2);
  }

  private resetCombatantActions(combatant: Combatant): void {
    combatant.actions.action = true;
    combatant.actions.bonusAction = true;
    combatant.actions.reaction = true;
    combatant.actions.movement = combatant.actions.maxMovement;
  }

  private processEndOfRoundEffects(_combatant: Combatant): void {
    // Process condition effects, damage over time, etc.
    // This would be expanded based on specific game rules
  }

  private handleCombatantDefeated(combatant: Combatant): void {
    combatant.isDefeated = true;

    this.logCombatEvent({
      type: "death",
      combatantId: combatant.id,
      description: `${combatant.name} is defeated`,
      data: Record<string, any>,
    });

    this.emitEvent({
      type: "combatant-defeated",
      data: { combatant },
    });
  }

  private startTurnTimer(): void {
    if (!this.combatState || this.combatState.settings.turnTimer <= 0) return;

    this.stopTurnTimer();
    this.turnTimer = setTimeout(() => {
      if (this.combatState?.settings.autoAdvance) {
        this.nextTurn();
      } else {
        this.emitEvent({
          type: "turn-timer-expired",
          data: { combatant: this.getCurrentCombatant() },
        });
      }
    }, this.combatState.settings.turnTimer * 1000);
  }

  private stopTurnTimer(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  private logCombatEvent(event: Omit<CombatEvent, "id" | "timestamp">): void {
    if (!this.combatState) return;

    const combatEvent: CombatEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: Date.now(),
    };

    const currentRound = this.getCurrentRound();
    if (currentRound) {
      currentRound.events.push(combatEvent);
    }
  }

  // Getters
  getCombatState(): CombatState | null {
    return this.combatState;
  }

  getCurrentCombatant(): Combatant | null {
    if (!this.combatState) return null;
    return this.combatState.combatants[this.combatState.currentTurn] || null;
  }

  getCombatant(id: string): Combatant | null {
    if (!this.combatState) return null;
    return this.combatState.combatants.find((c) => c.id === id) || null;
  }

  getCurrentRound(): CombatRound | null {
    if (!this.combatState) return null;
    return this.combatState.rounds[this.combatState.rounds.length - 1] || null;
  }

  private generateCombatId(): string {
    return `combat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCombatantId(): string {
    return `combatant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Event system
  addEventListener(_listener: (event: CombatManagerEvent) => void): void {
    this.eventListeners.push(listener);
  }

  removeEventListener(_listener: (event: CombatManagerEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private emitEvent(event: CombatManagerEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        logger.error("Combat manager event listener error:", error);
      }
    });
  }
}

// Event types
export type CombatManagerEvent =
  | { type: "combat-started"; data: { combat: CombatState } }
  | { type: "combat-ended"; data: { combat: CombatState } }
  | { type: "turn-advanced"; data: { combat: CombatState; currentCombatant: Combatant } }
  | { type: "round-started"; data: { combat: CombatState; round: CombatRound } }
  | { type: "damage-applied"; data: { combatantId: string; damage: number; combatant: Combatant } }
  | {
      type: "healing-applied";
      data: { combatantId: string; healing: number; combatant: Combatant };
    }
  | {
      type: "condition-added";
      data: { combatantId: string; condition: string; combatant: Combatant };
    }
  | {
      type: "condition-removed";
      data: { combatantId: string; condition: string; combatant: Combatant };
    }
  | { type: "action-used"; data: { combatantId: string; actionType: string; combatant: Combatant } }
  | { type: "combatant-defeated"; data: { combatant: Combatant } }
  | { type: "turn-timer-expired"; data: { combatant: Combatant | null } };
