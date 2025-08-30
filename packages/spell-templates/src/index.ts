/**
 * Spell Templates - Reusable patterns for systematic spell implementation
 * Provides consistent templates for all spell mechanics with proper typing
 */

import type { SRDSpell } from "../../content-5e-srd/src/spells";
import type { PhysicsSpellEffect } from "../../physics-spell-bridge/src";

export interface SpellTemplate {
  // Base SRD properties
  srd: Partial<SRDSpell>;

  // Enhanced physics properties
  enhanced: Partial<PhysicsSpellEffect>;

  // Computational properties
  computational?: any;

  // Utility mechanics
  utility?: any;

  // Visual effects
  visual?: any;
}

/**
 * PROJECTILE SPELL TEMPLATE
 * For spells that launch projectiles (Fire Bolt, Eldritch Blast, etc.)
 */
export const createProjectileSpell = (config: {
  id: string;
  name: string;
  level: number;
  school: string;
  damage: { dice: string; type: string; scaling?: string };
  range: number;
  speed: number;
  physics?: Partial<PhysicsSpellEffect["physics"]>;
}): SpellTemplate => ({
  srd: {
    id: config.id,
    name: config.name,
    level: config.level,
    school: config.school,
    castingTime: "1 action",
    range: `${config.range} feet`,
    components: ["V", "S"],
    duration: "Instantaneous",
    damage: {
      diceExpression: config.damage.dice,
      damageType: config.damage.type as any,
      scalingDice: config.damage.scaling || config.damage.dice,
    },
    attackRoll: true,
    concentration: false,
    ritual: false,
    source: "SRD 5.1",
  },
  enhanced: {
    id: config.id,
    name: config.name,
    level: config.level,
    school: config.school,
    effects: [
      {
        type: "damage",
        target: "single",
        damage: { dice: config.damage.dice, type: config.damage.type },
      },
    ],
    physics: {
      type: "projectile",
      projectile: {
        speed: config.speed,
        gravity: false,
        piercing: false,
        ...config.physics?.projectile,
      },
      ...config.physics,
    },
    scaling: { damage: config.damage.dice },
  },
});

/**
 * AREA EFFECT SPELL TEMPLATE
 * For spells that affect areas (Fireball, Burning Hands, etc.)
 */
export const createAreaEffectSpell = (config: {
  id: string;
  name: string;
  level: number;
  school: string;
  damage: { dice: string; type: string };
  area: { type: "sphere" | "cone" | "cube" | "line"; size: number };
  savingThrow: { ability: string; onSuccess: "half" | "none" };
  range: number;
}): SpellTemplate => ({
  srd: {
    id: config.id,
    name: config.name,
    level: config.level,
    school: config.school,
    castingTime: "1 action",
    range: `${config.range} feet`,
    components: ["V", "S"],
    duration: "Instantaneous",
    damage: {
      diceExpression: config.damage.dice,
      damageType: config.damage.type as any,
      scalingDice: config.damage.dice,
    },
    savingThrow: { ability: config.savingThrow.ability as any, dc: 0 },
    concentration: false,
    ritual: false,
    source: "SRD 5.1",
  },
  enhanced: {
    id: config.id,
    name: config.name,
    level: config.level,
    school: config.school,
    effects: [
      {
        type: "damage",
        target: "area",
        area: config.area,
        damage: {
          dice: config.damage.dice,
          type: config.damage.type,
          savingThrow: config.savingThrow,
        },
      },
    ],
    physics: {
      type: "area_effect",
      area: {
        type: config.area.type as any,
        radius: config.area.size,
        affectsMultiple: true,
      },
    },
    scaling: { damage: config.damage.dice },
  },
});

/**
 * UTILITY SPELL TEMPLATE
 * For spells that create interactive entities or persistent effects
 */
export const createUtilitySpell = (config: {
  id: string;
  name: string;
  level: number;
  school: string;
  duration: string;
  concentration?: boolean;
  range: string;
  utilityType: "spectral_hand" | "dancing_lights" | "minor_illusion" | "light_source";
  commands: string[];
}): SpellTemplate => ({
  srd: {
    id: config.id,
    name: config.name,
    level: config.level,
    school: config.school,
    castingTime: "1 action",
    range: config.range,
    components: ["V", "S"],
    duration: config.duration,
    concentration: config.concentration || false,
    ritual: false,
    source: "SRD 5.1",
  },
  enhanced: {
    id: config.id,
    name: config.name,
    level: config.level,
    school: config.school,
    effects: [
      {
        type: "utility",
        target: "area",
      },
    ],
    physics: {
      type: "persistent_effect",
      persistent: {
        followsCaster: false,
        duration: parseDuration(config.duration),
      },
    },
  },
  utility: {
    entityType: config.utilityType,
    commands: config.commands,
    duration: parseDuration(config.duration),
  },
});

/**
 * BUFF/DEBUFF SPELL TEMPLATE
 * For spells that modify character abilities or impose conditions
 */
