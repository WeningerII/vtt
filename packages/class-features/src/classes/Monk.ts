/**
 * Monk Class Implementation - Way of the Open Hand (SRD)
 */

import { BaseClass, ClassFeature } from './base/BaseClass';

export class MonkClass extends BaseClass {
  readonly className = "monk";
  readonly hitDie = 8;
  readonly primaryAbility = ["dexterity", "wisdom"];
  readonly savingThrows = ["strength", "dexterity"];
  readonly skillChoices = ["acrobatics", "athletics", "history", "insight", "religion", "stealth"];
  readonly subclassName = "Monastic Tradition";
  readonly subclassLevel = 3;

  getCoreFeatures(level: number): ClassFeature[] {
    const kiPoints = level >= 2 ? level : 0;
    
    return [
      {
        id: "unarmored_defense",
        name: "Unarmored Defense",
        className: "monk",
        level: 1,
        description: "AC = 10 + Dex modifier + Wis modifier when unarmored",
        type: "passive" as const,
        effects: [{
          type: "unarmored_defense_monk"
        }],
        source: "core" as const
      },
      {
        id: "martial_arts",
        name: "Martial Arts",
        className: "monk",
        level: 1,
        description: "Unarmed strikes and monk weapons use martial arts die",
        type: "passive" as const,
        effects: [{
          type: "martial_arts",
          parameters: { 
            die: level >= 17 ? "d10" : level >= 11 ? "d8" : level >= 5 ? "d6" : "d4"
          }
        }],
        source: "core" as const
      },
      {
        id: "ki",
        name: "Ki",
        className: "monk",
        level: 2,
        description: "Spend ki points for special abilities",
        type: "passive" as const,
        uses: {
          type: "per_short_rest" as const,
          amount: kiPoints,
          current: kiPoints,
          resetOn: "short_rest" as const,
        },
        effects: [{
          type: "ki_pool",
          parameters: { points: kiPoints }
        }],
        source: "core" as const
      },
      {
        id: "flurry_of_blows",
        name: "Flurry of Blows",
        className: "monk",
        level: 2,
        description: "Spend 1 ki for 2 bonus unarmed strikes",
        type: "active" as const,
        actionCost: "bonus_action" as const,
        effects: [{
          type: "flurry_of_blows",
          parameters: { ki_cost: 1 }
        }],
        source: "core" as const
      },
      {
        id: "patient_defense",
        name: "Patient Defense",
        className: "monk",
        level: 2,
        description: "Spend 1 ki to Dodge as bonus action",
        type: "active" as const,
        actionCost: "bonus_action" as const,
        effects: [{
          type: "patient_defense",
          parameters: { ki_cost: 1 }
        }],
        source: "core" as const
      },
      {
        id: "step_of_the_wind",
        name: "Step of the Wind",
        className: "monk",
        level: 2,
        description: "Spend 1 ki to Dash/Disengage as bonus action, double jump",
        type: "active" as const,
        actionCost: "bonus_action" as const,
        effects: [{
          type: "step_of_the_wind",
          parameters: { ki_cost: 1 }
        }],
        source: "core" as const
      },
      {
        id: "unarmored_movement",
        name: "Unarmored Movement",
        className: "monk",
        level: 2,
        description: "Speed increases when unarmored",
        type: "passive" as const,
        effects: [{
          type: "unarmored_movement",
          parameters: { 
            bonus: level >= 18 ? 30 : level >= 14 ? 25 : level >= 10 ? 20 : level >= 6 ? 15 : 10
          }
        }],
        source: "core" as const
      },
      {
        id: "deflect_missiles",
        name: "Deflect Missiles",
        className: "monk",
        level: 3,
        description: "Reduce ranged weapon damage, spend 1 ki to throw back",
        type: "reaction" as const,
        actionCost: "reaction" as const,
        effects: [{
          type: "deflect_missiles"
        }],
        source: "core" as const
      },
      {
        id: "slow_fall",
        name: "Slow Fall",
        className: "monk",
        level: 4,
        description: "Reduce falling damage by 5 × monk level",
        type: "reaction" as const,
        effects: [{
          type: "slow_fall",
          parameters: { reduction: level * 5 }
        }],
        source: "core" as const
      },
      {
        id: "stunning_strike",
        name: "Stunning Strike",
        className: "monk",
        level: 5,
        description: "Spend 1 ki to attempt to stun target",
        type: "active" as const,
        effects: [{
          type: "stunning_strike",
          parameters: { ki_cost: 1 }
        }],
        source: "core" as const
      },
      {
        id: "ki_empowered_strikes",
        name: "Ki-Empowered Strikes",
        className: "monk",
        level: 6,
        description: "Unarmed strikes count as magical",
        type: "passive" as const,
        effects: [{
          type: "ki_empowered_strikes"
        }],
        source: "core" as const
      },
      {
        id: "evasion",
        name: "Evasion",
        className: "monk",
        level: 7,
        description: "Take no damage on successful Dex save, half on failure",
        type: "passive" as const,
        effects: [{
          type: "evasion"
        }],
        source: "core" as const
      },
      {
        id: "stillness_of_mind",
        name: "Stillness of Mind",
        className: "monk",
        level: 7,
        description: "End charm or fear effect as action",
        type: "active" as const,
        actionCost: "action" as const,
        effects: [{
          type: "stillness_of_mind"
        }],
        source: "core" as const
      }
    ].filter(f => f.level <= level);
  }

  getSubclassFeatures(level: number, subclass: string): ClassFeature[] {
    if (subclass === "open_hand") {
      return [
        {
          id: "open_hand_technique",
          name: "Open Hand Technique",
          className: "monk",
          level: 3,
          description: "Flurry of Blows adds special effects",
          type: "passive" as const,
          effects: [{
            type: "open_hand_technique"
          }],
          subclass: "open_hand",
          source: "subclass" as const
        },
        {
          id: "wholeness_of_body",
          name: "Wholeness of Body",
          className: "monk",
          level: 6,
          description: "Heal yourself as action",
          type: "active" as const,
          actionCost: "action" as const,
          uses: {
            type: "per_long_rest" as const,
            amount: 1,
            current: 1,
            resetOn: "long_rest" as const,
          },
          effects: [{
            type: "wholeness_of_body",
            parameters: { healing: level * 3 }
          }],
          subclass: "open_hand",
          source: "subclass" as const
        },
        {
          id: "tranquility",
          name: "Tranquility",
          className: "monk",
          level: 11,
          description: "Cast sanctuary on self without spell slot",
          type: "active" as const,
          uses: {
            type: "per_long_rest" as const,
            amount: 1,
            current: 1,
            resetOn: "long_rest" as const,
          },
          effects: [{
            type: "tranquility"
          }],
          subclass: "open_hand",
          source: "subclass" as const
        },
        {
          id: "quivering_palm",
          name: "Quivering Palm",
          className: "monk",
          level: 17,
          description: "Spend 3 ki to set up devastating vibrations",
          type: "active" as const,
          effects: [{
            type: "quivering_palm",
            parameters: { ki_cost: 3 }
          }],
          subclass: "open_hand",
          source: "subclass" as const
        }
      ].filter(f => f.level <= level);
    }
    return [];
  }
}
