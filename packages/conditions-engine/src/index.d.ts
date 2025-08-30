/**
 * D&D 5e Condition and Status Effect Management System
 * Handles all conditions, temporary effects, and their interactions
 */
export interface Condition {
    id: string;
    name: string;
    description: string;
    duration: number;
    source?: string;
    level?: number;
    dc?: number;
    saveAbility?: string;
    saveAtEnd?: boolean;
    effects: ConditionEffect[];
    stackable?: boolean;
    replaces?: string[];
    preventedBy?: string[];
}
export interface ConditionEffect {
    type: 'ability_modifier' | 'skill_modifier' | 'save_modifier' | 'ac_modifier' | 'speed_modifier' | 'damage_modifier' | 'resistance' | 'immunity' | 'vulnerability' | 'advantage' | 'disadvantage' | 'prevent_action' | 'force_action' | 'damage_over_time' | 'healing_over_time' | 'custom';
    target: string;
    value?: number;
    dice?: string;
    damageType?: string;
    duration?: 'permanent' | 'turn' | 'round' | 'encounter';
    trigger?: 'start_turn' | 'end_turn' | 'attack' | 'spell_cast' | 'damage_taken';
}
export interface ActiveCondition extends Condition {
    appliedAt: number;
    remainingDuration: number;
    appliedBy: string;
    metadata?: Record<string, any>;
}
export declare const D5E_CONDITIONS: Record<string, Condition>;
export declare class ConditionsEngine {
    private activeConditions;
    /**
     * Apply condition to entity
     */
    applyCondition(entityId: string, condition: Condition | string, duration?: number, source?: string, metadata?: Record<string, any>): ActiveCondition;
    /**
     * Remove condition from entity
     */
    removeCondition(entityId: string, conditionId: string): boolean;
    /**
     * Get all active conditions for entity
     */
    getActiveConditions(entityId: string): ActiveCondition[];
    /**
     * Check if entity has specific condition
     */
    hasCondition(entityId: string, conditionId: string): boolean;
    /**
     * Process turn-based condition updates
     */
    processTurnStart(entityId: string): ConditionEffect[];
    /**
     * Process end of turn condition updates
     */
    processTurnEnd(entityId: string): {
        effects: ConditionEffect[];
        saves: Array<{
            condition: string;
            dc: number;
            ability: string;
        }>;
    };
    /**
     * Apply condition effect results
     */
    applyConditionEffects(entityId: string, rollType: string): {
        advantage: boolean;
        disadvantage: boolean;
        modifiers: number[];
        prevented: boolean;
    };
    /**
     * Get damage resistances/immunities/vulnerabilities
     */
    getDamageModifications(entityId: string): {
        resistances: string[];
        immunities: string[];
        vulnerabilities: string[];
    };
    private effectApplies;
    /**
     * Clear all conditions from entity
     */
    clearAllConditions(entityId: string): void;
    /**
     * Create custom condition
     */
    createCustomCondition(id: string, name: string, description: string, effects: ConditionEffect[], duration?: number): Condition;
}
export declare const conditionsEngine: ConditionsEngine;
export declare function applyCondition(_entityId: string, _conditionId: string, _duration?: number): ActiveCondition;
export declare function removeCondition(_entityId: string, _conditionId: string): boolean;
export declare function hasCondition(_entityId: string, _conditionId: string): boolean;
//# sourceMappingURL=index.d.ts.map