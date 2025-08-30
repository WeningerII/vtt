/**
 * Physics World - manages all rigid bodies and simulates physics
 */
import { RigidBody, Vector2 } from './RigidBody';
import { EventEmitter } from 'events';
export interface CollisionInfo {
    bodyA: RigidBody;
    bodyB: RigidBody;
    normal: Vector2;
    penetration: number;
    contactPoint: Vector2;
}
export interface PhysicsWorldConfig {
    gravity: Vector2;
    cellSize: number;
    maxVelocity: number;
    sleepThreshold: number;
    positionIterations: number;
    velocityIterations: number;
}
export declare class PhysicsWorld extends EventEmitter {
    private bodies;
    private spatialGrid;
    private config;
    private time;
    private fixedTimeStep;
    private accumulator;
    constructor(config?: Partial<PhysicsWorldConfig>);
    /**
     * Add a rigid body to the world
     */
    addBody(body: RigidBody): void;
    /**
     * Remove a rigid body from the world
     */
    removeBody(bodyId: number): RigidBody | null;
    /**
     * Get a rigid body by ID
     */
    getBody(bodyId: number): RigidBody | undefined;
    /**
     * Get all bodies
     */
    getAllBodies(): RigidBody[];
    /**
     * Update physics simulation
     */
    update(deltaTime: number): void;
    /**
     * Single physics step
     */
    private step;
    /**
     * Apply gravity to all dynamic bodies
     */
    private applyGravity;
    /**
     * Integrate all body physics
     */
    private integrateBodies;
    /**
     * Update spatial grid with new body positions
     */
    private updateSpatialGrid;
    /**
     * Update a single body in the spatial grid
     */
    private updateBodyInGrid;
    /**
     * Detect collisions using spatial grid
     */
    private detectCollisions;
    /**
     * Check AABB collision between two bodies
     */
    private checkAABBCollision;
    /**
     * Resolve all collisions
     */
    private resolveCollisions;
    /**
     * Apply velocity constraints
     */
    private constrainVelocities;
    /**
     * Query bodies in a region
     */
    queryRegion(minX: number, minY: number, maxX: number, maxY: number): RigidBody[];
    /**
     * Query bodies at a point
     */
    queryPoint(x: number, y: number): RigidBody[];
    /**
     * Raycast from point in direction
     */
    raycast(origin: Vector2, direction: Vector2, maxDistance: number): {
        hit: boolean;
        body?: RigidBody;
        point?: Vector2;
        normal?: Vector2;
        distance?: number;
    };
    /**
     * Set gravity
     */
    setGravity(gravity: Vector2): void;
    /**
     * Get current time
     */
    getTime(): number;
    /**
     * Get physics statistics
     */
    getStats(): {
        bodyCount: number;
        activeBodyCount: number;
        gridStats: any;
    };
    /**
     * Clear all bodies
     */
    clear(): void;
}
//# sourceMappingURL=PhysicsWorld.d.ts.map