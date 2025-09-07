import { EventEmitter } from 'events';

export interface DiceRoll {
  expression: string;
  result: number;
  rolls: number[];
  timestamp: Date;
}

export interface DiceResult {
  total: number;
  rolls: number[];
  expression: string;
  advantage?: boolean;
  disadvantage?: boolean;
}

export class DiceEngine extends EventEmitter {
  private rng: () => number;

  constructor(customRng?: () => number) {
    super();
    this.rng = customRng || Math.random;
  }

  public roll(sides: number): number {
    return Math.floor(this.rng() * sides) + 1;
  }

  public rollDice(count: number, sides: number): DiceResult {
    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(this.roll(sides));
    }
    
    const total = rolls.reduce((sum, roll) => sum + roll, 0);
    const expression = `${count}d${sides}`;
    
    const result: DiceResult = {
      total,
      rolls,
      expression
    };

    this.emit('diceRolled', result);
    return result;
  }

  public rollWithAdvantage(sides: number = 20): DiceResult {
    const roll1 = this.roll(sides);
    const roll2 = this.roll(sides);
    const total = Math.max(roll1, roll2);
    
    const result: DiceResult = {
      total,
      rolls: [roll1, roll2],
      expression: `1d${sides} (advantage)`,
      advantage: true
    };

    this.emit('diceRolled', result);
    return result;
  }

  public rollWithDisadvantage(sides: number = 20): DiceResult {
    const roll1 = this.roll(sides);
    const roll2 = this.roll(sides);
    const total = Math.min(roll1, roll2);
    
    const result: DiceResult = {
      total,
      rolls: [roll1, roll2],
      expression: `1d${sides} (disadvantage)`,
      disadvantage: true
    };

    this.emit('diceRolled', result);
    return result;
  }

  public rollExpression(expression: string): DiceResult {
    // Simple parser for expressions like "2d6+3", "1d20", etc.
    const diceRegex = /(\d+)d(\d+)(?:\+(\d+))?(?:-(\d+))?/i;
    const match = expression.match(diceRegex);
    
    if (!match) {
      throw new Error(`Invalid dice expression: ${expression}`);
    }

    const count = parseInt(match[1]!, 10);
    const sides = parseInt(match[2]!, 10);
    const bonus = match[3] ? parseInt(match[3], 10) : 0;
    const penalty = match[4] ? parseInt(match[4], 10) : 0;

    const baseRoll = this.rollDice(count, sides);
    const total = baseRoll.total + bonus - penalty;

    const result: DiceResult = {
      total,
      rolls: baseRoll.rolls,
      expression
    };

    this.emit('diceRolled', result);
    return result;
  }

  public rollInitiative(modifier: number = 0): DiceResult {
    const baseRoll = this.roll(20);
    const total = baseRoll + modifier;
    
    const result: DiceResult = {
      total,
      rolls: [baseRoll],
      expression: `1d20${modifier >= 0 ? '+' : ''}${modifier}`
    };

    this.emit('initiativeRolled', result);
    return result;
  }

  public rollAbilityScore(): DiceResult {
    // Roll 4d6, drop lowest
    const rolls = [this.roll(6), this.roll(6), this.roll(6), this.roll(6)];
    rolls.sort((a, b) => b - a);
    const total = rolls.slice(0, 3).reduce((sum, roll) => sum + roll, 0);
    
    const result: DiceResult = {
      total,
      rolls,
      expression: '4d6 drop lowest'
    };

    this.emit('abilityScoreRolled', result);
    return result;
  }
}
