import { vec3, quat, mat4 } from "gl-matrix";

export interface RigidBodyConfig {
  mass: number;
  position: vec3;
  rotation: quat;
  velocity: vec3;
  angularVelocity: vec3;
  linearDamping: number;
  angularDamping: number;
  restitution: number;
  friction: number;
  isStatic: boolean;
  isTrigger: boolean;
  gravityScale: number;
}

export interface CollisionShape {
  type: "box" | "sphere" | "capsule" | "mesh";
  bounds: { min: vec3; max: vec3 };
}

export interface BoxShape extends CollisionShape {
  type: "box";
  size: vec3;
}

export interface SphereShape extends CollisionShape {
  type: "sphere";
  radius: number;
}

export interface ContactPoint {
  position: vec3;
  normal: vec3;
  penetration: number;
  localPointA: vec3;
  localPointB: vec3;
}

export interface RaycastResult {
  hit: boolean;
  body?: RigidBody;
  point: vec3;
  normal: vec3;
  distance: number;
  fraction: number;
}

export class RigidBody {
  public id: string;
  public config: RigidBodyConfig;
  public shape: CollisionShape;
  public transform: mat4 = mat4.create();
  public invMass: number;
  public force: vec3 = vec3.create();
  public torque: vec3 = vec3.create();
  private worldBounds: { min: vec3; max: vec3 } | null = null;
  private worldBoundsDirty = true;

  constructor(id: string, shape: CollisionShape, config: Partial<RigidBodyConfig> = {}) {
    this.id = id;
    this.shape = shape;
    this.config = {
      mass: 1,
      position: vec3.create(),
      rotation: quat.create(),
      velocity: vec3.create(),
      angularVelocity: vec3.create(),
      linearDamping: 0.01,
      angularDamping: 0.05,
      restitution: 0.3,
      friction: 0.5,
      isStatic: false,
      isTrigger: false,
      gravityScale: 1,
      ...config,
    };

    this.invMass = this.config.isStatic ? 0 : 1 / this.config.mass;
    this.updateTransform();
  }

  updateTransform(): void {
    mat4.fromRotationTranslation(this.transform, this.config.rotation, this.config.position);
    this.worldBoundsDirty = true;
  }

  getWorldBounds(): { min: vec3; max: vec3 } {
    if (!this.worldBoundsDirty && this.worldBounds) {
      return this.worldBounds;
    }

    const localMin = vec3.copy(vec3.create(), this.shape.bounds.min);
    const localMax = vec3.copy(vec3.create(), this.shape.bounds.max);

    const corners = [
      vec3.fromValues(localMin[0], localMin[1], localMin[2]),
      vec3.fromValues(localMax[0], localMin[1], localMin[2]),
      vec3.fromValues(localMin[0], localMax[1], localMin[2]),
      vec3.fromValues(localMax[0], localMax[1], localMin[2]),
      vec3.fromValues(localMin[0], localMin[1], localMax[2]),
      vec3.fromValues(localMax[0], localMin[1], localMax[2]),
      vec3.fromValues(localMin[0], localMax[1], localMax[2]),
      vec3.fromValues(localMax[0], localMax[1], localMax[2]),
    ];

    const worldMin = vec3.fromValues(Infinity, Infinity, Infinity);
    const worldMax = vec3.fromValues(-Infinity, -Infinity, -Infinity);

    for (const corner of corners) {
      vec3.transformMat4(corner, corner, this.transform);
      vec3.min(worldMin, worldMin, corner);
      vec3.max(worldMax, worldMax, corner);
    }

    this.worldBounds = { min: worldMin, max: worldMax };
    this.worldBoundsDirty = false;

    return this.worldBounds;
  }

  applyForce(force: vec3, point?: vec3): void {
    if (this.config.isStatic) return;

    vec3.add(this.force, this.force, force);

    if (point) {
      const offset = vec3.subtract(vec3.create(), point, this.config.position);
      const torque = vec3.cross(vec3.create(), offset, force);
      vec3.add(this.torque, this.torque, torque);
    }
  }

