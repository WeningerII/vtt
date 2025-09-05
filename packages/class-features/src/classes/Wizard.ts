/**
 * Wizard Class Implementation - School of Evocation (SRD)
 */

import { BaseClass, ClassFeature } from './base/BaseClass';

export class WizardClass extends BaseClass {
  readonly className = "wizard";
  readonly hitDie = 6;
  readonly primaryAbility = ["intelligence"];
  readonly savingThrows = ["intelligence", "wisdom"];
  readonly skillChoices = ["arcana", "history", "insight", "investigation", "medicine", "religion"];
  readonly subclassName = "Arcane Tradition";
  readonly subclassLevel = 2;

  getCoreFeatures(level: number): ClassFeature[] {
    return [
      {
        id: "spellcasting",
        name: "Spellcasting",
        className: "wizard",
        level: 1,
        description: "Cast spells from spellbook",
        type: "passive" as const,
        effects: [{
          type: "spellcasting",
          parameters: { 
            ability: "intelligence",
            ritual_casting: true,
            spellbook: true
          }
        }],
        source: "core" as const
      },
      {
        id: "arcane_recovery",
        name: "Arcane Recovery",
        className: "wizard",
        level: 1,
        description: "Recover spell slots during short rest",
        type: "active" as const,
        uses: {
          type: "per_long_rest" as const,
          amount: 1,
          current: 1,
          resetOn: "long_rest" as const,
        },
        effects: [{
          type: "resource_gain",
          target: "self",
          value: Math.ceil(level / 2),
        }],
        source: "core" as const
      },
      {
        id: "spell_mastery",
        name: "Spell Mastery",
        className: "wizard",
        level: 18,
        description: "Cast certain 1st and 2nd level spells at will",
        type: "passive" as const,
        effects: [{
          type: "spell_mastery"
        }],
        source: "core" as const
      },
      {
        id: "signature_spells",
        name: "Signature Spells",
        className: "wizard",
        level: 20,
        description: "Two 3rd level spells always prepared",
        type: "passive" as const,
        effects: [{
          type: "signature_spells"
        }],
        source: "core" as const
      }
    ].filter(f => f.level <= level);
  }

  getSubclassFeatures(level: number, subclass: string): ClassFeature[] {
    if (subclass === "evocation") {
      return [
        {
          id: "evocation_savant",
          name: "Evocation Savant",
          className: "wizard",
          level: 2,
          description: "Copy evocation spells at half cost and time",
          type: "passive" as const,
          effects: [{
            type: "school_savant",
            parameters: { school: "evocation" }
          }],
          subclass: "evocation",
          source: "subclass" as const
        },
        {
          id: "sculpt_spells",
          name: "Sculpt Spells",
          className: "wizard",
          level: 2,
          description: "Protect allies from evocation spells",
          type: "passive" as const,
          effects: [{
            type: "sculpt_spells"
          }],
          subclass: "evocation",
          source: "subclass" as const
        },
        {
          id: "potent_cantrip",
          name: "Potent Cantrip",
          className: "wizard",
          level: 6,
          description: "Cantrips deal half damage on save",
          type: "passive" as const,
          effects: [{
            type: "potent_cantrip"
          }],
          subclass: "evocation",
          source: "subclass" as const
        },
        {
          id: "empowered_evocation",
          name: "Empowered Evocation",
          className: "wizard",
          level: 10,
          description: "Add Int modifier to evocation spell damage",
          type: "passive" as const,
          effects: [{
            type: "empowered_evocation",
            parameters: { bonus: this.getIntelligenceModifier() }
          }],
          subclass: "evocation",
          source: "subclass" as const
        },
        {
          id: "overchannel",
          name: "Overchannel",
          className: "wizard",
          level: 14,
          description: "Deal maximum damage with spells 5th level or lower",
          type: "active" as const,
          effects: [{
            type: "overchannel"
          }],
          subclass: "evocation",
          source: "subclass" as const
        }
      ].filter(f => f.level <= level);
    }
    return [];
  }

  private getIntelligenceModifier(): number {
    return 3; // placeholder
  }
}
