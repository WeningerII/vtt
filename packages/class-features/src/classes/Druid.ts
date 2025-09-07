/**
 * Druid Class Implementation - Circle of the Land (SRD)
 */

import { BaseClass, ClassFeature } from './base/BaseClass';

export class DruidClass extends BaseClass {
  readonly className = "druid";
  readonly hitDie = 8;
  readonly primaryAbility = ["wisdom"];
  readonly savingThrows = ["intelligence", "wisdom"];
  readonly skillChoices = ["arcana", "animal_handling", "insight", "medicine", "nature", "perception", "religion", "survival"];
  readonly subclassName = "Circle";
  readonly subclassLevel = 2;

  getCoreFeatures(level: number): ClassFeature[] {
    return [
      {
        id: "druidcraft",
        name: "Druidcraft",
        className: "druid",
        level: 1,
        description: "Minor nature magic cantrip",
        type: "active" as const,
        actionCost: "action" as const,
        effects: [{
          type: "cantrip",
          parameters: { spell: "druidcraft" }
        }],
        source: "core" as const
      },
      {
        id: "wild_shape",
        name: "Wild Shape",
        className: "druid",
        level: 2,
        description: "Transform into beast forms",
        type: "active" as const,
        actionCost: "action" as const,
        uses: {
          type: "per_short_rest" as const,
          amount: level >= 20 ? 999 : 2,
          current: level >= 20 ? 999 : 2,
          resetOn: "short_rest" as const,
        },
        effects: [{
          type: "wild_shape",
          parameters: { 
            max_cr: level >= 8 ? 1 : level >= 4 ? 0.5 : 0.25,
            swimming: level >= 4,
            flying: level >= 8
          }
        }],
        source: "core" as const
      },
      {
        id: "timeless_body",
        name: "Timeless Body",
        className: "druid",
        level: 18,
        description: "Age at 1/10 rate, no aging penalties",
        type: "passive" as const,
        effects: [{
          type: "timeless_body"
        }],
        source: "core" as const
      },
      {
        id: "beast_spells",
        name: "Beast Spells",
        className: "druid",
        level: 18,
        description: "Cast spells in Wild Shape",
        type: "passive" as const,
        effects: [{
          type: "beast_spells"
        }],
        source: "core" as const
      },
      {
        id: "archdruid",
        name: "Archdruid",
        className: "druid",
        level: 20,
        description: "Unlimited Wild Shape uses",
        type: "passive" as const,
        effects: [{
          type: "archdruid"
        }],
        source: "core" as const
      }
    ].filter(f => f.level <= level);
  }

  getSubclassFeatures(level: number, subclass: string): ClassFeature[] {
    if (subclass === "land") {
      return [
        {
          id: "bonus_cantrip",
          name: "Bonus Cantrip",
          className: "druid",
          level: 2,
          description: "Learn one additional druid cantrip",
          type: "passive" as const,
          effects: [{
            type: "bonus_cantrip",
            parameters: { count: 1 }
          }],
          subclass: "land",
          source: "subclass" as const
        },
        {
          id: "natural_recovery",
          name: "Natural Recovery",
          className: "druid",
          level: 2,
          description: "Recover spell slots during short rest",
          type: "active" as const,
          uses: {
            type: "per_long_rest" as const,
            amount: 1,
            current: 1,
            resetOn: "long_rest" as const,
          },
          effects: [{
            type: "natural_recovery",
            parameters: { total_levels: Math.ceil(level / 2) }
          }],
          subclass: "land",
          source: "subclass" as const
        },
        {
          id: "circle_spells",
          name: "Circle Spells",
          className: "druid",
          level: 3,
          description: "Additional spells based on chosen land",
          type: "passive" as const,
          effects: [{
            type: "circle_spells",
            parameters: { land_type: "forest" } // Default to forest
          }],
          subclass: "land",
          source: "subclass" as const
        },
        {
          id: "lands_stride",
          name: "Land's Stride",
          className: "druid",
          level: 6,
          description: "Move through difficult terrain and plants",
          type: "passive" as const,
          effects: [{
            type: "lands_stride"
          }],
          subclass: "land",
          source: "subclass" as const
        },
        {
          id: "natures_ward",
          name: "Nature's Ward",
          className: "druid",
          level: 10,
          description: "Immunity to charm/fear from elementals/fey",
          type: "passive" as const,
          effects: [{
            type: "natures_ward"
          }],
          subclass: "land",
          source: "subclass" as const
        },
        {
          id: "natures_sanctuary",
          name: "Nature's Sanctuary",
          className: "druid",
          level: 14,
          description: "Beasts and plants must save to attack you",
          type: "passive" as const,
          effects: [{
            type: "natures_sanctuary"
          }],
          subclass: "land",
          source: "subclass" as const
        }
      ].filter(f => f.level <= level);
    }
    return [];
  }
}
