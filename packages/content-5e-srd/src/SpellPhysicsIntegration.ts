/**
 * Spell Physics Integration - Computational Physics for Spell Effects
 * Integrates computational spell system with 3D physics simulation
 */

import {
  ComputationalSpell,
  ExecutionContext,
  GameEntity,
  Vector3D,
  _GeometryPrimitive,
} from "./ComputationalSpellSystem";

// Physics primitives
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

// Physics spell effects
export interface PhysicsSpellEffect {
  type: "projectile" | "area_field" | "force_application" | "teleportation" | "transformation";
  duration: (ctx: ExecutionContext) => number;
  physics: PhysicsParameters;
}

export interface PhysicsParameters {
  velocity?: (ctx: ExecutionContext) => Vector3D;
  acceleration?: (ctx: ExecutionContext) => Vector3D;
  mass?: (ctx: ExecutionContext) => number;
  drag?: number;
  bounce?: number;
  lifetime?: (ctx: ExecutionContext) => number;
  onCollision?: (collision: CollisionResult, ctx: ExecutionContext) => void;
  fieldStrength?: (position: Vector3D, _time: number) => number;
  fieldGradient?: (position: Vector3D, _time: number) => Vector3D;
}

// 3D Geometry calculations
export class GeometryCalculator {
  static getEntitiesInSphere(
    center: Vector3D,
    radius: number,
    entities: PhysicsEntity[],
  ): PhysicsEntity[] {
    return entities.filter((entity) => {
      const distance = this.distance(center, entity.position);
      return distance <= radius;
    });
  }

  static getEntitiesInCube(
    center: Vector3D,
    size: number,
    entities: PhysicsEntity[],
  ): PhysicsEntity[] {
    const halfSize = size / 2;
    return entities.filter((entity) => {
      return (
        Math.abs(entity.position.x - center.x) <= halfSize &&
        Math.abs(entity.position.y - center.y) <= halfSize &&
        Math.abs(entity.position.z - center.z) <= halfSize
      );
    });
  }

  static getEntitiesInCone(
    apex: Vector3D,
    direction: Vector3D,
    angle: number,
    length: number,
    entities: PhysicsEntity[],
  ): PhysicsEntity[] {
    const normalizedDirection = this.normalize(direction);

    return entities.filter((entity) => {
      const toEntity = this.subtract(entity.position, apex);
      const distance = this.magnitude(toEntity);

      if (distance > length) return false;

      const normalizedToEntity = this.normalize(toEntity);
      const dot = this.dot(normalizedDirection, normalizedToEntity);
      const entityAngle = Math.acos(Math.max(-1, Math.min(1, dot)));

      return entityAngle <= angle / 2;
    });
  }

  static getEntitiesInLine(
    start: Vector3D,
    end: Vector3D,
    width: number,
    entities: PhysicsEntity[],
  ): PhysicsEntity[] {
    return entities.filter((entity) => {
      const distance = this.distancePointToLine(entity.position, start, end);
      return distance <= width / 2;
    });
  }

  static distancePointToLine(point: Vector3D, lineStart: Vector3D, lineEnd: Vector3D): number {
    const lineVec = this.subtract(lineEnd, lineStart);
    const pointVec = this.subtract(point, lineStart);

    const lineLength = this.magnitude(lineVec);
    if (lineLength === 0) return this.distance(point, lineStart);

    const t = Math.max(0, Math.min(1, this.dot(pointVec, lineVec) / (lineLength * lineLength)));
    const projection = this.add(lineStart, this.multiply(lineVec, t));

    return this.distance(point, projection);
  }

  static distance(a: Vector3D, b: Vector3D): number {
    return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2) + Math.pow(b.z - a.z, 2));
  }

  static add(a: Vector3D, b: Vector3D): Vector3D {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }

  static subtract(a: Vector3D, b: Vector3D): Vector3D {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  static multiply(v: Vector3D, scalar: number): Vector3D {
    return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar };
  }

  static normalize(v: Vector3D): Vector3D {
    const mag = this.magnitude(v);
    return mag > 0 ? { x: v.x / mag, y: v.y / mag, z: v.z / mag } : { x: 0, y: 0, z: 0 };
  }

  static magnitude(v: Vector3D): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  static dot(a: Vector3D, b: Vector3D): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  static cross(a: Vector3D, b: Vector3D): Vector3D {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }
}

// Physics-integrated spell execution engine
export class PhysicsSpellExecutor {
  private physicsWorld: PhysicsWorld;
  private activeEffects: Map<string, ActivePhysicsEffect> = new Map();

  constructor(physicsWorld: PhysicsWorld) {
    this.physicsWorld = physicsWorld;
  }

