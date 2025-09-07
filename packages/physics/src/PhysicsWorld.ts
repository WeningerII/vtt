/**
 * Physics World - manages all rigid bodies and simulates physics
 */

import { RigidBody, Vector2, RigidBodyConfig } from "./RigidBody";
import { SpatialGrid } from "./SpatialGrid";
import { EventEmitter } from "node:events";

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

export class PhysicsWorld extends EventEmitter {
  private bodies: Map<number, RigidBody> = new Map();
  private spatialGrid: SpatialGrid;
  private config: PhysicsWorldConfig;
  private time: number = 0;
  private fixedTimeStep: number = 1 / 60; // 60 FPS
  private accumulator: number = 0;

  constructor(config: Partial<PhysicsWorldConfig> = {}) {
    super();

    this.config = {
      gravity: config.gravity || { x: 0, y: 0 },
      cellSize: config.cellSize || 100,
      maxVelocity: config.maxVelocity || 1000,
      sleepThreshold: config.sleepThreshold || 0.1,
      positionIterations: config.positionIterations || 4,
      velocityIterations: config.velocityIterations || 8,
    };

    this.spatialGrid = new SpatialGrid(this.config.cellSize);
  }

  /**
   * Add a rigid body to the world
   */
  addBody(body: RigidBody): void {
    this.bodies.set(body.id, body);
    this.updateBodyInGrid(body);
    this.emit("bodyAdded", body);
  }

  /**
   * Remove a rigid body from the world
   */
  removeBody(bodyId: number): RigidBody | null {
    const body = this.bodies.get(bodyId);
    if (body) {
      this.bodies.delete(bodyId);
      this.spatialGrid.removeEntity(bodyId);
      this.emit("bodyRemoved", body);
      return body;
    }
    return null;
  }

  /**
   * Get a rigid body by ID
   */
  getBody(bodyId: number): RigidBody | undefined {
    return this.bodies.get(bodyId);
  }

  /**
   * Get all bodies
   */
  getAllBodies(): RigidBody[] {
    return Array.from(this.bodies.values());
  }

  /**
   * Update physics simulation
   */
  update(deltaTime: number): void {
    // Fixed timestep with accumulator
    this.accumulator += deltaTime;

    while (this.accumulator >= this.fixedTimeStep) {
      this.step(this.fixedTimeStep);
      this.accumulator -= this.fixedTimeStep;
      this.time += this.fixedTimeStep;
    }
  }

  /**
   * Single physics step
   */
  private step(deltaTime: number): void {
    // Apply gravity to all bodies
    this.applyGravity();

    // Integrate forces and update positions
    this.integrateBodies(deltaTime);

    // Update spatial grid
    this.updateSpatialGrid();

    // Detect collisions
    const collisions = this.detectCollisions();

    // Resolve collisions
    this.resolveCollisions(collisions);

    // Apply velocity constraints
    this.constrainVelocities();

    this.emit("step", deltaTime);
  }

  /**
   * Apply gravity to all dynamic bodies
   */
  private applyGravity(): void {
    if (this.config.gravity.x === 0 && this.config.gravity.y === 0) {return;}

    for (const body of this.bodies.values()) {
      if (!body.config.isStatic) {
        body.applyGravity(this.config.gravity);
      }
    }
  }

  /**
   * Integrate all body physics
   */
  private integrateBodies(deltaTime: number): void {
    for (const body of this.bodies.values()) {
      body.integrate(deltaTime);
    }
  }

  /**
   * Update spatial grid with new body positions
   */
  private updateSpatialGrid(): void {
    for (const body of this.bodies.values()) {
      this.updateBodyInGrid(body);
    }
  }

  /**
   * Update a single body in the spatial grid
   */
  private updateBodyInGrid(body: RigidBody): void {
    const aabb = body.getAABB();
    this.spatialGrid.updateEntity(body.id, aabb);
  }

  /**
   * Detect collisions using spatial grid
   */
  private detectCollisions(): CollisionInfo[] {
    const collisions: CollisionInfo[] = [];
    const potentialPairs = this.spatialGrid.getPotentialCollisions();

    for (const [idA, idB] of potentialPairs) {
      const bodyA = this.bodies.get(idA);
      const bodyB = this.bodies.get(idB);

      if (!bodyA || !bodyB || !bodyA.shouldCollideWith(bodyB)) {continue;}

      const collision = this.checkAABBCollision(bodyA, bodyB);
      if (collision) {
        collisions.push(collision);
        this.emit("collision", collision);
      }
    }

    return collisions;
  }

  /**
   * Check AABB collision between two bodies
   */
  private checkAABBCollision(bodyA: RigidBody, bodyB: RigidBody): CollisionInfo | null {
    const aabbA = bodyA.getAABB();
    const aabbB = bodyB.getAABB();

    // Check overlap
    const overlapX = Math.min(aabbA.maxX, aabbB.maxX) - Math.max(aabbA.minX, aabbB.minX);
    const overlapY = Math.min(aabbA.maxY, aabbB.maxY) - Math.max(aabbA.minY, aabbB.minY);

    if (overlapX <= 0 || overlapY <= 0) {return null;}

    // Calculate collision normal and penetration
    let normal: Vector2;
    let penetration: number;

    if (overlapX < overlapY) {
      // Collision along X axis
      penetration = overlapX;
      normal = bodyA.position.x < bodyB.position.x ? { x: -1, y: 0 } : { x: 1, y: 0 };
    } else {
      // Collision along Y axis
      penetration = overlapY;
      normal = bodyA.position.y < bodyB.position.y ? { x: 0, y: -1 } : { x: 0, y: 1 };
    }

    // Calculate contact point
    const contactPoint: Vector2 = {
      x: (aabbA.minX + aabbA.maxX + aabbB.minX + aabbB.maxX) * 0.25,
      y: (aabbA.minY + aabbA.maxY + aabbB.minY + aabbB.maxY) * 0.25,
    };

    return {
      bodyA,
      bodyB,
      normal,
      penetration,
      contactPoint,
    };
  }

