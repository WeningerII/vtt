/**
 * Spell Physics Integration - Computational Physics for Spell Effects
 * Integrates computational spell system with 3D physics simulation
 */
// 3D Geometry calculations
export class GeometryCalculator {
    static getEntitiesInSphere(center, radius, entities) {
        return entities.filter((entity) => {
            const distance = this.distance(center, entity.position);
            return distance <= radius;
        });
    }
    static getEntitiesInCube(center, size, entities) {
        const halfSize = size / 2;
        return entities.filter((entity) => {
            return (Math.abs(entity.position.x - center.x) <= halfSize &&
                Math.abs(entity.position.y - center.y) <= halfSize &&
                Math.abs(entity.position.z - center.z) <= halfSize);
        });
    }
    static getEntitiesInCone(apex, direction, angle, length, entities) {
        const normalizedDirection = this.normalize(direction);
        return entities.filter((entity) => {
            const toEntity = this.subtract(entity.position, apex);
            const distance = this.magnitude(toEntity);
            if (distance > length)
                return false;
            const normalizedToEntity = this.normalize(toEntity);
            const dot = this.dot(normalizedDirection, normalizedToEntity);
            const entityAngle = Math.acos(Math.max(-1, Math.min(1, dot)));
            return entityAngle <= angle / 2;
        });
    }
    static getEntitiesInLine(start, end, width, entities) {
        return entities.filter((entity) => {
            const distance = this.distancePointToLine(entity.position, start, end);
            return distance <= width / 2;
        });
    }
    static distancePointToLine(point, lineStart, lineEnd) {
        const lineVec = this.subtract(lineEnd, lineStart);
        const pointVec = this.subtract(point, lineStart);
        const lineLength = this.magnitude(lineVec);
        if (lineLength === 0)
            return this.distance(point, lineStart);
        const t = Math.max(0, Math.min(1, this.dot(pointVec, lineVec) / (lineLength * lineLength)));
        const projection = this.add(lineStart, this.multiply(lineVec, t));
        return this.distance(point, projection);
    }
    static distance(a, b) {
        return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2) + Math.pow(b.z - a.z, 2));
    }
    static add(a, b) {
        return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
    }
    static subtract(a, b) {
        return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
    }
    static multiply(v, scalar) {
        return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar };
    }
    static normalize(v) {
        const mag = this.magnitude(v);
        return mag > 0 ? { x: v.x / mag, y: v.y / mag, z: v.z / mag } : { x: 0, y: 0, z: 0 };
    }
    static magnitude(v) {
        return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    }
    static dot(a, b) {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }
    static cross(a, b) {
        return {
            x: a.y * b.z - a.z * b.y,
            y: a.z * b.x - a.x * b.z,
            z: a.x * b.y - a.y * b.x,
        };
    }
}
// Physics-integrated spell execution engine
export class PhysicsSpellExecutor {
    constructor(physicsWorld) {
        this.activeEffects = new Map();
        this.physicsWorld = physicsWorld;
    }
    executeSpellWithPhysics(spell, ctx) {
        const physicsEffects = [];
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
    convertToPhysicsEffect(effect, spell, ctx) {
        switch (effect.type) {
            case "damage":
                if (effect.areaOfEffect) {
                    return this.createAreaDamagePhysics(effect, spell, ctx);
                }
                else {
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
    createProjectilePhysics(effect, _spell, _ctx) {
        return {
            type: "projectile",
            duration: () => 5000, // 5 second max flight time
            physics: {
                velocity: (ctx) => {
                    // Calculate initial velocity toward target
                    const target = ctx.targets[0];
                    if (!target)
                        return { x: 0, y: 0, z: 0 };
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
    createAreaDamagePhysics(effect, spell, ctx) {
        return {
            type: "area_field",
            duration: () => 100, // Instantaneous explosion
            physics: {
                fieldStrength: (position, _time) => {
                    // Field strength diminishes over time and distance from center
                    const center = ctx.targets[0]?.position || ctx.caster.position;
                    const distance = GeometryCalculator.distance(position, center);
                    const radius = effect.areaOfEffect.size(ctx);
                    if (distance > radius)
                        return 0;
                    const timeDecay = Math.max(0, 1 - time / 100);
                    const distanceDecay = Math.max(0, 1 - distance / radius);
                    return timeDecay * distanceDecay;
                },
                fieldGradient: (position, _time) => {
                    // Push outward from center
                    const center = ctx.targets[0]?.position || ctx.caster.position;
                    const direction = GeometryCalculator.subtract(position, center);
                    const normalized = GeometryCalculator.normalize(direction);
                    const strength = this.physics.fieldStrength(position, time);
                    return GeometryCalculator.multiply(normalized, strength * 1000);
                },
            },
        };
    }
    createForcePhysics(effect, _spell, _ctx) {
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
    createGeometryPhysics(effect, _spell, _ctx) {
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
    updatePhysics(deltaTime) {
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
    updateEffect(effect, deltaTime, elapsed) {
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
    updateProjectile(effect, deltaTime) {
        const physics = effect.physicsEffect.physics;
        const entity = effect.entity;
        if (!entity)
            return;
        // Apply acceleration
        if (physics.acceleration) {
            const accel = physics.acceleration(effect.context);
            entity.velocity = GeometryCalculator.add(entity.velocity, GeometryCalculator.multiply(accel, deltaTime));
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
    updateAreaField(effect, elapsed) {
        const physics = effect.physicsEffect.physics;
        if (!physics.fieldStrength || !physics.fieldGradient)
            return;
        // Apply field forces to all entities in range
        for (const entity of this.physicsWorld.entities.values()) {
            const strength = physics.fieldStrength(entity.position, elapsed);
            if (strength > 0) {
                const force = physics.fieldGradient(entity.position, elapsed);
                entity.forces.push(force);
            }
        }
    }
    updateForceApplication(effect, deltaTime) {
        const physics = effect.physicsEffect.physics;
        const targets = effect.context.targets;
        for (const target of targets) {
            if (physics.velocity) {
                const velocity = physics.velocity(effect.context);
                target.velocity = GeometryCalculator.add(target.velocity, GeometryCalculator.multiply(velocity, deltaTime));
            }
        }
    }
    updatePhysicsWorld(deltaTime) {
        // Update all entities in the physics world
        for (const entity of this.physicsWorld.entities.values()) {
            if (entity.isStatic)
                continue;
            // Apply forces
            let totalForce = { x: 0, y: 0, z: 0 };
            for (const force of entity.forces) {
                totalForce = GeometryCalculator.add(totalForce, force);
            }
            // Apply gravity
            totalForce = GeometryCalculator.add(totalForce, GeometryCalculator.multiply(this.physicsWorld.gravity, entity.mass));
            // Calculate acceleration (F = ma)
            const acceleration = entity.mass > 0
                ? GeometryCalculator.multiply(totalForce, 1 / entity.mass)
                : { x: 0, y: 0, z: 0 };
            // Update velocity
            entity.velocity = GeometryCalculator.add(entity.velocity, GeometryCalculator.multiply(acceleration, deltaTime));
            // Apply air resistance
            const dragForce = GeometryCalculator.multiply(entity.velocity, -this.physicsWorld.airResistance);
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
    checkCollisions(entity) {
        for (const other of this.physicsWorld.entities.values()) {
            if (other.id === entity.id)
                continue;
            const collision = this.physicsWorld.collisionDetection.checkCollision(entity, other);
            if (collision) {
                return collision;
            }
        }
        return null;
    }
    resolveCollisions(entity) {
        for (const other of this.physicsWorld.entities.values()) {
            if (other.id === entity.id)
                continue;
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
                    if (velocityAlongNormal > 0)
                        continue; // Objects separating
                    const restitution = 0.8; // Bounciness
                    const impulse = (-(1 + restitution) * velocityAlongNormal) / (1 / entity.mass + 1 / other.mass);
                    const impulseVector = GeometryCalculator.multiply(collision.normal, impulse);
                    entity.velocity = GeometryCalculator.add(entity.velocity, GeometryCalculator.multiply(impulseVector, 1 / entity.mass));
                    other.velocity = GeometryCalculator.subtract(other.velocity, GeometryCalculator.multiply(impulseVector, 1 / other.mass));
                }
            }
        }
    }
    findEntityAtPosition(position) {
        for (const entity of this.physicsWorld.entities.values()) {
            const distance = GeometryCalculator.distance(position, entity.position);
            if (distance < 1.0) {
                // Within 1 unit
                return entity;
            }
        }
        return null;
    }
    applyDamageEffect(effect, target, ctx) {
        const damage = effect.amount(ctx);
        target.hitPoints.current = Math.max(0, target.hitPoints.current - damage);
        // Apply physics impact
        const impulse = GeometryCalculator.multiply(GeometryCalculator.normalize(GeometryCalculator.subtract(target.position, ctx.caster.position)), damage * 10);
        target.velocity = GeometryCalculator.add(target.velocity, GeometryCalculator.multiply(impulse, 1 / target.mass));
    }
    createActiveEffect(physicsEffect, ctx) {
        const id = `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        let entity;
        if (physicsEffect.type === "projectile") {
            // Create a physics entity for the projectile
            entity = {
                id: `${id}_projectile`,
                position: { ...ctx.caster.position },
                hitPoints: { current: 1, maximum: 1 },
                armorClass: 0,
                savingThrows: (Record),
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
    removeEffect(id) {
        const effect = this.activeEffects.get(id);
        if (effect && effect.entity) {
            this.physicsWorld.entities.delete(effect.entity.id);
        }
        this.activeEffects.delete(id);
    }
}
//# sourceMappingURL=SpellPhysicsIntegration.js.map