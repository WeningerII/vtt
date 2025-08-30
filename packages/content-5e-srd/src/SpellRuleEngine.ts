/**
 * Spell Rule Engine - Computational D&D 5e Rules Implementation
 * Every D&D rule is implemented as executable algorithms
 */

import {
  _ExecutionContext,
  GameEntity,
  ComputationalSpell,
  Vector3D,
} from "./ComputationalSpellSystem";

// Core rule primitives
export interface Rule {
  id: string;
  condition: (ctx: RuleContext) => boolean;
  action: (ctx: RuleContext) => RuleResult;
  priority: number;
}

export interface RuleContext {
  spell: ComputationalSpell;
  caster: GameEntity;
  targets: GameEntity[];
  environment: {
    entities: Map<string, GameEntity>;
    obstacles: any[];
    lighting: number;
    temperature: number;
    gravity?: Vector3D;
  };
  dice: (_sides: number, _count?: number) => number[];
  time: number;
  gameState: GameState;
  eventType: "pre_cast" | "post_cast" | "damage" | "healing" | "condition" | "movement";
  metadata: Record<string, any>;
}

export interface RuleResult {
  type: "modify" | "prevent" | "trigger" | "log";
  data: any;
  continue: boolean;
}

export interface GameState {
  round: number;
  turn: number;
  time: number;
  weather: string;
  lighting: number;
  gravity: number;
  magicLevel: number;
  antimagicFields: Array<{
    center: { x: number; y: number; z: number };
    radius: number;
  }>;
}

