/**
 * Computational Spell System - Full Machine-Executable Spell Logic
 * Every spell effect is defined as computational primitives that can be executed algorithmically
 */
export interface Vector3D {
    x: number;
    y: number;
    z: number;
}
export interface GameEntity {
    id: string;
    position: Vector3D;
    hitPoints: {
        current: number;
        maximum: number;
    };
    armorClass: number;
    savingThrows: Record<string, number>;
    conditions: Set<string>;
    resistances: Set<string>;
    immunities: Set<string>;
    vulnerabilities: Set<string>;
}
export interface ExecutionContext {
    caster: GameEntity;
    targets: GameEntity[];
    environment: {
        entities: Map<string, GameEntity>;
        obstacles: any[];
        lighting: number;
        temperature: number;
    };
    dice: (_sides: number, _count?: number) => number[];
    time: number;
}
export type EffectPrimitive = DamageEffect | HealingEffect | MovementEffect | ConditionEffect | TransformationEffect | SummonEffect | GeometryEffect | TimeEffect | InformationEffect;
export interface DamageEffect {
    type: 'damage';
    amount: (_ctx: ExecutionContext) => number;
    damageType: string;
    savingThrow?: {
        ability: string;
        dc: (_ctx: ExecutionContext) => number;
        onSave: 'half' | 'none' | 'negate';
    };
    targetFilter: (_entity: GameEntity, _ctx: ExecutionContext) => boolean;
    areaOfEffect?: GeometryPrimitive;
}
export interface HealingEffect {
    type: 'healing';
    amount: (_ctx: ExecutionContext) => number;
    targetFilter: (_entity: GameEntity, _ctx: ExecutionContext) => boolean;
    constraints?: {
        maxTargets?: number;
        requiresLiving?: boolean;
        excludeUndead?: boolean;
    };
}
export interface MovementEffect {
    type: 'movement';
    mode: 'teleport' | 'push' | 'pull' | 'speed_change' | 'flight';
    magnitude: (_ctx: ExecutionContext) => number;
    direction?: (_ctx: ExecutionContext) => Vector3D;
    duration?: (_ctx: ExecutionContext) => number;
    constraints?: {
        requiresLineOfSight?: boolean;
        maxRange?: number;
        blockedByObstacles?: boolean;
    };
}
export interface ConditionEffect {
    type: 'condition';
    condition: string;
    duration: (_ctx: ExecutionContext) => number;
    savingThrow?: {
        ability: string;
        dc: (_ctx: ExecutionContext) => number;
        repeatInterval: number;
        endOnSuccess: boolean;
    };
    targetFilter: (_entity: GameEntity, _ctx: ExecutionContext) => boolean;
}
export interface GeometryPrimitive {
    type: 'sphere' | 'cube' | 'line' | 'cone' | 'cylinder';
    origin: (_ctx: ExecutionContext) => Vector3D;
    size: (_ctx: ExecutionContext) => number;
    rotation?: (_ctx: ExecutionContext) => Vector3D;
}
export interface TransformationEffect {
    type: 'transformation';
    property: string;
    operation: 'set' | 'add' | 'multiply' | 'min' | 'max';
    value: (_ctx: ExecutionContext) => any;
    duration?: (_ctx: ExecutionContext) => number;
}
export interface SummonEffect {
    type: 'summon';
    entityTemplate: string;
    count: (_ctx: ExecutionContext) => number;
    placement: (_ctx: ExecutionContext) => Vector3D[];
    duration: (_ctx: ExecutionContext) => number;
    control: 'caster' | 'autonomous' | 'hostile';
}
export interface GeometryEffect {
    type: 'geometry';
    operation: 'create_barrier' | 'create_difficult_terrain' | 'create_hazard' | 'remove_obstacle';
    geometry: GeometryPrimitive;
    properties: Record<string, any>;
    duration?: (_ctx: ExecutionContext) => number;
}
export interface TimeEffect {
    type: 'time';
    operation: 'delay' | 'trigger_condition' | 'duration_modifier';
    parameters: Record<string, (_ctx: ExecutionContext) => any>;
}
export interface InformationEffect {
    type: 'information';
    operation: 'detect' | 'scry' | 'communicate' | 'memory_modify';
    parameters: Record<string, (_ctx: ExecutionContext) => any>;
}
export interface ComputationalSpell {
    id: string;
    metadata: {
        name: string;
        level: number;
        school: string;
        classes: string[];
        source: string;
    };
    requirements: {
        components: {
            verbal: boolean;
            somatic: boolean;
            material?: {
                required: boolean;
                consumed: boolean;
                cost?: number;
                validator?: (_ctx: ExecutionContext) => boolean;
            };
        };
        castingTime: (_ctx: ExecutionContext) => number;
        range: (_ctx: ExecutionContext) => number;
        concentration: boolean;
        ritual: boolean;
    };
    targetSelection: {
        mode: 'single' | 'multiple' | 'area' | 'self' | 'line_of_effect';
        count?: (_ctx: ExecutionContext) => number;
        filter: (_entity: GameEntity, _ctx: ExecutionContext) => boolean;
        geometry?: GeometryPrimitive;
    };
    effects: EffectPrimitive[];
    scaling?: {
        parameter: 'slot_level' | 'caster_level';
        effects: Array<{
            threshold: number;
            modifications: Array<{
                effectIndex: number;
                property: string;
                operation: 'add' | 'multiply' | 'replace';
                value: (_level: number, _ctx: ExecutionContext) => any;
            }>;
        }>;
    };
    preExecution?: (_ctx: ExecutionContext) => ExecutionContext;
    postExecution?: (_ctx: ExecutionContext, _results: EffectResult[]) => void;
    canCast: (_ctx: ExecutionContext) => {
        valid: boolean;
        reason?: string;
    };
}
export interface EffectResult {
    effectIndex: number;
    success: boolean;
    targets: string[];
    values?: Record<string, any>;
    modifications?: Array<{
        entityId: string;
        property: string;
        oldValue: any;
        newValue: any;
    }>;
}
export declare class SpellExecutionEngine {
    execute(spell: ComputationalSpell, ctx: ExecutionContext, slotLevel?: number): {
        success: boolean;
        results: EffectResult[];
        error?: string;
    };
    private executeEffect;
    private executeDamageEffect;
    private executeHealingEffect;
    private executeMovementEffect;
    private executeConditionEffect;
    private executeTransformationEffect;
    private executeSummonEffect;
    private executeGeometryEffect;
    private executeTimeEffect;
    private executeInformationEffect;
    private applyDamageResistance;
    private applyScaling;
    private applyPropertyModification;
    private updateContext;
    private setNestedProperty;
}
export declare const spellExecutionEngine: SpellExecutionEngine;
//# sourceMappingURL=ComputationalSpellSystem.d.ts.map