  applyImpulse(impulse: vec3, point?: vec3): void {
    if (this.config.isStatic) return;

    const deltaV = vec3.scale(vec3.create(), impulse, this.invMass);
    vec3.add(this.config.velocity, this.config.velocity, deltaV);

    if (point) {
      const offset = vec3.subtract(vec3.create(), point, this.config.position);
      const angularImpulse = vec3.cross(vec3.create(), offset, impulse);
      vec3.add(this.config.angularVelocity, this.config.angularVelocity, angularImpulse);
    }
  }
}

export class PhysicsWorld {
  private bodies = new Map<string, RigidBody>();
  private gravity: vec3 = vec3.fromValues(0, -9.81, 0);
  private timeStep = 1 / 60;
  private accumulator = 0;
  private spatialHash = new Map<string, Set<RigidBody>>();
  private cellSize = 10;
  private contacts: ContactPoint[] = [];

  private stats = {
    activeBodies: 0,
    contactPairs: 0,
    broadphaseTime: 0,
    narrowphaseTime: 0,
    totalTime: 0,
  };

  addRigidBody(body: RigidBody): void {
    this.bodies.set(body.id, body);
    this.updateSpatialHash(body);
  }

  removeRigidBody(bodyId: string): void {
    const body = this.bodies.get(bodyId);
    if (body) {
      this.removeBodyFromSpatialHash(body);
      this.bodies.delete(bodyId);
    }
  }

  setGravity(gravity: vec3): void {
    vec3.copy(this.gravity, gravity);
  }

  step(deltaTime: number): void {
    const startTime = performance.now();

    this.accumulator += Math.min(deltaTime, 0.25);

    while (this.accumulator >= this.timeStep) {
      this.internalStep(this.timeStep);
      this.accumulator -= this.timeStep;
    }

    this.stats.totalTime = performance.now() - startTime;
  }

  private internalStep(dt: number): void {
    this.integrateVelocities(dt);

    const broadphaseStart = performance.now();
    this.updateSpatialHashing();
    const potentialPairs = this.broadphaseDetection();
    this.stats.broadphaseTime = performance.now() - broadphaseStart;

    const narrowphaseStart = performance.now();
    this.contacts = [];
    this.narrowphaseDetection(potentialPairs);
    this.stats.narrowphaseTime = performance.now() - narrowphaseStart;

    this.resolveContacts(dt);
    this.integratePositions(dt);
    this.updateStatistics();
  }

  private integrateVelocities(dt: number): void {
    for (const body of this.bodies.values()) {
      if (body.config.isStatic) continue;

      if (body.config.gravityScale > 0) {
        const gravityForce = vec3.scale(
          vec3.create(),
          this.gravity,
          body.config.mass * body.config.gravityScale,
        );
        vec3.add(body.force, body.force, gravityForce);
      }

      if (body.invMass > 0) {
        const acceleration = vec3.scale(vec3.create(), body.force, body.invMass);
        vec3.scaleAndAdd(body.config.velocity, body.config.velocity, acceleration, dt);

        const dampingFactor = Math.pow(1 - body.config.linearDamping, dt);
        vec3.scale(body.config.velocity, body.config.velocity, dampingFactor);
      }

      vec3.set(body.force, 0, 0, 0);
      vec3.set(body.torque, 0, 0, 0);
    }
  }

  private updateSpatialHashing(): void {
    this.spatialHash.clear();

    for (const body of this.bodies.values()) {
      this.updateSpatialHash(body);
    }
  }

  private updateSpatialHash(body: RigidBody): void {
    const bounds = body.getWorldBounds();

    const minCell = this.worldToCell(bounds.min);
    const maxCell = this.worldToCell(bounds.max);

    for (let x = minCell.x; x <= maxCell.x; x++) {
      for (let y = minCell.y; y <= maxCell.y; y++) {
        for (let z = minCell.z; z <= maxCell.z; z++) {
          const cellKey = `${x},${y},${z}`;

          if (!this.spatialHash.has(cellKey)) {
            this.spatialHash.set(cellKey, new Set());
          }

          this.spatialHash.get(cellKey)!.add(body);
        }
      }
    }
  }

