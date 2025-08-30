/**
 * D&D 5e Monster Abilities and Traits Automation System
 * Handles monster traits, legendary actions, lair actions, and special abilities
 */

import { DiceEngine, diceEngine } from "@vtt/dice-engine";
import { ConditionsEngine, conditionsEngine } from "@vtt/conditions-engine";
import { SpellEngine, spellEngine } from "@vtt/spell-engine";

export interface MonsterTrait {
  id: string;
  name: string;
  description: string;
  type: "trait" | "action" | "legendary_action" | "lair_action" | "reaction";
  mechanicalEffect?: TraitEffect;
  triggers?: TraitTrigger[];
  cost?: {
    type: "legendary_action" | "lair_action" | "reaction" | "recharge";
    amount?: number; // legendary action cost
    recharge?: string; // "5-6", "6", etc.
  };
  range?: string;
  area?: {
    type: "sphere" | "cube" | "cone" | "line";
    size: number;
  };
  save?: {
    ability: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
    dc: number;
    onSuccess: "half" | "none" | "negates";
  };
}

export interface TraitEffect {
  type:
    | "damage"
    | "healing"
    | "condition"
    | "teleport"
    | "summon"
    | "regeneration"
    | "resistance"
    | "immunity"
    | "vulnerability"
    | "spell_cast"
    | "multiattack"
    | "grapple"
    | "shove"
    | "frightening_presence";
  damage?: {
    dice: string;
    type: string;
    conditions?: string[]; // damage only applies if conditions met
  };
  healing?: {
    dice: string;
    target: "self" | "allies" | "specific";
  };
  condition?: {
    id: string;
    duration: number;
    savingThrow?: {
      ability: string;
      dc: number;
      endOfTurn: boolean;
    };
  };
  teleport?: {
    distance: number;
    requiresLineOfSight: boolean;
  };
  summon?: {
    creature: string;
    count: number;
    duration: number;
    hitPoints?: number;
  };
  regeneration?: {
    amount: number;
    conditions?: string[]; // conditions that prevent regeneration
  };
  damageType?: string;
  multiattack?: {
    attacks: Array<{
      name: string;
      count: number;
      type: "melee" | "ranged" | "spell";
    }>;
  };
  frightening?: {
    range: number;
    dc: number;
    duration: number;
  };
}

export interface TraitTrigger {
  event:
    | "start_turn"
    | "end_turn"
    | "take_damage"
    | "below_half_hp"
    | "first_bloodied"
    | "death"
    | "kill_creature"
    | "initiative_20"
    | "enter_lair"
    | "custom";
  condition?: string;
  once_per_combat?: boolean;
  once_per_round?: boolean;
}

export interface LegendaryActions {
  actionsPerTurn: number;
  currentActions: number;
  actions: MonsterTrait[];
}

export interface LairActions {
  initiative: number; // Usually 20
  actions: MonsterTrait[];
  currentRound: number;
}

export interface MonsterAbilityResult {
  success: boolean;
  effects: Array<{
    type: string;
    targets: string[];
    result: any;
  }>;
  actionsUsed: number;
  rechargeRoll?: {
    needed: number;
    rolled: number;
    recharged: boolean;
  };
  error?: string;
}

export class MonsterAbilitiesEngine {
  private dice: DiceEngine;
  private conditions: ConditionsEngine;
  private spells: SpellEngine;
  private monsterTraits = new Map<string, MonsterTrait[]>(); // monsterId -> traits
  private legendaryActions = new Map<string, LegendaryActions>(); // monsterId -> legendary actions
  private lairActions = new Map<string, LairActions>(); // encounterId -> lair actions
  private rechargeableAbilities = new Map<string, Map<string, boolean>>(); // monsterId -> abilityId -> available

  constructor() {
    this.dice = diceEngine;
    this.conditions = conditionsEngine;
    this.spells = spellEngine;
  }

