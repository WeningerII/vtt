/**
 * D&D 5e Condition and Status Effect Management System
 * Handles all conditions, temporary effects, and their interactions
 */

export interface Condition {
  id: string;
  name: string;
  description: string;
  duration: number; // -1 for permanent, 0 for instant, >0 for rounds
  source?: string; // spell, ability, etc.
  level?: number; // for spell-based conditions
  dc?: number; // save DC if applicable
  saveAbility?: string; // ability for saves
  saveAtEnd?: boolean; // save at end of turn
  effects: ConditionEffect[];
  stackable?: boolean;
  replaces?: string[]; // conditions this replaces
  preventedBy?: string[]; // conditions that prevent this
}

export interface ConditionEffect {
  type:
    | "ability_modifier"
    | "skill_modifier"
    | "save_modifier"
    | "ac_modifier"
    | "speed_modifier"
    | "damage_modifier"
    | "resistance"
    | "immunity"
    | "vulnerability"
    | "advantage"
    | "disadvantage"
    | "prevent_action"
    | "force_action"
    | "damage_over_time"
    | "healing_over_time"
    | "custom";
  target: string; // what it affects
  value?: number; // modifier amount
  dice?: string; // for DoT effects
  damageType?: string;
  duration?: "permanent" | "turn" | "round" | "encounter";
  trigger?: "start_turn" | "end_turn" | "attack" | "spell_cast" | "damage_taken";
}

export interface ActiveCondition extends Condition {
  appliedAt: number; // timestamp
  remainingDuration: number;
  appliedBy: string; // entity that applied it
  metadata?: Record<string, any>; // condition-specific data
}

// Predefined D&D 5e conditions
export const D5E_CONDITIONS: Record<string, Condition> = {
  blinded: {
    id: "blinded",
    name: "Blinded",
    description: "Cannot see and automatically fails ability checks that require sight",
    duration: -1,
    effects: [
      { type: "disadvantage", target: "attack_rolls" },
      { type: "advantage", target: "incoming_attacks" },
    ],
  },
  charmed: {
    id: "charmed",
    name: "Charmed",
    description: "Cannot attack the charmer or target them with harmful abilities",
    duration: -1,
    effects: [
      { type: "prevent_action", target: "attack_charmer" },
      { type: "advantage", target: "charmer_social_interactions" },
    ],
  },
  deafened: {
    id: "deafened",
    name: "Deafened",
    description: "Cannot hear and automatically fails ability checks that require hearing",
    duration: -1,
    effects: [],
  },
  frightened: {
    id: "frightened",
    name: "Frightened",
    description: "Disadvantage on ability checks and attacks while source is in sight",
    duration: -1,
    effects: [
      { type: "disadvantage", target: "ability_checks" },
      { type: "disadvantage", target: "attack_rolls" },
      { type: "prevent_action", target: "move_closer_to_source" },
    ],
  },
  grappled: {
    id: "grappled",
    name: "Grappled",
    description: "Speed becomes 0 and cannot benefit from bonuses to speed",
    duration: -1,
    effects: [{ type: "speed_modifier", target: "all", value: 0 }],
  },
  incapacitated: {
    id: "incapacitated",
    name: "Incapacitated",
    description: "Cannot take actions or reactions",
    duration: -1,
    effects: [
      { type: "prevent_action", target: "actions" },
      { type: "prevent_action", target: "reactions" },
    ],
  },
  invisible: {
    id: "invisible",
    name: "Invisible",
    description: "Cannot be seen without special senses",
    duration: -1,
    effects: [
      { type: "advantage", target: "attack_rolls" },
      { type: "disadvantage", target: "incoming_attacks" },
      { type: "advantage", target: "stealth_checks" },
    ],
  },
  paralyzed: {
    id: "paralyzed",
    name: "Paralyzed",
    description: "Incapacitated and cannot move or speak",
    duration: -1,
    effects: [
      { type: "prevent_action", target: "actions" },
      { type: "prevent_action", target: "reactions" },
      { type: "prevent_action", target: "movement" },
      { type: "prevent_action", target: "speech" },
      { type: "advantage", target: "incoming_attacks" },
      { type: "advantage", target: "incoming_melee_crits" },
    ],
  },
  petrified: {
    id: "petrified",
    name: "Petrified",
    description: "Incapacitated, cannot move or speak, and has resistance to all damage",
    duration: -1,
    effects: [
      { type: "prevent_action", target: "actions" },
      { type: "prevent_action", target: "reactions" },
      { type: "prevent_action", target: "movement" },
      { type: "prevent_action", target: "speech" },
      { type: "resistance", target: "all_damage" },
    ],
  },
  poisoned: {
    id: "poisoned",
    name: "Poisoned",
    description: "Disadvantage on attack rolls and ability checks",
    duration: -1,
    effects: [
      { type: "disadvantage", target: "attack_rolls" },
      { type: "disadvantage", target: "ability_checks" },
    ],
  },
  prone: {
    id: "prone",
    name: "Prone",
    description: "Disadvantage on attack rolls, advantage on incoming melee attacks",
    duration: -1,
    effects: [
      { type: "disadvantage", target: "attack_rolls" },
      { type: "advantage", target: "incoming_melee_attacks" },
      { type: "disadvantage", target: "incoming_ranged_attacks" },
    ],
  },
  restrained: {
    id: "restrained",
    name: "Restrained",
    description: "Speed becomes 0, disadvantage on attacks and Dex saves",
    duration: -1,
    effects: [
      { type: "speed_modifier", target: "all", value: 0 },
      { type: "disadvantage", target: "attack_rolls" },
      { type: "disadvantage", target: "dexterity_saves" },
      { type: "advantage", target: "incoming_attacks" },
    ],
  },
  stunned: {
    id: "stunned",
    name: "Stunned",
    description: "Incapacitated, cannot move, and can speak only falteringly",
    duration: -1,
    effects: [
      { type: "prevent_action", target: "actions" },
      { type: "prevent_action", target: "reactions" },
      { type: "prevent_action", target: "movement" },
      { type: "advantage", target: "incoming_attacks" },
    ],
  },
  unconscious: {
    id: "unconscious",
    name: "Unconscious",
    description: "Incapacitated, cannot move or speak, unaware of surroundings",
    duration: -1,
    effects: [
      { type: "prevent_action", target: "actions" },
      { type: "prevent_action", target: "reactions" },
      { type: "prevent_action", target: "movement" },
      { type: "prevent_action", target: "speech" },
      { type: "advantage", target: "incoming_attacks" },
      { type: "advantage", target: "incoming_melee_crits" },
      { type: "custom", target: "drop_concentration" },
    ],
    replaces: ["prone"],
  },
};

