import { vec3, vec4, mat4 } from "gl-matrix";
import { GeometryManager } from "../engine/GeometryManager";
import { TextureManager } from "../engine/TextureManager";
import { ShaderProgram } from "../engine/Shader";
import { Camera } from "../engine/Camera";

export interface ParticleSystemConfig {
  maxParticles: number;
  emissionRate: number;
  lifetime: number;
  lifetimeVariation: number;
  startSize: number;
  endSize: number;
  startColor: [number, number, number, number];
  endColor: [number, number, number, number];
  startVelocity: [number, number, number];
  velocityVariation: [number, number, number];
  acceleration: [number, number, number];
  gravity: number;
  damping: number;
  texture?: string;
  blendMode: "additive" | "alpha" | "multiply";
  worldSpace: boolean;
  prewarm: boolean;
  loop: boolean;
}

export interface Particle {
  position: vec3;
  velocity: vec3;
  color: vec4;
  size: number;
  life: number;
  maxLife: number;
  active: boolean;
}

export interface EmitterShape {
  type: "point" | "sphere" | "box" | "cone" | "circle" | "line";
  parameters: { [key: string]: number };
}

export interface ParticleForce {
  type: "gravity" | "wind" | "vortex" | "attractor" | "repulsor";
  strength: number;
  position?: vec3;
  direction?: vec3;
  radius?: number;
  falloff?: number;
}

export class ParticleSystem {
  private gl: WebGL2RenderingContext;
  private geometryManager: GeometryManager;
  private textureManager: TextureManager;

  private config: ParticleSystemConfig;
  private particles: Particle[] = [];
  private particlePool: Particle[] = [];
  private activeParticles = 0;

  // GPU buffers for instanced rendering
  private instanceVBO: WebGLBuffer | null = null;
  private instanceData: Float32Array = new Float32Array(0);
  private instanceStride = 12; // position(3) + color(4) + size(1) + rotation(1) + life(1) + reserved(2)

  // Emitter properties
  private position = vec3.create();
  private rotation = mat4.create();
  private emitterShape: EmitterShape = { type: "point", parameters: {} };
  private forces: ParticleForce[] = [];

  // Animation properties
  private time = 0;
  private deltaTime = 0;
  private emissionTimer = 0;
  private isPlaying = true;
  private isPaused = false;

  // Performance tracking
  private lastUpdateTime = 0;
  private updateTime = 0;
  private renderTime = 0;

  constructor(
    gl: WebGL2RenderingContext,
    geometryManager: GeometryManager,
    textureManager: TextureManager,
    config: Partial<ParticleSystemConfig> = {},
  ) {
    this.gl = gl;
    this.geometryManager = geometryManager;
    this.textureManager = textureManager;

    this.config = {
      maxParticles: 1000,
      emissionRate: 50,
      lifetime: 5.0,
      lifetimeVariation: 1.0,
      startSize: 1.0,
      endSize: 0.0,
      startColor: [1, 1, 1, 1],
      endColor: [1, 1, 1, 0],
      startVelocity: [0, 1, 0],
      velocityVariation: [1, 1, 1],
      acceleration: [0, 0, 0],
      gravity: -9.81,
      damping: 0.99,
      blendMode: "additive",
      worldSpace: true,
      prewarm: false,
      loop: true,
      ...config,
    };

    this.initializeParticles();
    this.createInstanceBuffer();

    if (this.config.prewarm) {
      this.prewarm();
    }
  }

  private initializeParticles(): void {
    // Create particle pool
    this.particles = [];
    this.particlePool = [];

    for (let i = 0; i < this.config.maxParticles; i++) {
      const particle: Particle = {
        position: vec3.create(),
        velocity: vec3.create(),
        color: vec4.create(),
        size: 0,
        life: 0,
        maxLife: 0,
        active: false,
      };

      this.particles.push(particle);
      this.particlePool.push(particle);
    }
  }

