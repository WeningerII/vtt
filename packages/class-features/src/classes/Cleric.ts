/**
 * Cleric Class Implementation - Life Domain (SRD)
 */

import { BaseClass, ClassFeature } from './base/BaseClass';

export class ClericClass extends BaseClass {
  readonly className = "cleric";
  readonly hitDie = 8;
  readonly primaryAbility = ["wisdom"];
  readonly savingThrows = ["wisdom", "charisma"];
  readonly skillChoices = ["history", "insight", "medicine", "persuasion", "religion"];
  readonly subclassName = "Divine Domain";
  readonly subclassLevel = 1;

  getCoreFeatures(level: number): ClassFeature[] {
    return [
      {
        id: "spellcasting",
        name: "Spellcasting",
        className: "cleric",
        level: 1,
        description: "Cast divine spells",
        type: "passive" as const,
        effects: [{
          type: "spellcasting",
          parameters: { 
            ability: "wisdom",
            ritual_casting: true,
            spell_list: "cleric"
          }
        }],
        source: "core" as const
      },
      {
        id: "divine_domain",
        name: "Divine Domain",
        className: "cleric",
        level: 1,
        description: "Choose a divine domain",
        type: "passive" as const,
        effects: [{
          type: "divine_domain_choice"
        }],
        source: "core" as const
      },
      {
        id: "channel_divinity",
        name: "Channel Divinity",
        className: "cleric",
        level: 2,
        description: "Channel divine energy",
        type: "active" as const,
        actionCost: "action" as const,
        uses: {
          type: "per_short_rest" as const,
          amount: level >= 18 ? 3 : level >= 6 ? 2 : 1,
          current: level >= 18 ? 3 : level >= 6 ? 2 : 1,
          resetOn: "short_rest" as const,
        },
        effects: [{
          type: "channel_divinity_base"
        }],
        source: "core" as const
      },
      {
        id: "turn_undead",
        name: "Channel Divinity: Turn Undead",
        className: "cleric",
        level: 2,
        description: "Turn undead creatures",
        type: "active" as const,
        actionCost: "action" as const,
        uses: {
          type: "per_short_rest" as const,
          amount: level >= 18 ? 3 : level >= 6 ? 2 : 1,
          current: level >= 18 ? 3 : level >= 6 ? 2 : 1,
          resetOn: "short_rest" as const,
        },
        effects: [{
          type: "turn_undead"
        }],
        source: "core" as const
      },
      {
        id: "destroy_undead",
        name: "Destroy Undead",
        className: "cleric",
        level: 5,
        description: "Destroy low CR undead instead of turning",
        type: "passive" as const,
        effects: [{
          type: "destroy_undead",
          parameters: {
            cr_threshold: level >= 17 ? 4 : level >= 14 ? 3 : level >= 11 ? 2 : level >= 8 ? 1 : 0.5
          }
        }],
        source: "core" as const
      },
      {
        id: "ability_score_improvement",
        name: "Ability Score Improvement",
        className: "cleric",
        level: 4,
        description: "Increase ability scores or gain feat",
        type: "passive" as const,
        effects: [{
          type: "ability_score_improvement",
          parameters: { 
            points: 2,
            levels: [4, 8, 12, 16, 19]
          }
        }],
        source: "core" as const
      },
      {
        id: "divine_intervention",
        name: "Divine Intervention",
        className: "cleric",
        level: 10,
        description: "Call upon your deity for aid",
        type: "active" as const,
        actionCost: "action" as const,
        uses: {
          type: "per_long_rest" as const,
          amount: 1,
          current: 1,
          resetOn: "long_rest" as const,
        },
        effects: [{
          type: "divine_intervention",
          parameters: {
            success_chance: level >= 20 ? 100 : level
          }
        }],
        source: "core" as const
      }
    ].filter(f => f.level <= level);
  }

  getSubclassFeatures(level: number, subclass: string): ClassFeature[] {
    if (subclass === "life") {
      return [
        {
          id: "bonus_proficiency",
          name: "Bonus Proficiency",
          className: "cleric",
          level: 1,
          description: "Proficiency with heavy armor",
          type: "passive" as const,
          effects: [{
            type: "armor_proficiency",
            parameters: { armor: "heavy" }
          }],
          subclass: "life",
          source: "subclass" as const
        },
        {
          id: "disciple_of_life",
          name: "Disciple of Life",
          className: "cleric",
          level: 1,
          description: "Healing spells restore additional hit points",
          type: "passive" as const,
          effects: [{
            type: "disciple_of_life"
          }],
          subclass: "life",
          source: "subclass" as const
        },
        {
          id: "preserve_life",
          name: "Channel Divinity: Preserve Life",
          className: "cleric",
          level: 2,
          description: "Restore hit points to multiple creatures",
          type: "active" as const,
          actionCost: "action" as const,
          uses: {
            type: "per_short_rest" as const,
            amount: level >= 18 ? 3 : level >= 6 ? 2 : 1,
            current: level >= 18 ? 3 : level >= 6 ? 2 : 1,
            resetOn: "short_rest" as const,
          },
          effects: [{
            type: "preserve_life",
            parameters: { 
              pool: level * 5
            }
          }],
          subclass: "life",
          source: "subclass" as const
        },
        {
          id: "blessed_healer",
          name: "Blessed Healer",
          className: "cleric",
          level: 6,
          description: "Heal yourself when healing others",
          type: "passive" as const,
          effects: [{
            type: "blessed_healer"
          }],
          subclass: "life",
          source: "subclass" as const
        },
        {
          id: "divine_strike",
          name: "Divine Strike",
          className: "cleric",
          level: 8,
          description: "Weapon attacks deal additional radiant damage",
          type: "passive" as const,
          effects: [{
            type: "divine_strike",
            parameters: {
              damage_type: "radiant",
              dice: level >= 14 ? "2d8" : "1d8"
            }
          }],
          subclass: "life",
          source: "subclass" as const
        },
        {
          id: "supreme_healing",
          name: "Supreme Healing",
          className: "cleric",
          level: 17,
          description: "Maximize healing dice for spells",
          type: "passive" as const,
          effects: [{
            type: "supreme_healing"
          }],
          subclass: "life",
          source: "subclass" as const
        }
      ].filter(f => f.level <= level);
    }
    return [];
  }
}
