/**
 * Rigid body physics component for VTT entities
 */
export interface Vector2 {
    x: number;
    y: number;
}
export interface RigidBodyConfig {
    mass: number;
    friction: number;
    restitution: number;
    isStatic: boolean;
    isTrigger: boolean;
    layer: number;
    mask: number;
}
export declare class RigidBody {
    id: number;
    position: Vector2;
    velocity: Vector2;
    acceleration: Vector2;
    rotation: number;
    angularVelocity: number;
    config: RigidBodyConfig;
    width: number;
    height: number;
    private forces;
    private torques;
    constructor(id: number, x?: number, y?: number, width?: number, height?: number, config?: Partial<RigidBodyConfig>);
    /**
     * Add force to be applied this frame
     */
    addForce(force: Vector2): void;
    /**
     * Add impulse (instantaneous force)
     */
    addImpulse(impulse: Vector2): void;
    /**
     * Add torque for rotation
     */
    addTorque(torque: number): void;
    /**
     * Get axis-aligned bounding box
     */
    getAABB(): {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    };
    /**
     * Check if this body should collide with another
     */
    shouldCollideWith(other: RigidBody): boolean;
    /**
     * Integrate physics (called by physics system)
     */
    integrate(deltaTime: number): void;
    /**
     * Apply collision response with another body
     */
    resolveCollision(other: RigidBody, normal: Vector2, penetration: number): void;
    /**
     * Set position (useful for teleporting)
     */
    setPosition(x: number, y: number): void;
    /**
     * Set velocity
     */
    setVelocity(x: number, y: number): void;
    /**
     * Stop all movement
     */
    stop(): void;
    /**
     * Apply gravity
     */
    applyGravity(gravity: Vector2): void;
}
//# sourceMappingURL=RigidBody.d.ts.map