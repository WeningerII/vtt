/**
 * Barbarian Class Implementation - Path of the Berserker (SRD)
 */

import { BaseClass, ClassFeature } from './base/BaseClass';

export class BarbarianClass extends BaseClass {
  readonly className = "barbarian";
  readonly hitDie = 12;
  readonly primaryAbility = ["strength"];
  readonly savingThrows = ["strength", "constitution"];
  readonly skillChoices = ["animal_handling", "athletics", "intimidation", "nature", "perception", "survival"];
  readonly subclassName = "Primal Path";
  readonly subclassLevel = 3;

  getCoreFeatures(level: number): ClassFeature[] {
    const rageUses = level >= 20 ? 999 : level >= 17 ? 6 : level >= 12 ? 4 : level >= 6 ? 3 : level >= 3 ? 3 : 2;
    const rageDamage = level >= 16 ? 4 : level >= 9 ? 3 : 2;
    
    return [
      {
        id: "rage",
        name: "Rage",
        className: "barbarian",
        level: 1,
        description: "Enter a battle rage",
        type: "active" as const,
        actionCost: "bonus_action" as const,
        uses: {
          type: "per_long_rest" as const,
          amount: rageUses,
          current: rageUses,
          resetOn: "long_rest" as const,
        },
        effects: [{
          type: "custom",
          target: "self",
          custom: {
            handler: "barbarian_rage",
            parameters: { 
              level,
              damage_bonus: rageDamage,
              resistance: ["bludgeoning", "piercing", "slashing"]
            },
          },
        }],
        source: "core" as const
      },
      {
        id: "unarmored_defense",
        name: "Unarmored Defense",
        className: "barbarian",
        level: 1,
        description: "AC = 10 + Dex + Con when unarmored",
        type: "passive" as const,
        effects: [{
          type: "modifier",
          target: "self",
          modifier: {
            stat: "ac",
            amount: 0, // Calculated dynamically
            type: "set",
          },
        }],
        source: "core" as const
      },
      {
        id: "reckless_attack",
        name: "Reckless Attack",
        className: "barbarian",
        level: 2,
        description: "Gain advantage on attack rolls, enemies gain advantage against you",
        type: "active" as const,
        effects: [{
          type: "reckless_attack"
        }],
        source: "core" as const
      },
      {
        id: "danger_sense",
        name: "Danger Sense",
        className: "barbarian",
        level: 2,
        description: "Advantage on Dex saves against effects you can see",
        type: "passive" as const,
        effects: [{
          type: "danger_sense"
        }],
        source: "core" as const
      },
      {
        id: "extra_attack",
        name: "Extra Attack",
        className: "barbarian",
        level: 5,
        description: "Attack twice when taking Attack action",
        type: "passive" as const,
        effects: [{
          type: "extra_attack",
          parameters: { attacks: 2 }
        }],
        source: "core" as const
      },
      {
        id: "fast_movement",
        name: "Fast Movement",
        className: "barbarian",
        level: 5,
        description: "Speed increases by 10 feet",
        type: "passive" as const,
        effects: [{
          type: "speed_increase",
          parameters: { amount: 10 }
        }],
        source: "core" as const
      },
      {
        id: "feral_instinct",
        name: "Feral Instinct",
        className: "barbarian",
        level: 7,
        description: "Advantage on initiative, can't be surprised while conscious",
        type: "passive" as const,
        effects: [{
          type: "feral_instinct"
        }],
        source: "core" as const
      },
      {
        id: "brutal_critical",
        name: "Brutal Critical",
        className: "barbarian",
        level: 9,
        description: "Roll additional weapon damage die on critical hit",
        type: "passive" as const,
        effects: [{
          type: "brutal_critical",
          parameters: { 
            dice: level >= 17 ? 3 : level >= 13 ? 2 : 1
          }
        }],
        source: "core" as const
      },
      {
        id: "relentless_rage",
        name: "Relentless Rage",
        className: "barbarian",
        level: 11,
        description: "Stay conscious at 0 HP while raging",
        type: "passive" as const,
        effects: [{
          type: "relentless_rage"
        }],
        source: "core" as const
      },
      {
        id: "persistent_rage",
        name: "Persistent Rage",
        className: "barbarian",
        level: 15,
        description: "Rage only ends early if you fall unconscious or choose to end it",
        type: "passive" as const,
        effects: [{
          type: "persistent_rage"
        }],
        source: "core" as const
      },
      {
        id: "indomitable_might",
        name: "Indomitable Might",
        className: "barbarian",
        level: 18,
        description: "Treat Strength checks less than Strength score as your Strength score",
        type: "passive" as const,
        effects: [{
          type: "indomitable_might"
        }],
        source: "core" as const
      },
      {
        id: "primal_champion",
        name: "Primal Champion",
        className: "barbarian",
        level: 20,
        description: "Increase Strength and Constitution by 4, maximums increase to 24",
        type: "passive" as const,
        effects: [{
          type: "ability_score_increase",
          parameters: {
            strength: 4,
            constitution: 4,
            max_increase: true
          }
        }],
        source: "core" as const
      }
    ].filter(f => f.level <= level);
  }

  getSubclassFeatures(level: number, subclass: string): ClassFeature[] {
    if (subclass === "berserker") {
      return [
        {
          id: "frenzy",
          name: "Frenzy",
          className: "barbarian",
          level: 3,
          description: "Make additional melee attack as bonus action while raging",
          type: "active" as const,
          actionCost: "bonus_action" as const,
          effects: [{
            type: "frenzy",
            target: "self"
          }],
          subclass: "berserker",
          source: "subclass" as const
        },
        {
          id: "mindless_rage",
          name: "Mindless Rage",
          className: "barbarian",
          level: 6,
          description: "Immune to charm and fear while raging",
          type: "passive" as const,
          effects: [{
            type: "condition_immunity",
            parameters: { conditions: ["charmed", "frightened"] }
          }],
          subclass: "berserker",
          source: "subclass" as const
        },
        {
          id: "intimidating_presence",
          name: "Intimidating Presence",
          className: "barbarian",
          level: 10,
          description: "Frighten creatures as action",
          type: "active" as const,
          actionCost: "action" as const,
          effects: [{
            type: "intimidating_presence"
          }],
          subclass: "berserker",
          source: "subclass" as const
        },
        {
          id: "retaliation",
          name: "Retaliation",
          className: "barbarian",
          level: 14,
          description: "Make melee attack when taking damage from adjacent creature",
          type: "reaction" as const,
          actionCost: "reaction" as const,
          effects: [{
            type: "retaliation"
          }],
          subclass: "berserker",
          source: "subclass" as const
        }
      ].filter(f => f.level <= level);
    }
    return [];
  }
}
