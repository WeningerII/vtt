/**
 * Rogue Class Implementation - Thief (SRD)
 */

import { BaseClass, ClassFeature } from './base/BaseClass';

export class RogueClass extends BaseClass {
  readonly className = "rogue";
  readonly hitDie = 8;
  readonly primaryAbility = ["dexterity"];
  readonly savingThrows = ["dexterity", "intelligence"];
  readonly skillChoices = ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "performance", "persuasion", "sleight_of_hand", "stealth"];
  readonly subclassName = "Roguish Archetype";
  readonly subclassLevel = 3;

  getCoreFeatures(level: number): ClassFeature[] {
    const sneakAttackDice = Math.ceil(level / 2);
    
    return [
      {
        id: "expertise",
        name: "Expertise",
        className: "rogue",
        level: 1,
        description: "Double proficiency bonus on chosen skills",
        type: "passive" as const,
        effects: [{
          type: "expertise",
          parameters: { 
            skills: level >= 6 ? 4 : 2,
            additional_at_level: 6
          }
        }],
        source: "core" as const
      },
      {
        id: "sneak_attack",
        name: "Sneak Attack",
        className: "rogue",
        level: 1,
        description: "Deal extra damage when you have advantage",
        type: "triggered" as const,
        triggers: [{
          event: "attack_hit",
          condition: "has_advantage",
        }],
        effects: [{
          type: "custom",
          target: "enemy",
          custom: {
            handler: "rogue_sneak_attack",
            parameters: { 
              level,
              dice: `${sneakAttackDice}d6`
            },
          },
        }],
        source: "core" as const
      },
      {
        id: "thieves_cant",
        name: "Thieves' Cant",
        className: "rogue",
        level: 1,
        description: "Secret language of rogues",
        type: "passive" as const,
        effects: [{
          type: "language",
          parameters: { language: "thieves_cant" }
        }],
        source: "core" as const
      },
      {
        id: "cunning_action",
        name: "Cunning Action",
        className: "rogue",
        level: 2,
        description: "Dash, Disengage, or Hide as bonus action",
        type: "active" as const,
        actionCost: "bonus_action" as const,
        effects: [{
          type: "cunning_action"
        }],
        source: "core" as const
      },
      {
        id: "uncanny_dodge",
        name: "Uncanny Dodge",
        className: "rogue",
        level: 5,
        description: "Halve damage from one attack per turn",
        type: "reaction" as const,
        actionCost: "reaction" as const,
        effects: [{
          type: "uncanny_dodge"
        }],
        source: "core" as const
      },
      {
        id: "evasion",
        name: "Evasion",
        className: "rogue",
        level: 7,
        description: "Take no damage on successful Dex save, half on failure",
        type: "passive" as const,
        effects: [{
          type: "evasion"
        }],
        source: "core" as const
      },
      {
        id: "reliable_talent",
        name: "Reliable Talent",
        className: "rogue",
        level: 11,
        description: "Treat d20 rolls of 9 or lower as 10 for proficient abilities",
        type: "passive" as const,
        effects: [{
          type: "reliable_talent"
        }],
        source: "core" as const
      },
      {
        id: "blindsense",
        name: "Blindsense",
        className: "rogue",
        level: 14,
        description: "Detect hidden creatures within 10 feet",
        type: "passive" as const,
        effects: [{
          type: "blindsense",
          parameters: { range: 10 }
        }],
        source: "core" as const
      },
      {
        id: "slippery_mind",
        name: "Slippery Mind",
        className: "rogue",
        level: 15,
        description: "Proficiency in Wisdom saving throws",
        type: "passive" as const,
        effects: [{
          type: "save_proficiency",
          parameters: { save: "wisdom" }
        }],
        source: "core" as const
      },
      {
        id: "elusive",
        name: "Elusive",
        className: "rogue",
        level: 18,
        description: "No attack has advantage against you while conscious",
        type: "passive" as const,
        effects: [{
          type: "elusive"
        }],
        source: "core" as const
      },
      {
        id: "stroke_of_luck",
        name: "Stroke of Luck",
        className: "rogue",
        level: 20,
        description: "Turn a miss into a hit or failed check into success",
        type: "active" as const,
        uses: {
          type: "per_short_rest" as const,
          amount: 1,
          current: 1,
          resetOn: "short_rest" as const,
        },
        effects: [{
          type: "stroke_of_luck"
        }],
        source: "core" as const
      }
    ].filter(f => f.level <= level);
  }

  getSubclassFeatures(level: number, subclass: string): ClassFeature[] {
    if (subclass === "thief") {
      return [
        {
          id: "fast_hands",
          name: "Fast Hands",
          className: "rogue",
          level: 3,
          description: "Use objects and thieves' tools as bonus action",
          type: "passive" as const,
          effects: [{
            type: "fast_hands"
          }],
          subclass: "thief",
          source: "subclass" as const
        },
        {
          id: "second_story_work",
          name: "Second-Story Work",
          className: "rogue",
          level: 3,
          description: "Climbing doesn't cost extra movement, jump distance increased",
          type: "passive" as const,
          effects: [{
            type: "second_story_work"
          }],
          subclass: "thief",
          source: "subclass" as const
        },
        {
          id: "supreme_sneak",
          name: "Supreme Sneak",
          className: "rogue",
          level: 9,
          description: "Advantage on Stealth if you move no more than half speed",
          type: "passive" as const,
          effects: [{
            type: "supreme_sneak"
          }],
          subclass: "thief",
          source: "subclass" as const
        },
        {
          id: "use_magic_device",
          name: "Use Magic Device",
          className: "rogue",
          level: 13,
          description: "Ignore class/race/level requirements for magic items",
          type: "passive" as const,
          effects: [{
            type: "use_magic_device"
          }],
          subclass: "thief",
          source: "subclass" as const
        },
        {
          id: "thiefs_reflexes",
          name: "Thief's Reflexes",
          className: "rogue",
          level: 17,
          description: "Take two turns in first round of combat",
          type: "passive" as const,
          effects: [{
            type: "thiefs_reflexes"
          }],
          subclass: "thief",
          source: "subclass" as const
        }
      ].filter(f => f.level <= level);
    }
    return [];
  }
}
