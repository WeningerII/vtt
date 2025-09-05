/**
 * Dice rolling utilities for D&D-style dice notation
 * Supports standard notation like: 1d20, 2d6+3, 1d8-1, etc.
 */

export interface DiceRoll {
  dice: string;
  total: number;
  rolls: number[];
  modifier: number;
}

export interface DiceRollResult {
  rollId: string;
  dice: string;
  total: number;
  rolls: number[];
  modifier: number;
  timestamp: number;
  label?: string;
}

const DICE_PATTERN = /^(\d+)?d(\d+)([+-]\d+)?$/i;

/**
 * Parse dice notation and validate it
 * Examples: "1d20", "2d6+3", "d4", "3d8-2"
 */
export function parseDiceNotation(
  dice: string,
): { count: number; sides: number; modifier: number } | null {
  const trimmed = dice.trim().toLowerCase();
  const match = trimmed.match(DICE_PATTERN);

  if (!match) {
    return null;
  }

  const [, countStr, sidesStr, modifierStr] = match;

  if (!sidesStr) {return null;}

  const count = countStr ? parseInt(countStr, 10) : 1;
  const sides = parseInt(sidesStr, 10);
  const modifier = modifierStr ? parseInt(modifierStr, 10) : 0;

  // Validation
  if (count <= 0 || count > 100) {return null;} // Reasonable limits
  if (sides <= 0 || sides > 1000) {return null;}

  return { count, sides, modifier };
}

/**
 * Roll a single die with given number of sides
 */
export function rollDie(_sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Roll dice according to notation and return detailed results
 */
export function rollDice(dice: string): DiceRoll | null {
  const parsed = parseDiceNotation(dice);
  if (!parsed) {
    return null;
  }

  const { count, sides, modifier } = parsed;
  const rolls: number[] = [];

  for (let i = 0; i < count; i++) {
    rolls.push(rollDie(sides));
  }

  const rollTotal = rolls.reduce((_sum, _roll) => sum + roll, 0);
  const total = rollTotal + modifier;

  return {
    dice,
    total,
    rolls,
    modifier,
  };
}

/**
 * Create a complete dice roll result with metadata
 */
export function createDiceRollResult(dice: string, _label?: string): DiceRollResult | null {
  const roll = rollDice(dice);
  if (!roll) {
    return null;
  }

  const result: DiceRollResult = {
    rollId: generateRollId(),
    dice: roll.dice,
    total: roll.total,
    rolls: roll.rolls,
    modifier: roll.modifier,
    timestamp: Date.now(),
  };

  if (label !== undefined) {
    result.label = label;
  }

  return result;
}

/**
 * Generate a unique roll ID
 */
function generateRollId(): string {
  return `roll_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Common D&D dice presets
 */
export const _COMMON_DICE = {
  D4: "1d4",
  D6: "1d6",
  D8: "1d8",
  D10: "1d10",
  D12: "1d12",
  D20: "1d20",
  D100: "1d100",

  // Common combinations
  ABILITY_SCORE: "4d6", // Roll 4d6, drop lowest (not implemented here)
  DAMAGE_2D6: "2d6",
  FIREBALL: "8d6",
  HEALING_POTION: "2d4+2",
} as const;

/**
 * Validate if a dice string is well-formed
 */
export function isValidDiceNotation(dice: string): boolean {
  return parseDiceNotation(dice) !== null;
}
