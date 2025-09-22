/**
 * Comprehensive test suite for ECS World interface compatibility
 */

import { World } from "../World";

describe("World Interface Compatibility", () => {
  let world: World;

  beforeEach(() => {
    world = new World(100);
  });

  describe("Entity Management", () => {
    it("should create and track entities correctly", () => {
      const entity1 = world.create();
      const entity2 = world.create();

      expect(world.isAlive(entity1)).toBe(true);
      expect(world.isAlive(entity2)).toBe(true);
      expect(entity1).not.toBe(entity2);
    });

    it("should destroy entities and mark them as not alive", () => {
      const entity = world.create();
      expect(world.isAlive(entity)).toBe(true);

      world.destroy(entity);
      expect(world.isAlive(entity)).toBe(false);
    });

    it("should reuse destroyed entity IDs", () => {
      const entity1 = world.create();
      world.destroy(entity1);

      const entity2 = world.create();
      expect(entity2).toBe(entity1); // Should reuse the ID
    });
  });

  describe("getEntities() Method", () => {
    it("should return empty array when no entities exist", () => {
      const entities = world.getEntities();
      expect(entities).toEqual([]);
    });

    it("should return all alive entity IDs", () => {
      const entity1 = world.create();
      const entity2 = world.create();
      const entity3 = world.create();

      const entities = world.getEntities();
      expect(entities).toContain(entity1);
      expect(entities).toContain(entity2);
      expect(entities).toContain(entity3);
      expect(entities.length).toBe(3);
    });

    it("should not include destroyed entities", () => {
      const entity1 = world.create();
      const entity2 = world.create();

      world.destroy(entity1);

      const entities = world.getEntities();
      expect(entities).not.toContain(entity1);
      expect(entities).toContain(entity2);
      expect(entities.length).toBe(1);
    });
  });

  describe("iterAllEntities() Method", () => {
    it("should iterate over all alive entities", () => {
      const entity1 = world.create();
      const entity2 = world.create();
      const entity3 = world.create();

      const iteratedEntities = Array.from(world.iterAllEntities());
      expect(iteratedEntities).toContain(entity1);
      expect(iteratedEntities).toContain(entity2);
      expect(iteratedEntities).toContain(entity3);
      expect(iteratedEntities.length).toBe(3);
    });

    it("should not iterate over destroyed entities", () => {
      const entity1 = world.create();
      const entity2 = world.create();

      world.destroy(entity1);

      const iteratedEntities = Array.from(world.iterAllEntities());
      expect(iteratedEntities).not.toContain(entity1);
      expect(iteratedEntities).toContain(entity2);
      expect(iteratedEntities.length).toBe(1);
    });
  });

  describe("getEntitiesWithComponents() Method", () => {
    it("should return entities with specified components", () => {
      const entity1 = world.create();
      const entity2 = world.create();
      const entity3 = world.create();

      // Add transform component to entity1 and entity2
      world.transforms.add(entity1, { x: 10, y: 20 });
      world.transforms.add(entity2, { x: 30, y: 40 });

      // Add movement component to entity1 only
      if (world.movement) {
        world.movement.add(entity1, { vx: 1, vy: 1 });
      }

      const entitiesWithTransform = world.getEntitiesWithComponents("transforms");
      expect(entitiesWithTransform).toContain(entity1);
      expect(entitiesWithTransform).toContain(entity2);
      expect(entitiesWithTransform).not.toContain(entity3);
      expect(entitiesWithTransform.length).toBe(2);

      if (world.movement) {
        const entitiesWithBoth = world.getEntitiesWithComponents("transforms", "movement");
        expect(entitiesWithBoth).toContain(entity1);
        expect(entitiesWithBoth).not.toContain(entity2);
        expect(entitiesWithBoth).not.toContain(entity3);
        expect(entitiesWithBoth.length).toBe(1);
      }
    });

    it("should return empty array when no entities have specified components", () => {
      world.create();
      const entities = world.getEntitiesWithComponents("transforms");
      expect(entities).toEqual([]);
    });
  });

  describe("Backward Compatibility", () => {
    it("should maintain iterMoveable() functionality", () => {
      const entity1 = world.create();
      const entity2 = world.create();

      world.transforms.add(entity1, { x: 10, y: 20 });
      if (world.movement) {
        world.movement.add(entity1, { vx: 1, vy: 1 });
      }

      world.transforms.add(entity2, { x: 30, y: 40 });
      // entity2 has no movement component

      if (world.iterMoveable) {
        const moveableEntities = Array.from(world.iterMoveable());
        expect(moveableEntities).toContain(entity1);
        expect(moveableEntities).not.toContain(entity2);
        expect(moveableEntities.length).toBe(1);
      }
    });
  });

  describe("Performance", () => {
    it("should handle large numbers of entities efficiently", () => {
      const startTime = performance.now();

      // Create 1000 entities
      const entities: number[] = [];
      for (let i = 0; i < 1000; i++) {
        entities.push(world.create());
      }

      // Get all entities
      const allEntities = world.getEntities();
      expect(allEntities.length).toBe(1000);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
    });
  });
});
