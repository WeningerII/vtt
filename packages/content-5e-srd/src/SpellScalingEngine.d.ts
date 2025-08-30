/**
 * Spell Scaling and Upcasting Engine
 * Handles automatic scaling of spell effects when cast at higher levels
 */
import type { SRDSpell } from './spells';
export interface ScaledSpellEffect {
    originalSpell: SRDSpell;
    castAtLevel: number;
    scaledDamage?: {
        originalDice: string;
        scaledDice: string;
        bonusDamage: string;
    };
    scaledHealing?: {
        originalDice: string;
        scaledDice: string;
        bonusHealing: string;
    };
    additionalTargets?: number;
    enhancedEffects?: string[];
    scalingDescription: string;
}
export interface SpellUpcastOptions {
    spellId: string;
    baseLevel: number;
    castAtLevel: number;
    casterLevel?: number;
}
export declare class SpellScalingEngine {
    /**
     * Calculate scaled spell effects for upcasting
     */
    upcastSpell(spell: SRDSpell, castAtLevel: number, casterLevel?: number): ScaledSpellEffect;
    /**
     * Scale cantrips based on character level
     */
    private scaleCantrip;
    /**
     * Upcast spell using higher level slot
     */
    private upcastSpellSlot;
    /**
     * Get spell-specific scaling effects
     */
    private getSpellSpecificScaling;
    /**
     * Calculate additional targets for upcasting
     */
    private getAdditionalTargets;
    /**
     * Generate human-readable scaling description
     */
    private generateScalingDescription;
    /**
     * Multiply dice expression by a factor
     */
    private multiplyDice;
    /**
     * Add two dice expressions together
     */
    private addDice;
    /**
     * Calculate average damage for a dice expression
     */
    calculateAverageDamage(diceExpression: string): number;
    /**
     * Get all possible upcasting levels for a spell
     */
    getAvailableUpcastLevels(spell: SRDSpell, availableSlots: Record<number, number>): number[];
    /**
     * Predict spell effectiveness at different levels
     */
    getUpcastingRecommendation(spell: SRDSpell, availableSlots: Record<number, number>): {
        level: number;
        effectiveness: number;
        recommendation: string;
    }[];
}
export declare const spellScalingEngine: SpellScalingEngine;
//# sourceMappingURL=SpellScalingEngine.d.ts.map