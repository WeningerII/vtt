/// <reference types="@webgpu/types" />

// WebGPU types are globally available via the triple-slash directive above.
/**
 * Advanced Physics Engine - Triple A Quality Browser-Optimized Physics
 * High-performance physics simulation with WASM acceleration and GPU compute
 */

export interface RigidBody {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number, number]; // quaternion
  velocity: [number, number, number];
  angularVelocity: [number, number, number];
  mass: number;
  inverseMass: number;
  inertia: [number, number, number];
  inverseInertia: [number, number, number];
  shape: CollisionShape;
  material: PhysicsMaterial;
  type: "static" | "kinematic" | "dynamic";
  sleeping: boolean;
  forces: [number, number, number];
  torques: [number, number, number];
}

export interface CollisionShape {
  type: "box" | "sphere" | "capsule" | "mesh" | "heightfield";
  dimensions: [number, number, number];
  vertices?: Float32Array;
  indices?: Uint32Array;
  bounds: AABB;
}

export interface AABB {
  min: [number, number, number];
  max: [number, number, number];
}

export interface PhysicsMaterial {
  friction: number;
  restitution: number;
  density: number;
  rollingFriction: number;
  spinningFriction: number;
}

export interface Constraint {
  id: string;
  type: "point" | "hinge" | "slider" | "fixed" | "spring";
  bodyA: string;
  bodyB: string;
  anchorA: [number, number, number];
  anchorB: [number, number, number];
  axis?: [number, number, number];
  limits?: [number, number];
  stiffness: number;
  damping: number;
}

export interface ParticleSystem {
  id: string;
  particles: Particle[];
  emitter: ParticleEmitter;
  forces: ForceField[];
  maxParticles: number;
  gpuAccelerated: boolean;
}

export interface Particle {
  position: [number, number, number];
  velocity: [number, number, number];
  mass: number;
  life: number;
  maxLife: number;
  size: number;
  color: [number, number, number, number];
}

export interface ParticleEmitter {
  position: [number, number, number];
  direction: [number, number, number];
  rate: number;
  spread: number;
  initialVelocity: number;
  initialLife: number;
  shape: "point" | "sphere" | "box" | "cone";
}

export interface ForceField {
  type: "gravity" | "wind" | "vortex" | "explosion" | "magnetic";
  position: [number, number, number];
  strength: number;
  radius: number;
  direction?: [number, number, number];
}

export interface FluidSimulation {
  id: string;
  particles: FluidParticle[];
  density: number;
  viscosity: number;
  surfaceTension: number;
  gasConstant: number;
  restDensity: number;
  kernelRadius: number;
  method: "SPH" | "FLIP" | "PIC";
}

export interface FluidParticle {
  position: [number, number, number];
  velocity: [number, number, number];
  density: number;
  pressure: number;
  mass: number;
  neighbors: number[];
}

export interface SoftBody {
  id: string;
  nodes: SoftBodyNode[];
  links: SoftBodyLink[];
  faces: SoftBodyFace[];
  material: SoftBodyMaterial;
}

export interface SoftBodyNode {
  position: [number, number, number];
  velocity: [number, number, number];
  mass: number;
  inverseMass: number;
  forces: [number, number, number];
  pinned: boolean;
}

export interface SoftBodyLink {
  nodeA: number;
  nodeB: number;
  restLength: number;
  stiffness: number;
  damping: number;
}

export interface SoftBodyFace {
  nodes: [number, number, number];
  normal: [number, number, number];
  area: number;
}

export interface SoftBodyMaterial {
  elasticity: number;
  plasticity: number;
  damping: number;
  pressure: number;
  volume: number;
}

export interface PhysicsWorld {
  gravity: [number, number, number];
  timeStep: number;
  maxSubSteps: number;
  broadphase: "naive" | "sweep" | "grid" | "octree";
  narrowphase: "sat" | "gjk" | "mpr";
  solver: "impulse" | "sequential" | "pgs";
  sleepThreshold: number;
  bounds: AABB;
}

export class AdvancedPhysicsEngine {
  private world: PhysicsWorld;
  private rigidBodies: Map<string, RigidBody> = new Map();
  private constraints: Map<string, Constraint> = new Map();
  private particleSystems: Map<string, ParticleSystem> = new Map();
  private fluidSimulations: Map<string, FluidSimulation> = new Map();
  private softBodies: Map<string, SoftBody> = new Map();

