/**
 * D&D 5e Spellcasting Classes and Level Integration
 * Defines spell progression, available spells, and casting mechanics for each class
 */
export interface SpellSlotProgression {
  [level: number]: {
    1?: number;
    2?: number;
    3?: number;
    4?: number;
    5?: number;
    6?: number;
    7?: number;
    8?: number;
    9?: number;
  };
}
export interface ClassSpellcasting {
  spellcastingAbility: "INT" | "WIS" | "CHA";
  spellsKnownProgression?: number[];
  cantripsKnownProgression: number[];
  slotProgression: SpellSlotProgression;
  spellPreparation: "prepared" | "known" | "all";
  ritualCasting: boolean;
  spellcastingFocus: boolean;
  firstSpellcastingLevel: number;
}
export declare const SPELLCASTING_CLASSES: Record<string, ClassSpellcasting>;
export declare function getSpellSlotsForClass(
  _className: string,
  _level: number,
): Record<number, number>;
export declare function getCantripsKnown(_className: string, _level: number): number;
export declare function getSpellsKnown(_className: string, _level: number): number;
export declare function getMaxSpellLevel(_className: string, _level: number): number;
export declare function getSpellcastingModifier(_className: string): "INT" | "WIS" | "CHA" | null;
//# sourceMappingURL=SpellcastingClasses.d.ts.map
