/**
 * Paladin Class Implementation - Oath of Devotion (SRD)
 */

import { BaseClass, ClassFeature } from './base/BaseClass';

export class PaladinClass extends BaseClass {
  readonly className = "paladin";
  readonly hitDie = 10;
  readonly primaryAbility = ["strength", "charisma"];
  readonly savingThrows = ["wisdom", "charisma"];
  readonly skillChoices = ["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"];
  readonly subclassName = "Sacred Oath";
  readonly subclassLevel = 3;

  getCoreFeatures(level: number): ClassFeature[] {
    return [
      {
        id: "divine_sense",
        name: "Divine Sense",
        className: "paladin",
        level: 1,
        description: "Detect celestials, fiends, and undead",
        type: "active" as const,
        actionCost: "action" as const,
        uses: {
          type: "per_long_rest" as const,
          amount: 1 + Math.max(0, this.getCharismaModifier()),
          current: 1 + Math.max(0, this.getCharismaModifier()),
          resetOn: "long_rest" as const,
        },
        effects: [{
          type: "divine_sense"
        }],
        source: "core" as const
      },
      {
        id: "lay_on_hands",
        name: "Lay on Hands",
        className: "paladin",
        level: 1,
        description: "Heal with touch or cure disease/poison",
        type: "active" as const,
        actionCost: "action" as const,
        uses: {
          type: "per_long_rest" as const,
          amount: level * 5,
          current: level * 5,
          resetOn: "long_rest" as const,
        },
        effects: [{
          type: "lay_on_hands",
          parameters: { pool: level * 5 }
        }],
        source: "core" as const
      },
      {
        id: "fighting_style",
        name: "Fighting Style",
        className: "paladin",
        level: 2,
        description: "Choose a fighting style",
        type: "passive" as const,
        effects: [{
          type: "fighting_style_choice"
        }],
        source: "core" as const
      },
      {
        id: "divine_smite",
        name: "Divine Smite",
        className: "paladin",
        level: 2,
        description: "Expend spell slot for extra radiant damage",
        type: "active" as const,
        effects: [{
          type: "divine_smite"
        }],
        source: "core" as const
      },
      {
        id: "divine_health",
        name: "Divine Health",
        className: "paladin",
        level: 3,
        description: "Immunity to disease",
        type: "passive" as const,
        effects: [{
          type: "divine_health"
        }],
        source: "core" as const
      },
      {
        id: "extra_attack",
        name: "Extra Attack",
        className: "paladin",
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
        id: "aura_of_protection",
        name: "Aura of Protection",
        className: "paladin",
        level: 6,
        description: "Add Charisma modifier to saving throws within 10 feet",
        type: "passive" as const,
        effects: [{
          type: "aura_of_protection",
          parameters: { 
            radius: level >= 18 ? 30 : 10,
            bonus: this.getCharismaModifier()
          }
        }],
        source: "core" as const
      },
      {
        id: "aura_of_courage",
        name: "Aura of Courage",
        className: "paladin",
        level: 10,
        description: "Immunity to fear, allies within 10 feet can't be frightened",
        type: "passive" as const,
        effects: [{
          type: "aura_of_courage",
          parameters: { radius: level >= 18 ? 30 : 10 }
        }],
        source: "core" as const
      },
      {
        id: "improved_divine_smite",
        name: "Improved Divine Smite",
        className: "paladin",
        level: 11,
        description: "All melee weapon hits deal extra 1d8 radiant damage",
        type: "passive" as const,
        effects: [{
          type: "improved_divine_smite"
        }],
        source: "core" as const
      },
      {
        id: "cleansing_touch",
        name: "Cleansing Touch",
        className: "paladin",
        level: 14,
        description: "End one spell on self or willing creature",
        type: "active" as const,
        actionCost: "action" as const,
        uses: {
          type: "per_long_rest" as const,
          amount: this.getCharismaModifier(),
          current: this.getCharismaModifier(),
          resetOn: "long_rest" as const,
        },
        effects: [{
          type: "cleansing_touch"
        }],
        source: "core" as const
      }
    ].filter(f => f.level <= level);
  }

  getSubclassFeatures(level: number, subclass: string): ClassFeature[] {
    if (subclass === "devotion") {
      return [
        {
          id: "sacred_weapon",
          name: "Sacred Weapon",
          className: "paladin",
          level: 3,
          description: "Channel Divinity: weapon becomes magical, sheds light",
          type: "active" as const,
          actionCost: "action" as const,
          effects: [{
            type: "sacred_weapon"
          }],
          subclass: "devotion",
          source: "subclass" as const
        },
        {
          id: "turn_the_unholy",
          name: "Turn the Unholy",
          className: "paladin",
          level: 3,
          description: "Channel Divinity: turn fiends and undead",
          type: "active" as const,
          actionCost: "action" as const,
          effects: [{
            type: "turn_the_unholy"
          }],
          subclass: "devotion",
          source: "subclass" as const
        },
        {
          id: "aura_of_devotion",
          name: "Aura of Devotion",
          className: "paladin",
          level: 7,
          description: "Immunity to charm within aura",
          type: "passive" as const,
          effects: [{
            type: "aura_of_devotion",
            parameters: { radius: level >= 18 ? 30 : 10 }
          }],
          subclass: "devotion",
          source: "subclass" as const
        },
        {
          id: "purity_of_spirit",
          name: "Purity of Spirit",
          className: "paladin",
          level: 15,
          description: "Always under protection from evil and good",
          type: "passive" as const,
          effects: [{
            type: "purity_of_spirit"
          }],
          subclass: "devotion",
          source: "subclass" as const
        },
        {
          id: "holy_nimbus",
          name: "Holy Nimbus",
          className: "paladin",
          level: 20,
          description: "Transform into avatar of divine power",
          type: "active" as const,
          actionCost: "action" as const,
          uses: {
            type: "per_long_rest" as const,
            amount: 1,
            current: 1,
            resetOn: "long_rest" as const,
          },
          effects: [{
            type: "holy_nimbus"
          }],
          subclass: "devotion",
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
