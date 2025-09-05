/**
 * Warlock Class Implementation - The Fiend (SRD)
 */

import { BaseClass, ClassFeature } from './base/BaseClass';

export class WarlockClass extends BaseClass {
  readonly className = "warlock";
  readonly hitDie = 8;
  readonly primaryAbility = ["charisma"];
  readonly savingThrows = ["wisdom", "charisma"];
  readonly skillChoices = ["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"];
  readonly subclassName = "Otherworldly Patron";
  readonly subclassLevel = 1;

  getCoreFeatures(level: number): ClassFeature[] {
    const spellSlots = level >= 17 ? 4 : level >= 11 ? 3 : level >= 2 ? 2 : 1;
    const slotLevel = level >= 17 ? 9 : level >= 15 ? 8 : level >= 13 ? 7 : level >= 11 ? 6 : level >= 9 ? 5 : level >= 7 ? 4 : level >= 5 ? 3 : level >= 3 ? 2 : 1;
    const invocationsKnown = level >= 18 ? 8 : level >= 15 ? 7 : level >= 12 ? 6 : level >= 9 ? 5 : level >= 7 ? 4 : level >= 5 ? 3 : level >= 2 ? 2 : 0;

    return [
      {
        id: "pact_magic",
        name: "Pact Magic",
        className: "warlock",
        level: 1,
        description: "Short rest spell slots, limited but high level",
        type: "passive" as const,
        uses: {
          type: "per_short_rest" as const,
          amount: spellSlots,
          current: spellSlots,
          resetOn: "short_rest" as const,
        },
        effects: [{
          type: "pact_magic",
          parameters: { 
            slots: spellSlots,
            slot_level: slotLevel
          }
        }],
        source: "core" as const
      },
      {
        id: "eldritch_invocations",
        name: "Eldritch Invocations",
        className: "warlock",
        level: 2,
        description: "Magical abilities granted by patron",
        type: "passive" as const,
        effects: [{
          type: "eldritch_invocations",
          parameters: { known: invocationsKnown }
        }],
        source: "core" as const
      },
      {
        id: "pact_boon",
        name: "Pact Boon",
        className: "warlock",
        level: 3,
        description: "Choose Blade, Chain, or Tome",
        type: "passive" as const,
        effects: [{
          type: "pact_boon_choice"
        }],
        source: "core" as const
      },
      {
        id: "mystic_arcanum_6",
        name: "Mystic Arcanum (6th level)",
        className: "warlock",
        level: 11,
        description: "Learn one 6th level spell, cast once per long rest",
        type: "passive" as const,
        uses: {
          type: "per_long_rest" as const,
          amount: 1,
          current: 1,
          resetOn: "long_rest" as const,
        },
        effects: [{
          type: "mystic_arcanum",
          parameters: { spell_level: 6 }
        }],
        source: "core" as const
      },
      {
        id: "mystic_arcanum_7",
        name: "Mystic Arcanum (7th level)",
        className: "warlock",
        level: 13,
        description: "Learn one 7th level spell, cast once per long rest",
        type: "passive" as const,
        uses: {
          type: "per_long_rest" as const,
          amount: 1,
          current: 1,
          resetOn: "long_rest" as const,
        },
        effects: [{
          type: "mystic_arcanum",
          parameters: { spell_level: 7 }
        }],
        source: "core" as const
      },
      {
        id: "mystic_arcanum_8",
        name: "Mystic Arcanum (8th level)",
        className: "warlock",
        level: 15,
        description: "Learn one 8th level spell, cast once per long rest",
        type: "passive" as const,
        uses: {
          type: "per_long_rest" as const,
          amount: 1,
          current: 1,
          resetOn: "long_rest" as const,
        },
        effects: [{
          type: "mystic_arcanum",
          parameters: { spell_level: 8 }
        }],
        source: "core" as const
      },
      {
        id: "mystic_arcanum_9",
        name: "Mystic Arcanum (9th level)",
        className: "warlock",
        level: 17,
        description: "Learn one 9th level spell, cast once per long rest",
        type: "passive" as const,
        uses: {
          type: "per_long_rest" as const,
          amount: 1,
          current: 1,
          resetOn: "long_rest" as const,
        },
        effects: [{
          type: "mystic_arcanum",
          parameters: { spell_level: 9 }
        }],
        source: "core" as const
      },
      {
        id: "eldritch_master",
        name: "Eldritch Master",
        className: "warlock",
        level: 20,
        description: "Regain all spell slots on short rest once per long rest",
        type: "active" as const,
        uses: {
          type: "per_long_rest" as const,
          amount: 1,
          current: 1,
          resetOn: "long_rest" as const,
        },
        effects: [{
          type: "eldritch_master"
        }],
        source: "core" as const
      }
    ].filter(f => f.level <= level);
  }

  getSubclassFeatures(level: number, subclass: string): ClassFeature[] {
    if (subclass === "fiend") {
      return [
        {
          id: "dark_ones_blessing",
          name: "Dark One's Blessing",
          className: "warlock",
          level: 1,
          description: "Gain temp HP when you reduce hostile to 0 HP",
          type: "triggered" as const,
          triggers: [{
            event: "enemy_reduced_to_zero",
            condition: "hostile_creature"
          }],
          effects: [{
            type: "dark_ones_blessing",
            parameters: { temp_hp: this.getCharismaModifier() + level }
          }],
          subclass: "fiend",
          source: "subclass" as const
        },
        {
          id: "dark_ones_own_luck",
          name: "Dark One's Own Luck",
          className: "warlock",
          level: 6,
          description: "Add d10 to ability check or saving throw",
          type: "active" as const,
          uses: {
            type: "per_short_rest" as const,
            amount: 1,
            current: 1,
            resetOn: "short_rest" as const,
          },
          effects: [{
            type: "dark_ones_own_luck"
          }],
          subclass: "fiend",
          source: "subclass" as const
        },
        {
          id: "fiendish_resilience",
          name: "Fiendish Resilience",
          className: "warlock",
          level: 10,
          description: "Choose damage type for resistance after short/long rest",
          type: "passive" as const,
          effects: [{
            type: "fiendish_resilience"
          }],
          subclass: "fiend",
          source: "subclass" as const
        },
        {
          id: "hurl_through_hell",
          name: "Hurl Through Hell",
          className: "warlock",
          level: 14,
          description: "Banish target to hell when you hit with attack",
          type: "active" as const,
          uses: {
            type: "per_long_rest" as const,
            amount: 1,
            current: 1,
            resetOn: "long_rest" as const,
          },
          effects: [{
            type: "hurl_through_hell"
          }],
          subclass: "fiend",
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
