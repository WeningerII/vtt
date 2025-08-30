import { describe, it, expect, beforeEach } from "vitest";
import { SparseSet, MultiSparseSet } from "../core/SparseSet";

interface TestComponent {
  value: number;
  name: string;
}

describe("SparseSet", () => {
  let sparseSet: SparseSet<TestComponent>;

  beforeEach(() => {
    sparseSet = new SparseSet<TestComponent>();
  });

  it("should add and retrieve components", () => {
    const component: TestComponent = { value: 42, name: "test" };
    sparseSet.set(5, component);

    expect(sparseSet.get(5)).toEqual(component);
    expect(sparseSet.has(5)).toBe(true);
    expect(sparseSet.length()).toBe(1);
  });

  it("should handle non-existent entities", () => {
    expect(sparseSet.get(999)).toBeUndefined();
    expect(sparseSet.has(999)).toBe(false);
  });

  it("should update existing components", () => {
    const initial: TestComponent = { value: 1, name: "initial" };
    const updated: TestComponent = { value: 2, name: "updated" };

    sparseSet.set(3, initial);
    sparseSet.set(3, updated);

    expect(sparseSet.get(3)).toEqual(updated);
    expect(sparseSet.length()).toBe(1);
  });

  it("should delete components correctly", () => {
    sparseSet.set(1, { value: 1, name: "one" });
    sparseSet.set(2, { value: 2, name: "two" });
    sparseSet.set(3, { value: 3, name: "three" });

    expect(sparseSet.delete(2)).toBe(true);
    expect(sparseSet.has(2)).toBe(false);
    expect(sparseSet.get(2)).toBeUndefined();
    expect(sparseSet.length()).toBe(2);

    // Ensure other components are still accessible
    expect(sparseSet.get(1)).toEqual({ value: 1, name: "one" });
    expect(sparseSet.get(3)).toEqual({ value: 3, name: "three" });

    expect(sparseSet.delete(999)).toBe(false);
  });

  it("should handle sparse entity IDs efficiently", () => {
    sparseSet.set(1000, { value: 1000, name: "sparse" });
    sparseSet.set(5, { value: 5, name: "dense" });

    expect(sparseSet.get(1000)).toEqual({ value: 1000, name: "sparse" });
    expect(sparseSet.get(5)).toEqual({ value: 5, name: "dense" });
    expect(sparseSet.length()).toBe(2);

    const stats = sparseSet.getMemoryStats();
    expect(stats.memoryEfficiency).toBeLessThan(1);
    expect(stats.utilization).toBeLessThan(1);
  });

  it("should iterate correctly", () => {
    sparseSet.set(10, { value: 10, name: "ten" });
    sparseSet.set(20, { value: 20, name: "twenty" });

    const entities = sparseSet.entities();
    const components = sparseSet.values();

    expect(entities).toHaveLength(2);
    expect(components).toHaveLength(2);

    const pairs = Array.from(sparseSet.entries());
    expect(pairs).toHaveLength(2);

    for (const [entityId, component] of pairs) {
      expect(sparseSet.get(entityId)).toEqual(component);
    }
  });

  it("should clear all data", () => {
    sparseSet.set(1, { value: 1, name: "one" });
    sparseSet.set(2, { value: 2, name: "two" });

    sparseSet.clear();

    expect(sparseSet.length()).toBe(0);
    expect(sparseSet.has(1)).toBe(false);
    expect(sparseSet.has(2)).toBe(false);
  });

  it("should compact efficiently", () => {
    // Create a sparse set with a large entity ID
    sparseSet.set(10000, { value: 1, name: "sparse" });

    const statsBefore = sparseSet.getMemoryStats();
    sparseSet.compact();
    const statsAfter = sparseSet.getMemoryStats();

    expect(statsAfter.sparseSize).toBeLessThanOrEqual(statsBefore.sparseSize);
  });

  it("should handle performance stress test", () => {
    const entityCount = 10000;
    const startTime = performance.now();

    // Add many components
    for (let i = 0; i < entityCount; i++) {
      sparseSet.set(i, { value: i, name: `entity-${i}` });
    }

    // Random access
    for (let i = 0; i < 1000; i++) {
      const entityId = Math.floor(Math.random() * entityCount);
      const component = sparseSet.get(entityId);
      expect(component?.value).toBe(entityId);
    }

    // Delete some entities
    for (let i = 0; i < entityCount / 4; i++) {
      sparseSet.delete(i * 4);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    expect(sparseSet.length()).toBe(entityCount - entityCount / 4);
  });
});

describe("MultiSparseSet", () => {
  let multiSet: MultiSparseSet;

  beforeEach(() => {
    multiSet = new MultiSparseSet();
  });

  it("should manage multiple component types", () => {
    multiSet.setComponent(1, "Health", { current: 100, max: 100 });
    multiSet.setComponent(1, "Position", { x: 10, y: 20 });
    multiSet.setComponent(2, "Health", { current: 80, max: 100 });

    expect(multiSet.hasComponent(1, "Health")).toBe(true);
    expect(multiSet.hasComponent(1, "Position")).toBe(true);
    expect(multiSet.hasComponent(2, "Health")).toBe(true);
    expect(multiSet.hasComponent(2, "Position")).toBe(false);

    expect(multiSet.getComponent(1, "Health")).toEqual({ current: 100, max: 100 });
    expect(multiSet.getComponent(1, "Position")).toEqual({ x: 10, y: 20 });
  });

  it("should query entities with specific components", () => {
    multiSet.setComponent(1, "Health", { current: 100, max: 100 });
    multiSet.setComponent(1, "Combat", { initiative: 15 });
    multiSet.setComponent(2, "Health", { current: 80, max: 100 });
    multiSet.setComponent(3, "Combat", { initiative: 12 });

    const healthEntities = multiSet.getEntitiesWithComponent("Health");
    const combatEntities = multiSet.getEntitiesWithComponent("Combat");
    const bothComponents = multiSet.getEntitiesWithComponents(["Health", "Combat"]);

    expect(healthEntities).toEqual(expect.arrayContaining([1, 2]));
    expect(combatEntities).toEqual(expect.arrayContaining([1, 3]));
    expect(bothComponents).toEqual([1]);
  });

  it("should track entity versions for change detection", () => {
    const initialVersion = multiSet.getEntityVersion(1);

    multiSet.setComponent(1, "Health", { current: 100, max: 100 });
    const afterAddVersion = multiSet.getEntityVersion(1);

    multiSet.setComponent(1, "Health", { current: 90, max: 100 });
    const afterUpdateVersion = multiSet.getEntityVersion(1);

    multiSet.removeComponent(1, "Health");
    const afterRemoveVersion = multiSet.getEntityVersion(1);

    expect(afterAddVersion).toBeGreaterThan(initialVersion);
    expect(afterUpdateVersion).toBeGreaterThan(afterAddVersion);
    expect(afterRemoveVersion).toBeGreaterThan(afterUpdateVersion);
  });

  it("should remove all components for an entity", () => {
    multiSet.setComponent(1, "Health", { current: 100, max: 100 });
    multiSet.setComponent(1, "Position", { x: 10, y: 20 });
    multiSet.setComponent(1, "Combat", { initiative: 15 });

    multiSet.removeEntity(1);

    expect(multiSet.hasComponent(1, "Health")).toBe(false);
    expect(multiSet.hasComponent(1, "Position")).toBe(false);
    expect(multiSet.hasComponent(1, "Combat")).toBe(false);
  });

  it("should provide memory statistics", () => {
    multiSet.setComponent(1, "Health", { current: 100, max: 100 });
    multiSet.setComponent(2, "Health", { current: 80, max: 100 });
    multiSet.setComponent(1, "Position", { x: 10, y: 20 });

    const stats = multiSet.getMemoryStats();

    expect(stats.componentTypes).toBe(2);
    expect(stats.averageUtilization).toBeGreaterThan(0);
    expect(stats.componentStats).toHaveProperty("Health");
    expect(stats.componentStats).toHaveProperty("Position");
  });

  it("should handle concurrent modifications during iteration", () => {
    // Set up initial state
    for (let i = 0; i < 100; i++) {
      multiSet.setComponent(i, "Health", { current: i, max: 100 });
    }

    const entities = multiSet.getEntitiesWithComponent("Health");
    expect(entities).toHaveLength(100);

    // Modify while we have a reference to entities
    multiSet.removeComponent(50, "Health");
    multiSet.setComponent(200, "Health", { current: 200, max: 100 });

    // Original query result should be unchanged
    expect(entities).toHaveLength(100);
    expect(entities).toContain(50);
    expect(entities).not.toContain(200);

    // New query should reflect changes
    const newEntities = multiSet.getEntitiesWithComponent("Health");
    expect(newEntities).toHaveLength(100); // 99 original + 1 new
    expect(newEntities).not.toContain(50);
    expect(newEntities).toContain(200);
  });
});