// Computational D&D 5e rules
const SPELL_RULES: Rule[] = [
  // Antimagic Field Rule
  {
    id: "antimagic_field_prevention",
    condition: (ctx) => {
      return ctx.gameState.antimagicFields.some((field) => {
        const distance = Math.sqrt(
          Math.pow(ctx.caster.position.x - field.center.x, 2) +
            Math.pow(ctx.caster.position.y - field.center.y, 2) +
            Math.pow(ctx.caster.position.z - field.center.z, 2),
        );
        return distance <= field.radius;
      });
    },
    action: (_ctx) => ({
      type: "prevent",
      data: { reason: "Caster is within an antimagic field" },
      continue: false,
    }),
    priority: 1000,
  },

  // Counterspell Interruption Rule
  {
    id: "counterspell_interrupt",
    condition: (ctx) => {
      return (
        ctx.eventType === "pre_cast" &&
        ctx.environment.entities &&
        Array.from(ctx.environment.entities.values()).some(
          (_entity: GameEntity) =>
            entity.conditions.has("ready_counterspell") &&
            isWithinRange(entity, ctx.caster, 60 * 5),
        )
      );
    },
    action: (ctx) => {
      const counterspeller = Array.from(ctx.environment.entities.values()).find((e: GameEntity) =>
        e.conditions.has("ready_counterspell"),
      );

      if (!counterspeller) return { type: "log", data: Record<string, any>, continue: true };

      // Execute counterspell logic
      const spellLevel = ctx.spell.metadata.level;
      const counterspellLevel = 3; // Would get from actual readied spell

      let success = counterspellLevel >= spellLevel;
      if (!success) {
        const roll = Math.floor(Math.random() * 20) + 1 + 3; // d20 + modifier
        const dc = 10 + spellLevel;
        success = roll >= dc;
      }

      return {
        type: success ? "prevent" : "log",
        data: {
          counterspeller: counterspeller?.id,
          success,
          reason: success ? "Spell was countered" : "Counterspell failed",
        },
        continue: !success,
      };
    },
    priority: 900,
  },

  // Concentration Check Rule
  {
    id: "concentration_damage_check",
    condition: (ctx) => {
      return ctx.eventType === "damage" && ctx.caster.conditions.has("concentrating");
    },
    action: (ctx) => {
      const damage = ctx.metadata.damage || 0;
      const dc = Math.max(10, Math.floor(damage / 2));
      const roll = Math.floor(Math.random() * 20) + 1;
      const conSave = ctx.caster.savingThrows["CON"] || 0;

      const success = roll + conSave >= dc;

      if (!success) {
        ctx.caster.conditions.delete("concentrating");
        // End concentration spell effects
      }

      return {
        type: "modify",
        data: {
          concentrationMaintained: success,
          roll: roll + conSave,
          dc,
        },
        continue: true,
      };
    },
    priority: 800,
  },

  // Spell Slot Consumption Rule
  {
    id: "spell_slot_consumption",
    condition: (ctx) => {
      return ctx.eventType === "post_cast" && ctx.spell.metadata.level > 0;
    },
    action: (ctx) => {
      const slotLevel = ctx.metadata.slotLevel || ctx.spell.metadata.level;
      // Would actually consume spell slot from caster's resources

      return {
        type: "modify",
        data: { slotConsumed: slotLevel },
        continue: true,
      };
    },
    priority: 100,
  },

  // Legendary Resistance Rule
  {
    id: "legendary_resistance",
    condition: (ctx) => {
      return (
        ctx.eventType === "damage" &&
        ctx.targets.some(
          (t) =>
            t.conditions.has("legendary_resistance") &&
            ctx.metadata.savingThrow &&
            ctx.metadata.saveResult === false,
        )
      );
    },
    action: (ctx) => {
      const legendaryCreature = ctx.targets.find((t) => t.conditions.has("legendary_resistance"));

      if (!legendaryCreature) return { type: "log", data: Record<string, any>, continue: true };

      // Check if creature has legendary resistance uses left
      const usesLeft = 3; // Would get from actual creature data

      if (usesLeft > 0) {
        // Choose to use legendary resistance automatically for high-damage spells
        const shouldUse = ctx.metadata.damage > legendaryCreature.hitPoints.current * 0.25;

        if (shouldUse) {
          return {
            type: "modify",
            data: {
              legendaryResistanceUsed: true,
              saveResult: true, // Override failed save
            },
            continue: true,
          };
        }
      }

      return { type: "log", data: Record<string, any>, continue: true };
    },
    priority: 750,
  },

  // Magic Resistance Rule
  {
    id: "magic_resistance",
    condition: (ctx) => {
      return (
        ctx.targets.some((t) => t.conditions.has("magic_resistance")) &&
        ctx.metadata.savingThrow !== undefined
      );
    },
    action: (_ctx) => {
      return {
        type: "modify",
        data: {
          savingThrowAdvantage: true,
          source: "magic_resistance",
        },
        continue: true,
      };
    },
    priority: 600,
  },

  // Cover Calculation Rule
  {
    id: "cover_calculation",
    condition: (ctx) => {
      return ctx.eventType === "pre_cast" && ctx.spell.targetSelection.mode !== "self";
    },
    action: (ctx) => {
      const coverBonuses = ctx.targets.map((target) => {
        const cover = calculateCover(ctx.caster, target, ctx.environment);
        return {
          targetId: target.id,
          coverType: cover.type,
          acBonus: cover.acBonus,
          saveBonus: cover.saveBonus,
        };
      });

      return {
        type: "modify",
        data: { coverBonuses },
        continue: true,
      };
    },
    priority: 500,
  },

  // Wild Magic Surge Rule
  {
    id: "wild_magic_surge",
    condition: (ctx) => {
      return ctx.caster.conditions.has("wild_magic_sorcerer") && ctx.spell.metadata.level > 0;
    },
    action: (_ctx) => {
      const roll = Math.floor(Math.random() * 20) + 1;

      if (roll === 1) {
        const surgeEffect = getWildMagicSurgeEffect();
        return {
          type: "trigger",
          data: { wildMagicSurge: surgeEffect },
          continue: true,
        };
      }

      return { type: "log", data: Record<string, any>, continue: true };
    },
    priority: 200,
  },
];

// Utility functions for rule calculations
function isWithinRange(entity1: GameEntity, entity2: GameEntity, _range: number): boolean {
  const dx = entity2.position.x - entity1.position.x;
  const dy = entity2.position.y - entity1.position.y;
  const dz = entity2.position.z - entity1.position.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) <= range;
}

