/**
 * Physics World - manages all rigid bodies and simulates physics
 */
import { SpatialGrid } from "./SpatialGrid";
import { EventEmitter } from "events";
export class PhysicsWorld extends EventEmitter {
  constructor(config = {}) {
    super();
    this.bodies = new Map();
    this.time = 0;
    this.fixedTimeStep = 1 / 60; // 60 FPS
    this.accumulator = 0;
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
  addBody(body) {
    this.bodies.set(body.id, body);
    this.updateBodyInGrid(body);
    this.emit("bodyAdded", body);
  }
  /**
   * Remove a rigid body from the world
   */
  removeBody(bodyId) {
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
  getBody(bodyId) {
    return this.bodies.get(bodyId);
  }
  /**
   * Get all bodies
   */
  getAllBodies() {
    return Array.from(this.bodies.values());
  }
  /**
   * Update physics simulation
   */
  update(deltaTime) {
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
  step(deltaTime) {
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
  applyGravity() {
    if (this.config.gravity.x === 0 && this.config.gravity.y === 0) return;
    for (const body of this.bodies.values()) {
      if (!body.config.isStatic) {
        body.applyGravity(this.config.gravity);
      }
    }
  }
  /**
   * Integrate all body physics
   */
  integrateBodies(deltaTime) {
    for (const body of this.bodies.values()) {
      body.integrate(deltaTime);
    }
  }
  /**
   * Update spatial grid with new body positions
   */
  updateSpatialGrid() {
    for (const body of this.bodies.values()) {
      this.updateBodyInGrid(body);
    }
  }
  /**
   * Update a single body in the spatial grid
   */
  updateBodyInGrid(body) {
    const aabb = body.getAABB();
    this.spatialGrid.updateEntity(body.id, aabb);
  }
  /**
   * Detect collisions using spatial grid
   */
  detectCollisions() {
    const collisions = [];
    const potentialPairs = this.spatialGrid.getPotentialCollisions();
    for (const [idA, idB] of potentialPairs) {
      const bodyA = this.bodies.get(idA);
      const bodyB = this.bodies.get(idB);
      if (!bodyA || !bodyB || !bodyA.shouldCollideWith(bodyB)) continue;
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
  checkAABBCollision(bodyA, bodyB) {
    const aabbA = bodyA.getAABB();
    const aabbB = bodyB.getAABB();
    // Check overlap
    const overlapX = Math.min(aabbA.maxX, aabbB.maxX) - Math.max(aabbA.minX, aabbB.minX);
    const overlapY = Math.min(aabbA.maxY, aabbB.maxY) - Math.max(aabbA.minY, aabbB.minY);
    if (overlapX <= 0 || overlapY <= 0) return null;
    // Calculate collision normal and penetration
    let normal;
    let penetration;
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
    const contactPoint = {
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
  resolveCollisions(collisions) {
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
  constrainVelocities() {
    for (const body of this.bodies.values()) {
      if (body.config.isStatic) continue;
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
  queryRegion(minX, minY, maxX, maxY) {
    const entityIds = this.spatialGrid.queryRegion({ minX, minY, maxX, maxY });
    return entityIds.map((id) => this.bodies.get(id)).filter((body) => body !== undefined);
  }
  /**
   * Query bodies at a point
   */
  queryPoint(x, y) {
    const entityIds = this.spatialGrid.queryPoint(x, y);
    return entityIds.map((id) => this.bodies.get(id)).filter((body) => body !== undefined);
  }
  /**
   * Raycast from point in direction
   */
  raycast(origin, direction, maxDistance) {
    // Normalize direction
    const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (length === 0) return { hit: false };
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
          let normal;
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
  setGravity(gravity) {
    this.config.gravity = gravity;
  }
  /**
   * Get current time
   */
  getTime() {
    return this.time;
  }
  /**
   * Get physics statistics
   */
  getStats() {
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
   * Clear all bodies
   */
  clear() {
    this.bodies.clear();
    this.spatialGrid.clear();
    this.time = 0;
    this.accumulator = 0;
  }
}
//# sourceMappingURL=PhysicsWorld.js.map
