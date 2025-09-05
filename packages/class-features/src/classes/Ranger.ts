/**
 * Ranger Class Implementation - Hunter (SRD)
 */

import { BaseClass, ClassFeature } from './base/BaseClass';

export class RangerClass extends BaseClass {
  readonly className = "ranger";
  readonly hitDie = 10;
  readonly primaryAbility = ["dexterity", "wisdom"];
  readonly savingThrows = ["strength", "dexterity"];
  readonly skillChoices = ["animal_handling", "athletics", "insight", "investigation", "nature", "perception", "stealth", "survival"];
  readonly subclassName = "Ranger Archetype";
  readonly subclassLevel = 3;

  getCoreFeatures(level: number): ClassFeature[] {
    return [
      {
        id: "favored_enemy",
        name: "Favored Enemy",
        className: "ranger",
        level: 1,
        description: "Choose creature types for combat and tracking bonuses",
        type: "passive" as const,
        effects: [{
          type: "favored_enemy",
          parameters: { types: level >= 14 ? 3 : level >= 6 ? 2 : 1 }
        }],
        source: "core" as const
      },
      {
        id: "natural_explorer",
        name: "Natural Explorer",
        className: "ranger",
        level: 1,
        description: "Choose favored terrain for exploration bonuses",
        type: "passive" as const,
        effects: [{
          type: "natural_explorer",
          parameters: { terrains: level >= 10 ? 3 : level >= 6 ? 2 : 1 }
        }],
        source: "core" as const
      },
      {
        id: "fighting_style",
        name: "Fighting Style",
        className: "ranger",
        level: 2,
        description: "Choose a fighting style",
        type: "passive" as const,
        effects: [{
          type: "fighting_style_choice"
        }],
        source: "core" as const
      },
      {
        id: "primeval_awareness",
        name: "Primeval Awareness",
        className: "ranger",
        level: 3,
        description: "Sense favored enemies within 1 mile",
        type: "active" as const,
        effects: [{
          type: "primeval_awareness"
        }],
        source: "core" as const
      },
      {
        id: "extra_attack",
        name: "Extra Attack",
        className: "ranger",
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
        id: "lands_stride",
        name: "Land's Stride",
        className: "ranger",
        level: 8,
        description: "Move through difficult terrain and plants",
        type: "passive" as const,
        effects: [{
          type: "lands_stride"
        }],
        source: "core" as const
      },
      {
        id: "hide_in_plain_sight",
        name: "Hide in Plain Sight",
        className: "ranger",
        level: 10,
        description: "Camouflage yourself for stealth bonus",
        type: "active" as const,
        effects: [{
          type: "hide_in_plain_sight"
        }],
        source: "core" as const
      },
      {
        id: "vanish",
        name: "Vanish",
        className: "ranger",
        level: 14,
        description: "Hide as bonus action, can't be tracked",
        type: "active" as const,
        actionCost: "bonus_action" as const,
        effects: [{
          type: "vanish"
        }],
        source: "core" as const
      },
      {
        id: "feral_senses",
        name: "Feral Senses",
        className: "ranger",
        level: 18,
        description: "Fight invisible creatures without disadvantage",
        type: "passive" as const,
        effects: [{
          type: "feral_senses"
        }],
        source: "core" as const
      },
      {
        id: "foe_slayer",
        name: "Foe Slayer",
        className: "ranger",
        level: 20,
        description: "Add Wisdom modifier to attack or damage vs favored enemy",
        type: "passive" as const,
        effects: [{
          type: "foe_slayer"
        }],
        source: "core" as const
      }
    ].filter(f => f.level <= level);
  }

  getSubclassFeatures(level: number, subclass: string): ClassFeature[] {
    if (subclass === "hunter") {
      return [
        {
          id: "hunters_prey",
          name: "Hunter's Prey",
          className: "ranger",
          level: 3,
          description: "Choose special combat technique vs single targets",
          type: "passive" as const,
          effects: [{
            type: "hunters_prey"
          }],
          subclass: "hunter",
          source: "subclass" as const
        },
        {
          id: "defensive_tactics",
          name: "Defensive Tactics",
          className: "ranger",
          level: 7,
          description: "Choose defensive ability",
          type: "passive" as const,
          effects: [{
            type: "defensive_tactics"
          }],
          subclass: "hunter",
          source: "subclass" as const
        },
        {
          id: "multiattack",
          name: "Multiattack",
          className: "ranger",
          level: 11,
          description: "Choose enhanced attack pattern",
          type: "passive" as const,
          effects: [{
            type: "ranger_multiattack"
          }],
          subclass: "hunter",
          source: "subclass" as const
        },
        {
          id: "superior_hunters_defense",
          name: "Superior Hunter's Defense",
          className: "ranger",
          level: 15,
          description: "Choose superior defensive ability",
          type: "passive" as const,
          effects: [{
            type: "superior_hunters_defense"
          }],
          subclass: "hunter",
          source: "subclass" as const
        }
      ].filter(f => f.level <= level);
    }
    return [];
  }
}