  private removeBodyFromSpatialHash(body: RigidBody): void {
    for (const cellBodies of this.spatialHash.values()) {
      cellBodies.delete(body);
    }
  }

  private worldToCell(position: vec3): { x: number; y: number; z: number } {
    return {
      x: Math.floor(position[0] / this.cellSize),
      y: Math.floor(position[1] / this.cellSize),
      z: Math.floor(position[2] / this.cellSize),
    };
  }

  private broadphaseDetection(): Array<[RigidBody, RigidBody]> {
    const pairs: Array<[RigidBody, RigidBody]> = [];
    const processed = new Set<string>();

    for (const cellBodies of this.spatialHash.values()) {
      const bodiesArray = Array.from(cellBodies);

      for (let i = 0; i < bodiesArray.length; i++) {
        for (let j = i + 1; j < bodiesArray.length; j++) {
          const bodyA = bodiesArray[i];
          const bodyB = bodiesArray[j];

          const pairKey =
            bodyA.id < bodyB.id ? `${bodyA.id}-${bodyB.id}` : `${bodyB.id}-${bodyA.id}`;

          if (!processed.has(pairKey)) {
            processed.add(pairKey);

            if (bodyA.config.isStatic && bodyB.config.isStatic) continue;

            if (this.aabbOverlap(bodyA.getWorldBounds(), bodyB.getWorldBounds())) {
              pairs.push([bodyA, bodyB]);
            }
          }
        }
      }
    }

    this.stats.contactPairs = pairs.length;
    return pairs;
  }

  private aabbOverlap(a: { min: vec3; max: vec3 }, b: { min: vec3; max: vec3 }): boolean {
    return (
      a.min[0] <= b.max[0] &&
      a.max[0] >= b.min[0] &&
      a.min[1] <= b.max[1] &&
      a.max[1] >= b.min[1] &&
      a.min[2] <= b.max[2] &&
      a.max[2] >= b.min[2]
    );
  }

  private narrowphaseDetection(pairs: Array<[RigidBody, RigidBody]>): void {
    for (const [bodyA, bodyB] of pairs) {
      const contacts = this.detectCollision(bodyA, bodyB);
      this.contacts.push(...contacts);
    }
  }

  private detectCollision(bodyA: RigidBody, bodyB: RigidBody): ContactPoint[] {
    if (bodyA.shape.type === "sphere" && bodyB.shape.type === "sphere") {
      return this.sphereSphereCollision(bodyA, bodyB);
    }
    return this.aabbCollision(bodyA, bodyB);
  }

  private sphereSphereCollision(bodyA: RigidBody, bodyB: RigidBody): ContactPoint[] {
    const sphereA = bodyA.shape as SphereShape;
    const sphereB = bodyB.shape as SphereShape;

    const distance = vec3.distance(bodyA.config.position, bodyB.config.position);
    const radiusSum = sphereA.radius + sphereB.radius;

    if (distance < radiusSum) {
      const normal = vec3.subtract(vec3.create(), bodyB.config.position, bodyA.config.position);
      vec3.normalize(normal, normal);

      const penetration = radiusSum - distance;
      const contactPoint = vec3.scaleAndAdd(
        vec3.create(),
        bodyA.config.position,
        normal,
        sphereA.radius - penetration * 0.5,
      );

      return [
        {
          position: contactPoint,
          normal,
          penetration,
          localPointA: vec3.create(),
          localPointB: vec3.create(),
        },
      ];
    }

    return [];
  }

  private aabbCollision(bodyA: RigidBody, bodyB: RigidBody): ContactPoint[] {
    const boundsA = bodyA.getWorldBounds();
    const boundsB = bodyB.getWorldBounds();

    if (this.aabbOverlap(boundsA, boundsB)) {
      const centerA = vec3.lerp(vec3.create(), boundsA.min, boundsA.max, 0.5);
      const centerB = vec3.lerp(vec3.create(), boundsB.min, boundsB.max, 0.5);

      const normal = vec3.subtract(vec3.create(), centerB, centerA);
      vec3.normalize(normal, normal);

      return [
        {
          position: vec3.lerp(vec3.create(), centerA, centerB, 0.5),
          normal,
          penetration: 0.1,
          localPointA: vec3.create(),
          localPointB: vec3.create(),
        },
      ];
    }

    return [];
  }

