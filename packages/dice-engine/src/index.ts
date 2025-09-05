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
    this.rng = _rng || (() => Math.random());
  }

  /**
   * Roll dice with expression like "1d20+5", "2d6", "3d8+2d4+10"
   */
  roll(expression: string, advantage = false, disadvantage = false): DiceRoll {
    const normalized = expression.toLowerCase().replace(/\s/g, "");
    const parts = this.parseDiceExpression(normalized);

    let total = 0;
    const allRolls: number[] = [];
    const modifiers: number[] = [];
    let breakdown = "";

    for (const part of parts) {
      if (part.type === "dice") {
        const rolls = this.rollDice(part.count!, part.sides!, advantage, disadvantage);
        total += rolls.reduce((_sum, _roll) => _sum + _roll, 0);
        allRolls.push(...rolls);
        breakdown += `${part.count}d${part.sides}[${rolls.join(",")}]`;
      } else if (part.type === "modifier") {
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
      disadvantage,
    };
  }

  /**
   * Roll attack with automatic hit/miss determination
   */
  rollAttack(
    attackBonus: number,
    targetAC: number,
    advantage = false,
    disadvantage = false,
  ): { hit: boolean; critical: boolean; roll: DiceRoll } {
    const roll = this.roll(`1d20+${attackBonus}`, advantage, disadvantage);
    const naturalRoll = roll.rolls[0];

    const critical = naturalRoll === 20;
    const criticalMiss = naturalRoll === 1;
    const hit = critical || (!criticalMiss && roll.total >= targetAC);

    return {
      hit,
      critical,
      roll,
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
    vulnerabilities: string[] = [],
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
      components: [
        {
          type: damageType,
          amount: finalAmount,
          rolls: baseRoll,
        },
      ],
      isCritical,
      breakdown: `${baseRoll.breakdown} ${damageType} damage${isCritical ? " (CRITICAL!)" : ""}`,
    };
  }

  /**
   * Roll saving throw
   */
  rollSavingThrow(
    savingThrowBonus: number,
    dc: number,
    advantage = false,
    disadvantage = false,
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
    disadvantage = false,
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
    type: "dice" | "modifier";
    count?: number;
    sides?: number;
    value?: number;
  }> {
    const parts: Array<{
      type: "dice" | "modifier";
      count?: number;
      sides?: number;
      value?: number;
    }> = [];
    const regex = /([+-]?\d*d\d+|[+-]?\d+)/g;
    let match;

    while ((match = regex.exec(expression)) !== null) {
      const part = match[1];

      if (part?.includes("d")) {
        const [countStr, sidesStr] = part.split("d");
        const count =
          countStr === "" || countStr === "+" ? 1 : countStr === "-" ? -1 : parseInt(countStr!);
        const sides = parseInt(sidesStr!);
        parts.push({ type: "dice" as const, count: Math.abs(count), sides });
        if (count < 0) {
          parts.push({ type: "modifier" as const, value: 0 }); // Handle negative dice
        }
      } else {
        parts.push({ type: "modifier" as const, value: parseInt(part!) });
      }
    }

    return parts;
  }

  private rollDice(
    _count: number,
    _sides: number,
    _advantage = false,
    _disadvantage = false,
  ): number[] {
    if (_count <= 0 || _sides <= 0) {
      throw new Error(`Invalid dice: ${_count}d${_sides}`);
    }

    const rolls: number[] = [];
    const rollCount = _advantage || _disadvantage ? 2 : _count;

    for (let i = 0; i < rollCount; i++) {
      rolls.push(Math.floor(this.rng() * _sides) + 1);
    }

    // Handle advantage/disadvantage for d20 rolls
    if (_advantage && rolls.length === 2) {
      return [Math.max(...rolls)];
    } else if (_disadvantage && rolls.length === 2) {
      return [Math.min(...rolls)];
    }

    return rolls;
  }

  private isCriticalRoll(rolls: number[], parts: any[]): boolean {
    // Check if any d20 rolled a natural 20
    const d20Parts = parts.filter((p) => p.type === "dice" && p.sides === 20);
    return d20Parts.length > 0 && rolls.some((roll) => roll === 20);
  }

  private doubleDiceForCritical(expression: string): string {
    return expression.replace(/(\d*)d(\d+)/g, (match, _count, _sides) => {
      const diceCount = _count === "" ? 1 : parseInt(_count);
      return `${diceCount * 2}d${_sides}`;
    });
  }

  /**
   * Calculate average damage for an expression
   */
  calculateAverageDamage(expression: string): number {
    const parts = this.parseDiceExpression(expression.toLowerCase());
    let average = 0;

    for (const part of parts) {
      if (part.type === "dice") {
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
  simulateRolls(
    expression: string,
    iterations = 1000,
  ): {
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
      average: results.reduce((_sum, _val) => _sum + _val, 0) / results.length,
      min: Math.min(...results),
      max: Math.max(...results),
      distribution,
    };
  }
}

// Export singleton instance
export const diceEngine = new DiceEngine();

// Utility functions
export function rollD20(_modifier = 0, _advantage = false, _disadvantage = false): DiceRoll {
  return diceEngine.roll(`1d20+${_modifier}`, _advantage, _disadvantage);
}

export function rollDamage(
  _expression: string,
  _damageType = "bludgeoning",
  _critical = false,
): DamageResult {
  return diceEngine.rollDamage(_expression, _damageType, _critical);
}

export function rollInitiative(_dexModifier = 0, _advantage = false): DiceRoll {
  return diceEngine.rollInitiative(_dexModifier, _advantage);
}