  /**
   * Resolve all collisions
   */
  private resolveCollisions(collisions: CollisionInfo[]): void {
    // Iterate multiple times for better stability
    for (let i = 0; i < this.config.positionIterations; i++) {
      for (const collision of collisions) {
        collision.bodyA.resolveCollision(collision.bodyB, collision.normal, collision.penetration);
      }
    }
  }

  /**
   * Apply velocity constraints
   */
  private constrainVelocities(): void {
    for (const body of this.bodies.values()) {
      if (body.config.isStatic) {continue;}

      // Max velocity constraint
      const speed = Math.sqrt(
        body.velocity.x * body.velocity.x + body.velocity.y * body.velocity.y,
      );
      if (speed > this.config.maxVelocity) {
        const scale = this.config.maxVelocity / speed;
        body.velocity.x *= scale;
        body.velocity.y *= scale;
      }

      // Sleep threshold
      if (speed < this.config.sleepThreshold) {
        body.velocity.x *= 0.98;
        body.velocity.y *= 0.98;
      }
    }
  }

  /**
   * Query bodies in a region
   */
  queryRegion(minX: number, minY: number, maxX: number, maxY: number): RigidBody[] {
    const entityIds = this.spatialGrid.queryRegion({ minX, minY, maxX, maxY });
    return entityIds
      .map((id) => this.bodies.get(id))
      .filter((body): body is RigidBody => body !== undefined);
  }

  /**
   * Query bodies at a point
   */
  queryPoint(x: number, y: number): RigidBody[] {
    const entityIds = this.spatialGrid.queryPoint(x, y);
    return entityIds
      .map((id) => this.bodies.get(id))
      .filter((body): body is RigidBody => body !== undefined);
  }

  /**
   * Raycast from point in direction
   */
  raycast(
    origin: Vector2,
    direction: Vector2,
    maxDistance: number,
  ): {
    hit: boolean;
    body?: RigidBody;
    point?: Vector2;
    normal?: Vector2;
    distance?: number;
  } {
    // Normalize direction
    const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (length === 0) {return { hit: false };}

    const normalizedDir = { x: direction.x / length, y: direction.y / length };

    // Step along ray
    const stepSize = Math.min(this.config.cellSize * 0.1, maxDistance * 0.01);
    let currentDistance = 0;

    while (currentDistance < maxDistance) {
      const testPoint = {
        x: origin.x + normalizedDir.x * currentDistance,
        y: origin.y + normalizedDir.y * currentDistance,
      };

      const bodies = this.queryPoint(testPoint.x, testPoint.y);

      for (const body of bodies) {
        if (!body.config.isTrigger) {
          // Calculate surface normal (simplified for AABB)
          const center = body.position;
          const toCenter = { x: center.x - testPoint.x, y: center.y - testPoint.y };
          const absX = Math.abs(toCenter.x);
          const absY = Math.abs(toCenter.y);

          let normal: Vector2;
          if (absX > absY) {
            normal = { x: toCenter.x > 0 ? 1 : -1, y: 0 };
          } else {
            normal = { x: 0, y: toCenter.y > 0 ? 1 : -1 };
          }

          return {
            hit: true,
            body,
            point: testPoint,
            normal,
            distance: currentDistance,
          };
        }
      }

      currentDistance += stepSize;
    }

    return { hit: false };
  }

  /**
   * Set gravity
   */
  setGravity(gravity: Vector2): void {
    this.config.gravity = gravity;
  }

  /**
   * Get current time
   */
  getTime(): number {
    return this.time;
  }

  /**
   * Get physics statistics
   */
  getStats(): {
    bodyCount: number;
    activeBodyCount: number;
    gridStats: any;
  } {
    const activeBodies = Array.from(this.bodies.values()).filter(
      (body) =>
        !body.config.isStatic &&
        (Math.abs(body.velocity.x) > this.config.sleepThreshold ||
          Math.abs(body.velocity.y) > this.config.sleepThreshold),
    );

    return {
      bodyCount: this.bodies.size,
      activeBodyCount: activeBodies.length,
      gridStats: this.spatialGrid.getStats(),
    };
  }

  /**
   * Create a new rigid body
   */
  createBody(config: {
    position: Vector2;
    type: "static" | "dynamic" | "kinematic";
    size?: Vector2;
    mass?: number;
    friction?: number;
    restitution?: number;
    isTrigger?: boolean;
    layer?: number;
    mask?: number;
  }): RigidBody {
    const bodyConfig: RigidBodyConfig = {
      mass: config.mass || (config.type === "static" ? 0 : 1),
      friction: config.friction || 0.3,
      restitution: config.restitution || 0.2,
      isStatic: config.type === "static",
      isTrigger: config.isTrigger || false,
      layer: config.layer || 1,
      mask: config.mask || 0xFFFFFFFF,
    };

    const size = config.size || { x: 32, y: 32 };
    const body = new RigidBody(
      this.getNextBodyId(),
      config.position.x,
      config.position.y,
      size.x,
      size.y,
      bodyConfig
    );

    this.addBody(body);
    return body;
  }

  /**
   * Get next available body ID
   */
  private getNextBodyId(): number {
    let id = 1;
    while (this.bodies.has(id)) {
      id++;
    }
    return id;
  }

  /**
   * Clear all bodies
   */
  clear(): void {
    this.bodies.clear();
    this.spatialGrid.clear();
    this.time = 0;
    this.accumulator = 0;
  }
}