  private createInstanceBuffer(): void {
    const gl = this.gl;

    // Create instance data buffer
    this.instanceData = new Float32Array(this.config.maxParticles * this.instanceStride);

    this.instanceVBO = gl.createBuffer();
    if (this.instanceVBO) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
      gl.bufferData(gl.ARRAY_BUFFER, this.instanceData, gl.DYNAMIC_DRAW);
    }
  }

  update(deltaTime: number): void {
    const startTime = performance.now();

    this.deltaTime = deltaTime;
    this.time += deltaTime;

    if (!this.isPlaying || this.isPaused) {
      return;
    }

    // Emit new particles
    this.emitParticles(deltaTime);

    // Update existing particles
    this.updateParticles(deltaTime);

    // Apply forces
    this.applyForces(deltaTime);

    // Update GPU data
    this.updateInstanceData();

    this.updateTime = performance.now() - startTime;
  }

  private emitParticles(deltaTime: number): void {
    if (!this.config.loop && this.time > this.config.lifetime) {
      return;
    }

    this.emissionTimer += deltaTime;
    const emissionInterval = 1.0 / this.config.emissionRate;

    while (this.emissionTimer >= emissionInterval && this.particlePool.length > 0) {
      this.emissionTimer -= emissionInterval;

      const particle = this.particlePool.pop()!;
      this.initializeParticle(particle);
    }
  }

  private initializeParticle(particle: Particle): void {
    // Set initial position based on emitter shape
    this.setParticlePosition(particle);

    // Set initial velocity with variation
    particle.velocity[0] = this.config.startVelocity[0];
    particle.velocity[1] = this.config.startVelocity[1];
    particle.velocity[2] = this.config.startVelocity[2];
    this.addVariation(particle.velocity, this.config.velocityVariation);

    // Transform velocity by emitter rotation if in local space
    if (!this.config.worldSpace) {
      vec3.transformMat4(particle.velocity, particle.velocity, this.rotation);
    }

    // Set initial color
    particle.color[0] = this.config.startColor[0];
    particle.color[1] = this.config.startColor[1];
    particle.color[2] = this.config.startColor[2];
    particle.color[3] = this.config.startColor[3];

    // Set size
    particle.size = this.config.startSize;

    // Set lifetime
    particle.maxLife =
      this.config.lifetime + (Math.random() - 0.5) * 2 * this.config.lifetimeVariation;
    particle.life = particle.maxLife;

    particle.active = true;
    this.activeParticles++;
  }

  private setParticlePosition(particle: Particle): void {
    const shape = this.emitterShape;

    switch (shape.type) {
      case "point":
        vec3.copy(particle.position, this.position);
        break;

      case "sphere":
        {
          const radius = shape.parameters?.radius || 1;
          const phi = Math.random() * Math.PI * 2;
          const cosTheta = Math.random() * 2 - 1;
          const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
          const r = Math.pow(Math.random(), 1 / 3) * radius;

          particle.position[0] = (this.position[0] ?? 0) + r * sinTheta * Math.cos(phi);
          particle.position[1] = (this.position[1] ?? 0) + r * cosTheta;
          particle.position[2] = (this.position[2] ?? 0) + r * sinTheta * Math.sin(phi);
        }
        break;

      case "box":
        {
          const width = shape.parameters?.width || 1;
          const height = shape.parameters?.height || 1;
          const depth = shape.parameters?.depth || 1;

          particle.position[0] = (this.position[0] ?? 0) + (Math.random() - 0.5) * width;
          particle.position[1] = (this.position[1] ?? 0) + (Math.random() - 0.5) * height;
          particle.position[2] = (this.position[2] ?? 0) + (Math.random() - 0.5) * depth;
        }
        break;

      case "circle":
        {
          const circleRadius = shape.parameters?.radius || 1;
          const angle = Math.random() * Math.PI * 2;
          const distance = Math.sqrt(Math.random()) * circleRadius;

          particle.position[0] = (this.position[0] ?? 0) + Math.cos(angle) * distance;
          particle.position[1] = this.position[1] ?? 0;
          particle.position[2] = (this.position[2] ?? 0) + Math.sin(angle) * distance;
        }
        break;

      case "cone":
        {
          const coneRadius = shape.parameters?.radius || 1;
          const coneHeight = shape.parameters?.height || 1;
          const coneAngle = Math.random() * Math.PI * 2;
          const coneDistance = Math.sqrt(Math.random()) * coneRadius;
          const heightOffset = Math.random() * coneHeight;

          particle.position[0] =
            (this.position[0] ?? 0) + Math.cos(coneAngle) * coneDistance * (1 - heightOffset / coneHeight);
          particle.position[1] = (this.position[1] ?? 0) + heightOffset;
          particle.position[2] =
            (this.position[2] ?? 0) + Math.sin(coneAngle) * coneDistance * (1 - heightOffset / coneHeight);
        }
        break;

      default:
        particle.position[0] = this.position[0] ?? 0;
        particle.position[1] = this.position[1] ?? 0;
        particle.position[2] = this.position[2] ?? 0;
    }
  }

  private addVariation(value: vec3, variation: [number, number, number]): void {
    if (value[0] !== undefined) {value[0] += (Math.random() - 0.5) * 2 * variation[0];}
    if (value[1] !== undefined) {value[1] += (Math.random() - 0.5) * 2 * variation[1];}
    if (value[2] !== undefined) {value[2] += (Math.random() - 0.5) * 2 * variation[2];}
  }

  private updateParticles(deltaTime: number): void {
    for (const particle of this.particles) {
      if (!particle.active) {continue;}

      // Update lifetime
      particle.life -= deltaTime;
      if (particle.life <= 0) {
        this.deactivateParticle(particle);
        continue;
      }

      // Calculate life ratio (0 = just born, 1 = about to die)
      const lifeRatio = 1 - particle.life / particle.maxLife;

      // Apply velocity and acceleration
      const accel = vec3.fromValues(
        this.config.acceleration[0],
        this.config.acceleration[1] + this.config.gravity,
        this.config.acceleration[2],
      );

      vec3.scaleAndAdd(particle.velocity, particle.velocity, accel, deltaTime);
      vec3.scale(particle.velocity, particle.velocity, Math.pow(this.config.damping, deltaTime));
      vec3.scaleAndAdd(particle.position, particle.position, particle.velocity, deltaTime);

      // Interpolate color
      this.lerpColor(particle.color, this.config.startColor, this.config.endColor, lifeRatio);

      // Interpolate size
      particle.size = this.lerp(this.config.startSize, this.config.endSize, lifeRatio);
    }
  }

  private applyForces(deltaTime: number): void {
    for (const force of this.forces) {
      this.applyForce(force, deltaTime);
    }
  }

  private applyForce(force: ParticleForce, deltaTime: number): void {
    for (const particle of this.particles) {
      if (!particle.active) {continue;}

      const forceVector = vec3.create();

      switch (force.type) {
        case "gravity":
          vec3.set(forceVector, 0, -force.strength, 0);
          break;

        case "wind":
          if (force.direction) {
            vec3.scale(forceVector, force.direction, force.strength);
          }
          break;

        case "attractor":
        case "repulsor":
          if (force.position) {
            vec3.subtract(forceVector, force.position, particle.position);
            const distance = vec3.length(forceVector);

            if (distance > 0) {
              vec3.normalize(forceVector, forceVector);

              let strength = force.strength;
              if (force.falloff && force.radius) {
                strength *= Math.max(0, 1 - distance / force.radius);
              }

              if (force.type === "repulsor") {
                strength = -strength;
              }

              vec3.scale(forceVector, forceVector, strength / (distance * distance + 1));
            }
          }
          break;

        case "vortex":
          if (force.position) {
            const toCenter = vec3.subtract(vec3.create(), force.position, particle.position);
            const distance = vec3.length(toCenter);

            if (distance > 0) {
              // Create tangential force for vortex
              const tangent = vec3.fromValues(-(toCenter[2] ?? 0), 0, toCenter[0] ?? 0);
              vec3.normalize(tangent, tangent);
              vec3.scale(forceVector, tangent, force.strength / distance);
            }
          }
          break;
      }

      vec3.scaleAndAdd(particle.velocity, particle.velocity, forceVector, deltaTime);
    }
  }

  private deactivateParticle(particle: Particle): void {
    particle.active = false;
    this.particlePool.push(particle);
    this.activeParticles--;
  }

  private updateInstanceData(): void {
    let index = 0;

    for (const particle of this.particles) {
      if (!particle.active) {continue;}

      const offset = index * this.instanceStride;

      // Position
      this.instanceData[offset] = particle.position[0] ?? 0;
      this.instanceData[offset + 1] = particle.position[1] ?? 0;
      this.instanceData[offset + 2] = particle.position[2] ?? 0;

      // Color
      this.instanceData[offset + 3] = particle.color[0] ?? 1;
      this.instanceData[offset + 4] = particle.color[1] ?? 1;
      this.instanceData[offset + 5] = particle.color[2] ?? 1;
      this.instanceData[offset + 6] = particle.color[3] ?? 1;

      // Size
      this.instanceData[offset + 7] = particle.size;

      // Rotation (placeholder)
      this.instanceData[offset + 8] = 0;

      // Life ratio
      this.instanceData[offset + 9] = 1 - particle.life / particle.maxLife;

      // Reserved
      this.instanceData[offset + 10] = 0;
      this.instanceData[offset + 11] = 0;

      index++;
    }

    // Update GPU buffer
    if (this.instanceVBO && index > 0) {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        0,
        this.instanceData.subarray(0, index * this.instanceStride),
      );
    }
  }

  render(camera: Camera, shader: ShaderProgram): void {
    if (this.activeParticles === 0) {return;}

    const startTime = performance.now();
    const gl = this.gl;

    // Set up blending
    gl.enable(gl.BLEND);
    switch (this.config.blendMode) {
      case "additive":
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        break;
      case "alpha":
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        break;
      case "multiply":
        gl.blendFunc(gl.DST_COLOR, gl.ZERO);
        break;
    }

    // Disable depth writing but keep depth testing
    gl.depthMask(false);

    // Bind texture if available
    if (this.config.texture) {
      const texture = this.textureManager.getTexture(this.config.texture);
      if (texture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        shader.setUniform1i("u_texture", 0);
        shader.setUniform1i("u_hasTexture", 1);
      } else {
        shader.setUniform1i("u_hasTexture", 0);
      }
    } else {
      shader.setUniform1i("u_hasTexture", 0);
    }

    // Set up instanced rendering
    const quadMesh = this.geometryManager.getMesh("_quad");
    if (quadMesh && this.instanceVBO) {
      this.geometryManager.bindMesh(quadMesh);

      // Bind instance buffer and set up attributes
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);

      // Instance position (location 1)
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, this.instanceStride * 4, 0);
      gl.vertexAttribDivisor(1, 1);

      // Instance color (location 2)
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, this.instanceStride * 4, 3 * 4);
      gl.vertexAttribDivisor(2, 1);

      // Instance size (location 3)
      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 1, gl.FLOAT, false, this.instanceStride * 4, 7 * 4);
      gl.vertexAttribDivisor(3, 1);

      // Instance rotation (location 4)
      gl.enableVertexAttribArray(4);
      gl.vertexAttribPointer(4, 1, gl.FLOAT, false, this.instanceStride * 4, 8 * 4);
      gl.vertexAttribDivisor(4, 1);

      // Render instanced
      gl.drawElementsInstanced(
        quadMesh.drawMode,
        quadMesh.indexCount,
        gl.UNSIGNED_SHORT,
        0,
        this.activeParticles,
      );

      // Clean up
      gl.vertexAttribDivisor(1, 0);
      gl.vertexAttribDivisor(2, 0);
      gl.vertexAttribDivisor(3, 0);
      gl.vertexAttribDivisor(4, 0);
    }

    // Restore GL state
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    this.renderTime = performance.now() - startTime;
  }

  private prewarm(): void {
    const steps = 100;
    const deltaTime = this.config.lifetime / steps;

    for (let i = 0; i < steps; i++) {
      this.update(deltaTime);
    }
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private lerpColor(
    result: vec4,
    a: [number, number, number, number],
    b: [number, number, number, number],
    t: number,
  ): void {
    result[0] = this.lerp(a[0], b[0], t);
    result[1] = this.lerp(a[1], b[1], t);
    result[2] = this.lerp(a[2], b[2], t);
    result[3] = this.lerp(a[3], b[3], t);
  }

  // Public API
  setPosition(position: vec3): void {
    vec3.copy(this.position, position);
  }

  setRotation(rotation: mat4): void {
    mat4.copy(this.rotation, rotation);
  }

  setEmitterShape(shape: EmitterShape): void {
    this.emitterShape = shape;
  }

  addForce(force: ParticleForce): void {
    this.forces.push(force);
  }

  removeForce(force: ParticleForce): void {
    const index = this.forces.indexOf(force);
    if (index >= 0) {
      this.forces.splice(index, 1);
    }
  }

  clearForces(): void {
    this.forces.length = 0;
  }

  play(): void {
    this.isPlaying = true;
    this.isPaused = false;
  }

  pause(): void {
    this.isPaused = true;
  }

  stop(): void {
    this.isPlaying = false;
    this.time = 0;
    this.emissionTimer = 0;

    // Deactivate all particles
    for (const particle of this.particles) {
      if (particle.active) {
        this.deactivateParticle(particle);
      }
    }
  }

  restart(): void {
    this.stop();
    this.play();

    if (this.config.prewarm) {
      this.prewarm();
    }
  }

  updateConfig(config: Partial<ParticleSystemConfig>): void {
    Object.assign(this.config, config);

    // Recreate buffers if max particles changed
    if (config.maxParticles && config.maxParticles !== this.config.maxParticles) {
      this.initializeParticles();
      this.createInstanceBuffer();
    }
  }

  getStats() {
    return {
      activeParticles: this.activeParticles,
      maxParticles: this.config.maxParticles,
      poolSize: this.particlePool.length,
      utilization: this.activeParticles / this.config.maxParticles,
      updateTime: this.updateTime,
      renderTime: this.renderTime,
      totalTime: this.time,
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
    };
  }

  dispose(): void {
    const gl = this.gl;

    if (this.instanceVBO) {
      gl.deleteBuffer(this.instanceVBO);
      this.instanceVBO = null;
    }

    this.particles.length = 0;
    this.particlePool.length = 0;
    this.forces.length = 0;
    this.activeParticles = 0;
  }
}
