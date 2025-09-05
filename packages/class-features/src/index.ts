/**
 * D&D 5e Class Feature Automation System
 * Handles automatic execution of class abilities and features
 * Now supports modular class implementations for complete SRD parity
 */

import { DiceEngine, diceEngine } from "@vtt/dice-engine";
import { ConditionsEngine, conditionsEngine } from "@vtt/conditions-engine";
import { SpellEngine, spellEngine } from "@vtt/spell-engine";
import { classRegistry, ModularClassRegistry, SRD_CLASSES } from "./classes";

// Export new modular system
export { classRegistry, ModularClassRegistry, SRD_CLASSES };
export type { ClassMetadata } from "./classes";

export interface ClassFeature {
  id: string;
  name: string;
  className: string;
  level: number;
  description: string;
  type: "passive" | "active" | "reaction" | "triggered";
  uses?: {
    type: "per_short_rest" | "per_long_rest" | "per_day" | "charges";
    amount: number;
    current: number;
    resetOn: "short_rest" | "long_rest" | "dawn";
  };
  effects: FeatureEffect[];
  triggers?: FeatureTrigger[];
  actionCost?: "action" | "bonus_action" | "reaction" | "free";
  scaling?: {
    level: number;
    effect: string;
  }[];
}

export interface FeatureEffect {
  type:
    | "damage"
    | "healing"
    | "condition"
    | "modifier"
    | "advantage"
    | "extra_attack"
    | "spell_cast"
    | "resource_gain"
    | "custom";
  target: "self" | "enemy" | "ally" | "all_enemies" | "all_allies";
  value?: number;
  dice?: string;
  duration?: number;
  condition?: string;
  modifier?: {
    stat: string;
    amount: number;
    type: "bonus" | "set" | "advantage";
  };
  custom?: {
    handler: string;
    parameters: any;
  };
}

export interface FeatureTrigger {
  event:
    | "attack_hit"
    | "attack_miss"
    | "take_damage"
    | "kill_enemy"
    | "start_turn"
    | "end_turn"
    | "cast_spell"
    | "below_half_hp"
    | "custom";
  condition?: string; // additional condition to check
  once_per_turn?: boolean;
}

export interface FeatureActivationResult {
  success: boolean;
  effects: Array<{
    type: string;
    target: string;
    result: any;
  }>;
  resourcesUsed: Array<{
    feature: string;
    amount: number;
  }>;
  error?: string;
}

export class ClassFeaturesEngine {
  private dice: DiceEngine;
  private conditions: ConditionsEngine;
  private spells: SpellEngine;
  private activeFeatures = new Map<string, ClassFeature[]>(); // characterId -> features

  constructor() {
    this.dice = diceEngine;
    this.conditions = conditionsEngine;
    this.spells = spellEngine;
  }

  /**
   * Initialize character features
   */
  initializeCharacterFeatures(characterId: string, characterClass: string, level: number): void {
    const features = this.getClassFeatures(characterClass, level);
    this.activeFeatures.set(characterId, features);
  }

  /**
   * Activate a class feature
   */
  activateFeature(
    characterId: string,
    featureId: string,
    character: any,
    targets: string[] = [],
    context?: any,
  ): FeatureActivationResult {
    const features = this.activeFeatures.get(characterId) || [];
    const feature = features.find((f) => f.id === featureId);

    if (!feature) {
      return { success: false, error: "Feature not found", effects: [], resourcesUsed: [] };
    }

    // Check if feature has uses remaining
    if (feature.uses && feature.uses.current <= 0) {
      return { success: false, error: "No uses remaining", effects: [], resourcesUsed: [] };
    }

    // Check action economy
    if (feature.actionCost && !this.canUseAction(character, feature.actionCost)) {
      return { success: false, error: "Action not available", effects: [], resourcesUsed: [] };
    }

    const effects: any[] = [];
    const resourcesUsed: any[] = [];

    // Execute feature effects
    for (const effect of feature.effects) {
      const result = this.executeFeatureEffect(effect, character, targets, context);
      if (result) {
        effects.push(result);
      }
    }

    // Consume uses
    if (feature.uses) {
      feature.uses.current = Math.max(0, feature.uses.current - 1);
      resourcesUsed.push({
        feature: feature.name,
        amount: 1,
      });
    }

    // Consume action
    if (feature.actionCost) {
      this.consumeAction(character, feature.actionCost);
    }

    return { success: true, effects, resourcesUsed };
  }