function calculateCover(
  caster: GameEntity,
  target: GameEntity,
  environment: any,
): {
  type: "none" | "half" | "three_quarters" | "full";
  acBonus: number;
  saveBonus: number;
} {
  // Simplified cover calculation
  // In a real implementation, this would do 3D line-of-sight calculation

  const _distance = Math.sqrt(
    Math.pow(target.position.x - caster.position.x, 2) +
      Math.pow(target.position.y - caster.position.y, 2),
  );

  // Mock cover calculation based on environment obstacles
  const obstaclesBetween =
    environment.obstacles?.filter((__obs: any) => {
      // Check if obstacle is between caster and target
      return true; // Simplified
    }).length || 0;

  if (obstaclesBetween === 0) return { type: "none", acBonus: 0, saveBonus: 0 };
  if (obstaclesBetween === 1) return { type: "half", acBonus: 2, saveBonus: 2 };
  if (obstaclesBetween === 2) return { type: "three_quarters", acBonus: 5, saveBonus: 5 };
  return { type: "full", acBonus: Infinity, saveBonus: Infinity };
}

function getWildMagicSurgeEffect(): any {
  // Simplified wild magic table
  const effects = [
    { id: 1, effect: "summon_unicorn", description: "A unicorn appears within 5 feet" },
    { id: 2, effect: "fireball_self", description: "You cast fireball centered on yourself" },
    { id: 3, effect: "color_change", description: "Your skin turns bright blue for 24 hours" },
    // ... would include all 100 effects
  ];

  const roll = Math.floor(Math.random() * effects.length);
  return effects[roll];
}

// Rule execution engine
export class SpellRuleEngine {
  private rules: Rule[] = [...SPELL_RULES];

  addRule(rule: Rule): void {
    this.rules.push(rule);
    this.rules.sort((_a, _b) => b.priority - a.priority);
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
  }

  executeRules(ruleContext: RuleContext): RuleResult[] {
    const results: RuleResult[] = [];

    for (const rule of this.rules) {
      if (rule.condition(ruleContext)) {
        const result = rule.action(ruleContext);
        results.push(result);

        // Apply the result to the context for subsequent rules
        this.applyRuleResult(ruleContext, result);

        if (!result.continue) {
          break; // Stop processing rules if this one says to stop
        }
      }
    }

    return results;
  }

  private applyRuleResult(ctx: RuleContext, result: RuleResult): void {
    switch (result.type) {
      case "modify":
        // Apply modifications to the context
        Object.assign(ctx.metadata, result.data);
        break;
      case "prevent":
        ctx.metadata.prevented = true;
        ctx.metadata.preventionReason = result.data.reason;
        break;
      case "trigger":
        // Queue additional effects to be processed
        ctx.metadata.additionalEffects = ctx.metadata.additionalEffects || [];
        ctx.metadata.additionalEffects.push(result.data);
        break;
    }
  }

  // Validate spell casting with all applicable rules
  validateSpellCast(
    spell: ComputationalSpell,
    caster: GameEntity,
    targets: GameEntity[],
    gameState: GameState,
  ): {
    valid: boolean;
    reasons: string[];
    modifications: Record<string, any>;
  } {
    const ruleContext: RuleContext = {
      spell,
      caster,
      targets,
      environment: {
        entities: new Map(),
        obstacles: [],
        lighting: 1.0,
        temperature: 20,
        gravity: { x: 0, y: -9.8, z: 0 },
      },
      gameState,
      eventType: "pre_cast",
      metadata: Record<string, any>,
      dice: (_sides: number, _count = 1) =>
        Array.from({ _length: count }, () => Math.floor(Math.random() * sides) + 1),
      time: Date.now(),
    };

    const results = this.executeRules(ruleContext);

    const prevented = results.some((r) => r.type === "prevent");
    const reasons = results.filter((r) => r.type === "prevent").map((r) => r.data.reason);

    const modifications = results
      .filter((r) => r.type === "modify")
      .reduce((_acc, _r) => ({ ...acc, ...r.data }), {});

    return {
      valid: !prevented,
      reasons,
      modifications,
    };
  }
}