  executeSpellWithPhysics(
    spell: ComputationalSpell,
    ctx: ExecutionContext,
  ): {
    success: boolean;
    physicsEffects: ActivePhysicsEffect[];
    error?: string;
  } {
    const physicsEffects: ActivePhysicsEffect[] = [];

    for (const effect of spell.effects) {
      const physicsEffect = this.convertToPhysicsEffect(effect, spell, ctx);
      if (physicsEffect) {
        const activeEffect = this.createActiveEffect(physicsEffect, ctx);
        this.activeEffects.set(activeEffect.id, activeEffect);
        physicsEffects.push(activeEffect);
      }
    }

    return { success: true, physicsEffects };
  }

  private convertToPhysicsEffect(
    effect: any,
    spell: ComputationalSpell,
    ctx: ExecutionContext,
  ): PhysicsSpellEffect | null {
    switch (effect.type) {
      case "damage":
        if (effect.areaOfEffect) {
          return this.createAreaDamagePhysics(effect, spell, ctx);
        } else {
          return this.createProjectilePhysics(effect, spell, ctx);
        }

      case "movement":
        return this.createForcePhysics(effect, spell, ctx);

      case "geometry":
        return this.createGeometryPhysics(effect, spell, ctx);

      default:
        return null;
    }
  }

  private createProjectilePhysics(
    effect: any,
    _spell: ComputationalSpell,
    _ctx: ExecutionContext,
  ): PhysicsSpellEffect {
    return {
      type: "projectile",
      duration: () => 5000, // 5 second max flight time
      physics: {
        velocity: (ctx) => {
          // Calculate initial velocity toward target
          const target = ctx.targets[0];
          if (!target) return { x: 0, y: 0, z: 0 };

          const direction = GeometryCalculator.subtract(target.position, ctx.caster.position);
          const distance = GeometryCalculator.magnitude(direction);
          const normalized = GeometryCalculator.normalize(direction);

          // Calculate velocity for projectile to reach target (simple ballistic)
          const speed = Math.max(30, distance * 2); // Adaptive speed based on distance
          return GeometryCalculator.multiply(normalized, speed);
        },
        acceleration: (ctx) => ctx.environment.gravity || { x: 0, y: -9.8, z: 0 },
        mass: () => 0.1, // Light magical projectile
        drag: 0.1,
        bounce: 0,
        onCollision: (collision, ctx) => {
          // Execute spell effect on collision
          const targetEntity = this.findEntityAtPosition(collision.point);
          if (targetEntity && effect.targetFilter(targetEntity, ctx)) {
            this.applyDamageEffect(effect, targetEntity, ctx);
          }
        },
      },
    };
  }

  private createAreaDamagePhysics(
    effect: any,
    spell: ComputationalSpell,
    ctx: ExecutionContext,
  ): PhysicsSpellEffect {
    return {
      type: "area_field",
      duration: () => 100, // Instantaneous explosion
      physics: {
        fieldStrength: (position, _time) => {
          // Field strength diminishes over time and distance from center
          const center = ctx.targets[0]?.position || ctx.caster.position;
          const distance = GeometryCalculator.distance(position, center);
          const radius = effect.areaOfEffect.size(ctx);

          if (distance > radius) return 0;

          const timeDecay = Math.max(0, 1 - time / 100);
          const distanceDecay = Math.max(0, 1 - distance / radius);

          return timeDecay * distanceDecay;
        },
        fieldGradient: (position, _time) => {
          // Push outward from center
          const center = ctx.targets[0]?.position || ctx.caster.position;
          const direction = GeometryCalculator.subtract(position, center);
          const normalized = GeometryCalculator.normalize(direction);

          const strength = this.physics.fieldStrength!(position, time);
          return GeometryCalculator.multiply(normalized, strength * 1000);
        },
      },
    };
  }

  private createForcePhysics(
    effect: any,
    _spell: ComputationalSpell,
    _ctx: ExecutionContext,
  ): PhysicsSpellEffect {
    return {
      type: "force_application",
      duration: (ctx) => (effect.duration ? effect.duration(ctx) : 1000),
      physics: {
        velocity: (ctx) => {
          if (effect.mode === "teleport") {
            // Instant displacement
            return { x: 0, y: 0, z: 0 };
          }

          const magnitude = effect.magnitude(ctx);
          const direction = effect.direction ? effect.direction(ctx) : { x: 1, y: 0, z: 0 };
          const normalized = GeometryCalculator.normalize(direction);

          return GeometryCalculator.multiply(normalized, magnitude);
        },
      },
    };
  }