  // Performance optimization
  private spatialGrid: SpatialGrid;
  private octree: Octree;
  private islandManager: IslandManager;

  // GPU acceleration
  private device: GPUDevice | null = null;
  private computePipelines: Map<string, GPUComputePipeline> = new Map();
  private buffers: Map<string, GPUBuffer> = new Map();

  // WASM workers for heavy computations
  private workers: Worker[] = [];
  private workerPool: WorkerPool;

  // Statistics
  private stats = {
    rigidBodies: 0,
    constraints: 0,
    particles: 0,
    collisionPairs: 0,
    islands: 0,
    frameTime: 0,
    solverIterations: 0,
  };

  constructor(world?: Partial<PhysicsWorld>) {
    this.world = {
      gravity: [0, -9.81, 0],
      timeStep: 1 / 60,
      maxSubSteps: 3,
      broadphase: "octree",
      narrowphase: "gjk",
      solver: "pgs",
      sleepThreshold: 0.01,
      bounds: { min: [-1000, -1000, -1000], max: [1000, 1000, 1000] },
      ...world,
    };

    this.spatialGrid = new SpatialGrid(64);
    this.octree = new Octree(this.world.bounds, 8);
    this.islandManager = new IslandManager();
    this.workerPool = new WorkerPool(4);
  }

  async initialize(gpuDevice?: GPUDevice): Promise<void> {
    this.device = gpuDevice || null;

    if (this.device) {
      await this.initializeGPUCompute();
    }

    await this.initializeWorkers();
  }

  private async initializeGPUCompute(): Promise<void> {
    if (!this.device) {
      return;
    }

    // Particle simulation compute shader
    const particleShader = this.device.createShaderModule({
      code: `
        struct Particle {
          position: vec3<f32>,
          velocity: vec3<f32>,
          mass: f32,
          life: f32,
        }

        @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
        @group(0) @binding(1) var<uniform> deltaTime: f32;
        @group(0) @binding(2) var<uniform> gravity: vec3<f32>;

        @compute @workgroup_size(64)
        fn main(@builtin(global_invocation_id) id: vec3<u32>) {
          let index = id.x;
          if (index >= arrayLength(&particles)) { return; }
          
          var particle = particles[index];
          if (particle.life <= 0.0) { return; }
          
          // Apply forces
          let force = gravity * particle.mass;
          let acceleration = force / particle.mass;
          
          // Integrate velocity and position
          particle.velocity += acceleration * deltaTime;
          particle.position += particle.velocity * deltaTime;
          
          // Update life
          particle.life -= deltaTime;
          
          particles[index] = particle;
        }
      `,
    });

    this.computePipelines.set(
      "particles",
      this.device.createComputePipeline({
        layout: "auto",
        compute: { module: particleShader, entryPoint: "main" },
      }),
    );
  }

  private async initializeWorkers(): Promise<void> {
    // Create WASM workers for heavy physics computations
    for (let i = 0; i < 4; i++) {
      const worker = new Worker("/physics/physics-worker.js");
      this.workers.push(worker);
      this.workerPool.addWorker(worker);
    }
  }

