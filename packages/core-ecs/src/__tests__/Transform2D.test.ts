/**
 * Test suite for Transform2DStore interface enhancements
 */

import { Transform2DStore, Transform2DData } from '../components/Transform2D';

describe('Transform2DStore Interface', () => {
  let store: Transform2DStore;

  beforeEach(() => {
    store = new Transform2DStore(100);
  });

  describe('get() Method', () => {
    it('should return null for entities without transform component', () => {
      const result = store.get(1);
      expect(result).toBeNull();
    });

    it('should return complete transform data for entities with component', () => {
      const entityId = 1;
      const transformData = { x: 10, y: 20, rot: 45, sx: 2, sy: 1.5, zIndex: 5 };
      
      store.add(entityId, transformData);
      const result = store.get(entityId);
      
      expect(result).toEqual({
        x: 10,
        y: 20,
        rot: 45,
        sx: 2,
        sy: 1.5,
        zIndex: 5
      });
    });

    it('should return default values for unspecified properties', () => {
      const entityId = 1;
      store.add(entityId, { x: 10, y: 20 });
      
      const result = store.get(entityId);
      expect(result).toEqual({
        x: 10,
        y: 20,
        rot: 0,
        sx: 1,
        sy: 1,
        zIndex: 0
      });
    });

    it('should return updated values after modification', () => {
      const entityId = 1;
      store.add(entityId, { x: 10, y: 20 });
      
      // Modify values directly
      store.x[entityId] = 30;
      store.y[entityId] = 40;
      
      const result = store.get(entityId);
      expect(result?.x).toBe(30);
      expect(result?.y).toBe(40);
    });
  });

  describe('getPosition() Method', () => {
    it('should return null for entities without transform component', () => {
      const result = store.getPosition(1);
      expect(result).toBeNull();
    });

    it('should return position data only', () => {
      const entityId = 1;
      store.add(entityId, { x: 100, y: 200, rot: 45, sx: 2 });
      
      const result = store.getPosition(entityId);
      expect(result).toEqual({ x: 100, y: 200 });
    });
  });

  describe('getRotation() Method', () => {
    it('should return null for entities without transform component', () => {
      const result = store.getRotation(1);
      expect(result).toBeNull();
    });

    it('should return rotation value', () => {
      const entityId = 1;
      store.add(entityId, { rot: Math.PI / 4 });
      
      const result = store.getRotation(entityId);
      expect(result).toBe(Math.PI / 4);
    });

    it('should return 0 for default rotation', () => {
      const entityId = 1;
      store.add(entityId, { x: 10, y: 20 });
      
      const result = store.getRotation(entityId);
      expect(result).toBe(0);
    });
  });

  describe('getScale() Method', () => {
    it('should return null for entities without transform component', () => {
      const result = store.getScale(1);
      expect(result).toBeNull();
    });

    it('should return scale data', () => {
      const entityId = 1;
      store.add(entityId, { sx: 2.5, sy: 1.8 });
      
      const result = store.getScale(entityId);
      expect(result).toEqual({ sx: 2.5, sy: 1.8 });
    });

    it('should return default scale values', () => {
      const entityId = 1;
      store.add(entityId, { x: 10, y: 20 });
      
      const result = store.getScale(entityId);
      expect(result).toEqual({ sx: 1, sy: 1 });
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing add() functionality', () => {
      const entityId = 1;
      store.add(entityId, { x: 10, y: 20, rot: 45 });
      
      expect(store.has(entityId)).toBe(true);
      expect(store.x[entityId]).toBe(10);
      expect(store.y[entityId]).toBe(20);
      expect(store.rot[entityId]).toBe(45);
    });

    it('should maintain existing remove() functionality', () => {
      const entityId = 1;
      store.add(entityId, { x: 10, y: 20 });
      expect(store.has(entityId)).toBe(true);
      
      store.remove(entityId);
      expect(store.has(entityId)).toBe(false);
      expect(store.get(entityId)).toBeNull();
    });

    it('should maintain existing has() functionality', () => {
      const entityId = 1;
      expect(store.has(entityId)).toBe(false);
      
      store.add(entityId);
      expect(store.has(entityId)).toBe(true);
    });
  });

  describe('Type Safety', () => {
    it('should enforce Transform2DData interface', () => {
      const entityId = 1;
      store.add(entityId, { x: 10, y: 20 });
      
      const data: Transform2DData | null = store.get(entityId);
      if (data) {
        // TypeScript should enforce these properties exist
        expect(typeof data.x).toBe('number');
        expect(typeof data.y).toBe('number');
        expect(typeof data.rot).toBe('number');
        expect(typeof data.sx).toBe('number');
        expect(typeof data.sy).toBe('number');
        expect(typeof data.zIndex).toBe('number');
      }
    });
  });

  describe('Performance', () => {
    it('should handle bulk operations efficiently', () => {
      const startTime = performance.now();
      
      // Add 1000 entities
      for (let i = 0; i < 1000; i++) {
        store.add(i, { x: i * 10, y: i * 20 });
      }
      
      // Get all transform data
      for (let i = 0; i < 1000; i++) {
        const data = store.get(i);
        expect(data).not.toBeNull();
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(100);
    });
  });
});