export class ConditionsEngine {
  private activeConditions = new Map<string, ActiveCondition[]>(); // entityId -> conditions

  /**
   * Apply condition to entity
   */
  applyCondition(
    entityId: string,
    condition: Condition | string,
    duration?: number,
    source?: string,
    metadata?: Record<string, any>,
  ): ActiveCondition {
    const conditionData = typeof condition === "string" ? D5E_CONDITIONS[condition] : condition;

    if (!conditionData) {
      throw new Error(`Unknown condition: ${condition}`);
    }

    // Check if condition is prevented by existing conditions
    const existingConditions = this.getActiveConditions(entityId);
    for (const existing of existingConditions) {
      if (existing.preventedBy?.includes(conditionData.id)) {
        throw new Error(`Condition ${conditionData.name} prevented by ${existing.name}`);
      }
    }

    // Handle condition replacement
    if (conditionData.replaces) {
      for (const replacedId of conditionData.replaces) {
        this.removeCondition(entityId, replacedId);
      }
    }

    // Check if condition is stackable
    if (!conditionData.stackable) {
      const existing = existingConditions.find((c) => c.id === conditionData.id);
      if (existing) {
        // Update existing condition instead of stacking
        existing.remainingDuration = Math.max(
          existing.remainingDuration,
          duration ?? conditionData.duration,
        );
        existing.metadata = { ...existing.metadata, ...metadata };
        return existing;
      }
    }

    const activeCondition: ActiveCondition = {
      ...conditionData,
      appliedAt: Date.now(),
      remainingDuration: duration ?? conditionData.duration,
      appliedBy: source || "unknown",
      metadata: metadata || {},
    };

    if (!this.activeConditions.has(entityId)) {
      this.activeConditions.set(entityId, []);
    }

    this.activeConditions.get(entityId)!.push(activeCondition);
    return activeCondition;
  }

  /**
   * Remove condition from entity
   */
  removeCondition(entityId: string, conditionId: string): boolean {
    const conditions = this.activeConditions.get(entityId);
    if (!conditions) return false;

    const index = conditions.findIndex((c) => c.id === conditionId);
    if (index === -1) return false;

    conditions.splice(index, 1);
    return true;
  }

  /**
   * Get all active conditions for entity
   */
  getActiveConditions(entityId: string): ActiveCondition[] {
    return this.activeConditions.get(entityId) || [];
  }

  /**
   * Check if entity has specific condition
   */
  hasCondition(entityId: string, conditionId: string): boolean {
    const conditions = this.activeConditions.get(entityId);
    return conditions?.some((c) => c.id === conditionId) || false;
  }

