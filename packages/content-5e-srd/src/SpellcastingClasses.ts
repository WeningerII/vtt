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

export const SPELLCASTING_CLASSES: Record<string, ClassSpellcasting> = {
  Bard: {
    spellcastingAbility: "CHA",
    spellsKnownProgression: [
      0, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 20, 22, 22, 22, 22,
    ],
    cantripsKnownProgression: [0, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
    slotProgression: {
      1: { 1: 2 },
      2: { 1: 3 },
      3: { 1: 4, 2: 2 },
      4: { 1: 4, 2: 3 },
      5: { 1: 4, 2: 3, 3: 2 },
      6: { 1: 4, 2: 3, 3: 3 },
      7: { 1: 4, 2: 3, 3: 3, 4: 1 },
      8: { 1: 4, 2: 3, 3: 3, 4: 2 },
      9: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
      10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
      11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
      12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
      13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
      14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
      15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
      16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
      17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
      18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
      19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
      20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 },
    },
    spellPreparation: "known",
    ritualCasting: true,
    spellcastingFocus: true,
    firstSpellcastingLevel: 1,
  },

  Cleric: {
    spellcastingAbility: "WIS",
    cantripsKnownProgression: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    slotProgression: {
      1: { 1: 2 },
      2: { 1: 3 },
      3: { 1: 4, 2: 2 },
      4: { 1: 4, 2: 3 },
      5: { 1: 4, 2: 3, 3: 2 },
      6: { 1: 4, 2: 3, 3: 3 },
      7: { 1: 4, 2: 3, 3: 3, 4: 1 },
      8: { 1: 4, 2: 3, 3: 3, 4: 2 },
      9: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
      10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
      11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
      12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
      13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
      14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
      15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
      16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
      17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
      18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
      19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
      20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 },
    },
    spellPreparation: "prepared",
    ritualCasting: true,
    spellcastingFocus: true,
    firstSpellcastingLevel: 1,
  },

  Druid: {
    spellcastingAbility: "WIS",
    cantripsKnownProgression: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
    slotProgression: {
      1: { 1: 2 },
      2: { 1: 3 },
      3: { 1: 4, 2: 2 },
      4: { 1: 4, 2: 3 },
      5: { 1: 4, 2: 3, 3: 2 },
      6: { 1: 4, 2: 3, 3: 3 },
      7: { 1: 4, 2: 3, 3: 3, 4: 1 },
      8: { 1: 4, 2: 3, 3: 3, 4: 2 },
      9: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
      10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
      11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
      12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
      13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
      14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
      15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
      16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
      17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
      18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
      19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
      20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 },
    },
    spellPreparation: "prepared",
    ritualCasting: true,
    spellcastingFocus: true,
    firstSpellcastingLevel: 1,
  },

  Sorcerer: {
    spellcastingAbility: "CHA",
    spellsKnownProgression: [
      0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15,
    ],
    cantripsKnownProgression: [0, 4, 4, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
    slotProgression: {
      1: { 1: 2 },
      2: { 1: 3 },
      3: { 1: 4, 2: 2 },
      4: { 1: 4, 2: 3 },
      5: { 1: 4, 2: 3, 3: 2 },
      6: { 1: 4, 2: 3, 3: 3 },
      7: { 1: 4, 2: 3, 3: 3, 4: 1 },
      8: { 1: 4, 2: 3, 3: 3, 4: 2 },
      9: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
      10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
      11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
      12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
      13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
      14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
      15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
      16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
      17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
      18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
      19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
      20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 },
    },
    spellPreparation: "known",
    ritualCasting: false,
    spellcastingFocus: true,
    firstSpellcastingLevel: 1,
  },

  Warlock: {
    spellcastingAbility: "CHA",
    spellsKnownProgression: [
      0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15,
    ],
    cantripsKnownProgression: [0, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
    slotProgression: {
      1: { 1: 1 },
      2: { 1: 2 },
      3: { 2: 2 },
      4: { 2: 2 },
      5: { 3: 2 },
      6: { 3: 2 },
      7: { 4: 2 },
      8: { 4: 2 },
      9: { 5: 2 },
      10: { 5: 2 },
      11: { 5: 3 },
      12: { 5: 3 },
      13: { 5: 3 },
      14: { 5: 3 },
      15: { 5: 3 },
      16: { 5: 3 },
      17: { 5: 4 },
      18: { 5: 4 },
      19: { 5: 4 },
      20: { 5: 4 },
    },
    spellPreparation: "known",
    ritualCasting: false,
    spellcastingFocus: true,
    firstSpellcastingLevel: 1,
  },

  Wizard: {
    spellcastingAbility: "INT",
    cantripsKnownProgression: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    slotProgression: {
      1: { 1: 2 },
      2: { 1: 3 },
      3: { 1: 4, 2: 2 },
      4: { 1: 4, 2: 3 },
      5: { 1: 4, 2: 3, 3: 2 },
      6: { 1: 4, 2: 3, 3: 3 },
      7: { 1: 4, 2: 3, 3: 3, 4: 1 },
      8: { 1: 4, 2: 3, 3: 3, 4: 2 },
      9: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
      10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
      11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
      12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
      13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
      14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
      15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
      16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
      17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
      18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
      19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
      20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 },
    },
    spellPreparation: "prepared",
    ritualCasting: true,
    spellcastingFocus: true,
    firstSpellcastingLevel: 1,
  },

  // Half-casters
  Paladin: {
    spellcastingAbility: "CHA",
    slotProgression: {
      2: { 1: 2 },
      3: { 1: 3 },
      4: { 1: 3 },
      5: { 1: 4, 2: 2 },
      6: { 1: 4, 2: 2 },
      7: { 1: 4, 2: 3 },
      8: { 1: 4, 2: 3 },
      9: { 1: 4, 2: 3, 3: 2 },
      10: { 1: 4, 2: 3, 3: 2 },
      11: { 1: 4, 2: 3, 3: 3 },
      12: { 1: 4, 2: 3, 3: 3 },
      13: { 1: 4, 2: 3, 3: 3, 4: 1 },
      14: { 1: 4, 2: 3, 3: 3, 4: 1 },
      15: { 1: 4, 2: 3, 3: 3, 4: 2 },
      16: { 1: 4, 2: 3, 3: 3, 4: 2 },
      17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
      18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
      19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
      20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
    },
    cantripsKnownProgression: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    spellPreparation: "prepared",
    ritualCasting: false,
    spellcastingFocus: true,
    firstSpellcastingLevel: 2,
  },

  Ranger: {
    spellcastingAbility: "WIS",
    spellsKnownProgression: [0, 0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
    slotProgression: {
      2: { 1: 2 },
      3: { 1: 3 },
      4: { 1: 3 },
      5: { 1: 4, 2: 2 },
      6: { 1: 4, 2: 2 },
      7: { 1: 4, 2: 3 },
      8: { 1: 4, 2: 3 },
      9: { 1: 4, 2: 3, 3: 2 },
      10: { 1: 4, 2: 3, 3: 2 },
      11: { 1: 4, 2: 3, 3: 3 },
      12: { 1: 4, 2: 3, 3: 3 },
      13: { 1: 4, 2: 3, 3: 3, 4: 1 },
      14: { 1: 4, 2: 3, 3: 3, 4: 1 },
      15: { 1: 4, 2: 3, 3: 3, 4: 2 },
      16: { 1: 4, 2: 3, 3: 3, 4: 2 },
      17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
      18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
      19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
      20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
    },
    cantripsKnownProgression: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    spellPreparation: "known",
    ritualCasting: false,
    spellcastingFocus: true,
    firstSpellcastingLevel: 2,
  },
};

