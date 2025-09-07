import { describe, test, expect, beforeEach } from "vitest";
import { CombatStore } from "../components/Combat";
import { CombatSystem } from "../systems/CombatSystem";
import { World } from "../World";

describe("CombatSystem Performance Benchmarks", () => {
  let combatStore: CombatStore;
  let combatSystem: CombatSystem;
  let world: World;

  beforeEach(() => {
    combatStore = new CombatStore(1000);
    world = new World();
    combatSystem = new CombatSystem(world, combatStore);
  });

  test("CombatStore object pooling performance", () => {
    const iterations = 1000;
    const startTime = performance.now();

    // Add and remove entities rapidly to test pooling
    for (let i = 0; i < iterations; i++) {
      combatStore.add(i, { initiative: Math.random() * 20 });
    }

    for (let i = 0; i < iterations; i++) {
      combatStore.remove(i);
    }

    // Add them again to test pool reuse
    for (let i = 0; i < iterations; i++) {
      combatStore.add(i + iterations, { initiative: Math.random() * 20 });
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`Pool performance: ${iterations * 2} operations in ${duration.toFixed(2)}ms`);

    // Should complete within reasonable time (adjust threshold as needed)
    expect(duration).toBeLessThan(100);

    // Verify pool utilization
    const stats = combatStore.getPerformanceStats();
    expect(stats.poolUtilization).toBeGreaterThan(0);
    expect(stats.totalEntities).toBe(iterations);
  });

  test("Initiative order caching performance", () => {
    const entityCount = 100;
    const iterations = 1000;

    // Add entities with random initiative
    for (let i = 0; i < entityCount; i++) {
      combatStore.add(i, { initiative: Math.random() * 20 });
    }

    const startTime = performance.now();

    // Call getInitiativeOrder multiple times to test caching
    for (let i = 0; i < iterations; i++) {
      const order = combatStore.getInitiativeOrder();
      expect(order).toHaveLength(entityCount);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(
      `Initiative caching: ${iterations} calls with ${entityCount} entities in ${duration.toFixed(2)}ms`,
    );

    // Cached calls should be very fast
    expect(duration).toBeLessThan(50);

    // Verify cache is working
    const stats = combatStore.getPerformanceStats();
    expect(stats.cacheValid).toBe(true);
  });

  test("Large scale combat simulation", () => {
    const entityCount = 500;
    const participants: number[] = [];

    // Create a large number of entities
    for (let i = 0; i < entityCount; i++) {
      participants.push(i);
    }

    const startTime = performance.now();

    // Start combat with many participants
    combatSystem.startCombat(participants);

    // Simulate several rounds of combat
    for (let round = 0; round < 10; round++) {
      for (let turn = 0; turn < entityCount; turn++) {
        const currentActor = combatSystem.getCurrentActor();
        if (currentActor !== null) {
          // Simulate a basic action
          const success = combatSystem.takeAction({
            actorId: currentActor,
            entityId: currentActor,
            type: "attack",
            targetId: (currentActor + 1) % entityCount,
          });

          if (success || Math.random() > 0.5) {
            combatSystem.nextTurn();
          }
        } else {
          break;
        }
      }
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(
      `Large combat simulation: ${entityCount} entities, 10 rounds in ${duration.toFixed(2)}ms`,
    );

    // Should handle large combat efficiently
    expect(duration).toBeLessThan(1000); // 1 second max
    expect(combatSystem.isInCombat()).toBe(true);
  });

  test("Memory usage stability test", () => {
    const iterations = 100;
    const entitiesPerIteration = 50;

    for (let i = 0; i < iterations; i++) {
      // Add entities
      const entities: number[] = [];
      for (let j = 0; j < entitiesPerIteration; j++) {
        const entityId = i * entitiesPerIteration + j;
        combatStore.add(entityId, {
          initiative: Math.random() * 20,
          actionPoints: Math.floor(Math.random() * 3) + 1,
        });
        entities.push(entityId);
      }

      // Perform operations
      combatStore.getInitiativeOrder();

      // Remove entities
      entities.forEach((id) => combatStore.remove(id));
    }

    const stats = combatStore.getPerformanceStats();

    // Pool should be efficiently reused
    expect(stats.poolUtilization).toBeLessThan(1.0); // Not exhausted
    expect(stats.recycledEntities).toBeGreaterThan(0); // Some recycling occurred

    console.log("Memory stability stats:", stats);
  });

  test("Concurrent operations performance", async () => {
    const entityCount = 200;
    const operationsPerBatch = 10;

    // Add initial entities
    for (let i = 0; i < entityCount; i++) {
      combatStore.add(i, { initiative: Math.random() * 20 });
    }

    const startTime = performance.now();

    // Simulate concurrent operations
    const promises: Promise<void>[] = [];
    for (let batch = 0; batch < 50; batch++) {
      promises.push(
        new Promise<void>((resolve) => {
          setTimeout(() => {
            for (let op = 0; op < operationsPerBatch; op++) {
              const entityId = Math.floor(Math.random() * entityCount);
              const combat = combatStore.get(entityId);
              if (combat) {
                combatStore.setInitiative(entityId, Math.random() * 20);
                combatStore.getInitiativeOrder();
              }
            }
            resolve();
          }, Math.random() * 10);
        }),
      );
    }

    await Promise.all(promises);

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`Concurrent operations: 50 batches in ${duration.toFixed(2)}ms`);

    // Should handle concurrent operations reasonably well
    expect(duration).toBeLessThan(500);
  });

  test("Performance regression detection", () => {
    const baselineMs = 50; // Acceptable baseline for 1000 operations
    const _operations = 10000;

    const startTime = performance.now();

    for (let i = 0; i < _operations; i++) {
      combatStore.add(i, {
        initiative: Math.random() * 20,
        actionPoints: Math.floor(Math.random() * 3) + 1,
        concentrating: Math.random() > 0.8,
      });

      if (i % 10 === 0) {
        combatStore.getInitiativeOrder();
      }

      if (i % 5 === 0) {
        combatStore.setInitiative(i, Math.random() * 20);
      }
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`Regression test: ${_operations} mixed operations in ${duration.toFixed(2)}ms`);

    // Alert if performance degrades significantly
    if (duration > baselineMs * 2) {
      console.warn(`Performance regression detected: ${duration}ms > ${baselineMs * 2}ms baseline`);
    }

    expect(duration).toBeLessThan(baselineMs * 3); // Hard limit
  });
});

// Helper function for detailed performance profiling
export function profileCombatOperations(combatStore: CombatStore, _operations: number = 1000) {
  const results = {
    addEntity: 0,
    removeEntity: 0,
    getInitiative: 0,
    setInitiative: 0,
    getOrder: 0,
  };

  // Profile add operations
  let start = performance.now();
  for (let i = 0; i < _operations; i++) {
    combatStore.add(i, { initiative: Math.random() * 20 });
  }
  results.addEntity = performance.now() - start;

  // Profile initiative order operations
  start = performance.now();
  for (let i = 0; i < 100; i++) {
    combatStore.getInitiativeOrder();
  }
  results.getOrder = performance.now() - start;

  // Profile set initiative operations
  start = performance.now();
  for (let i = 0; i < _operations / 2; i++) {
    combatStore.setInitiative(i, Math.random() * 20);
  }
  results.setInitiative = performance.now() - start;

  // Profile remove operations
  start = performance.now();
  for (let i = 0; i < _operations; i++) {
    combatStore.remove(i);
  }
  results.removeEntity = performance.now() - start;

  return results;
}
