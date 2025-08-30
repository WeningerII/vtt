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
export declare class DiceEngine {
    private rng;
    constructor(_rng?: () => number);
    /**
     * Roll dice with expression like "1d20+5", "2d6", "3d8+2d4+10"
     */
    roll(expression: string, advantage?: boolean, disadvantage?: boolean): DiceRoll;
    /**
     * Roll attack with automatic hit/miss determination
     */
    rollAttack(attackBonus: number, targetAC: number, advantage?: boolean, disadvantage?: boolean): {
        hit: boolean;
        critical: boolean;
        roll: DiceRoll;
    };
    /**
     * Calculate damage with critical hit support
     */
    rollDamage(damageExpression: string, damageType: string, isCritical?: boolean, resistances?: string[], immunities?: string[], vulnerabilities?: string[]): DamageResult;
    /**
     * Roll saving throw
     */
    rollSavingThrow(savingThrowBonus: number, dc: number, advantage?: boolean, disadvantage?: boolean): {
        success: boolean;
        roll: DiceRoll;
    };
    /**
     * Roll ability check
     */
    rollAbilityCheck(abilityModifier: number, proficiencyBonus?: number, advantage?: boolean, disadvantage?: boolean): DiceRoll;
    /**
     * Roll initiative
     */
    rollInitiative(dexModifier: number, advantage?: boolean): DiceRoll;
    private parseDiceExpression;
    private rollDice;
    private isCriticalRoll;
    private doubleDiceForCritical;
    /**
     * Calculate average damage for an expression
     */
    calculateAverageDamage(expression: string): number;
    /**
     * Simulate multiple rolls for probability analysis
     */
    simulateRolls(expression: string, iterations?: number): {
        average: number;
        min: number;
        max: number;
        distribution: Record<number, number>;
    };
}
export declare const diceEngine: DiceEngine;
export declare function rollD20(_modifier?: number, _advantage?: boolean, _disadvantage?: boolean): DiceRoll;
export declare function rollDamage(_expression: string, _damageType?: string, _critical?: boolean): DamageResult;
export declare function rollInitiative(_dexModifier: number, _advantage?: boolean): DiceRoll;
//# sourceMappingURL=index.d.ts.map