  /**
   * Initialize monster with its traits and abilities
   */
  initializeMonster(
    monsterId: string,
    traits: MonsterTrait[],
    legendaryActionsPerTurn?: number,
    lairActions?: MonsterTrait[],
  ): void {
    this.monsterTraits.set(monsterId, traits);

    // Setup legendary actions
    const legendaryTraits = traits.filter((t) => t.type === "legendary_action");
    if (legendaryTraits.length > 0 && legendaryActionsPerTurn) {
      this.legendaryActions.set(monsterId, {
        actionsPerTurn: legendaryActionsPerTurn,
        currentActions: legendaryActionsPerTurn,
        actions: legendaryTraits,
      });
    }

    // Setup lair actions
    if (lairActions && lairActions.length > 0) {
      this.lairActions.set(`lair_${monsterId}`, {
        initiative: 20,
        actions: lairActions,
        currentRound: 0,
      });
    }

    // Setup rechargeable abilities
    const rechargeableTraits = traits.filter((t) => t.cost?.recharge);
    if (rechargeableTraits.length > 0) {
      const rechargeMap = new Map<string, boolean>();
      rechargeableTraits.forEach((trait) => {
        rechargeMap.set(trait.id, true); // Initially available
      });
      this.rechargeableAbilities.set(monsterId, rechargeMap);
    }
  }

  /**
   * Execute a monster trait or ability
   */
  executeMonsterAbility(
    monsterId: string,
    abilityId: string,
    monster: any,
    targets: string[] = [],
    context?: any,
  ): MonsterAbilityResult {
    const traits = this.monsterTraits.get(monsterId) || [];
    const trait = traits.find((t) => t.id === abilityId);

    if (!trait) {
      return { success: false, error: "Ability not found", effects: [], actionsUsed: 0 };
    }

    // Check if rechargeable ability is available
    if (trait.cost?.recharge) {
      const rechargeMap = this.rechargeableAbilities.get(monsterId);
      if (!rechargeMap?.get(abilityId)) {
        return { success: false, error: "Ability not recharged", effects: [], actionsUsed: 0 };
      }
      // Mark as used
      rechargeMap.set(abilityId, false);
    }

    // Check legendary action cost
    let actionsUsed = 0;
    if (trait.type === "legendary_action") {
      const legendary = this.legendaryActions.get(monsterId);
      const cost = trait.cost?.amount || 1;

      if (!legendary || legendary.currentActions < cost) {
        return {
          success: false,
          error: "Insufficient legendary actions",
          effects: [],
          actionsUsed: 0,
        };
      }

      legendary.currentActions -= cost;
      actionsUsed = cost;
    }

    const effects: any[] = [];

    // Execute trait effect
    if (trait.mechanicalEffect) {
      const effectResults = this.executeTraitEffect(
        trait.mechanicalEffect,
        monster,
        targets,
        trait,
        context,
      );
      effects.push(...effectResults);
    }

    return { success: true, effects, actionsUsed };
  }