  private createGeometryPhysics(
    effect: any,
    _spell: ComputationalSpell,
    _ctx: ExecutionContext,
  ): PhysicsSpellEffect {
    return {
      type: "transformation",
      duration: (ctx) => (effect.duration ? effect.duration(ctx) : 60000),
      physics: {
        // Create physical barriers, walls, etc.
        mass: () => Infinity, // Immovable
        velocity: () => ({ x: 0, y: 0, z: 0 }),
      },
    };
  }

  // Physics simulation update loop
  updatePhysics(deltaTime: number): void {
    const currentTime = Date.now();

    // Update all active effects
    for (const [id, effect] of this.activeEffects.entries()) {
      const elapsed = currentTime - effect.startTime;
      const duration = effect.physicsEffect.duration(effect.context);

      if (elapsed >= duration) {
        this.removeEffect(id);
        continue;
      }

      this.updateEffect(effect, deltaTime, elapsed);
    }

    // Update physics world
    this.updatePhysicsWorld(deltaTime);
  }

  private updateEffect(effect: ActivePhysicsEffect, deltaTime: number, elapsed: number): void {
    switch (effect.physicsEffect.type) {
      case "projectile":
        this.updateProjectile(effect, deltaTime);
        break;

      case "area_field":
        this.updateAreaField(effect, elapsed);
        break;

      case "force_application":
        this.updateForceApplication(effect, deltaTime);
        break;
    }
  }

  private updateProjectile(effect: ActivePhysicsEffect, deltaTime: number): void {
    const physics = effect.physicsEffect.physics;
    const entity = effect.entity;

    if (!entity) return;

    // Apply acceleration
    if (physics.acceleration) {
      const accel = physics.acceleration(effect.context);
      entity.velocity = GeometryCalculator.add(
        entity.velocity,
        GeometryCalculator.multiply(accel, deltaTime),
      );
    }

    // Apply drag
    if (physics.drag) {
      const dragForce = GeometryCalculator.multiply(entity.velocity, -physics.drag);
      entity.velocity = GeometryCalculator.add(entity.velocity, dragForce);
    }

    // Update position
    const displacement = GeometryCalculator.multiply(entity.velocity, deltaTime);
    entity.position = GeometryCalculator.add(entity.position, displacement);

    // Check for collisions
    const collision = this.checkCollisions(entity);
    if (collision && physics.onCollision) {
      physics.onCollision(collision, effect.context);
      this.removeEffect(effect.id);
    }
  }

  private updateAreaField(effect: ActivePhysicsEffect, elapsed: number): void {
    const physics = effect.physicsEffect.physics;

    if (!physics.fieldStrength || !physics.fieldGradient) return;

    // Apply field forces to all entities in range
    for (const entity of this.physicsWorld.entities.values()) {
      const strength = physics.fieldStrength(entity.position, elapsed);

      if (strength > 0) {
        const force = physics.fieldGradient(entity.position, elapsed);
        entity.forces.push(force);
      }
    }
  }

  private updateForceApplication(effect: ActivePhysicsEffect, deltaTime: number): void {
    const physics = effect.physicsEffect.physics;
    const targets = effect.context.targets;

    for (const target of targets) {
      if (physics.velocity) {
        const velocity = physics.velocity(effect.context);
        (target as PhysicsEntity).velocity = GeometryCalculator.add(
          (target as PhysicsEntity).velocity,
          GeometryCalculator.multiply(velocity, deltaTime),
        );
      }
    }
  }

  private updatePhysicsWorld(deltaTime: number): void {
    // Update all entities in the physics world
    for (const entity of this.physicsWorld.entities.values()) {
      if (entity.isStatic) continue;

      // Apply forces
      let totalForce = { x: 0, y: 0, z: 0 };
      for (const force of entity.forces) {
        totalForce = GeometryCalculator.add(totalForce, force);
      }

      // Apply gravity
      totalForce = GeometryCalculator.add(
        totalForce,
        GeometryCalculator.multiply(this.physicsWorld.gravity, entity.mass),
      );

      // Calculate acceleration (F = ma)
      const acceleration =
        entity.mass > 0
          ? GeometryCalculator.multiply(totalForce, 1 / entity.mass)
          : { x: 0, y: 0, z: 0 };

      // Update velocity
      entity.velocity = GeometryCalculator.add(
        entity.velocity,
        GeometryCalculator.multiply(acceleration, deltaTime),
      );

      // Apply air resistance
      const dragForce = GeometryCalculator.multiply(
        entity.velocity,
        -this.physicsWorld.airResistance,
      );
      entity.velocity = GeometryCalculator.add(entity.velocity, dragForce);

      // Update position
      const displacement = GeometryCalculator.multiply(entity.velocity, deltaTime);
      entity.position = GeometryCalculator.add(entity.position, displacement);

      // Clear forces for next frame
      entity.forces = [];

      // Check for collisions with other entities and world geometry
      this.resolveCollisions(entity);
    }
  }

