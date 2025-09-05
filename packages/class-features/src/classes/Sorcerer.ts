/**
 * Sorcerer Class Implementation - Draconic Bloodline (SRD)
 */

import { BaseClass, ClassFeature } from './base/BaseClass';

export class SorcererClass extends BaseClass {
  readonly className = "sorcerer";
  readonly hitDie = 6;
  readonly primaryAbility = ["charisma"];
  readonly savingThrows = ["constitution", "charisma"];
  readonly skillChoices = ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"];
  readonly subclassName = "Sorcerous Origin";
  readonly subclassLevel = 1;

  getCoreFeatures(level: number): ClassFeature[] {
    const sorceryPoints = level >= 2 ? level : 0;
    const metamagicOptions = level >= 17 ? 4 : level >= 10 ? 3 : level >= 3 ? 2 : 0;

    return [
      {
        id: "sorcery_points",
        name: "Sorcery Points",
        className: "sorcerer",
        level: 2,
        description: "Fuel metamagic and create spell slots",
        type: "passive" as const,
        uses: {
          type: "per_short_rest" as const,
          amount: sorceryPoints,
          current: sorceryPoints,
          resetOn: "long_rest" as const,
        },
        effects: [{
          type: "sorcery_points",
          parameters: { points: sorceryPoints }
        }],
        source: "core" as const
      },
      {
        id: "font_of_magic",
        name: "Font of Magic",
        className: "sorcerer",
        level: 2,
        description: "Convert sorcery points to spell slots and vice versa",
        type: "active" as const,
        actionCost: "bonus_action" as const,
        effects: [{
          type: "font_of_magic"
        }],
        source: "core" as const
      },
      {
        id: "metamagic",
        name: "Metamagic",
        className: "sorcerer",
        level: 3,
        description: "Modify spells with sorcery points",
        type: "passive" as const,
        effects: [{
          type: "metamagic",
          parameters: { options: metamagicOptions }
        }],
        source: "core" as const
      },
      {
        id: "sorcerous_restoration",
        name: "Sorcerous Restoration",
        className: "sorcerer",
        level: 20,
        description: "Regain 4 sorcery points on short rest when you have 0",
        type: "passive" as const,
        effects: [{
          type: "sorcerous_restoration"
        }],
        source: "core" as const
      }
    ].filter(f => f.level <= level);
  }

  getSubclassFeatures(level: number, subclass: string): ClassFeature[] {
    if (subclass === "draconic") {
      return [
        {
          id: "dragon_ancestor",
          name: "Dragon Ancestor",
          className: "sorcerer",
          level: 1,
          description: "Choose dragon type, learn Draconic, double proficiency with Charisma checks vs dragons",
          type: "passive" as const,
          effects: [{
            type: "dragon_ancestor"
          }],
          subclass: "draconic",
          source: "subclass" as const
        },
        {
          id: "draconic_resilience",
          name: "Draconic Resilience",
          className: "sorcerer",
          level: 1,
          description: "Extra hit points, natural armor when unarmored",
          type: "passive" as const,
          effects: [{
            type: "draconic_resilience",
            parameters: { hp_bonus: level }
          }],
          subclass: "draconic",
          source: "subclass" as const
        },
        {
          id: "elemental_affinity",
          name: "Elemental Affinity",
          className: "sorcerer",
          level: 6,
          description: "Add Charisma modifier to dragon damage type spells, resist that damage",
          type: "passive" as const,
          effects: [{
            type: "elemental_affinity",
            parameters: { bonus: this.getCharismaModifier() }
          }],
          subclass: "draconic",
          source: "subclass" as const
        },
        {
          id: "dragon_wings",
          name: "Dragon Wings",
          className: "sorcerer",
          level: 14,
          description: "Manifest dragon wings for flight",
          type: "active" as const,
          actionCost: "bonus_action" as const,
          effects: [{
            type: "dragon_wings",
            parameters: { speed: 60 }
          }],
          subclass: "draconic",
          source: "subclass" as const
        },
        {
          id: "draconic_presence",
          name: "Draconic Presence",
          className: "sorcerer",
          level: 18,
          description: "Emanate draconic aura to charm or frighten",
          type: "active" as const,
          actionCost: "action" as const,
          uses: {
            type: "per_short_rest" as const,
            amount: 1,
            current: 1,
            resetOn: "long_rest" as const,
          },
          effects: [{
            type: "draconic_presence"
          }],
          subclass: "draconic",
          source: "subclass" as const
        }
      ].filter(f => f.level <= level);
    }
    return [];
  }

  private getCharismaModifier(): number {
    return 3; // placeholder
  }
}