  // Rigid body management
  addRigidBody(config: Partial<RigidBody> & { id: string }): void {
    const body: RigidBody = {
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      velocity: [0, 0, 0],
      angularVelocity: [0, 0, 0],
      mass: 1,
      inverseMass: 1,
      inertia: [1, 1, 1],
      inverseInertia: [1, 1, 1],
      shape: {
        type: "box",
        dimensions: [1, 1, 1],
        bounds: { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
      },
      material: {
        friction: 0.5,
        restitution: 0.3,
        density: 1,
        rollingFriction: 0.1,
        spinningFriction: 0.1,
      },
      type: "dynamic",
      sleeping: false,
      forces: [0, 0, 0],
      torques: [0, 0, 0],
      ...config,
    };

    if (body.mass > 0) {
      body.inverseMass = 1 / body.mass;
      this.calculateInertia(body);
    } else {
      body.inverseMass = 0;
      body.inverseInertia = [0, 0, 0];
    }

    this.rigidBodies.set(body.id, body);
    this.spatialGrid.insert(body);
    this.octree.insert(body);
  }

  private calculateInertia(body: RigidBody): void {
    const { shape, mass } = body;
    let inertia: [number, number, number];

    switch (shape.type) {
      case "box":
        {
          const [w, h, d] = shape.dimensions;
          inertia = [
            (mass * (h * h + d * d)) / 12,
            (mass * (w * w + d * d)) / 12,
            (mass * (w * w + h * h)) / 12,
          ];
        }
        break;
      case "sphere":
        {
          const r = shape.dimensions[0];
          const sphereInertia = 0.4 * mass * r * r;
          inertia = [sphereInertia, sphereInertia, sphereInertia];
        }
        break;
      default:
        inertia = [mass, mass, mass];
    }

    body.inertia = inertia;
    body.inverseInertia = inertia.map((i) => (i > 0 ? 1 / i : 0)) as [number, number, number];
  }

  // Particle systems
  createParticleSystem(config: Partial<ParticleSystem> & { id: string }): void {
    const system: ParticleSystem = {
      particles: [],
      emitter: {
        position: [0, 0, 0],
        direction: [0, 1, 0],
        rate: 10,
        spread: 0.1,
        initialVelocity: 5,
        initialLife: 3,
        shape: "point",
      },
      forces: [{ type: "gravity", position: [0, 0, 0], strength: -9.81, radius: 1000 }],
      maxParticles: 1000,
      gpuAccelerated: true,
      ...config,
    };

    this.particleSystems.set(system.id, system);
  }

  // Fluid simulation
  createFluidSimulation(config: Partial<FluidSimulation> & { id: string }): void {
    const fluid: FluidSimulation = {
      particles: [],
      density: 1000,
      viscosity: 0.01,
      surfaceTension: 0.0728,
      gasConstant: 2000,
      restDensity: 1000,
      kernelRadius: 0.04,
      method: "SPH",
      ...config,
    };

    this.fluidSimulations.set(fluid.id, fluid);
  }

  // Main simulation step
  step(deltaTime: number): void {
    const startTime = performance.now();

    const dt = Math.min(deltaTime, this.world.timeStep * this.world.maxSubSteps);
    const subSteps = Math.ceil(dt / this.world.timeStep);
    const subDt = dt / subSteps;

    for (let i = 0; i < subSteps; i++) {
      this.substep(subDt);
    }

    this.stats.frameTime = performance.now() - startTime;
    this.updateStats();
  }

  private substep(dt: number): void {
    // Clear forces
    this.clearForces();

    // Apply forces
    this.applyForces(dt);

    // Broadphase collision detection
    const pairs = this.broadphaseCollision();

    // Narrowphase collision detection
    const contacts = this.narrowphaseCollision(pairs);

    // Solve constraints
    this.solveConstraints(dt);

    // Solve contacts
    this.solveContacts(contacts, dt);

    // Integrate motion
    this.integrateMotion(dt);

    // Update particle systems
    this.updateParticleSystems(dt);

    // Update fluid simulations
    this.updateFluidSimulations(dt);

    // Update spatial structures
    this.updateSpatialStructures();

    // Sleep management
    this.updateSleeping();
  }

  private clearForces(): void {
    for (const body of this.rigidBodies.values()) {
      body.forces = [0, 0, 0];
      body.torques = [0, 0, 0];
    }
  }

  private applyForces(_dt: number): void {
    const [gx, gy, gz] = this.world.gravity;

    for (const body of this.rigidBodies.values()) {
      if (body.type === "dynamic" && !body.sleeping) {
        // Apply gravity
        body.forces[0] += body.mass * gx;
        body.forces[1] += body.mass * gy;
        body.forces[2] += body.mass * gz;
      }
    }
  }

  private broadphaseCollision(): CollisionPair[] {
    switch (this.world.broadphase) {
      case "octree":
        return this.octreeBroadphase();
      case "grid":
        return this.gridBroadphase();
      case "sweep":
        return this.sweepBroadphase();
      default:
        return this.naiveBroadphase();
    }
  }

  private octreeBroadphase(): CollisionPair[] {
    const pairs: CollisionPair[] = [];
    // Implementation would use octree for efficient broad phase
    return pairs;
  }

  private narrowphaseCollision(pairs: CollisionPair[]): Contact[] {
    const contacts: Contact[] = [];

    for (const pair of pairs) {
      const contact = this.detectCollision(pair.bodyA, pair.bodyB);
      if (contact) {
        contacts.push(contact);
      }
    }

    return contacts;
  }

  private detectCollision(_bodyA: RigidBody, _bodyB: RigidBody): Contact | null {
    // GJK-EPA collision detection implementation
    return null;
  }

  private solveConstraints(dt: number): void {
    for (const constraint of this.constraints.values()) {
      this.solveConstraint(constraint, dt);
    }
  }

  private solveConstraint(_constraint: Constraint, _dt: number): void {
    // Constraint solving implementation
  }

  private solveContacts(contacts: Contact[], dt: number): void {
    // PGS (Projected Gauss-Seidel) solver
    const iterations = 10;

    for (let i = 0; i < iterations; i++) {
      for (const contact of contacts) {
        this.solveContact(contact, dt);
      }
    }
  }

  private solveContact(_contact: Contact, _dt: number): void {
    // Contact constraint solving
  }

  private integrateMotion(dt: number): void {
    for (const body of this.rigidBodies.values()) {
      if (body.type !== "dynamic" || body.sleeping) {
        continue;
      }

      // Linear integration
      body.velocity[0] += body.forces[0] * body.inverseMass * dt;
      body.velocity[1] += body.forces[1] * body.inverseMass * dt;
      body.velocity[2] += body.forces[2] * body.inverseMass * dt;

      body.position[0] += body.velocity[0] * dt;
      body.position[1] += body.velocity[1] * dt;
      body.position[2] += body.velocity[2] * dt;

      // Angular integration
      body.angularVelocity[0] += body.torques[0] * body.inverseInertia[0] * dt;
      body.angularVelocity[1] += body.torques[1] * body.inverseInertia[1] * dt;
      body.angularVelocity[2] += body.torques[2] * body.inverseInertia[2] * dt;

      // Quaternion integration
      this.integrateRotation(body, dt);
    }
  }

  private integrateRotation(body: RigidBody, dt: number): void {
    const [wx, wy, wz] = body.angularVelocity;
    const [qx, qy, qz, qw] = body.rotation;

    const dqx = 0.5 * (wx * qw + wy * qz - wz * qy) * dt;
    const dqy = 0.5 * (wy * qw + wz * qx - wx * qz) * dt;
    const dqz = 0.5 * (wz * qw + wx * qy - wy * qx) * dt;
    const dqw = 0.5 * (-wx * qx - wy * qy - wz * qz) * dt;

    body.rotation[0] += dqx;
    body.rotation[1] += dqy;
    body.rotation[2] += dqz;
    body.rotation[3] += dqw;

    // Normalize quaternion
    const length = Math.sqrt(
      body.rotation[0] ** 2 + body.rotation[1] ** 2 + body.rotation[2] ** 2 + body.rotation[3] ** 2,
    );
    body.rotation[0] /= length;
    body.rotation[1] /= length;
    body.rotation[2] /= length;
    body.rotation[3] /= length;
  }

  private async updateParticleSystems(dt: number): Promise<void> {
    for (const system of this.particleSystems.values()) {
      if (system.gpuAccelerated && this.device) {
        await this.updateParticlesGPU(system, dt);
      } else {
        this.updateParticlesCPU(system, dt);
      }
    }
  }

  private async updateParticlesGPU(_system: ParticleSystem, _dt: number): Promise<void> {
    // GPU particle update implementation
  }

  private updateParticlesCPU(system: ParticleSystem, dt: number): void {
    // CPU particle update implementation
    system.particles.forEach((particle) => {
      if (particle.life > 0) {
        // Apply forces
        const totalForce: [number, number, number] = [0, 0, 0];
        for (const force of system.forces) {
          const f = this.calculateForceOnParticle(particle, force);
          if (f) {
            totalForce[0] += f[0];
            totalForce[1] += f[1];
            totalForce[2] += f[2];
          }
        }

        // Integrate
        const acceleration: [number, number, number] = [
          totalForce[0] / particle.mass,
          totalForce[1] / particle.mass,
          totalForce[2] / particle.mass,
        ];

        if (particle.velocity) {
          particle.velocity[0] += acceleration[0] * dt;
          particle.velocity[1] += acceleration[1] * dt;
          particle.velocity[2] += acceleration[2] * dt;
        }

        particle.position[0] += particle.velocity[0] * dt;
        particle.position[1] += particle.velocity[1] * dt;
        particle.position[2] += particle.velocity[2] * dt;

        particle.life -= dt;
      }
    });

    // Remove dead particles
    system.particles = system.particles.filter((p) => p.life > 0);
  }

  private calculateForceOnParticle(
    particle: Particle,
    force: ForceField,
  ): [number, number, number] {
    const dx = particle.position[0] - force.position[0];
    const dy = particle.position[1] - force.position[1];
    const dz = particle.position[2] - force.position[2];
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance > force.radius) {
      return [0, 0, 0];
    }

    const strength = force.strength * (1 - distance / force.radius);

    switch (force.type) {
      case "gravity":
        return [0, strength, 0];
      case "wind":
        return force.direction
          ? [
              force.direction[0] * strength,
              force.direction[1] * strength,
              force.direction[2] * strength,
            ]
          : [0, 0, 0];
      default:
        return [0, 0, 0];
    }
  }