  /**
   * Process turn-based condition updates
   */
  processTurnStart(entityId: string): ConditionEffect[] {
    const effects: ConditionEffect[] = [];
    const conditions = this.getActiveConditions(entityId);

    for (const condition of conditions) {
      // Process start-of-turn effects
      for (const effect of condition.effects) {
        if (effect.trigger === "start_turn") {
          effects.push(effect);
        }
      }

      // Reduce duration
      if (condition.remainingDuration > 0) {
        condition.remainingDuration--;
        if (condition.remainingDuration === 0) {
          this.removeCondition(entityId, condition.id);
        }
      }
    }

    return effects;
  }

  /**
   * Process end of turn condition updates
   */
  processTurnEnd(entityId: string): {
    effects: ConditionEffect[];
    saves: Array<{ condition: string; dc: number; ability: string }>;
  } {
    const effects: ConditionEffect[] = [];
    const saves: Array<{ condition: string; dc: number; ability: string }> = [];
    const conditions = this.getActiveConditions(entityId);

    for (const condition of conditions) {
      // Process end-of-turn effects
      for (const effect of condition.effects) {
        if (effect.trigger === "end_turn") {
          effects.push(effect);
        }
      }

      // Check for saves
      if (condition.saveAtEnd && condition.dc && condition.saveAbility) {
        saves.push({
          condition: condition.id,
          dc: condition.dc,
          ability: condition.saveAbility,
        });
      }
    }

    return { effects, saves };
  }

  /**
   * Apply condition effect results
   */
  applyConditionEffects(
    entityId: string,
    rollType: string,
  ): {
    advantage: boolean;
    disadvantage: boolean;
    modifiers: number[];
    prevented: boolean;
  } {
    const conditions = this.getActiveConditions(entityId);
    let advantage = false;
    let disadvantage = false;
    const modifiers: number[] = [];
    let prevented = false;

    for (const condition of conditions) {
      for (const effect of condition.effects) {
        if (this.effectApplies(effect, rollType)) {
          switch (effect.type) {
            case "advantage":
              advantage = true;
              break;
            case "disadvantage":
              disadvantage = true;
              break;
            case "ability_modifier":
            case "skill_modifier":
            case "save_modifier":
              if (effect.value !== undefined) {
                modifiers.push(effect.value);
              }
              break;
            case "prevent_action":
              prevented = true;
              break;
          }
        }
      }
    }

    return { advantage, disadvantage, modifiers, prevented };
  }

  /**
   * Get damage resistances/immunities/vulnerabilities
   */
  getDamageModifications(entityId: string): {
    resistances: string[];
    immunities: string[];
    vulnerabilities: string[];
  } {
    const conditions = this.getActiveConditions(entityId);
    const resistances: string[] = [];
    const immunities: string[] = [];
    const vulnerabilities: string[] = [];

    for (const condition of conditions) {
      for (const effect of condition.effects) {
        switch (effect.type) {
          case "resistance":
            resistances.push(effect.target);
            break;
          case "immunity":
            immunities.push(effect.target);
            break;
          case "vulnerability":
            vulnerabilities.push(effect.target);
            break;
        }
      }
    }

    return { resistances, immunities, vulnerabilities };
  }

  private effectApplies(effect: ConditionEffect, rollType: string): boolean {
    switch (effect.target) {
      case "all":
      case "attack_rolls":
      case "ability_checks":
      case "saving_throws":
        return rollType.includes(effect.target) || rollType === "all";
      default:
        return effect.target === rollType;
    }
  }

  /**
   * Clear all conditions from entity
   */
  clearAllConditions(entityId: string): void {
    this.activeConditions.delete(entityId);
  }

  /**
   * Create custom condition
   */
  createCustomCondition(
    id: string,
    name: string,
    description: string,
    effects: ConditionEffect[],
    duration = -1,
  ): Condition {
    return {
      id,
      name,
      description,
      duration,
      effects,
    };
  }
}

// Export singleton instance
export const conditionsEngine = new ConditionsEngine();

// Utility functions
export function applyCondition(
  _entityId: string,
  _conditionId: string,
  _duration?: number,
): ActiveCondition {
  return conditionsEngine.applyCondition(entityId, conditionId, duration);
}

export function removeCondition(_entityId: string, _conditionId: string): boolean {
  return conditionsEngine.removeCondition(entityId, conditionId);
}

export function hasCondition(_entityId: string, _conditionId: string): boolean {
  return conditionsEngine.hasCondition(entityId, conditionId);
}
