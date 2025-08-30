/**
 * Physics-Spell Bridge System
 * Integrates spell effects with physics simulation for realistic magical interactions
 */
import type { PhysicsWorld, Vector2 } from '../../../packages/physics/src';
import type { SpellEngine, SpellEffect, CastingResult } from '../../../packages/spell-engine/src';
import { EventEmitter } from 'events';
export interface PhysicsSpellEffect extends Omit<SpellEffect, 'type' | 'target'> {
    id?: string;
    name?: string;
    level?: number;
    school?: string;
    castingTime?: string;
    range?: string;
    components?: string[];
    duration?: string;
    description?: string;
    effects?: any[];
    concentration?: boolean;
    scaling?: any;
    ritual?: boolean;
    type?: "damage" | "healing" | "condition" | "teleport" | "summon" | "buff" | "debuff" | "utility" | "custom" | string;
    target?: "area" | "self" | "single" | "multiple" | "line" | "cone" | "sphere" | string;
    physics?: {
        type: 'force' | 'teleport' | 'constraint' | 'projectile' | 'area_barrier' | 'movement_modifier' | 'area_effect' | 'persistent_effect' | 'melee_effect' | 'mental_effect';
        force?: {
            magnitude: number;
            direction?: Vector2;
            duration?: number;
        };
        teleport?: {
            range: number;
            requiresLineOfSight: boolean;
        };
        constraint?: {
            type: 'immobilize' | 'slow' | 'entangle';
            strength: number;
            duration: number;
        };
        projectile?: {
            speed: number;
            gravity: boolean;
            piercing: boolean;
            maxBounces?: number;
            splash?: boolean;
            ethereal?: boolean;
            freezing?: boolean;
            onThrow?: boolean;
        };
        barrier?: {
            thickness: number;
            height: number;
            duration: number;
            passable: boolean;
        };
        movementModifier?: {
            type?: string;
            speedMultiplier: number;
            jumpMultiplier?: number;
            duration: number;
            magnitude?: number;
        };
        area?: {
            type: 'circle' | 'cone' | 'cylinder';
            radius: number;
            height?: string | number;
            angle?: number;
            origin?: string;
            affectsMultiple?: boolean;
            ignoresCover?: boolean;
            originatesFromAbove?: boolean;
        };
        particles?: {
            type: string;
            density: string;
            dispersal: string;
        };
        persistent?: {
            followsCaster: boolean;
            duration: number;
            light?: {
                bright: number;
                dim: number;
            };
        };
        melee?: {
            range: number;
            electrical?: boolean;
            advantageAgainstMetal?: boolean;
        };
        electrical?: {
            arcing?: boolean;
            conductivity?: boolean;
            disruptive?: boolean;
        };
        mental?: {
            requiresHearing?: boolean;
            psychic?: boolean;
            debuff?: string;
        };
        sound?: {
            audible?: boolean;
            range?: number;
            requiresLineOfSight?: boolean;
        };
        radiant?: {
            intensity?: string;
            piercesCover?: boolean;
        };
    };
}
export interface PhysicsAwareToken {
    id: string;
    physicsBodyId: number;
    position: Vector2;
    size: Vector2;
    canMove: boolean;
    movementSpeed: number;
    constraints: PhysicsConstraint[];
}
export interface PhysicsConstraint {
    id: string;
    type: 'immobilize' | 'slow' | 'entangle' | 'web';
    strength: number;
    duration: number;
    sourceSpell?: string;
    expiresAt: number;
}
export interface SpellProjectile {
    id: string;
    spellId: string;
    casterId: string;
    physicsBodyId: number;
    targetIds: string[];
    onHit: (_targetId: string) => void;
    onExpire: () => void;
}
export declare class PhysicsSpellBridge extends EventEmitter {
    private physicsWorld;
    private spellEngine;
    private tokens;
    private projectiles;
    private barriers;
    private activeConstraints;
    constructor(physicsWorld: PhysicsWorld, spellEngine: SpellEngine);
    /**
     * Register a token with physics awareness
     */
    registerToken(tokenId: string, position: Vector2, size: Vector2): void;
    /**
     * Cast spell with physics integration
     */
    castSpellWithPhysics(spell: PhysicsSpellEffect, caster: any, targets: string[], spellLevel?: number, position?: Vector2): Promise<CastingResult & {
        physicsEffects: any[];
    }>;
    /**
     * Apply force to targets (e.g., Thunderwave, Eldritch Blast)
     */
    private applyForceEffect;
    /**
     * Apply teleport effect (e.g., Misty Step, Dimension Door)
     */
    private applyTeleportEffect;
    /**
     * Apply movement constraints (e.g., Web, Entangle, Hold Person)
     */
    private applyConstraintEffect;
    /**
     * Create spell projectile (e.g., Magic Missile, Firebolt)
     */
    private createProjectile;
    /**
     * Create area barrier (e.g., Wall of Force, Wall of Fire)
     */
    private createAreaBarrier;
    /**
     * Apply movement speed modifiers (e.g., Haste, Slow)
     */
    private applyMovementModifier;
    /**
     * Handle projectile collision
     */
    private handleProjectileHit;
    /**
     * Clean up projectile
     */
    private cleanupProjectile;
    /**
     * Update physics-spell integration (called each frame)
     */
    update(deltaTime: number): void;
    /**
     * Remove constraint from token
     */
    private removeConstraint;
    /**
     * Setup physics world integration
     */
    private setupPhysicsIntegration;
    /**
     * Handle physics collision for spell interactions
     */
    private handlePhysicsCollision;
    /**
     * Find token by physics body ID
     */
    private findTokenByBodyId;
    /**
     * Get token physics state
     */
    getTokenState(tokenId: string): PhysicsAwareToken | undefined;
    /**
     * Check if area spell affects targets using physics collision
     */
    getTargetsInArea(center: Vector2, radius: number, height?: number): string[];
}
export declare const createPhysicsSpellBridge: (_physicsWorld: PhysicsWorld, _spellEngine: SpellEngine) => PhysicsSpellBridge;
//# sourceMappingURL=index.d.ts.map