  private checkCollisions(entity: PhysicsEntity): CollisionResult | null {
    for (const other of this.physicsWorld.entities.values()) {
      if (other.id === entity.id) continue;

      const collision = this.physicsWorld.collisionDetection.checkCollision(entity, other);
      if (collision) {
        return collision;
      }
    }
    return null;
  }

  private resolveCollisions(entity: PhysicsEntity): void {
    for (const other of this.physicsWorld.entities.values()) {
      if (other.id === entity.id) continue;

      const collision = this.physicsWorld.collisionDetection.checkCollision(entity, other);
      if (collision) {
        // Separate entities
        const separation = GeometryCalculator.multiply(collision.normal, collision.penetration / 2);
        if (!entity.isStatic) {
          entity.position = GeometryCalculator.subtract(entity.position, separation);
        }
        if (!other.isStatic) {
          other.position = GeometryCalculator.add(other.position, separation);
        }

        // Apply collision response (simplified elastic collision)
        if (!entity.isStatic && !other.isStatic) {
          const relativeVelocity = GeometryCalculator.subtract(entity.velocity, other.velocity);
          const velocityAlongNormal = GeometryCalculator.dot(relativeVelocity, collision.normal);

          if (velocityAlongNormal > 0) continue; // Objects separating

          const restitution = 0.8; // Bounciness
          const impulse =
            (-(1 + restitution) * velocityAlongNormal) / (1 / entity.mass + 1 / other.mass);

          const impulseVector = GeometryCalculator.multiply(collision.normal, impulse);

          entity.velocity = GeometryCalculator.add(
            entity.velocity,
            GeometryCalculator.multiply(impulseVector, 1 / entity.mass),
          );
          other.velocity = GeometryCalculator.subtract(
            other.velocity,
            GeometryCalculator.multiply(impulseVector, 1 / other.mass),
          );
        }
      }
    }
  }

  private findEntityAtPosition(position: Vector3D): PhysicsEntity | null {
    for (const entity of this.physicsWorld.entities.values()) {
      const distance = GeometryCalculator.distance(position, entity.position);
      if (distance < 1.0) {
        // Within 1 unit
        return entity;
      }
    }
    return null;
  }

  private applyDamageEffect(effect: any, target: PhysicsEntity, ctx: ExecutionContext): void {
    const damage = effect.amount(ctx);
    target.hitPoints.current = Math.max(0, target.hitPoints.current - damage);

    // Apply physics impact
    const impulse = GeometryCalculator.multiply(
      GeometryCalculator.normalize(
        GeometryCalculator.subtract(target.position, ctx.caster.position),
      ),
      damage * 10, // Convert damage to impulse
    );

    target.velocity = GeometryCalculator.add(
      target.velocity,
      GeometryCalculator.multiply(impulse, 1 / target.mass),
    );
  }

  private createActiveEffect(
    physicsEffect: PhysicsSpellEffect,
    ctx: ExecutionContext,
  ): ActivePhysicsEffect {
    const id = `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    let entity: PhysicsEntity | undefined;

    if (physicsEffect.type === "projectile") {
      // Create a physics entity for the projectile
      entity = {
        id: `${id}_projectile`,
        position: { ...ctx.caster.position },
        hitPoints: { current: 1, maximum: 1 },
        armorClass: 0,
        savingThrows: Record<string, any>,
        conditions: new Set(),
        resistances: new Set(),
        immunities: new Set(),
        vulnerabilities: new Set(),
        velocity: physicsEffect.physics.velocity
          ? physicsEffect.physics.velocity(ctx)
          : { x: 0, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        mass: physicsEffect.physics.mass ? physicsEffect.physics.mass(ctx) : 1,
        boundingBox: {
          min: { x: -0.1, y: -0.1, z: -0.1 },
          max: { x: 0.1, y: 0.1, z: 0.1 },
        },
        collisionMask: 1,
        forces: [],
        isStatic: false,
      };

      this.physicsWorld.entities.set(entity.id, entity);
    }

    return {
      id,
      physicsEffect,
      context: ctx,
      startTime: Date.now(),
      entity,
    };
  }

  private removeEffect(id: string): void {
    const effect = this.activeEffects.get(id);
    if (effect && effect.entity) {
      this.physicsWorld.entities.delete(effect.entity.id);
    }
    this.activeEffects.delete(id);
  }
}

interface ActivePhysicsEffect {
  id: string;
  physicsEffect: PhysicsSpellEffect;
  context: ExecutionContext;
  startTime: number;
  entity?: PhysicsEntity;
}

export { GeometryCalculator, PhysicsSpellExecutor };