export function getSpellSlotsForClass(className: string, level: number): Record<number, number> {
  const classData = SPELLCASTING_CLASSES[className];
  if (!classData || level < classData.firstSpellcastingLevel) {
    return {};
  }

  const slots = classData.slotProgression[level];
  if (!slots) {
    return {};
  }
  
  // Filter out undefined values
  const result: Record<number, number> = {};
  for (const [key, value] of Object.entries(slots)) {
    if (value !== undefined) {
      result[Number(key)] = value;
    }
  }
  return result;
}

export function getCantripsKnown(className: string, level: number): number {
  const classData = SPELLCASTING_CLASSES[className];
  if (!classData || level < 1) {return 0;}

  return classData.cantripsKnownProgression[level] || 0;
}

export function getSpellsKnown(className: string, level: number): number | null {
  const classData = SPELLCASTING_CLASSES[className];
  if (!classData || !classData.spellsKnownProgression || level < classData.firstSpellcastingLevel) {
    return null;
  }

  return classData.spellsKnownProgression[level] || null;
}

export function getMaxSpellLevel(className: string, level: number): number {
  const slots = getSpellSlotsForClass(className, level);
  const levels = Object.keys(slots).map(Number);
  return levels.length > 0 ? Math.max(...levels) : 0;
}

export function getSpellcastingModifier(className: string): "INT" | "WIS" | "CHA" | null {
  const classData = SPELLCASTING_CLASSES[className];
  return classData?.spellcastingAbility || null;
}
