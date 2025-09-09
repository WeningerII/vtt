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
  restitution: number; // bounciness
  isStatic: boolean;
  isTrigger: boolean; // collision detection without physics response
  layer: number; // collision layer
  mask: number; // which layers this body collides with
}

export class RigidBody {
  public id: number;
  public position: Vector2;
  public velocity: Vector2;
  public acceleration: Vector2;
  public rotation: number;
  public angularVelocity: number;
  public config: RigidBodyConfig;

  // Collision shape (AABB for simplicity)
  public width: number;
  public height: number;

  // Force accumulator
  private forces: Vector2[];
  private torques: number[];

  constructor(
    id: number,
    x: number = 0,
    y: number = 0,
    width: number = 1,
    height: number = 1,
    config: Partial<RigidBodyConfig> = {},
  ) {
    this.id = id;
    this.position = { x, y };
    this.velocity = { x: 0, y: 0 };
    this.acceleration = { x: 0, y: 0 };
    this.rotation = 0;
    this.angularVelocity = 0;
    this.width = width;
    this.height = height;
    this.forces = [];
    this.torques = [];

    this.config = {
      mass: config.mass ?? 1,
      friction: config.friction ?? 0.5,
      restitution: config.restitution ?? 0.3,
      isStatic: config.isStatic ?? false,
      isTrigger: config.isTrigger ?? false,
      layer: config.layer ?? 0, // Use 0-based layer indexing for consistency with bit operations
      mask: config.mask ?? 0xffffffff,
    };
  }

  /**
   * Add force to be applied this frame
   */
  addForce(force: Vector2): void {
    if (this.config.isStatic) {return;}
    this.forces.push({ ...force });
  }

  /**
   * Add impulse (instantaneous force)
   */
  addImpulse(impulse: Vector2): void {
    if (this.config.isStatic) {return;}
    this.velocity.x += impulse.x / this.config.mass;
    this.velocity.y += impulse.y / this.config.mass;
  }

  /**
   * Add torque for rotation
   */
  addTorque(torque: number): void {
    if (this.config.isStatic) {return;}
    this.torques.push(torque);
  }

  /**
   * Get axis-aligned bounding box
   */
  getAABB(): { minX: number; minY: number; maxX: number; maxY: number } {
    const halfWidth = this.width * 0.5;
    const halfHeight = this.height * 0.5;

    return {
      minX: this.position.x - halfWidth,
      minY: this.position.y - halfHeight,
      maxX: this.position.x + halfWidth,
      maxY: this.position.y + halfHeight,
    };
  }

  /**
   * Check if this body should collide with another
   */
  shouldCollideWith(other: RigidBody): boolean {
    // Check layer mask
    const layerCheck = (this.config.mask & (1 << other.config.layer)) !== 0;
    const otherLayerCheck = (other.config.mask & (1 << this.config.layer)) !== 0;

    return layerCheck && otherLayerCheck;
  }

  /**
   * Integrate physics (called by physics system)
   */
  integrate(deltaTime: number): void {
    if (this.config.isStatic) {return;}

    // Apply forces
    this.acceleration.x = 0;
    this.acceleration.y = 0;

    for (const force of this.forces) {
      this.acceleration.x += force.x / this.config.mass;
      this.acceleration.y += force.y / this.config.mass;
    }

    // Apply friction with clamping to prevent negative damping
    const linearDamping = Math.max(0, 1 - this.config.friction * deltaTime);
    this.velocity.x *= linearDamping;
    this.velocity.y *= linearDamping;

    // Integrate velocity
    this.velocity.x += this.acceleration.x * deltaTime;
    this.velocity.y += this.acceleration.y * deltaTime;

    // Integrate position
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;

    // Apply torques
    let totalTorque = 0;
    for (const torque of this.torques) {
      totalTorque += torque;
    }

    // Simple angular integration (moment of inertia = 1 for simplicity)
    this.angularVelocity += totalTorque * deltaTime;
    const angularDamping = Math.max(0, 1 - this.config.friction * deltaTime);
    this.angularVelocity *= angularDamping;
    this.rotation += this.angularVelocity * deltaTime;

    // Clear force accumulators
    this.forces = [];
    this.torques = [];
  }

  /**
   * Apply collision response with another body
   */
  resolveCollision(other: RigidBody, normal: Vector2, penetration: number): void {
    if (this.config.isTrigger || other.config.isTrigger) {return;}
    if (this.config.isStatic && other.config.isStatic) {return;}

    // Calculate relative velocity
    const relativeVelocity = {
      x: this.velocity.x - other.velocity.x,
      y: this.velocity.y - other.velocity.y,
    };

    // Calculate relative velocity in collision normal direction
    const velAlongNormal = relativeVelocity.x * normal.x + relativeVelocity.y * normal.y;

    // Don't resolve if velocities are separating
    if (velAlongNormal > 0) {return;}

    // Calculate restitution
    const restitution = Math.min(this.config.restitution, other.config.restitution);

    // Calculate impulse using proper inverse mass formula
    // j = -(1 + e) * vr·n / (1/m1 + 1/m2)
    const invMass1 = this.config.isStatic ? 0 : 1 / this.config.mass;
    const invMass2 = other.config.isStatic ? 0 : 1 / other.config.mass;
    const invMassSum = invMass1 + invMass2;
    
    if (invMassSum === 0) {return;} // Both static - shouldn't happen due to earlier check
    
    const impulseScalar = -(1 + restitution) * velAlongNormal / invMassSum;

    // Apply impulse using Newton's 3rd law (equal and opposite)
    const impulse = {
      x: impulseScalar * normal.x,
      y: impulseScalar * normal.y,
    };

    if (!this.config.isStatic) {
      this.velocity.x += impulse.x * invMass1;
      this.velocity.y += impulse.y * invMass1;
    }

    if (!other.config.isStatic) {
      other.velocity.x -= impulse.x * invMass2;
      other.velocity.y -= impulse.y * invMass2;
    }

    // Position correction to prevent sinking (using proper inverse mass weighting)
    const correctionPercent = 0.8;
    const slop = 0.01;
    const correctionMagnitude = Math.max(penetration - slop, 0) * correctionPercent;
    
    if (correctionMagnitude > 0 && invMassSum > 0) {
      const correction = {
        x: (correctionMagnitude * normal.x) / invMassSum,
        y: (correctionMagnitude * normal.y) / invMassSum,
      };

      if (!this.config.isStatic) {
        this.position.x += correction.x * invMass1;
        this.position.y += correction.y * invMass1;
      }

      if (!other.config.isStatic) {
        other.position.x -= correction.x * invMass2;
        other.position.y -= correction.y * invMass2;
      }
    }
  }

  /**
   * Set position (useful for teleporting)
   */
  setPosition(x: number, y: number): void {
    this.position.x = x;
    this.position.y = y;
  }

  /**
   * Set velocity
   */
  setVelocity(x: number, y: number): void {
    if (this.config.isStatic) {return;}
    this.velocity.x = x;
    this.velocity.y = y;
  }

  /**
   * Stop all movement
   */
  stop(): void {
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.angularVelocity = 0;
  }

  /**
   * Apply gravity
   */
  applyGravity(gravity: Vector2): void {
    if (this.config.isStatic) {return;}
    this.addForce({
      x: gravity.x * this.config.mass,
      y: gravity.y * this.config.mass,
    });
  }
}