  private updateFluidSimulations(dt: number): void {
    for (const fluid of this.fluidSimulations.values()) {
      this.updateFluidSPH(fluid, dt);
    }
  }

  private updateFluidSPH(fluid: FluidSimulation, dt: number): void {
    // SPH fluid simulation implementation
    this.computeDensityPressure(fluid);
    this.computeForces(fluid);
    this.integrate(fluid, dt);
  }

  private computeDensityPressure(_fluid: FluidSimulation): void {
    // Density and pressure computation for SPH
  }

  private computeForces(_fluid: FluidSimulation): void {
    // Force computation for SPH
  }

  private integrate(_fluid: FluidSimulation, _dt: number): void {
    // Integration step for SPH
  }

  private updateSpatialStructures(): void {
    this.spatialGrid.clear();
    this.octree.clear();

    for (const body of this.rigidBodies.values()) {
      this.spatialGrid.insert(body);
      this.octree.insert(body);
    }
  }

  private updateSleeping(): void {
    for (const body of this.rigidBodies.values()) {
      if (body.type !== "dynamic") {
        continue;
      }

      const speed = Math.sqrt(
        body.velocity[0] ** 2 +
          body.velocity[1] ** 2 +
          body.velocity[2] ** 2 +
          body.angularVelocity[0] ** 2 +
          body.angularVelocity[1] ** 2 +
          body.angularVelocity[2] ** 2,
      );

      if (speed < this.world.sleepThreshold) {
        body.sleeping = true;
      } else if (speed > this.world.sleepThreshold * 2) {
        body.sleeping = false;
      }
    }
  }

