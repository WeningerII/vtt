/**
 * Bard Class Implementation - College of Lore (SRD)
 */

import { BaseClass, ClassFeature } from './base/BaseClass';

export class BardClass extends BaseClass {
  readonly className = "bard";
  readonly hitDie = 8;
  readonly primaryAbility = ["charisma"];
  readonly savingThrows = ["dexterity", "charisma"];
  readonly skillChoices = ["any"]; // Choose any 3
  readonly subclassName = "College";
  readonly subclassLevel = 3;

  getCoreFeatures(level: number): ClassFeature[] {
    return [
      {
        id: "bardic_inspiration",
        name: "Bardic Inspiration",
        className: "bard",
        level: 1,
        description: "Inspire allies with bonus action, d6 bonus die",
        type: "active" as const,
        actionCost: "bonus_action" as const,
        uses: {
          type: "per_short_rest" as const,
          amount: Math.max(1, this.getCharismaModifier()),
          current: Math.max(1, this.getCharismaModifier()),
          resetOn: "short_rest" as const,
        },
        effects: [{
          type: "bardic_inspiration",
          parameters: { die: level >= 15 ? "d12" : level >= 10 ? "d10" : level >= 5 ? "d8" : "d6" }
        }],
        source: "core" as const
      },
      {
        id: "jack_of_all_trades",
        name: "Jack of All Trades",
        className: "bard",
        level: 2,
        description: "Add half proficiency to non-proficient ability checks",
        type: "passive" as const,
        effects: [{
          type: "jack_of_all_trades",
          parameters: { bonus: Math.floor(this.getProficiencyBonus(level) / 2) }
        }],
        source: "core" as const
      },
      {
        id: "song_of_rest",
        name: "Song of Rest",
        className: "bard",
        level: 2,
        description: "Extra healing during short rest",
        type: "passive" as const,
        effects: [{
          type: "song_of_rest",
          parameters: { die: level >= 17 ? "d12" : level >= 13 ? "d10" : level >= 9 ? "d8" : "d6" }
        }],
        source: "core" as const
      },
      {
        id: "expertise",
        name: "Expertise",
        className: "bard",
        level: 3,
        description: "Double proficiency bonus on 2 skills",
        type: "passive" as const,
        effects: [{
          type: "expertise",
          parameters: { count: level >= 10 ? 4 : 2 }
        }],
        source: "core" as const
      },
      {
        id: "font_of_inspiration",
        name: "Font of Inspiration",
        className: "bard",
        level: 5,
        description: "Bardic Inspiration recharges on short rest",
        type: "passive" as const,
        effects: [{
          type: "font_of_inspiration"
        }],
        source: "core" as const
      },
      {
        id: "countercharm",
        name: "Countercharm",
        className: "bard",
        level: 6,
        description: "Grant advantage against charm and fear",
        type: "active" as const,
        actionCost: "action" as const,
        effects: [{
          type: "countercharm"
        }],
        source: "core" as const
      }
    ].filter(f => f.level <= level);
  }

  getSubclassFeatures(level: number, subclass: string): ClassFeature[] {
    if (subclass === "lore") {
      return [
        {
          id: "cutting_words",
          name: "Cutting Words",
          className: "bard",
          level: 3,
          description: "Use reaction to reduce enemy attack/ability check/damage",
          type: "reaction" as const,
          actionCost: "reaction" as const,
          uses: {
            type: "per_short_rest" as const,
            amount: Math.max(1, this.getCharismaModifier()),
            current: Math.max(1, this.getCharismaModifier()),
            resetOn: "short_rest" as const,
          },
          effects: [{
            type: "cutting_words",
            parameters: { die: level >= 15 ? "d12" : level >= 10 ? "d10" : level >= 5 ? "d8" : "d6" }
          }],
          subclass: "lore" as const,
          source: "subclass" as const
        },
        {
          id: "additional_magical_secrets",
          name: "Additional Magical Secrets",
          className: "bard",
          level: 6,
          description: "Learn 2 additional spells from any class",
          type: "passive" as const,
          effects: [{
            type: "additional_magical_secrets",
            parameters: { count: 2 }
          }],
          subclass: "lore" as const,
          source: "subclass" as const
        }
      ].filter(f => f.level <= level);
    }
    return [];
  }

  private getCharismaModifier(): number {
    // This would be calculated from character stats
    return 3; // placeholder
  }

  private getProficiencyBonus(level: number): number {
    return Math.ceil(level / 4) + 1;
  }
}