  /**
   * Process triggered features (automatic activation)
   */
  processTriggers(
    characterId: string,
    event: string,
    character: any,
    context?: any,
  ): FeatureActivationResult[] {
    const features = this.activeFeatures.get(characterId) || [];
    const results: FeatureActivationResult[] = [];

    for (const feature of features) {
      if (feature.type === "triggered" && feature.triggers) {
        for (const trigger of feature.triggers) {
          if (trigger.event === event && this.checkTriggerCondition(trigger, character, context)) {
            const result = this.activateFeature(characterId, feature.id, character, [], context);
            if (result.success) {
              results.push(result);
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Rest recovery (short or long rest)
   */
  processRest(characterId: string, restType: "short" | "long"): void {
    const features = this.activeFeatures.get(characterId) || [];

    for (const feature of features) {
      if (feature.uses) {
        const shouldRecover =
          restType === "long" || (restType === "short" && feature.uses.resetOn === "short_rest");

        if (shouldRecover) {
          feature.uses.current = feature.uses.amount;
        }
      }
    }
  }

  private executeFeatureEffect(
    effect: FeatureEffect,
    character: any,
    targets: string[],
    context?: any,
  ): any {
    switch (effect.type) {
      case "damage":
        if (effect.dice) {
          const damage = this.dice.rollDamage(effect.dice, "force"); // Default damage type
          return {
            type: "damage",
            target: targets[0] || "enemy",
            result: damage,
          };
        }
        break;

      case "healing":
        if (effect.dice) {
          const healing = this.dice.roll(effect.dice);
          return {
            type: "healing",
            target: targets[0] || "self",
            result: { amount: healing.total },
          };
        }
        break;

      case "condition":
        if (effect.condition && targets.length > 0 && targets[0]) {
          this.conditions.applyCondition(targets[0], effect.condition, effect.duration);
          return {
            type: "condition",
            target: targets[0],
            result: { condition: effect.condition },
          };
        }
        break;

      case "modifier":
        if (effect.modifier) {
          return {
            type: "modifier",
            target: effect.target === "self" ? character.id : targets[0],
            result: effect.modifier,
          };
        }
        break;

      case "advantage":
        return {
          type: "advantage",
          target: effect.target === "self" ? character.id : targets[0],
          result: { type: "advantage", duration: effect.duration || 1 },
        };

      case "extra_attack":
        return {
          type: "extra_attack",
          target: character.id,
          result: { attacks: effect.value || 1 },
        };

      case "resource_gain":
        return {
          type: "resource_gain",
          target: character.id,
          result: { amount: effect.value || 1 },
        };

      case "custom":
        if (effect.custom) {
          return this.handleCustomEffect(effect.custom, character, targets, context);
        }
        break;
    }

    return null;
  }

  private canUseAction(character: any, actionType: string): boolean {
    // Check if character has the required action available
    switch (actionType) {
      case "action":
        return character.actionEconomy?.action !== false;
      case "bonus_action":
        return character.actionEconomy?.bonusAction !== false;
      case "reaction":
        return character.actionEconomy?.reaction !== false;
      case "free":
        return true;
      default:
        return false;
    }
  }

  private consumeAction(character: any, actionType: string): void {
    if (!character.actionEconomy) {
      character.actionEconomy = { action: true, bonusAction: true, reaction: true };
    }

    switch (actionType) {
      case "action":
        character.actionEconomy.action = false;
        break;
      case "bonus_action":
        character.actionEconomy.bonusAction = false;
        break;
      case "reaction":
        character.actionEconomy.reaction = false;
        break;
    }
  }

  private checkTriggerCondition(trigger: FeatureTrigger, character: any, context?: any): boolean {
    if (trigger.condition) {
      // Check additional conditions (e.g., "below_half_hp")
      switch (trigger.condition) {
        case "below_half_hp":
          return character.hitPoints.current < character.hitPoints.max / 2;
        case "bloodied":
          return character.hitPoints.current <= character.hitPoints.max / 2;
        default:
          return true;
      }
    }
    return true;
  }

  private handleCustomEffect(custom: any, character: any, targets: string[], context?: any): any {
    // Handle custom feature effects
    switch (custom.handler) {
      case "barbarian_rage":
        return this.handleBarbarianRage(character, custom.parameters);
      case "rogue_sneak_attack":
        if (targets[0]) {
          return this.handleSneakAttack(character, targets[0], custom.parameters);
        }
        break;
      case "fighter_action_surge":
        return this.handleActionSurge(character);
      default:
        return {
          type: "custom",
          target: character.id,
          result: { handler: custom.handler },
        };
    }
  }

  private handleBarbarianRage(character: any, _parameters: any): any {
    // Apply rage effects
    this.conditions.applyCondition(character.id, "rage", 10);
    return {
      type: "rage",
      target: character.id,
      result: {
        active: true,
        damage_bonus: 2,
        resistance: ["bludgeoning", "piercing", "slashing"],
      },
    };
  }

  private handleSneakAttack(character: any, target: string, _parameters: any): any {
    const level = character.level;
    const sneakDice = Math.ceil(level / 2);
    const damage = this.dice.rollDamage(`${sneakDice}d6`, "piercing");

    return {
      type: "sneak_attack",
      target,
      result: damage,
    };
  }

  private handleActionSurge(character: any): any {
    // Restore action for this turn
    if (character.actionEconomy) {
      character.actionEconomy.action = true;
    }

    return {
      type: "action_surge",
      target: character.id,
      result: { extra_action: true },
    };
  }

  private getClassFeatures(className: string, level: number): ClassFeature[] {
    const features: ClassFeature[] = [];

    // Legacy implementations moved to modular classes - return empty for now
    // TODO: Remove this method entirely and migrate to ModularClassRegistry

    return features.filter((f) => f.level <= level);
  }



  /**
   * Get character's available features
   */
  getAvailableFeatures(characterId: string): ClassFeature[] {
    return this.activeFeatures.get(characterId) || [];
  }

  /**
   * Reset action economy (start of turn)
   */
  resetActionEconomy(character: any): void {
    character.actionEconomy = {
      action: true,
      bonusAction: true,
      reaction: true,
      movement: character.speed || 30,
    };
  }
}

// Export singleton instance
export const _classFeaturesEngine = new ClassFeaturesEngine();
