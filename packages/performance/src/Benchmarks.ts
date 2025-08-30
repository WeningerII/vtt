/**
 * Comprehensive benchmarking suite for VTT systems
 */

import * as Benchmark from "benchmark";
import { logger } from "@vtt/logging";
import { Profiler } from "./Profiler";

export interface BenchmarkConfig {
  name: string;
  setup?: () => void;
  teardown?: () => void;
  iterations?: number;
  warmupIterations?: number;
  minSamples?: number;
  maxTime?: number;
}

export interface BenchmarkResult {
  name: string;
  hz: number; // Operations per second
  mean: number; // Mean execution time in milliseconds
  deviation: number; // Standard deviation
  samples: number;
  variance: number;
  margin: number; // Margin of error
  rme: number; // Relative margin of error as percentage
}

export interface SystemBenchmarkSuite {
  ecs: BenchmarkResult[];
  renderer: BenchmarkResult[];
  physics: BenchmarkResult[];
  networking: BenchmarkResult[];
  overall: BenchmarkResult[];
}

export class BenchmarkRunner {
  private _profiler: Profiler;
  private results: Map<string, BenchmarkResult> = new Map();

  constructor(profiler: Profiler) {
    this._profiler = profiler;
  }

  // Core benchmarking functionality
  async runBenchmark(
    _name: string,
    _operation: () => void | Promise<void>,
    config: Partial<BenchmarkConfig> = {},
  ): Promise<BenchmarkResult> {
    const suite = new Benchmark.Suite();

    return new Promise((_resolve, __reject) => {
      suite
        .add(_name, _operation, {
          setup: config.setup,
          teardown: config.teardown,
          minSamples: config.minSamples || 100,
          maxTime: config.maxTime || 5,
          ...config,
        })
        .on("complete", () => {
          const benchmark = (suite as any)[0];
          const result: BenchmarkResult = {
            name: _name,
            hz: benchmark.hz,
            mean: benchmark.stats.mean * 1000, // Convert to milliseconds
            deviation: benchmark.stats.deviation * 1000,
            samples: benchmark.stats.sample.length,
            variance: benchmark.stats.variance,
            margin: benchmark.stats.moe * 1000,
            rme: benchmark.stats.rme,
          };

          this.results.set(_name, result);
          _resolve(result);
        })
        .on("error", __reject)
        .run({ async: true });
    });
  }

  // ECS System Benchmarks
  async benchmarkECSOperations(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    // Component creation benchmark
    let entityId = 0;
    const componentStore = new Map<number, any>();

    results.push(
      await this.runBenchmark(
        "ECS: Component Creation",
        () => {
          const id = entityId++;
          componentStore.set(id, {
            position: { x: Math.random() * 1000, y: Math.random() * 1000 },
            velocity: { x: Math.random() * 10, y: Math.random() * 10 },
            health: 100,
          });
        },
        { minSamples: 1000 },
      ),
    );

    // Component lookup benchmark
    const existingIds = Array.from(componentStore.keys());
    results.push(
      await this.runBenchmark(
        "ECS: Component Lookup",
        () => {
          const randomId = existingIds[Math.floor(Math.random() * existingIds.length)];
          if (randomId === undefined) return;
          const component = componentStore.get(randomId);
          if (component) {
            component.position.x += 1;
          }
        },
        { minSamples: 1000 },
      ),
    );

    // System update simulation
    results.push(
      await this.runBenchmark(
        "ECS: System Update (1000 entities)",
        () => {
          for (const [_id, component] of componentStore) {
            if (component.velocity) {
              component.position.x += component.velocity.x * 0.016; // 60 FPS
              component.position.y += component.velocity.y * 0.016;
            }
          }
        },
        { minSamples: 100 },
      ),
    );

    return results;
  }