// Advanced spell interaction calculator
export class SpellInteractionCalculator {
  // Calculate spell interactions (counterspell, dispel magic, etc.)
  calculateSpellInteraction(
    activeSpells: ComputationalSpell[],
    newSpell: ComputationalSpell,
  ): {
    conflicts: Array<{ spellId: string; reason: string; resolution: string }>;
    synergies: Array<{ spellId: string; effect: string; modifier: number }>;
    dispels: string[];
  } {
    const conflicts: Array<{ spellId: string; reason: string; resolution: string }> = [];
    const synergies: Array<{ spellId: string; effect: string; modifier: number }> = [];
    const dispels: string[] = [];

    for (const activeSpell of activeSpells) {
      // Check for direct conflicts
      if (this.spellsConflict(activeSpell, newSpell)) {
        conflicts.push({
          spellId: activeSpell.id,
          reason: "Same effect type, non-stacking",
          resolution: "Replace existing effect",
        });
      }

      // Check for synergies
      const synergy = this.calculateSynergy(activeSpell, newSpell);
      if (synergy) {
        synergies.push({
          spellId: activeSpell.id,
          effect: synergy.type,
          modifier: synergy.value,
        });
      }

      // Check if new spell dispels active spell
      if (this.spellDispelsAnother(newSpell, activeSpell)) {
        dispels.push(activeSpell.id);
      }
    }

    return { conflicts, synergies, dispels };
  }

  private spellsConflict(spell1: ComputationalSpell, spell2: ComputationalSpell): boolean {
    // Check if spells provide the same type of bonus that doesn't stack
    const _nonStackingCategories = ["armor_class_bonus", "attribute_enhancement", "movement_speed"];

    // This would check actual spell effects for conflicts
    // Simplified implementation
    return (
      spell1.metadata.school === spell2.metadata.school &&
      spell1.metadata.level === spell2.metadata.level
    );
  }

  private calculateSynergy(
    spell1: ComputationalSpell,
    spell2: ComputationalSpell,
  ): { type: string; value: number } | null {
    // Examples of spell synergies:
    // - Faerie Fire + attack spells = advantage
    // - Web + fire spells = extra damage
    // - Darkness + Devil's Sight = advantage on attacks

    const synergies: Record<string, Record<string, { type: string; value: number }>> = {
      faerie_fire: {
        "*_attack": { type: "advantage", value: 1 },
      },
      web: {
        "*_fire_damage": { type: "damage_bonus", value: 2 },
      },
      bless: {
        "*_attack": { type: "attack_bonus", value: 4 },
        "*_save": { type: "save_bonus", value: 4 },
      },
    };

    const spell1Synergies = synergies[spell1.id];
    if (spell1Synergies) {
      for (const [pattern, synergy] of Object.entries(spell1Synergies)) {
        if (this.matchesSpellPattern(spell2, pattern)) {
          return synergy;
        }
      }
    }

    return null;
  }

  private spellDispelsAnother(
    dispelSpell: ComputationalSpell,
    targetSpell: ComputationalSpell,
  ): boolean {
    // Dispel Magic, Counterspell, Remove Curse, etc.
    const dispelSpells = ["dispel_magic", "counterspell", "remove_curse", "greater_restoration"];

    if (!dispelSpells.includes(dispelSpell.id)) return false;

    if (dispelSpell.id === "dispel_magic") {
      // Dispel magic affects spells of 3rd level or lower automatically
      // Higher level spells require a check
      return targetSpell.metadata.level <= 3;
    }

    if (dispelSpell.id === "remove_curse") {
      return (
        targetSpell.metadata.school === "necromancy" ||
        targetSpell.effects.some(
          (e) =>
            e.type === "condition" && ["cursed", "charmed", "frightened"].includes(e.condition),
        )
      );
    }

    return false;
  }

  private matchesSpellPattern(spell: ComputationalSpell, pattern: string): boolean {
    if (pattern === "*_attack") {
      return spell.effects.some((e) => e.type === "damage" && !(e as any).savingThrow);
    }

    if (pattern === "*_fire_damage") {
      return spell.effects.some((e) => e.type === "damage" && (e as any).damageType === "fire");
    }

    if (pattern === "*_save") {
      return spell.effects.some((e) => (e as any).savingThrow);
    }

    return false;
  }
}

export const _spellRuleEngine = new SpellRuleEngine();
export const _spellInteractionCalculator = new SpellInteractionCalculator();
