/**
 * Computational Spells - Machine-Executable D&D 5e Spell Definitions
 * Every spell effect is defined as computational primitives that can be executed algorithmically
 */
import { MaterialComponentValidator } from "./MaterialComponentDatabase.js";
// Utility functions for spell computations
const rollDice = (sides, count = 1) => {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }
  return total;
};
const calculateSpellSaveDC = (_caster) => {
  // Simplified - would use 8 + proficiency bonus + spellcasting ability modifier
  return 15; // placeholder
};
const isAlive = (entity) => {
  return entity.hitPoints.current > 0;
};
const isHostile = (entity, caster) => {
  // Simplified - would check faction/alignment relationships
  return entity.id !== caster.id;
};
const isWithinRange = (source, target, range) => {
  const dx = target.position.x - source.position.x;
  const dy = target.position.y - source.position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance <= range;
};
const getSpellcastingModifier = (_ctx) => {
  // Simplified - would get from caster's spellcasting ability
  return 3; // placeholder modifier
};
const getSpellSaveDC = (_ctx) => {
  return calculateSpellSaveDC(ctx.caster);
};
// CANTRIP COMPUTATIONAL DEFINITIONS
export const cantripComputationalSpells = {
  prestidigitation: {
    id: "prestidigitation",
    metadata: {
      name: "Prestidigitation",
      level: 0,
      school: "transmutation",
      classes: ["bard", "sorcerer", "warlock", "wizard"],
      source: "PHB",
    },
    requirements: {
      components: {
        verbal: false,
        somatic: true,
        material: {
          required: false,
          consumed: false,
          cost: 0,
          validator: (ctx) => true, // No material components required
        },
      },
      castingTime: () => 1000,
      range: (ctx) => 30,
      concentration: false,
      ritual: false,
    },
    targetSelection: {
      mode: "single",
      filter: (entity, ctx) => true,
    },
    effects: [
      {
        type: "information",
        operation: "detect",
        parameters: {
          effectType: (ctx) => "variable",
          duration: (ctx) => 3600000,
          options: (ctx) => [
            "instantaneous_spark_shower",
            "light_candle_torch_fire",
            "snuff_candle_torch_fire",
            "chill_warm_flavor_1_pound_food",
            "clean_soil_1_cubic_foot",
            "color_scent_1_cubic_foot_6_seconds",
          ],
        },
      },
    ],
    canCast: (ctx) => ({ valid: true }),
  },
  eldritchBlast: {
    id: "eldritch_blast",
    metadata: {
      name: "Eldritch Blast",
      level: 0,
      school: "evocation",
      classes: ["warlock"],
      source: "PHB",
    },
    requirements: {
      components: {
        verbal: true,
        somatic: true,
      },
      castingTime: (ctx) => 6000,
      range: (ctx) => 120,
      concentration: false,
      ritual: false,
    },
    targetSelection: {
      mode: "single",
      filter: (entity, ctx) => isAlive(entity),
    },
    effects: [
      {
        type: "damage",
        amount: (ctx) => rollDice(10),
        damageType: "force",
        targetFilter: (entity, ctx) => isAlive(entity),
      },
    ],
    canCast: (ctx) => ({ valid: true }),
  },
  sacredFlame: {
    id: "sacred_flame",
    metadata: {
      name: "Sacred Flame",
      level: 0,
      school: "evocation",
      classes: ["cleric"],
      source: "PHB",
    },
    requirements: {
      components: {
        verbal: true,
        somatic: true,
      },
      castingTime: (ctx) => 6000,
      range: (ctx) => 60,
      concentration: false,
      ritual: false,
    },
    targetSelection: {
      mode: "single",
      filter: (entity, ctx) => isAlive(entity),
    },
    effects: [
      {
        type: "damage",
        amount: (ctx) => rollDice(8),
        damageType: "radiant",
        savingThrow: {
          ability: "dexterity",
          dc: (ctx) => calculateSpellSaveDC(ctx.caster),
          onSave: "none",
        },
        targetFilter: (entity, ctx) => isAlive(entity),
      },
    ],
    canCast: (_ctx) => {
      // Check material components for Sacred Flame (requires holy symbol)
      const componentCheck = MaterialComponentValidator.validateSpellComponents(
        "word_of_radiance", // Sacred Flame uses same component as Word of Radiance
        [], // Would get from actual inventory system
      );
      if (componentCheck.valid) {
        return { valid: true };
      } else {
        return { valid: false, reason: "Missing holy symbol" };
      }
    },
  },
};
// Level 1 Spells Computational Layer
export const Level1ComputationalSpells = {
  guidingBolt: {
    id: "guiding_bolt",
    validationRules: {
      target: (target) => target.type === "creature",
      range: (distance) => distance <= 120,
      lineOfSight: true,
    },
    effectPrimitives: [
      {
        type: "spell_attack_roll",
        modifier: "spellcasting",
        onHit: [
          { type: "damage", dice: "4d6", damageType: "radiant" },
          { type: "apply_condition", condition: "advantage_next_attack", duration: 1 },
        ],
      },
    ],
    scaling: { damage: "1d6" },
  },
  burningHands: {
    id: "burning_hands",
    validationRules: {
      target: (target) => target.type === "area",
      shape: "cone",
      size: 15,
    },
    effectPrimitives: [
      {
        type: "area_effect",
        shape: "cone",
        size: 15,
        savingThrow: { ability: "DEX", dc: "spellcasting" },
        onFail: { type: "damage", dice: "3d6", damageType: "fire" },
        onSuccess: { type: "damage", dice: "3d6", damageType: "fire", modifier: 0.5 },
      },
    ],
    scaling: { damage: "1d6" },
  },
  magicMissile: {
    id: "magic_missile",
    validationRules: {
      target: (target) => target.type === "creature",
      range: (distance) => distance <= 120,
      lineOfSight: true,
      autoHit: true,
    },
    effectPrimitives: [
      {
        type: "multiple_projectiles",
        count: 3,
        effects: [{ type: "damage", dice: "1d4+1", damageType: "force" }],
      },
    ],
    scaling: { projectiles: 1 },
  },
  cureWounds: {
    id: "cure_wounds",
    validationRules: {
      target: (target) => target.type === "creature" && !target.undead && !target.construct,
      range: (distance) => distance <= 5,
      touch: true,
    },
    effectPrimitives: [
      {
        type: "healing",
        dice: "1d8",
        modifier: "spellcasting",
      },
    ],
    scaling: { healing: "1d8" },
  },
  command: {
    id: "command",
    validationRules: {
      target: (target) => target.type === "humanoid",
      range: (distance) => distance <= 60,
      language: true,
    },
    effectPrimitives: [
      {
        type: "mind_effect",
        savingThrow: { ability: "WIS", dc: "spellcasting" },
        onFail: {
          type: "compulsion",
          command: "single_word",
          duration: 1,
        },
      },
    ],
    scaling: { targets: 1 },
  },
};
//# sourceMappingURL=ComputationalSpells.js.map
