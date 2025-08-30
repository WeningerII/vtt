/**
 * Complete Game-Specific Visual Scripting Nodes
 * Comprehensive node library for VTT automation and scripting
 */

import {
  NodeDefinition,
  _NodeExecutor,
  _DataType,
  _ExecutionContext,
} from "./VisualScriptingEngine";
import {
  globalEventBus,
  GameEvents,
  _AIEvents,
  _ContentEvents,
  _RuleEvents,
} from "@vtt/core/src/EventBus";

// D&D 5e Specific Nodes
export const dnd5eNodes: NodeDefinition[] = [
  {
    type: "dnd5e_ability_check",
    name: "Ability Check",
    category: "game",
    description: "Perform a D&D 5e ability check",
    inputs: [
      { id: "exec", name: "Execute", type: "exec", required: true },
      { id: "character", name: "Character", type: "character", required: true },
      { id: "ability", name: "Ability", type: "string", required: true, defaultValue: "strength" },
      { id: "dc", name: "Difficulty Class", type: "number", required: true, defaultValue: 15 },
      { id: "advantage", name: "Advantage", type: "boolean", required: false, defaultValue: false },
    ],
    outputs: [
      { id: "exec", name: "Execute", type: "exec" },
      { id: "success", name: "Success", type: "boolean" },
      { id: "total", name: "Total Roll", type: "number" },
      { id: "natural", name: "Natural Roll", type: "number" },
    ],
    properties: [],
    executor: async (inputs, _properties, _context) => {
      const character = inputs.character;
      const ability = inputs.ability;
      const dc = inputs.dc;
      const hasAdvantage = inputs.advantage;

      // Get ability modifier
      const abilityScore = character.attributes[ability]?.total || 10;
      const modifier = Math.floor((abilityScore - 10) / 2);
      const proficiencyBonus = character.proficiencyBonus || 0;

      // Check for proficiency
      const skillKey = `${ability}_save`;
      const isProficient = character.savingThrows?.[skillKey]?.proficient || false;
      const totalModifier = modifier + (isProficient ? proficiencyBonus : 0);

      // Roll dice
      const roll1 = Math.floor(Math.random() * 20) + 1;
      const roll2 = hasAdvantage ? Math.floor(Math.random() * 20) + 1 : roll1;

      const naturalRoll = hasAdvantage ? Math.max(roll1, roll2) : roll1;
      const totalRoll = naturalRoll + totalModifier;
      const success = totalRoll >= dc;

      // Emit game event
      await globalEventBus.emit(
        GameEvents.spellCast(character.id, "", {
          type: "ability_check",
          ability,
          dc,
          roll: totalRoll,
          natural: naturalRoll,
          success,
        }),
      );

      return {
        exec: true,
        success,
        total: totalRoll,
        natural: naturalRoll,
      };
    },
  },

  {
    type: "dnd5e_skill_check",
    name: "Skill Check",
    category: "game",
    description: "Perform a D&D 5e skill check",
    inputs: [
      { id: "exec", name: "Execute", type: "exec", required: true },
      { id: "character", name: "Character", type: "character", required: true },
      { id: "skill", name: "Skill", type: "string", required: true, defaultValue: "perception" },
      { id: "dc", name: "Difficulty Class", type: "number", required: true, defaultValue: 15 },
    ],
    outputs: [
      { id: "exec", name: "Execute", type: "exec" },
      { id: "success", name: "Success", type: "boolean" },
      { id: "total", name: "Total Roll", type: "number" },
    ],
    properties: [],
    executor: async (inputs) => {
      const character = inputs.character;
      const skill = inputs.skill;
      const dc = inputs.dc;

      const skillData = character.skills[skill];
      const totalModifier = skillData?.total || 0;

      const naturalRoll = Math.floor(Math.random() * 20) + 1;
      const totalRoll = naturalRoll + totalModifier;
      const success = totalRoll >= dc;

      return {
        exec: true,
        success,
        total: totalRoll,
      };
    },
  },

  {
    type: "dnd5e_spell_slot_check",
    name: "Check Spell Slot",
    category: "game",
    description: "Check if character has available spell slot",
    inputs: [
      { id: "character", name: "Character", type: "character", required: true },
      { id: "level", name: "Spell Level", type: "number", required: true, defaultValue: 1 },
    ],
    outputs: [
      { id: "available", name: "Available", type: "boolean" },
      { id: "remaining", name: "Remaining Slots", type: "number" },
    ],
    properties: [],
    executor: async (inputs) => {
      const character = inputs.character;
      const level = inputs.level;

      const spellSlots = character.spellSlots || {};
      const remaining = spellSlots[`level${level}`] || 0;

      return {
        available: remaining > 0,
        remaining,
      };
    },
  },

  {
    type: "dnd5e_consume_spell_slot",
    name: "Consume Spell Slot",
    category: "game",
    description: "Consume a spell slot from character",
    inputs: [
      { id: "exec", name: "Execute", type: "exec", required: true },
      { id: "character", name: "Character", type: "character", required: true },
      { id: "level", name: "Spell Level", type: "number", required: true, defaultValue: 1 },
    ],
    outputs: [
      { id: "exec", name: "Execute", type: "exec" },
      { id: "success", name: "Success", type: "boolean" },
    ],
    properties: [],
    executor: async (inputs) => {
      const character = inputs.character;
      const level = inputs.level;

      const spellSlots = character.spellSlots || {};
      const slotKey = `level${level}`;
      const remaining = spellSlots[slotKey] || 0;

      if (remaining > 0) {
        spellSlots[slotKey] = remaining - 1;
        return { exec: true, success: true };
      }

      return { exec: true, success: false };
    },
  },
];

