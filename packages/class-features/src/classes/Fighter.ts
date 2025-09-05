/**
 * Fighter Class Implementation - Champion (SRD)
 */

import { BaseClass, ClassFeature } from './base/BaseClass';

export class FighterClass extends BaseClass {
  readonly className = "fighter";
  readonly hitDie = 10;
  readonly primaryAbility = ["strength", "dexterity"];
  readonly savingThrows = ["strength", "constitution"];
  readonly skillChoices = ["acrobatics", "animal_handling", "athletics", "history", "insight", "intimidation", "perception", "survival"];
  readonly subclassName = "Martial Archetype";
  readonly subclassLevel = 3;

  getCoreFeatures(level: number): ClassFeature[] {
    return [
      {
        id: "fighting_style",
        name: "Fighting Style",
        className: "fighter",
        level: 1,
        description: "Choose a fighting style",
        type: "passive" as const,
        effects: [{
          type: "fighting_style_choice"
        }],
        source: "core" as const
      },
      {
        id: "second_wind",
        name: "Second Wind",
        className: "fighter",
        level: 1,
        description: "Regain hit points as a bonus action",
        type: "active" as const,
        actionCost: "bonus_action" as const,
        uses: {
          type: "per_short_rest" as const,
          amount: 1,
          current: 1,
          resetOn: "short_rest" as const,
        },
        effects: [{
          type: "healing",
          target: "self",
          dice: "1d10+1", // Would scale with level
        }],
        source: "core" as const
      },
      {
        id: "action_surge",
        name: "Action Surge",
        className: "fighter",
        level: 2,
        description: "Take an additional action",
        type: "active" as const,
        actionCost: "free" as const,
        uses: {
          type: "per_short_rest" as const,
          amount: level >= 17 ? 2 : 1,
          current: level >= 17 ? 2 : 1,
          resetOn: "short_rest" as const,
        },
        effects: [{
          type: "custom",
          target: "self",
          custom: {
            handler: "fighter_action_surge",
            parameters: {} as Record<string, any>,
          },
        }],
        source: "core" as const
      },
      {
        id: "extra_attack",
        name: "Extra Attack",
        className: "fighter",
        level: 5,
        description: "Attack twice when taking Attack action",
        type: "passive" as const,
        effects: [{
          type: "extra_attack",
          parameters: { attacks: level >= 20 ? 4 : level >= 11 ? 3 : 2 }
        }],
        source: "core" as const
      },
      {
        id: "indomitable",
        name: "Indomitable",
        className: "fighter",
        level: 9,
        description: "Reroll a failed saving throw",
        type: "active" as const,
        uses: {
          type: "per_long_rest" as const,
          amount: level >= 17 ? 3 : level >= 13 ? 2 : 1,
          current: level >= 17 ? 3 : level >= 13 ? 2 : 1,
          resetOn: "long_rest" as const,
        },
        effects: [{
          type: "indomitable"
        }],
        source: "core" as const
      }
    ].filter(f => f.level <= level);
  }

  getSubclassFeatures(level: number, subclass: string): ClassFeature[] {
    if (subclass === "champion") {
      return [
        {
          id: "improved_critical",
          name: "Improved Critical",
          className: "fighter",
          level: 3,
          description: "Critical hit on 19-20",
          type: "passive" as const,
          effects: [{
            type: "improved_critical",
            parameters: { threshold: level >= 15 ? 18 : 19 }
          }],
          subclass: "champion",
          source: "subclass" as const
        },
        {
          id: "remarkable_athlete",
          name: "Remarkable Athlete",
          className: "fighter",
          level: 7,
          description: "Add half proficiency to non-proficient Str/Dex/Con checks",
          type: "passive" as const,
          effects: [{
            type: "remarkable_athlete"
          }],
          subclass: "champion",
          source: "subclass" as const
        },
        {
          id: "additional_fighting_style",
          name: "Additional Fighting Style",
          className: "fighter",
          level: 10,
          description: "Choose a second fighting style",
          type: "passive" as const,
          effects: [{
            type: "fighting_style_choice"
          }],
          subclass: "champion",
          source: "subclass" as const
        },
        {
          id: "survivor",
          name: "Survivor",
          className: "fighter",
          level: 18,
          description: "Regain HP at start of turn when bloodied",
          type: "passive" as const,
          effects: [{
            type: "survivor"
          }],
          subclass: "champion",
          source: "subclass" as const
        }
      ].filter(f => f.level <= level);
    }
    return [];
  }
}
