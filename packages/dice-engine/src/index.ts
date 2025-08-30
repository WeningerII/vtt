/**
 * Advanced D&D 5e Dice Engine
 * Handles all dice rolling, damage calculation, and probability analysis
 */

export interface DiceRoll {
  expression: string;
  total: number;
  rolls: number[];
  modifiers: number[];
  breakdown: string;
  isCritical?: boolean;
  advantage?: boolean;
  disadvantage?: boolean;
}

export interface DamageResult {
  total: number;
  components: Array<{
    type: string;
    amount: number;
    rolls?: DiceRoll;
  }>;
  isCritical: boolean;
  breakdown: string;
}

export interface AttackResult {
  attackRoll: DiceRoll;
  hit: boolean;
  critical: boolean;
  damage?: DamageResult;
  effects?: string[];
}

export class DiceEngine {
  private rng: () => number;

  constructor(_rng?: () => number) {
    this.rng = rng || (() => Math.random());
  }

  /**
   * Roll dice with expression like "1d20+5", "2d6", "3d8+2d4+10"
   */
  roll(expression: string, advantage = false, disadvantage = false): DiceRoll {
    const normalized = expression.toLowerCase().replace(/\s/g, '');
    const parts = this.parseDiceExpression(normalized);
    
    let total = 0;
    const allRolls: number[] = [];
    const modifiers: number[] = [];
    let breakdown = '';

    for (const part of parts) {
      if (part.type === 'dice') {
        const rolls = this.rollDice(part.count!, part.sides!, advantage, disadvantage);
        total += rolls.reduce((_sum, _roll) => sum + roll, 0);
        allRolls.push(...rolls);
        breakdown += `${part.count}d${part.sides}[${rolls.join(',')}]`;
      } else if (part.type === 'modifier') {
        total += part.value!;
        modifiers.push(part.value!);
        breakdown += part.value! >= 0 ? `+${part.value}` : `${part.value}`;
      }
    }

    const isCritical = this.isCriticalRoll(allRolls, parts);

    return {
      expression,
      total,
      rolls: allRolls,
      modifiers,
      breakdown,
      isCritical,
      advantage,
      disadvantage
    };
  }

  /**
   * Roll attack with automatic hit/miss determination
   */
  rollAttack(
    attackBonus: number,
    targetAC: number,
    advantage = false,
    disadvantage = false
  ): { hit: boolean; critical: boolean; roll: DiceRoll } {
    const roll = this.roll(`1d20+${attackBonus}`, advantage, disadvantage);
    const naturalRoll = roll.rolls[0];
    
    const critical = naturalRoll === 20;
    const criticalMiss = naturalRoll === 1;
    const hit = critical || (!criticalMiss && roll.total >= targetAC);

    return {
      hit,
      critical,
      roll
    };
  }

  /**
   * Calculate damage with critical hit support
   */
  rollDamage(
    damageExpression: string,
    damageType: string,
    isCritical = false,
    resistances: string[] = [],
    immunities: string[] = [],
    vulnerabilities: string[] = []
  ): DamageResult {
    let expression = damageExpression;
    
    // Double dice on critical hits
    if (isCritical) {
      expression = this.doubleDiceForCritical(expression);
    }

    const baseRoll = this.roll(expression);
    let finalAmount = baseRoll.total;

    // Apply damage resistances/immunities/vulnerabilities
    if (immunities.includes(damageType)) {
      finalAmount = 0;
    } else if (resistances.includes(damageType)) {
      finalAmount = Math.floor(finalAmount / 2);
    } else if (vulnerabilities.includes(damageType)) {
      finalAmount = finalAmount * 2;
    }

    return {
      total: finalAmount,
      components: [{
        type: damageType,
        amount: finalAmount,
        rolls: baseRoll
      }],
      isCritical,
      breakdown: `${baseRoll.breakdown} ${damageType} damage${isCritical ? ' (CRITICAL!)' : ''}`
    };
  }

  /**
   * Roll saving throw
   */
  rollSavingThrow(
    savingThrowBonus: number,
    dc: number,
    advantage = false,
    disadvantage = false
  ): { success: boolean; roll: DiceRoll } {
    const roll = this.roll(`1d20+${savingThrowBonus}`, advantage, disadvantage);
    const success = roll.total >= dc;

    return { success, roll };
  }