// Combat System Nodes
export const combatNodes: NodeDefinition[] = [
  {
    type: "combat_attack_roll",
    name: "Attack Roll",
    category: "combat",
    description: "Make an attack roll against a target",
    inputs: [
      { id: "exec", name: "Execute", type: "exec", required: true },
      { id: "attacker", name: "Attacker", type: "character", required: true },
      { id: "target", name: "Target", type: "character", required: true },
      { id: "weapon", name: "Weapon", type: "object", required: false },
      { id: "advantage", name: "Advantage", type: "boolean", required: false, defaultValue: false },
    ],
    outputs: [
      { id: "exec_hit", name: "On Hit", type: "exec" },
      { id: "exec_miss", name: "On Miss", type: "exec" },
      { id: "hit", name: "Hit", type: "boolean" },
      { id: "critical", name: "Critical Hit", type: "boolean" },
      { id: "attack_roll", name: "Attack Roll", type: "number" },
    ],
    properties: [],
    executor: async (inputs) => {
      const attacker = inputs.attacker;
      const target = inputs.target;
      const weapon = inputs.weapon;
      const hasAdvantage = inputs.advantage;

      // Calculate attack bonus
      const proficiencyBonus = attacker.proficiencyBonus || 0;
      const abilityMod = weapon?.finesse
        ? Math.max(
            Math.floor((attacker.attributes.strength?.total || 10 - 10) / 2),
            Math.floor((attacker.attributes.dexterity?.total || 10 - 10) / 2),
          )
        : Math.floor((attacker.attributes.strength?.total || 10 - 10) / 2);

      const attackBonus = abilityMod + proficiencyBonus + (weapon?.enchantment || 0);

      // Roll attack
      const roll1 = Math.floor(Math.random() * 20) + 1;
      const roll2 = hasAdvantage ? Math.floor(Math.random() * 20) + 1 : roll1;
      const naturalRoll = hasAdvantage ? Math.max(roll1, roll2) : roll1;
      const attackRoll = naturalRoll + attackBonus;

      // Check hit
      const targetAC = target.armorClass?.total || 10;
      const hit = attackRoll >= targetAC;
      const critical = naturalRoll === 20;

      // Emit combat event
      await globalEventBus.emit(GameEvents.damageDealt(attacker.id, target.id, 0, "attack_roll"));

      return {
        exec_hit: hit,
        exec_miss: !hit,
        hit,
        critical,
        attack_roll: attackRoll,
      };
    },
  },

  {
    type: "combat_damage_roll",
    name: "Damage Roll",
    category: "combat",
    description: "Roll damage for an attack",
    inputs: [
      { id: "exec", name: "Execute", type: "exec", required: true },
      { id: "dice", name: "Damage Dice", type: "string", required: true, defaultValue: "1d8" },
      { id: "modifier", name: "Damage Modifier", type: "number", required: false, defaultValue: 0 },
      {
        id: "critical",
        name: "Critical Hit",
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      {
        id: "damage_type",
        name: "Damage Type",
        type: "string",
        required: false,
        defaultValue: "slashing",
      },
    ],
    outputs: [
      { id: "exec", name: "Execute", type: "exec" },
      { id: "damage", name: "Total Damage", type: "number" },
      { id: "rolls", name: "Individual Rolls", type: "array" },
    ],
    properties: [],
    executor: async (inputs) => {
      const dice = inputs.dice;
      const modifier = inputs.modifier;
      const isCritical = inputs.critical;
      const _damageType = inputs.damage_type;

      // Parse dice notation (e.g., "1d8", "2d6+3")
      const diceMatch = dice.match(/(\d+)d(\d+)(?:\+(\d+))?/);
      if (!diceMatch) {
        return { exec: true, damage: 0, rolls: [] };
      }

      const count = parseInt(diceMatch[1]);
      const sides = parseInt(diceMatch[2]);
      const diceModifier = parseInt(diceMatch[3] || "0");

      // Roll dice (double on critical)
      const rollCount = isCritical ? count * 2 : count;
      const rolls = [];
      let total = 0;

      for (let i = 0; i < rollCount; i++) {
        const roll = Math.floor(Math.random() * sides) + 1;
        rolls.push(roll);
        total += roll;
      }

      total += modifier + diceModifier;

      return {
        exec: true,
        damage: Math.max(0, total),
        rolls,
      };
    },
  },

  {
    type: "combat_apply_damage",
    name: "Apply Damage",
    category: "combat",
    description: "Apply damage to a character",
    inputs: [
      { id: "exec", name: "Execute", type: "exec", required: true },
      { id: "character", name: "Character", type: "character", required: true },
      { id: "damage", name: "Damage Amount", type: "number", required: true },
      {
        id: "damage_type",
        name: "Damage Type",
        type: "string",
        required: false,
        defaultValue: "slashing",
      },
    ],
    outputs: [
      { id: "exec", name: "Execute", type: "exec" },
      { id: "actual_damage", name: "Actual Damage", type: "number" },
      { id: "is_unconscious", name: "Is Unconscious", type: "boolean" },
      { id: "is_dead", name: "Is Dead", type: "boolean" },
    ],
    properties: [],
    executor: async (inputs) => {
      const character = inputs.character;
      const damage = inputs.damage;
      const damageType = inputs.damage_type;

      // Check resistances/immunities
      let actualDamage = damage;
      if (character.resistances?.includes(damageType)) {
        actualDamage = Math.floor(damage / 2);
      }
      if (character.immunities?.includes(damageType)) {
        actualDamage = 0;
      }
      if (character.vulnerabilities?.includes(damageType)) {
        actualDamage = damage * 2;
      }

      // Apply damage
      const currentHP = character.hitPoints?.current || 0;
      const newHP = Math.max(0, currentHP - actualDamage);
      character.hitPoints.current = newHP;

      const isUnconscious = newHP === 0;
      const maxHP = character.hitPoints?.max || 0;
      const isDead = newHP === 0 && damage >= maxHP;

      // Emit damage event
      await globalEventBus.emit(GameEvents.damageDealt("", character.id, actualDamage, damageType));

      return {
        exec: true,
        actual_damage: actualDamage,
        is_unconscious: isUnconscious,
        is_dead: isDead,
      };
    },
  },
];

// Spell System Nodes
export const spellNodes: NodeDefinition[] = [
  {
    type: "spell_cast",
    name: "Cast Spell",
    category: "magic",
    description: "Cast a spell with all proper checks",
    inputs: [
      { id: "exec", name: "Execute", type: "exec", required: true },
      { id: "caster", name: "Caster", type: "character", required: true },
      { id: "spell", name: "Spell", type: "object", required: true },
      { id: "target", name: "Target", type: "character", required: false },
      { id: "slot_level", name: "Slot Level", type: "number", required: false },
    ],
    outputs: [
      { id: "exec_success", name: "On Success", type: "exec" },
      { id: "exec_failure", name: "On Failure", type: "exec" },
      { id: "success", name: "Cast Successful", type: "boolean" },
      { id: "spell_attack", name: "Spell Attack Roll", type: "number" },
      { id: "save_dc", name: "Save DC", type: "number" },
    ],
    properties: [],
    executor: async (inputs) => {
      const caster = inputs.caster;
      const spell = inputs.spell;
      const target = inputs.target;
      const slotLevel = inputs.slot_level || spell.level;

      // Check spell slot availability
      const spellSlots = caster.spellSlots || {};
      const slotKey = `level${slotLevel}`;
      const hasSlot = (spellSlots[slotKey] || 0) > 0;

      if (!hasSlot && spell.level > 0) {
        return {
          exec_success: false,
          exec_failure: true,
          success: false,
          spell_attack: 0,
          save_dc: 0,
        };
      }

      // Consume spell slot
      if (spell.level > 0) {
        spellSlots[slotKey]--;
      }

      // Calculate spell attack bonus and save DC
      const spellcastingAbility = caster.spellcastingAbility || "intelligence";
      const abilityMod = Math.floor((caster.attributes[spellcastingAbility]?.total || 10 - 10) / 2);
      const proficiencyBonus = caster.proficiencyBonus || 0;

      const spellAttackBonus = abilityMod + proficiencyBonus;
      const spellSaveDC = 8 + abilityMod + proficiencyBonus;

      let spellAttackRoll = 0;
      if (spell.requiresAttackRoll) {
        spellAttackRoll = Math.floor(Math.random() * 20) + 1 + spellAttackBonus;
      }

      // Emit spell cast event
      await globalEventBus.emit(
        GameEvents.spellCast(caster.id, target?.id || "", {
          spell: spell.name,
          level: slotLevel,
          attackRoll: spellAttackRoll,
          saveDC: spellSaveDC,
        }),
      );

      return {
        exec_success: true,
        exec_failure: false,
        success: true,
        spell_attack: spellAttackRoll,
        save_dc: spellSaveDC,
      };
    },
  },

  {
    type: "spell_save",
    name: "Saving Throw",
    category: "magic",
    description: "Make a saving throw against a spell",
    inputs: [
      { id: "exec", name: "Execute", type: "exec", required: true },
      { id: "character", name: "Character", type: "character", required: true },
      {
        id: "save_type",
        name: "Save Type",
        type: "string",
        required: true,
        defaultValue: "dexterity",
      },
      { id: "dc", name: "Save DC", type: "number", required: true, defaultValue: 15 },
    ],
    outputs: [
      { id: "exec_success", name: "On Success", type: "exec" },
      { id: "exec_failure", name: "On Failure", type: "exec" },
      { id: "success", name: "Save Successful", type: "boolean" },
      { id: "roll_total", name: "Total Roll", type: "number" },
    ],
    properties: [],
    executor: async (inputs) => {
      const character = inputs.character;
      const saveType = inputs.save_type;
      const dc = inputs.dc;

      const saveData = character.savingThrows?.[saveType];
      const saveModifier = saveData?.total || 0;

      const naturalRoll = Math.floor(Math.random() * 20) + 1;
      const totalRoll = naturalRoll + saveModifier;
      const success = totalRoll >= dc;

      return {
        exec_success: success,
        exec_failure: !success,
        success,
        roll_total: totalRoll,
      };
    },
  },
];

// Character Management Nodes
export const characterNodes: NodeDefinition[] = [
  {
    type: "character_get_stat",
    name: "Get Character Stat",
    category: "character",
    description: "Get any character attribute, skill, or property",
    inputs: [
      { id: "character", name: "Character", type: "character", required: true },
      {
        id: "stat_path",
        name: "Stat Path",
        type: "string",
        required: true,
        defaultValue: "attributes.strength.total",
      },
    ],
    outputs: [
      { id: "value", name: "Value", type: "any" },
      { id: "exists", name: "Exists", type: "boolean" },
    ],
    properties: [],
    executor: async (inputs) => {
      const character = inputs.character;
      const statPath = inputs.stat_path;

      const pathParts = statPath.split(".");
      let value = character;
      let exists = true;

      for (const part of pathParts) {
        if (value && typeof value === "object" && part in value) {
          value = value[part];
        } else {
          exists = false;
          value = undefined;
          break;
        }
      }

      return { value, exists };
    },
  },

  {
    type: "character_set_stat",
    name: "Set Character Stat",
    category: "character",
    description: "Set any character attribute, skill, or property",
    inputs: [
      { id: "exec", name: "Execute", type: "exec", required: true },
      { id: "character", name: "Character", type: "character", required: true },
      {
        id: "stat_path",
        name: "Stat Path",
        type: "string",
        required: true,
        defaultValue: "hitPoints.current",
      },
      { id: "value", name: "New Value", type: "any", required: true },
    ],
    outputs: [
      { id: "exec", name: "Execute", type: "exec" },
      { id: "success", name: "Success", type: "boolean" },
      { id: "old_value", name: "Old Value", type: "any" },
    ],
    properties: [],
    executor: async (inputs) => {
      const character = inputs.character;
      const statPath = inputs.stat_path;
      const newValue = inputs.value;

      const pathParts = statPath.split(".");
      const lastPart = pathParts.pop()!;

      let target = character;
      for (const part of pathParts) {
        if (!target[part]) {
          target[part] = {};
        }
        target = target[part];
      }

      const oldValue = target[lastPart];
      target[lastPart] = newValue;

      return {
        exec: true,
        success: true,
        old_value: oldValue,
      };
    },
  },

  {
    type: "character_add_condition",
    name: "Add Condition",
    category: "character",
    description: "Add a condition effect to a character",
    inputs: [
      { id: "exec", name: "Execute", type: "exec", required: true },
      { id: "character", name: "Character", type: "character", required: true },
      { id: "condition", name: "Condition Name", type: "string", required: true },
      {
        id: "duration",
        name: "Duration (rounds)",
        type: "number",
        required: false,
        defaultValue: -1,
      },
      { id: "source", name: "Source", type: "string", required: false, defaultValue: "unknown" },
    ],
    outputs: [
      { id: "exec", name: "Execute", type: "exec" },
      { id: "success", name: "Success", type: "boolean" },
    ],
    properties: [],
    executor: async (inputs) => {
      const character = inputs.character;
      const condition = inputs.condition;
      const duration = inputs.duration;
      const source = inputs.source;

      if (!character.conditions) {
        character.conditions = [];
      }

      const newCondition = {
        name: condition,
        duration: duration,
        source: source,
        effects: [], // Would be populated based on condition type
        savingThrow: undefined,
      };

      character.conditions.push(newCondition);

      // Emit condition applied event
      await globalEventBus.emit(GameEvents.damageDealt("", character.id, 0, "condition"));

      return {
        exec: true,
        success: true,
      };
    },
  },
];

// All game nodes combined
export const allGameNodes: NodeDefinition[] = [
  ...dnd5eNodes,
  ...combatNodes,
  ...spellNodes,
  ...characterNodes,
];
