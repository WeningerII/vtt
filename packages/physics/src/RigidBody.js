/**
 * Rigid body physics component for VTT entities
 */
export class RigidBody {
  constructor(id, x = 0, y = 0, width = 1, height = 1, config = {}) {
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
      layer: config.layer ?? 1,
      mask: config.mask ?? 0xffffffff,
    };
  }
  /**
   * Add force to be applied this frame
   */
  addForce(force) {
    if (this.config.isStatic) return;
    this.forces.push({ ...force });
  }
  /**
   * Add impulse (instantaneous force)
   */
  addImpulse(impulse) {
    if (this.config.isStatic) return;
    this.velocity.x += impulse.x / this.config.mass;
    this.velocity.y += impulse.y / this.config.mass;
  }
  /**
   * Add torque for rotation
   */
  addTorque(torque) {
    if (this.config.isStatic) return;
    this.torques.push(torque);
  }
  /**
   * Get axis-aligned bounding box
   */
  getAABB() {
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
  shouldCollideWith(other) {
    // Check layer mask
    const layerCheck = (this.config.mask & (1 << other.config.layer)) !== 0;
    const otherLayerCheck = (other.config.mask & (1 << this.config.layer)) !== 0;
    return layerCheck && otherLayerCheck;
  }
  /**
   * Integrate physics (called by physics system)
   */
  integrate(deltaTime) {
    if (this.config.isStatic) return;
    // Apply forces
    this.acceleration.x = 0;
    this.acceleration.y = 0;
    for (const force of this.forces) {
      this.acceleration.x += force.x / this.config.mass;
      this.acceleration.y += force.y / this.config.mass;
    }
    // Apply friction
    this.velocity.x *= 1 - this.config.friction * deltaTime;
    this.velocity.y *= 1 - this.config.friction * deltaTime;
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
    this.angularVelocity *= 1 - this.config.friction * deltaTime;
    this.rotation += this.angularVelocity * deltaTime;
    // Clear force accumulators
    this.forces = [];
    this.torques = [];
  }
  /**
   * Apply collision response with another body
   */
  resolveCollision(other, normal, penetration) {
    if (this.config.isTrigger || other.config.isTrigger) return;
    if (this.config.isStatic && other.config.isStatic) return;
    // Calculate relative velocity
    const relativeVelocity = {
      x: this.velocity.x - other.velocity.x,
      y: this.velocity.y - other.velocity.y,
    };
    // Calculate relative velocity in collision normal direction
    const velAlongNormal = relativeVelocity.x * normal.x + relativeVelocity.y * normal.y;
    // Don't resolve if velocities are separating
    if (velAlongNormal > 0) return;
    // Calculate restitution
    const restitution = Math.min(this.config.restitution, other.config.restitution);
    // Calculate impulse scalar
    let impulseScalar = -(1 + restitution) * velAlongNormal;
    const totalMass = this.config.isStatic
      ? other.config.mass
      : other.config.isStatic
        ? this.config.mass
        : this.config.mass + other.config.mass;
    impulseScalar /= totalMass;
    // Apply impulse
    const impulse = {
      x: impulseScalar * normal.x,
      y: impulseScalar * normal.y,
    };
    if (!this.config.isStatic) {
      this.velocity.x += (impulse.x * this.config.mass) / totalMass;
      this.velocity.y += (impulse.y * this.config.mass) / totalMass;
    }
    if (!other.config.isStatic) {
      other.velocity.x -= (impulse.x * other.config.mass) / totalMass;
      other.velocity.y -= (impulse.y * other.config.mass) / totalMass;
    }
    // Position correction to prevent sinking
    const correctionPercent = 0.8;
    const slop = 0.01;
    const correction = (Math.max(penetration - slop, 0) * correctionPercent) / totalMass;
    if (!this.config.isStatic) {
      this.position.x += (correction * normal.x * other.config.mass) / totalMass;
      this.position.y += (correction * normal.y * other.config.mass) / totalMass;
    }
    if (!other.config.isStatic) {
      other.position.x -= (correction * normal.x * this.config.mass) / totalMass;
      other.position.y -= (correction * normal.y * this.config.mass) / totalMass;
    }
  }
  /**
   * Set position (useful for teleporting)
   */
  setPosition(x, y) {
    this.position.x = x;
    this.position.y = y;
  }
  /**
   * Set velocity
   */
  setVelocity(x, y) {
    if (this.config.isStatic) return;
    this.velocity.x = x;
    this.velocity.y = y;
  }
  /**
   * Stop all movement
   */
  stop() {
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.angularVelocity = 0;
  }
  /**
   * Apply gravity
   */
  applyGravity(gravity) {
    if (this.config.isStatic) return;
    this.addForce({
      x: gravity.x * this.config.mass,
      y: gravity.y * this.config.mass,
    });
  }
}
//# sourceMappingURL=RigidBody.js.map