  /**
   * Roll ability check
   */
  rollAbilityCheck(
    abilityModifier: number,
    proficiencyBonus = 0,
    advantage = false,
    disadvantage = false
  ): DiceRoll {
    return this.roll(`1d20+${abilityModifier + proficiencyBonus}`, advantage, disadvantage);
  }

  /**
   * Roll initiative
   */
  rollInitiative(dexModifier: number, advantage = false): DiceRoll {
    return this.roll(`1d20+${dexModifier}`, advantage);
  }

  private parseDiceExpression(expression: string): Array<{
    type: 'dice' | 'modifier';
    count?: number;
    sides?: number;
    value?: number;
  }> {
    const parts = [];
    const regex = /([+-]?\d*d\d+|[+-]?\d+)/g;
    let match;

    while ((match = regex.exec(expression)) !== null) {
      const part = match[1];
      
      if (part?.includes('d')) {
        const [countStr, sidesStr] = part.split('d');
        const count = countStr === '' || countStr === '+' ? 1 : 
                     countStr === '-' ? -1 : parseInt(countStr!);
        const sides = parseInt(sidesStr!);
        parts.push({ type: 'dice' as const, count: Math.abs(count), sides });
        if (count < 0) {
          parts.push({ type: 'modifier' as const, value: 0 }); // Handle negative dice
        }
      } else {
        parts.push({ type: 'modifier' as const, value: parseInt(part!) });
      }
    }

    return parts;
  }

  private rollDice(count: number, sides: number, advantage = false, disadvantage = false): number[] {
    if (sides === 20 && count === 1 && (advantage || disadvantage)) {
      const roll1 = Math.floor(this.rng() * sides) + 1;
      const roll2 = Math.floor(this.rng() * sides) + 1;
      
      if (advantage) {
        return [Math.max(roll1, roll2)];
      } else {
        return [Math.min(roll1, roll2)];
      }
    }

    const rolls = [];
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(this.rng() * sides) + 1);
    }
    return rolls;
  }

  private isCriticalRoll(rolls: number[], parts: any[]): boolean {
    // Check if any d20 rolled a natural 20
    const d20Parts = parts.filter(p => p.type === 'dice' && p.sides === 20);
    return d20Parts.length > 0 && rolls.some(roll => roll === 20);
  }

  private doubleDiceForCritical(expression: string): string {
    return expression.replace(/(\d*)d(\d+)/g, (match, _count, _sides) => {
      const diceCount = count === '' ? 1 : parseInt(count);
      return `${diceCount * 2}d${sides}`;
    });
  }

  /**
   * Calculate average damage for an expression
   */
  calculateAverageDamage(expression: string): number {
    const parts = this.parseDiceExpression(expression.toLowerCase());
    let average = 0;

    for (const part of parts) {
      if (part.type === 'dice') {
        const avgPerDie = (part.sides! + 1) / 2;
        average += part.count! * avgPerDie;
      } else {
        average += part.value!;
      }
    }

    return Math.round(average * 100) / 100;
  }

  /**
   * Simulate multiple rolls for probability analysis
   */
  simulateRolls(expression: string, iterations = 1000): {
    average: number;
    min: number;
    max: number;
    distribution: Record<number, number>;
  } {
    const results: number[] = [];
    const distribution: Record<number, number> = {};

    for (let i = 0; i < iterations; i++) {
      const result = this.roll(expression);
      results.push(result.total);
      distribution[result.total] = (distribution[result.total] || 0) + 1;
    }

    return {
      average: results.reduce((_sum, __val) => sum + val, 0) / results.length,
      min: Math.min(...results),
      max: Math.max(...results),
      distribution
    };
  }
}

// Export singleton instance
export const diceEngine = new DiceEngine();

// Utility functions
export function rollD20(_modifier = 0, _advantage = false, _disadvantage = false): DiceRoll {
  return diceEngine.roll(`1d20+${modifier}`, advantage, disadvantage);
}

export function rollDamage(expression: string, _damageType = 'bludgeoning', _critical = false): DamageResult {
  return diceEngine.rollDamage(expression, damageType, critical);
}

export function rollInitiative(_dexModifier: number, _advantage = false): DiceRoll {
  return diceEngine.rollInitiative(dexModifier, advantage);
}
