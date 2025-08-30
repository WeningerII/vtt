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
export declare class DiceRoller {
    private rng;
    constructor(_rng?: () => number);
    /**
     * Roll a single die
     */
    rollDie(sides: number): number;
    /**
     * Roll multiple dice
     */
    rollDice(count: number, sides: number): number[];
    /**
     * Parse and roll dice expression (e.g., "2d6+3", "1d20")
     */
    roll(expression: string): RollResult;
    /**
     * Roll with advantage (roll twice, take higher)
     */
    rollWithAdvantage(sides: number, modifier?: number): RollResult;
    /**
     * Roll with disadvantage (roll twice, take lower)
     */
    rollWithDisadvantage(sides: number, modifier?: number): RollResult;
    /**
     * Roll a standard D&D dice roll
     */
    rollDiceRoll(diceRoll: DiceRoll): RollResult;
    /**
     * Standard dice roll without advantage/disadvantage
     */
    private rollStandard;
    /**
     * Parse dice expression string into DiceRoll object
     */
    private parseDiceExpression;
    /**
     * Roll initiative (1d20 + modifier)
     */
    rollInitiative(modifier?: number, advantage?: boolean, disadvantage?: boolean): RollResult;
    /**
     * Roll ability check (1d20 + modifier)
     */
    rollAbilityCheck(modifier?: number, advantage?: boolean, disadvantage?: boolean): RollResult;
    /**
     * Roll saving throw (1d20 + modifier)
     */
    rollSavingThrow(modifier?: number, advantage?: boolean, disadvantage?: boolean): RollResult;
    /**
     * Roll attack roll (1d20 + modifier)
     */
    rollAttack(modifier?: number, advantage?: boolean, disadvantage?: boolean): RollResult;
    /**
     * Roll damage with potential critical hit doubling
     */
    rollDamage(expression: string, critical?: boolean): RollResult;
    /**
     * Roll healing
     */
    rollHealing(expression: string): RollResult;
}
/**
 * Default dice roller instance
 */
export declare const diceRoller: DiceRoller;
//# sourceMappingURL=DiceRoller.d.ts.map