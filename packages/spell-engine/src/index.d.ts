/**
 * D&D 5e Spell Casting Automation Engine
 * Handles spell casting mechanics, slot management, and spell effects
 */
import { DamageResult } from '@vtt/dice-engine';
export interface Spell {
    id: string;
    name: string;
    level: number;
    school: 'abjuration' | 'conjuration' | 'divination' | 'enchantment' | 'evocation' | 'illusion' | 'necromancy' | 'transmutation';
    castingTime: string;
    range: string;
    components: {
        verbal: boolean;
        somatic: boolean;
        material?: string;
        consumed?: boolean;
        cost?: number;
    };
    duration: string;
    concentration: boolean;
    ritual: boolean;
    description: string;
    atHigherLevels?: string;
    effects: SpellEffect[];
    scaling?: SpellScaling;
}
export interface SpellEffect {
    type: 'damage' | 'healing' | 'condition' | 'teleport' | 'summon' | 'buff' | 'debuff' | 'utility' | 'custom';
    target: 'self' | 'single' | 'multiple' | 'area' | 'line' | 'cone' | 'sphere';
    area?: {
        type: 'sphere' | 'cube' | 'cylinder' | 'line' | 'cone';
        size: number;
    };
    damage?: {
        dice: string;
        type: string;
        savingThrow?: {
            ability: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
            dc?: number;
            onSuccess: 'half' | 'none' | 'negates';
        };
    };
    healing?: {
        dice: string;
        maxTargets?: number;
    };
    condition?: {
        id: string;
        duration: number;
        savingThrow?: {
            ability: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
            dc?: number;
            endOfTurn?: boolean;
        };
    };
    modifier?: {
        target: string;
        value: number;
        duration: number;
    };
    custom?: {
        description: string;
        handler?: string;
    };
}
export interface SpellScaling {
    damage?: string;
    healing?: string;
    duration?: string;
    targets?: number;
    area?: number;
}
export interface SpellSlots {
    1: {
        max: number;
        current: number;
    };
    2: {
        max: number;
        current: number;
    };
    3: {
        max: number;
        current: number;
    };
    4: {
        max: number;
        current: number;
    };
    5: {
        max: number;
        current: number;
    };
    6: {
        max: number;
        current: number;
    };
    7: {
        max: number;
        current: number;
    };
    8: {
        max: number;
        current: number;
    };
    9: {
        max: number;
        current: number;
    };
}
export interface CastingResult {
    success: boolean;
    spellSlotUsed: number;
    effects: Array<{
        type: string;
        target: string;
        result: DamageResult | {
            amount: number;
        } | {
            condition: string;
        } | any;
    }>;
    conditions?: Array<{
        target: string;
        condition: string;
        duration: number;
    }>;
    error?: string;
}
export declare class SpellEngine {
    private dice;
    private conditions;
    constructor();
    /**
     * Cast a spell with automatic effect resolution
     */
    castSpell(spell: Spell, caster: any, targets: string[], spellLevel?: number, position?: {
        x: number;
        y: number;
    }): CastingResult;
    private resolveSpellEffect;
    private hasSpellSlot;
    private consumeSpellSlot;
    private rollSavingThrow;
    private scaleDamage;
    private scaleHealing;
    private parseDuration;
    /**
     * End concentration on a spell
     */
    endConcentration(caster: any): void;
    /**
     * Check concentration when taking damage
     */
    checkConcentration(caster: any, damage: number): boolean;
    /**
     * Restore spell slots (long rest)
     */
    restoreSpellSlots(caster: any): void;
    /**
     * Get available spell slots
     */
    getAvailableSlots(caster: any): Partial<SpellSlots>;
}
export declare const D5E_SPELLS: Record<string, Spell>;
export declare const spellEngine: SpellEngine;
//# sourceMappingURL=index.d.ts.map