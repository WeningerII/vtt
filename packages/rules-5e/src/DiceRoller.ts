/**
 * Comprehensive dice rolling system for D&D 5e
 */

export interface DiceRoll {
  sides: number;
  count: number;
  modifier: number;
  advantage?: boolean;
  disadvantage?: boolean;
}

export interface RollResult {
  total: number;
  rolls: number[];
  modifier: number;
  expression: string;
  critical: boolean;
  criticalFail: boolean;
}

export class DiceRoller {
  private rng: () => number;

  constructor(_rng: () => number = Math.random) {
    this.rng = _rng;
  }

  /**
   * Roll a single die
   */
  rollDie(sides: number): number {
    return Math.floor(this.rng() * sides) + 1;
  }

  /**
   * Roll multiple dice
   */
  rollDice(count: number, sides: number): number[] {
    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(this.rollDie(sides));
    }
    return rolls;
  }

  /**
   * Parse and roll dice expression (e.g., "2d6+3", "1d20")
   */
  roll(expression: string): RollResult {
    const parsed = this.parseDiceExpression(expression);
    return this.rollDiceRoll(parsed);
  }

  /**
   * Roll with advantage (roll twice, take higher)
   */
  rollWithAdvantage(sides: number, modifier: number = 0): RollResult {
    const roll1 = this.rollDie(sides);
    const roll2 = this.rollDie(sides);
    const higher = Math.max(roll1, roll2);

    return {
      total: higher + modifier,
      rolls: [roll1, roll2],
      modifier,
      expression: `1d${sides}+${modifier} (advantage)`,
      critical: sides === 20 && higher === 20,
      criticalFail: sides === 20 && higher === 1,
    };
  }

  /**
   * Roll with disadvantage (roll twice, take lower)
   */
  rollWithDisadvantage(sides: number, modifier: number = 0): RollResult {
    const roll1 = this.rollDie(sides);
    const roll2 = this.rollDie(sides);
    const lower = Math.min(roll1, roll2);

    return {
      total: lower + modifier,
      rolls: [roll1, roll2],
      modifier,
      expression: `1d${sides}+${modifier} (disadvantage)`,
      critical: sides === 20 && lower === 20,
      criticalFail: sides === 20 && lower === 1,
    };
  }

  /**
   * Roll a standard D&D dice roll
   */
  rollDiceRoll(diceRoll: DiceRoll): RollResult {
    if (diceRoll.advantage && diceRoll.disadvantage) {
      // Advantage and disadvantage cancel out
      return this.rollStandard(diceRoll.count, diceRoll.sides, diceRoll.modifier);
    } else if (diceRoll.advantage) {
      if (diceRoll.count === 1) {
        return this.rollWithAdvantage(diceRoll.sides, diceRoll.modifier);
      } else {
        // Roll normally but with advantage on the first die
        const advantageRoll = this.rollWithAdvantage(diceRoll.sides);
        const otherRolls = this.rollDice(diceRoll.count - 1, diceRoll.sides);
        const allRolls = [Math.max(...advantageRoll.rolls), ...otherRolls];
        const total = allRolls.reduce((_sum, _roll) => _sum + _roll, diceRoll.modifier);

        return {
          total,
          rolls: allRolls,
          modifier: diceRoll.modifier,
          expression: `${diceRoll.count}d${diceRoll.sides}+${diceRoll.modifier} (advantage on first die)`,
          critical: diceRoll.sides === 20 && allRolls[0] === 20,
          criticalFail: diceRoll.sides === 20 && allRolls[0] === 1,
        };
      }
    } else if (diceRoll.disadvantage) {
      if (diceRoll.count === 1) {
        return this.rollWithDisadvantage(diceRoll.sides, diceRoll.modifier);
      } else {
        // Roll normally but with disadvantage on the first die
        const disadvantageRoll = this.rollWithDisadvantage(diceRoll.sides);
        const otherRolls = this.rollDice(diceRoll.count - 1, diceRoll.sides);
        const allRolls = [Math.min(...disadvantageRoll.rolls), ...otherRolls];
        const total = allRolls.reduce((_sum, _roll) => _sum + _roll, diceRoll.modifier);

        return {
          total,
          rolls: allRolls,
          modifier: diceRoll.modifier,
          expression: `${diceRoll.count}d${diceRoll.sides}+${diceRoll.modifier} (disadvantage on first die)`,
          critical: diceRoll.sides === 20 && allRolls[0] === 20,
          criticalFail: diceRoll.sides === 20 && allRolls[0] === 1,
        };
      }
    } else {
      return this.rollStandard(diceRoll.count, diceRoll.sides, diceRoll.modifier);
    }
  }

  /**
   * Standard dice roll without advantage/disadvantage
   */
  private rollStandard(count: number, sides: number, modifier: number): RollResult {
    const rolls = this.rollDice(count, sides);
    const total = rolls.reduce((_sum, _roll) => _sum + _roll, modifier);

    return {
      total,
      rolls,
      modifier,
      expression: `${count}d${sides}+${modifier}`,
      critical: sides === 20 && count === 1 && rolls[0] === 20,
      criticalFail: sides === 20 && count === 1 && rolls[0] === 1,
    };
  }

  /**
   * Parse dice expression string into DiceRoll object
   */
  private parseDiceExpression(expression: string): DiceRoll {
    const normalized = expression.replace(/\s/g, "").toLowerCase();

    // Match patterns like "2d6+3", "1d20", "d8+1", etc.
    const match = normalized.match(/^(\d*)d(\d+)([+-]\d+)?$/);

    if (!match) {
      throw new Error(`Invalid dice expression: ${expression}`);
    }

    const count = match[1] ? parseInt(match[1]) : 1;
    const sides = match[2] ? parseInt(match[2]) : 6;
    const modifier = match[3] ? parseInt(match[3]) : 0;

    return { count, sides, modifier };
  }

  /**
   * Roll initiative (1d20 + modifier)
   */
  rollInitiative(modifier: number = 0, advantage?: boolean, disadvantage?: boolean): RollResult {
    const diceRoll: DiceRoll = {
      count: 1,
      sides: 20,
      modifier,
      advantage: advantage || false,
      disadvantage: disadvantage || false,
    };
    return this.rollDiceRoll(diceRoll);
  }

  /**
   * Roll ability check (1d20 + modifier)
   */
  rollAbilityCheck(modifier: number = 0, advantage?: boolean, disadvantage?: boolean): RollResult {
    return this.rollInitiative(modifier, advantage, disadvantage);
  }

  /**
   * Roll saving throw (1d20 + modifier)
   */
  rollSavingThrow(modifier: number = 0, advantage?: boolean, disadvantage?: boolean): RollResult {
    return this.rollInitiative(modifier, advantage, disadvantage);
  }

  /**
   * Roll attack roll (1d20 + modifier)
   */
  rollAttack(modifier: number = 0, advantage?: boolean, disadvantage?: boolean): RollResult {
    return this.rollInitiative(modifier, advantage, disadvantage);
  }

  /**
   * Roll damage with potential critical hit doubling
   */
  rollDamage(expression: string, critical: boolean = false): RollResult {
    const parsed = this.parseDiceExpression(expression);
    let result = this.rollStandard(parsed.count, parsed.sides, parsed.modifier);

    if (critical) {
      // Double the dice (not the modifier) for critical hits
      const criticalRolls = this.rollDice(parsed.count, parsed.sides);
      result = {
        ...result,
        rolls: [...result.rolls, ...criticalRolls],
        total: result.total + criticalRolls.reduce((_sum, _roll) => _sum + _roll, 0),
        expression: `${expression} (critical hit)`,
      };
    }

    return result;
  }

  /**
   * Roll healing
   */
  rollHealing(expression: string): RollResult {
    return this.roll(expression);
  }
}

/**
 * Default dice roller instance
 */
export const _diceRoller = new DiceRoller();