  // Renderer Benchmarks
  async benchmarkRenderOperations(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    // Matrix operations benchmark
    results.push(
      await this.runBenchmark(
        "Renderer: Matrix Multiplication",
        () => {
          const m1: number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
          const m2: number[] = [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1];
          const result: number[] = new Array(16).fill(0);

          for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
              result[i * 4 + j] = 0;
              for (let k = 0; k < 4; k++) {
                const val1 = m1[i * 4 + k];
                const val2 = m2[k * 4 + j];
                const idx = i * 4 + j;
                if (val1 !== undefined && val2 !== undefined && result[idx] !== undefined) {
                  result[idx] += val1 * val2;
                }
              }
            }
          }
        },
        { minSamples: 10000 },
      ),
    );

    // Frustum culling simulation
    const objects = Array.from({ length: 1000 }, () => ({
      x: Math.random() * 2000 - 1000,
      y: Math.random() * 2000 - 1000,
      radius: Math.random() * 50 + 10,
    }));

    results.push(
      await this.runBenchmark(
        "Renderer: Frustum Culling (1000 objects)",
        () => {
          const viewLeft = -400,
            viewRight = 400,
            viewTop = 300,
            viewBottom = -300;
          let visibleCount = 0;

          for (const obj of objects) {
            if (
              obj.x + obj.radius >= viewLeft &&
              obj.x - obj.radius <= viewRight &&
              obj.y + obj.radius >= viewBottom &&
              obj.y - obj.radius <= viewTop
            ) {
              visibleCount++;
            }
          }
        },
        { minSamples: 1000 },
      ),
    );

    // Batch sorting benchmark
    const renderObjects = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      layer: Math.floor(Math.random() * 10),
      textureId: Math.floor(Math.random() * 20),
      position: [Math.random() * 1000, Math.random() * 1000],
    }));

    results.push(
      await this.runBenchmark(
        "Renderer: Batch Sorting (1000 objects)",
        () => {
          renderObjects.sort((a, b) => {
            if (a.layer !== b.layer) return a.layer - b.layer;
            return a.textureId - b.textureId;
          });
        },
        { minSamples: 1000 },
      ),
    );

    return results;
  }

  // Physics Benchmarks
  async benchmarkPhysicsOperations(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    // Vector operations
    results.push(
      await this.runBenchmark(
        "Physics: Vector3 Operations",
        () => {
          const v1 = { x: Math.random(), y: Math.random(), z: Math.random() };
          const v2 = { x: Math.random(), y: Math.random(), z: Math.random() };

          // Dot product
          const _dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;

          // Cross product
          const _cross = {
            x: v1.y * v2.z - v1.z * v2.y,
            y: v1.z * v2.x - v1.x * v2.z,
            z: v1.x * v2.y - v1.y * v2.x,
          };

          // Length
          const _length = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
        },
        { minSamples: 10000 },
      ),
    );

    // Collision detection
    const bodies = Array.from({ length: 100 }, () => ({
      x: Math.random() * 1000,
      y: Math.random() * 1000,
      radius: Math.random() * 20 + 5,
    }));

    results.push(
      await this.runBenchmark(
        "Physics: Circle Collision Detection (100 bodies)",
        () => {
          let collisions = 0;
          for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
              const bodyA = bodies[i];
              const bodyB = bodies[j];
              if (!bodyA || !bodyB) continue;

              const dx = bodyA.x - bodyB.x;
              const dy = bodyA.y - bodyB.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const minDistance = bodyA.radius + bodyB.radius;

              if (distance < minDistance) {
                collisions++;
              }
            }
          }
        },
        { minSamples: 1000 },
      ),
    );

    // Integration step
    const particles = Array.from({ length: 1000 }, () => ({
      x: Math.random() * 1000,
      y: Math.random() * 1000,
      vx: Math.random() * 20 - 10,
      vy: Math.random() * 20 - 10,
      ax: 0,
      ay: -9.81,
    }));

    results.push(
      await this.runBenchmark(
        "Physics: Integration Step (1000 particles)",
        () => {
          const dt = 1 / 60;
          for (const particle of particles) {
            particle.vx += particle.ax * dt;
            particle.vy += particle.ay * dt;
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
          }
        },
        { minSamples: 1000 },
      ),
    );

    return results;
  }

  // Network Benchmarks
  async benchmarkNetworkOperations(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    // Message serialization
    const sampleMessage = {
      type: "player_move",
      playerId: "player_123",
      position: { x: 100.5, y: 200.3, z: 0 },
      rotation: 45.2,
      timestamp: Date.now(),
      metadata: {
        speed: 5.2,
        direction: "north",
        animation: "walk",
      },
    };

    results.push(
      await this.runBenchmark(
        "Network: JSON Serialization",
        () => {
          const serialized = JSON.stringify(sampleMessage);
          const _deserialized = JSON.parse(serialized);
        },
        { minSamples: 10000 },
      ),
    );

    // Message batching simulation
    const messages = Array.from({ length: 100 }, (_, i) => ({
      ...sampleMessage,
      playerId: `player_${i}`,
      position: { x: Math.random() * 1000, y: Math.random() * 1000, z: 0 },
    }));

    results.push(
      await this.runBenchmark(
        "Network: Message Batching (100 messages)",
        () => {
          const batch = {
            timestamp: Date.now(),
            messages: messages,
          };
          const _serialized = JSON.stringify(batch);
        },
        { minSamples: 1000 },
      ),
    );

    // Delta compression simulation
    const previousState = { players: new Map() };
    for (let i = 0; i < 50; i++) {
      previousState.players.set(`player_${i}`, {
        x: Math.random() * 1000,
        y: Math.random() * 1000,
        health: 100,
      });
    }

    results.push(
      await this.runBenchmark(
        "Network: Delta Compression (50 players)",
        () => {
          const currentState = { players: new Map() };
          const delta: {
            updated: Array<{ playerId: string; x: number; y: number; health: number }>;
            removed: any[];
          } = { updated: [], removed: [] };

          // Simulate state changes
          for (const [playerId, player] of previousState.players) {
            const newPlayer = {
              x: player.x + (Math.random() - 0.5) * 10,
              y: player.y + (Math.random() - 0.5) * 10,
              health: player.health,
            };
            currentState.players.set(playerId, newPlayer);

            // Check if changed enough to send delta
            if (Math.abs(newPlayer.x - player.x) > 1 || Math.abs(newPlayer.y - player.y) > 1) {
              delta.updated.push({ playerId, ...newPlayer });
            }
          }

          const _serialized = JSON.stringify(delta);
        },
        { minSamples: 1000 },
      ),
    );

    return results;
  }

  // Overall system benchmarks
  async benchmarkGameLoopOperations(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    // Simulate a complete game loop iteration
    const gameState: {
      entities: Map<number, any>;
      renderQueue: Array<{ id: number; x: number; y: number; layer: number }>;
      networkMessages: Array<{ type: string; id: number; position: any }>;
    } = {
      entities: new Map(),
      renderQueue: [],
      networkMessages: [],
    };

    // Initialize entities
    for (let i = 0; i < 100; i++) {
      gameState.entities.set(i, {
        position: { x: Math.random() * 1000, y: Math.random() * 1000 },
        velocity: { x: Math.random() * 10 - 5, y: Math.random() * 10 - 5 },
        health: 100,
        visible: true,
      });
    }

    results.push(
      await this.runBenchmark(
        "Game Loop: Complete Iteration (100 entities)",
        () => {
          // Update phase
          for (const [_id, entity] of gameState.entities) {
            entity.position.x += entity.velocity.x * 0.016;
            entity.position.y += entity.velocity.y * 0.016;

            // Boundary check
            if (entity.position.x < 0 || entity.position.x > 1000) {
              entity.velocity.x *= -1;
            }
            if (entity.position.y < 0 || entity.position.y > 1000) {
              entity.velocity.y *= -1;
            }
          }

          // Render preparation
          gameState.renderQueue = [];
          for (const [id, entity] of gameState.entities) {
            if (entity.visible) {
              gameState.renderQueue.push({
                id,
                x: entity.position.x,
                y: entity.position.y,
                layer: 0,
              });
            }
          }

          // Network preparation
          gameState.networkMessages = [];
          for (const [id, entity] of gameState.entities) {
            if (Math.random() < 0.1) {
              // 10% of entities send updates
              gameState.networkMessages.push({
                type: "entity_update",
                id,
                position: entity.position,
              });
            }
          }
        },
        { minSamples: 1000 },
      ),
    );

    return results;
  }

  // Complete benchmark suite
  async runFullBenchmarkSuite(): Promise<SystemBenchmarkSuite> {
    logger.info("Running comprehensive VTT performance benchmark suite...");

    const [ecs, renderer, physics, networking, overall] = await Promise.all([
      this.benchmarkECSOperations(),
      this.benchmarkRenderOperations(),
      this.benchmarkPhysicsOperations(),
      this.benchmarkNetworkOperations(),
      this.benchmarkGameLoopOperations(),
    ]);

    return { ecs, renderer, physics, networking, overall };
  }

  // Performance regression testing
  async compareWithBaseline(
    baseline: SystemBenchmarkSuite,
    current: SystemBenchmarkSuite,
    threshold: number = 0.1, // 10% regression threshold
  ): Promise<{
    regressions: Array<{ name: string; baseline: number; current: number; regression: number }>;
    improvements: Array<{ name: string; baseline: number; current: number; improvement: number }>;
    summary: { totalRegressions: number; totalImprovements: number; overallChange: number };
  }> {
    const regressions: Array<{
      name: string;
      baseline: number;
      current: number;
      regression: number;
    }> = [];
    const improvements: Array<{
      name: string;
      baseline: number;
      current: number;
      improvement: number;
    }> = [];

    const allCategories = [
      ...baseline.ecs.map((b) => ({ ...b, category: "ecs" })),
      ...baseline.renderer.map((b) => ({ ...b, category: "renderer" })),
      ...baseline.physics.map((b) => ({ ...b, category: "physics" })),
      ...baseline.networking.map((b) => ({ ...b, category: "networking" })),
      ...baseline.overall.map((b) => ({ ...b, category: "overall" })),
    ];

    const currentAll = [
      ...current.ecs.map((b) => ({ ...b, category: "ecs" })),
      ...current.renderer.map((b) => ({ ...b, category: "renderer" })),
      ...current.physics.map((b) => ({ ...b, category: "physics" })),
      ...current.networking.map((b) => ({ ...b, category: "networking" })),
      ...current.overall.map((b) => ({ ...b, category: "overall" })),
    ];

    for (const baselineBench of allCategories) {
      const currentBench = currentAll.find((c) => c.name === baselineBench.name);

      if (currentBench) {
        const change = (currentBench.mean - baselineBench.mean) / baselineBench.mean;

        if (change > threshold) {
          regressions.push({
            name: baselineBench.name,
            baseline: baselineBench.mean,
            current: currentBench.mean,
            regression: change,
          });
        } else if (change < -threshold) {
          improvements.push({
            name: baselineBench.name,
            baseline: baselineBench.mean,
            current: currentBench.mean,
            improvement: Math.abs(change),
          });
        }
      }
    }

    const totalRegressions = regressions.length;
    const totalImprovements = improvements.length;
    const overallChange =
      regressions.reduce((_sum, _r) => _sum + _r.regression, 0) -
      improvements.reduce((_sum, _i) => _sum + _i.improvement, 0);

    return {
      regressions,
      improvements,
      summary: { totalRegressions, totalImprovements, overallChange },
    };
  }

  // Results access
  getResults(): Map<string, BenchmarkResult> {
    return new Map(this.results);
  }

  getBestPerforming(count: number = 5): BenchmarkResult[] {
    return Array.from(this.results.values())
      .sort((a, b) => b.hz - a.hz)
      .slice(0, count);
  }

  getWorstPerforming(count: number = 5): BenchmarkResult[] {
    return Array.from(this.results.values())
      .sort((a, b) => a.hz - b.hz)
      .slice(0, count);
  }
}
