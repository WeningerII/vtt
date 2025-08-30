/**
 * Spell Physics Integration - Computational Physics for Spell Effects
 * Integrates computational spell system with 3D physics simulation
 */
import { ComputationalSpell, ExecutionContext, GameEntity, Vector3D } from './ComputationalSpellSystem';
export interface PhysicsWorld {
    entities: Map<string, PhysicsEntity>;
    gravity: Vector3D;
    airResistance: number;
    timeStep: number;
    collisionDetection: CollisionSystem;
}
export interface PhysicsEntity extends GameEntity {
    velocity: Vector3D;
    acceleration: Vector3D;
    mass: number;
    boundingBox: BoundingBox;
    collisionMask: number;
    forces: Vector3D[];
    isStatic: boolean;
}
export interface BoundingBox {
    min: Vector3D;
    max: Vector3D;
}
export interface CollisionSystem {
    checkCollision(entity1: PhysicsEntity, entity2: PhysicsEntity): CollisionResult | null;
    raycast(origin: Vector3D, direction: Vector3D, maxDistance: number): RaycastHit[];
}
export interface CollisionResult {
    point: Vector3D;
    normal: Vector3D;
    penetration: number;
}
export interface RaycastHit {
    entity: PhysicsEntity;
    point: Vector3D;
    normal: Vector3D;
    distance: number;
}
export interface PhysicsSpellEffect {
    type: 'projectile' | 'area_field' | 'force_application' | 'teleportation' | 'transformation';
    duration: (_ctx: ExecutionContext) => number;
    physics: PhysicsParameters;
}
export interface PhysicsParameters {
    velocity?: (_ctx: ExecutionContext) => Vector3D;
    acceleration?: (_ctx: ExecutionContext) => Vector3D;
    mass?: (_ctx: ExecutionContext) => number;
    drag?: number;
    bounce?: number;
    lifetime?: (_ctx: ExecutionContext) => number;
    onCollision?: (_collision: CollisionResult, _ctx: ExecutionContext) => void;
    fieldStrength?: (_position: Vector3D, _time: number) => number;
    fieldGradient?: (_position: Vector3D, _time: number) => Vector3D;
}
export declare class GeometryCalculator {
    static getEntitiesInSphere(center: Vector3D, radius: number, entities: PhysicsEntity[]): PhysicsEntity[];
    static getEntitiesInCube(center: Vector3D, size: number, entities: PhysicsEntity[]): PhysicsEntity[];
    static getEntitiesInCone(apex: Vector3D, direction: Vector3D, angle: number, length: number, entities: PhysicsEntity[]): PhysicsEntity[];
    static getEntitiesInLine(start: Vector3D, end: Vector3D, width: number, entities: PhysicsEntity[]): PhysicsEntity[];
    static distancePointToLine(point: Vector3D, lineStart: Vector3D, lineEnd: Vector3D): number;
    static distance(a: Vector3D, b: Vector3D): number;
    static add(a: Vector3D, b: Vector3D): Vector3D;
    static subtract(a: Vector3D, b: Vector3D): Vector3D;
    static multiply(v: Vector3D, scalar: number): Vector3D;
    static normalize(v: Vector3D): Vector3D;
    static magnitude(v: Vector3D): number;
    static dot(a: Vector3D, b: Vector3D): number;
    static cross(a: Vector3D, b: Vector3D): Vector3D;
}
export declare class PhysicsSpellExecutor {
    private physicsWorld;
    private activeEffects;
    constructor(physicsWorld: PhysicsWorld);
    executeSpellWithPhysics(spell: ComputationalSpell, ctx: ExecutionContext): {
        success: boolean;
        physicsEffects: ActivePhysicsEffect[];
        error?: string;
    };
    private convertToPhysicsEffect;
    private createProjectilePhysics;
    private createAreaDamagePhysics;
    private createForcePhysics;
    private createGeometryPhysics;
    updatePhysics(deltaTime: number): void;
    private updateEffect;
    private updateProjectile;
    private updateAreaField;
    private updateForceApplication;
    private updatePhysicsWorld;
    private checkCollisions;
    private resolveCollisions;
    private findEntityAtPosition;
    private applyDamageEffect;
    private createActiveEffect;
    private removeEffect;
}
interface ActivePhysicsEffect {
    id: string;
    physicsEffect: PhysicsSpellEffect;
    context: ExecutionContext;
    startTime: number;
    entity?: PhysicsEntity;
}
export { GeometryCalculator, PhysicsSpellExecutor };
//# sourceMappingURL=SpellPhysicsIntegration.d.ts.map