export const createConditionSpell = (config: {
  id: string;
  name: string;
  level: number;
  school: string;
  condition: string;
  duration: string;
  concentration?: boolean;
  savingThrow?: { ability: string; endOfTurn?: boolean };
  range: string;
}): SpellTemplate => ({
  srd: {
    id: config.id,
    name: config.name,
    level: config.level,
    school: config.school,
    castingTime: "1 action",
    range: config.range,
    components: ["V", "S"],
    duration: config.duration,
    concentration: config.concentration || false,
    ritual: false,
    savingThrow: config.savingThrow
      ? { ability: config.savingThrow.ability as any, dc: 0 }
      : undefined,
    source: "SRD 5.1",
  },
  enhanced: {
    id: config.id,
    name: config.name,
    level: config.level,
    school: config.school,
    concentration: config.concentration,
    effects: [
      {
        type: "condition",
        target: "single",
        condition: {
          id: config.condition,
          duration: parseDuration(config.duration),
          savingThrow: config.savingThrow,
        },
      },
    ],
    physics: {
      type: "constraint",
      constraint: {
        type: mapConditionToConstraint(config.condition),
        strength: 1.0,
        duration: parseDuration(config.duration),
      },
    },
  },
});

/**
 * Helper functions
 */
function parseDuration(duration: string): number {
  if (duration.includes("1 minute")) return 60000;
  if (duration.includes("10 minutes")) return 600000;
  if (duration.includes("1 hour")) return 3600000;
  if (duration.includes("1 round")) return 6000;
  return 0;
}

function mapConditionToConstraint(_condition: string): "immobilize" | "slow" | "entangle" {
  switch (condition) {
    case "paralyzed":
    case "stunned":
      return "immobilize";
    case "restrained":
      return "entangle";
    default:
      return "slow";
  }
}

/**
 * MISSING CANTRIPS IMPLEMENTATION
 */
export const _missingCantrips = {
  message: createUtilitySpell({
    id: "message",
    name: "Message",
    level: 0,
    school: "transmutation",
    duration: "1 round",
    range: "120 feet",
    utilityType: "light_source", // Reusing closest type
    commands: ["send_message", "receive_reply"],
  }),

  minorIllusion: createUtilitySpell({
    id: "minor_illusion",
    name: "Minor Illusion",
    level: 0,
    school: "illusion",
    duration: "1 minute",
    range: "30 feet",
    utilityType: "minor_illusion",
    commands: ["change_sound", "investigation_check"],
  }),

  resistance: createConditionSpell({
    id: "resistance",
    name: "Resistance",
    level: 0,
    school: "abjuration",
    condition: "resistance_bonus",
    duration: "1 minute",
    concentration: true,
    range: "Touch",
  }),

  shillelagh: createConditionSpell({
    id: "shillelagh",
    name: "Shillelagh",
    level: 0,
    school: "transmutation",
    condition: "weapon_enhanced",
    duration: "1 minute",
    range: "Touch",
  }),
};

/**
 * LEVEL 1 COMBAT SPELLS
 */
export const _level1CombatSpells = {
  burningHands: createAreaEffectSpell({
    id: "burning_hands",
    name: "Burning Hands",
    level: 1,
    school: "evocation",
    damage: { dice: "3d6", type: "fire" },
    area: { type: "cone", size: 15 },
    savingThrow: { ability: "DEX", onSuccess: "half" },
    range: 15,
  }),

  guidingBolt: createProjectileSpell({
    id: "guiding_bolt",
    name: "Guiding Bolt",
    level: 1,
    school: "evocation",
    damage: { dice: "4d6", type: "radiant" },
    range: 120,
    speed: 300,
  }),

  inflictWounds: {
    srd: {
      id: "inflict_wounds",
      name: "Inflict Wounds",
      level: 1,
      school: "necromancy",
      castingTime: "1 action",
      range: "Touch",
      components: ["V", "S"],
      duration: "Instantaneous",
      damage: { diceExpression: "3d10", damageType: "necrotic" as any, scalingDice: "1d10" },
      attackRoll: true,
      concentration: false,
      ritual: false,
      source: "SRD 5.1",
    },
    enhanced: {
      id: "inflict_wounds",
      name: "Inflict Wounds",
      level: 1,
      school: "necromancy",
      effects: [
        {
          type: "damage",
          target: "single",
          damage: { dice: "3d10", type: "necrotic" },
        },
      ],
      physics: {
        type: "melee_effect",
        melee: { range: 5 },
      },
      scaling: { damage: "1d10" },
    },
  },
};

/**
 * LEVEL 1 UTILITY SPELLS
 */
export const _level1UtilitySpells = {
  detectMagic: createUtilitySpell({
    id: "detect_magic",
    name: "Detect Magic",
    level: 1,
    school: "divination",
    duration: "10 minutes",
    concentration: true,
    range: "Self",
    utilityType: "light_source",
    commands: ["detect_aura", "identify_school"],
  }),

  comprehendLanguages: {
    srd: {
      id: "comprehend_languages",
      name: "Comprehend Languages",
      level: 1,
      school: "divination",
      castingTime: "1 action",
      range: "Self",
      components: ["V", "S", "M"],
      duration: "1 hour",
      ritual: true,
      concentration: false,
      source: "SRD 5.1",
    },
  },

  identify: {
    srd: {
      id: "identify",
      name: "Identify",
      level: 1,
      school: "divination",
      castingTime: "1 minute",
      range: "Touch",
      components: ["V", "S", "M"],
      duration: "Instantaneous",
      ritual: true,
      concentration: false,
      source: "SRD 5.1",
    },
  },
};

/**
 * Template application helper
 */
export function applyTemplate(
  template: SpellTemplate,
  overrides: Partial<SpellTemplate> = {},
): SpellTemplate {
  return {
    srd: { ...template.srd, ...overrides.srd },
    enhanced: { ...template.enhanced, ...overrides.enhanced },
    computational: { ...template.computational, ...overrides.computational },
    utility: { ...template.utility, ...overrides.utility },
    visual: { ...template.visual, ...overrides.visual },
  };
}