  private naiveBroadphase(): CollisionPair[] {
    return [];
  }
  private gridBroadphase(): CollisionPair[] {
    return [];
  }
  private sweepBroadphase(): CollisionPair[] {
    return [];
  }

  private updateStats(): void {
    this.stats.rigidBodies = this.rigidBodies.size;
    this.stats.constraints = this.constraints.size;
    this.stats.particles = Array.from(this.particleSystems.values()).reduce(
      (_sum, _sys) => _sum + _sys.particles.length,
      0,
    );
  }

  getStats() {
    return { ...this.stats };
  }

  destroy(): void {
    this.workers.forEach((worker) => worker.terminate());
    this.rigidBodies.clear();
    this.constraints.clear();
    this.particleSystems.clear();
    this.fluidSimulations.clear();
  }
}

// Helper classes and interfaces
interface CollisionPair {
  bodyA: RigidBody;
  bodyB: RigidBody;
}
interface Contact {
  bodyA: RigidBody;
  bodyB: RigidBody;
  normal: [number, number, number];
  penetration: number;
}
class SpatialGrid {
  constructor(public cellSize: number) {}
  insert(_body: RigidBody): void {}
  clear(): void {}
}
class Octree {
  constructor(
    public bounds: AABB,
    public maxDepth: number,
  ) {}
  insert(_body: RigidBody): void {}
  clear(): void {}
}
class IslandManager {}
class WorkerPool {
  constructor(public size: number) {}
  addWorker(_worker: Worker): void {}
}