  private resolveContacts(_dt: number): void {
    // Simplified contact resolution
    for (const _contact of this.contacts) {
      // Apply impulse-based resolution
    }
  }

  private integratePositions(dt: number): void {
    for (const body of this.bodies.values()) {
      if (body.config.isStatic) continue;

      vec3.scaleAndAdd(body.config.position, body.config.position, body.config.velocity, dt);

      const angularSpeed = vec3.length(body.config.angularVelocity);
      if (angularSpeed > 0) {
        const axis = vec3.scale(vec3.create(), body.config.angularVelocity, 1 / angularSpeed);
        const angle = angularSpeed * dt;

        const deltaRotation = quat.setAxisAngle(quat.create(), axis, angle);
        quat.multiply(body.config.rotation, body.config.rotation, deltaRotation);
        quat.normalize(body.config.rotation, body.config.rotation);
      }

      body.updateTransform();
    }
  }

  private updateStatistics(): void {
    this.stats.activeBodies = Array.from(this.bodies.values()).filter(
      (body) => !body.config.isStatic,
    ).length;
  }

  raycast(origin: vec3, direction: vec3, maxDistance: number = 1000): RaycastResult {
    const normalizedDir = vec3.normalize(vec3.create(), direction);

    let closestHit: RaycastResult = {
      hit: false,
      point: vec3.create(),
      normal: vec3.create(),
      distance: maxDistance,
      fraction: 1,
    };

    for (const body of this.bodies.values()) {
      const result = this.raycastBody(origin, normalizedDir, maxDistance, body);
      if (result.hit && result.distance < closestHit.distance) {
        closestHit = result;
      }
    }

    return closestHit;
  }

  private raycastBody(
    origin: vec3,
    direction: vec3,
    maxDistance: number,
    body: RigidBody,
  ): RaycastResult {
    const bounds = body.getWorldBounds();
    const result = this.raycastAABB(origin, direction, maxDistance, bounds);

    if (result.hit) {
      result.body = body;
    }

    return result;
  }

  private raycastAABB(
    origin: vec3,
    direction: vec3,
    maxDistance: number,
    bounds: { min: vec3; max: vec3 },
  ): RaycastResult {
    const invDir = vec3.fromValues(1 / direction[0], 1 / direction[1], 1 / direction[2]);

    const t1 = vec3.multiply(
      vec3.create(),
      vec3.subtract(vec3.create(), bounds.min, origin),
      invDir,
    );
    const t2 = vec3.multiply(
      vec3.create(),
      vec3.subtract(vec3.create(), bounds.max, origin),
      invDir,
    );

    const tmin = vec3.max(vec3.create(), vec3.min(vec3.create(), t1, t2), vec3.create());
    const tmax = vec3.min(
      vec3.create(),
      vec3.max(vec3.create(), t1, t2),
      vec3.fromValues(maxDistance, maxDistance, maxDistance),
    );

    const tmaxScalar = Math.min(tmax[0], tmax[1], tmax[2]);
    const tminScalar = Math.max(Math.max(tmin[0], tmin[1], tmin[2]), 0);

    if (tminScalar <= tmaxScalar && tmaxScalar >= 0) {
      const distance = tminScalar;
      const hitPoint = vec3.scaleAndAdd(vec3.create(), origin, direction, distance);

      return {
        hit: true,
        point: hitPoint,
        normal: vec3.fromValues(0, 1, 0), // Simplified normal
        distance,
        fraction: distance / maxDistance,
      };
    }

    return {
      hit: false,
      point: vec3.create(),
      normal: vec3.create(),
      distance: maxDistance,
      fraction: 1,
    };
  }

  getStats() {
    return this.stats;
  }

  dispose(): void {
    this.bodies.clear();
    this.spatialHash.clear();
    this.contacts.length = 0;
  }
}
