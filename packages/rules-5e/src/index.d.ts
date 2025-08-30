import { Monster, ChallengeRating } from "@vtt/core-schemas";
import { EventEmitter } from 'events';
export { DiceRoller, diceRoller } from './DiceRoller';
export { SpellSystem } from './SpellSystem';
export { ActionSystem } from './ActionSystem';
export type { DiceRoll, RollResult } from './DiceRoller';
export type { Spell, SpellSlot, SchoolOfMagic, SpellcastingAbility } from './SpellSystem';
export type { AttackAction, ActionResult, ActionType, DamageType } from './ActionSystem';
export type CompiledMonster = Monster & {
    xp: number;
    proficiencyBonus: number;
    passivePerception: number;
};
export declare function abilityMod(_score: number): number;
export declare const CR_XP_MAP: Record<ChallengeRating, number>;
export declare function crToProficiency(_cr: ChallengeRating): number;
export declare function compileMonster(_mon: Monster): CompiledMonster;
export declare function compileMonsters(_list: Monster[]): CompiledMonster[];
export interface Combatant {
    id: string;
    name: string;
    initiative: number;
    hitPoints: number;
    maxHitPoints: number;
    armorClass: number;
    isPlayer: boolean;
}
export declare class CombatEngine extends EventEmitter {
    private combatants;
    private turnOrder;
    private currentTurnIndex;
    private currentRound;
    private isActive;
    constructor();
    addCombatant(combatant: Combatant): void;
    removeCombatant(id: string): void;
    startCombat(): void;
    endCombat(): void;
    nextTurn(): void;
    getCurrentCombatant(): Combatant | null;
    getCombatants(): Combatant[];
    getTurnOrder(): string[];
    getCurrentRound(): number;
    isInCombat(): boolean;
    executeAction(action: any): void;
    private sortInitiative;
}
//# sourceMappingURL=index.d.ts.map