  /**
   * Process automatic trait triggers
   */
  processTriggers(
    monsterId: string,
    event: string,
    monster: any,
    context?: any,
  ): MonsterAbilityResult[] {
    const traits = this.monsterTraits.get(monsterId) || [];
    const results: MonsterAbilityResult[] = [];

    for (const trait of traits) {
      if (trait.triggers) {
        for (const trigger of trait.triggers) {
          if (trigger.event === event && this.checkTriggerCondition(trigger, monster, context)) {
            const result = this.executeMonsterAbility(monsterId, trait.id, monster, [], context);
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
   * Execute legendary actions (end of other creatures' turns)
   */
  processLegendaryActions(monsterId: string, _monster: any): MonsterAbilityResult[] {
    const legendary = this.legendaryActions.get(monsterId);
    if (!legendary || legendary.currentActions <= 0) {
      return [];
    }

    // AI would choose which legendary actions to use
    // For now, return available actions for manual selection
    const availableActions = legendary.actions.filter((action) => {
      const cost = action.cost?.amount || 1;
      return legendary.currentActions >= cost;
    });

    return [
      {
        success: true,
        effects: [
          {
            type: "legendary_actions_available",
            targets: [monsterId],
            result: {
              actionsRemaining: legendary.currentActions,
              availableActions: availableActions.map((a) => ({
                id: a.id,
                name: a.name,
                cost: a.cost?.amount || 1,
              })),
            },
          },
        ],
        actionsUsed: 0,
      },
    ];
  }

  /**
   * Execute lair actions (initiative 20)
   */
  processLairActions(encounterId: string, context?: any): MonsterAbilityResult {
    const lair = this.lairActions.get(`lair_${encounterId}`);
    if (!lair) {
      return { success: false, error: "No lair actions", effects: [], actionsUsed: 0 };
    }

    lair.currentRound++;

    // Choose a random lair action
    const availableActions = lair.actions.filter(
      (action) => !action.cost?.recharge || this.rollRecharge(action.cost.recharge),
    );

    if (availableActions.length === 0) {
      return { success: false, error: "No available lair actions", effects: [], actionsUsed: 0 };
    }

    const selectedAction = availableActions[Math.floor(Math.random() * availableActions.length)];
    const effects: any[] = [];

    if (selectedAction && selectedAction.mechanicalEffect) {
      const effectResults = this.executeTraitEffect(
        selectedAction.mechanicalEffect,
        { id: "lair" },
        [],
        selectedAction,
        context,
      );
      effects.push(...effectResults);
    }

    return { success: true, effects, actionsUsed: 0 };
  }

  /**
   * Reset legendary actions (start of monster's turn)
   */
  resetLegendaryActions(monsterId: string): void {
    const legendary = this.legendaryActions.get(monsterId);
    if (legendary) {
      legendary.currentActions = legendary.actionsPerTurn;
    }
  }

  /**
   * Roll for recharge abilities (start of turn)
   */
  rollRechargeAbilities(monsterId: string): Array<{ ability: string; recharged: boolean }> {
    const traits = this.monsterTraits.get(monsterId) || [];
    const rechargeMap = this.rechargeableAbilities.get(monsterId);
    const results: Array<{ ability: string; recharged: boolean }> = [];

    if (!rechargeMap) return results;

    for (const trait of traits) {
      if (trait.cost?.recharge && !rechargeMap.get(trait.id)) {
        const recharged = this.rollRecharge(trait.cost.recharge);
        if (recharged) {
          rechargeMap.set(trait.id, true);
        }
        results.push({ ability: trait.name, recharged });
      }
    }

    return results;
  }

  private executeTraitEffect(
    effect: TraitEffect,
    monster: any,
    targets: string[],
    trait: MonsterTrait,
    context?: any,
  ): any[] {
    const results: any[] = [];

    switch (effect.type) {
      case "damage":
        if (effect.damage) {
          for (const target of targets) {
            const damage = this.dice.rollDamage(effect.damage.dice, effect.damage.type);

            // Handle saving throws
            if (trait.save) {
              const saveResult = this.rollMonsterSave(target, trait.save);
              if (saveResult.success) {
                switch (trait.save.onSuccess) {
                  case "half":
                    damage.total = Math.floor(damage.total / 2);
                    break;
                  case "none":
                    damage.total = 0;
                    break;
                  case "negates":
                    continue;
                }
              }
            }

            results.push({
              type: "damage",
              targets: [target],
              result: damage,
            });
          }
        }
        break;

      case "condition":
        if (effect.condition) {
          for (const target of targets) {
            let applyCondition = true;

            // Handle saving throws
            if (effect.condition.savingThrow) {
              const saveResult = this.rollMonsterSave(target, {
                ability: effect.condition.savingThrow.ability,
                dc: effect.condition.savingThrow.dc,
                onSuccess: "negates",
              });
              if (saveResult.success) {
                applyCondition = false;
              }
            }

            if (applyCondition) {
              this.conditions.applyCondition(
                target,
                effect.condition.id,
                effect.condition.duration,
              );
              results.push({
                type: "condition",
                targets: [target],
                result: { condition: effect.condition.id },
              });
            }
          }
        }
        break;

      case "multiattack":
        if (effect.multiattack) {
          results.push({
            type: "multiattack",
            targets: [monster.id],
            result: effect.multiattack,
          });
        }
        break;

      case "regeneration":
        if (effect.regeneration) {
          const canRegenerate = !effect.regeneration.conditions?.some((condition) =>
            this.conditions.hasCondition(monster.id, condition),
          );

          if (canRegenerate) {
            results.push({
              type: "regeneration",
              targets: [monster.id],
              result: { amount: effect.regeneration.amount },
            });
          }
        }
        break;

      case "teleport":
        if (effect.teleport) {
          results.push({
            type: "teleport",
            targets: [monster.id],
            result: effect.teleport,
          });
        }
        break;

      case "summon":
        if (effect.summon) {
          results.push({
            type: "summon",
            targets: ["battlefield"],
            result: effect.summon,
          });
        }
        break;

      case "frightening_presence":
        if (effect.frightening) {
          results.push({
            type: "frightening_presence",
            targets: ["all_enemies_in_range"],
            result: {
              range: effect.frightening.range,
              dc: effect.frightening.dc,
              condition: "frightened",
              duration: effect.frightening.duration,
            },
          });
        }
        break;

      case "spell_cast":
        // Cast a spell using the spell engine
        results.push({
          type: "spell_cast",
          targets: targets,
          result: { spellId: context?.spellId || "unknown" },
        });
        break;
    }

    return results;
  }

  private checkTriggerCondition(trigger: TraitTrigger, monster: any, context?: any): boolean {
    if (trigger.condition) {
      switch (trigger.condition) {
        case "below_half_hp":
          return monster.hitPoints.current < monster.hitPoints.max / 2;
        case "first_bloodied":
          return monster.hitPoints.current <= monster.hitPoints.max / 2 && !monster.hasBeenBloodied;
        case "death":
          return monster.hitPoints.current <= 0;
        default:
          return true;
      }
    }
    return true;
  }

  private rollMonsterSave(targetId: string, save: any): { success: boolean; roll: any } {
    // This would integrate with character system to get target's save bonus
    const saveBonus = 0; // Placeholder
    const roll = this.dice.rollSavingThrow(saveBonus, save.dc);
    return roll;
  }

  private rollRecharge(rechargeRequirement: string): boolean {
    const roll = this.dice.roll("1d6");

    if (rechargeRequirement === "6") {
      return roll.total >= 6;
    } else if (rechargeRequirement === "5-6") {
      return roll.total >= 5;
    } else if (rechargeRequirement === "4-6") {
      return roll.total >= 4;
    }

    return false;
  }

  /**
   * Get available abilities for a monster
   */
  getAvailableAbilities(monsterId: string): {
    traits: MonsterTrait[];
    legendary: MonsterTrait[];
    legendaryActionsRemaining: number;
    rechargeableStatus: Record<string, boolean>;
  } {
    const traits = this.monsterTraits.get(monsterId) || [];
    const legendary = this.legendaryActions.get(monsterId);
    const rechargeMap = this.rechargeableAbilities.get(monsterId);

    return {
      traits: traits.filter((t) => t.type !== "legendary_action"),
      legendary: legendary?.actions || [],
      legendaryActionsRemaining: legendary?.currentActions || 0,
      rechargeableStatus: rechargeMap
        ? Object.fromEntries(rechargeMap)
        : ({} as Record<string, any>),
    };
  }

  /**
   * Get trait by ID
   */
  getTrait(monsterId: string, traitId: string): MonsterTrait | undefined {
    const traits = this.monsterTraits.get(monsterId) || [];
    return traits.find((t) => t.id === traitId);
  }
}

// Common monster traits
export const COMMON_MONSTER_TRAITS: Record<string, MonsterTrait> = {
  pack_tactics: {
    id: "pack_tactics",
    name: "Pack Tactics",
    description:
      "Has advantage on attack rolls against a creature if at least one ally is within 5 feet of the target",
    type: "trait",
    mechanicalEffect: {
      type: "damage",
      damage: { dice: "0", type: "none" }, // Mechanical effect handled in combat system
    },
  },

  keen_senses: {
    id: "keen_senses",
    name: "Keen Senses",
    description: "Has advantage on Wisdom (Perception) checks",
    type: "trait",
  },

  fire_breath: {
    id: "fire_breath",
    name: "Fire Breath",
    description: "Exhales fire in a 15-foot cone",
    type: "action",
    cost: {
      type: "recharge",
      recharge: "5-6",
    },
    area: {
      type: "cone",
      size: 15,
    },
    save: {
      ability: "DEX",
      dc: 13,
      onSuccess: "half",
    },
    mechanicalEffect: {
      type: "damage",
      damage: {
        dice: "2d6",
        type: "fire",
      },
    },
  },

  multiattack_2: {
    id: "multiattack_2",
    name: "Multiattack",
    description: "Makes two attacks",
    type: "action",
    mechanicalEffect: {
      type: "multiattack",
      multiattack: {
        attacks: [{ name: "claw", count: 2, type: "melee" }],
      },
    },
  },

  legendary_claw: {
    id: "legendary_claw",
    name: "Claw",
    description: "Makes one claw attack",
    type: "legendary_action",
    cost: {
      type: "legendary_action",
      amount: 1,
    },
    mechanicalEffect: {
      type: "damage",
      damage: {
        dice: "1d6+3",
        type: "slashing",
      },
    },
  },

  frightful_presence: {
    id: "frightful_presence",
    name: "Frightful Presence",
    description:
      "Each creature within 120 feet must make a Wisdom saving throw or be frightened for 1 minute",
    type: "action",
    mechanicalEffect: {
      type: "frightening_presence",
      frightening: {
        range: 120,
        dc: 16,
        duration: 10, // rounds
      },
    },
  },
};

// Export singleton instance
export const _monsterAbilitiesEngine = new MonsterAbilitiesEngine();
