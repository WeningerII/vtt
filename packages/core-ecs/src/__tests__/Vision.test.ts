/**
 * Test suite for VisionStore interface enhancements
 */

import { VisionStore, VisionData } from '../components/Vision';

describe('VisionStore Interface', () => {
  let store: VisionStore;

  beforeEach(() => {
    store = new VisionStore(100);
  });

  describe('Enhanced VisionData Interface', () => {
    it('should initialize with default visibility state properties', () => {
      const entityId = 1;
      store.add(entityId);
      
      const vision = store.get(entityId);
      expect(vision).toBeDefined();
      expect(vision?.isInvisible).toBe(false);
      expect(vision?.isEthereal).toBe(false);
      expect(vision?.isBlinded).toBe(false);
      expect(vision?.hasDevilsSight).toBe(false);
      expect(vision?.hasMagicalDarkness).toBe(false);
      expect(vision?.immuneToBlindness).toBe(false);
      expect(vision?.immuneToInvisibilityDetection).toBe(false);
    });

    it('should accept custom visibility state properties', () => {
      const entityId = 1;
      store.add(entityId, {
        isInvisible: true,
        isEthereal: true,
        hasDevilsSight: true,
        immuneToBlindness: true
      });
      
      const vision = store.get(entityId);
      expect(vision?.isInvisible).toBe(true);
      expect(vision?.isEthereal).toBe(true);
      expect(vision?.hasDevilsSight).toBe(true);
      expect(vision?.immuneToBlindness).toBe(true);
    });
  });

  describe('Enhanced canSeeEntity() Method', () => {
    it('should handle basic visibility without special conditions', () => {
      const observerId = 1;
      const targetId = 2;
      
      store.add(observerId, { sightRange: 6 });
      store.add(targetId);
      
      // Normal sight in bright light
      const canSee = store.canSeeEntity(observerId, targetId, 5, 1.0);
      expect(canSee).toBe(true);
      
      // Too far away
      const cannotSee = store.canSeeEntity(observerId, targetId, 10, 1.0);
      expect(cannotSee).toBe(false);
    });

    it('should handle invisible targets correctly', () => {
      const observerId = 1;
      const targetId = 2;
      
      store.add(observerId, { 
        sightRange: 6,
        truesightRange: 12,
        blindsightRange: 3
      });
      store.add(targetId, { isInvisible: true });
      
      // Cannot see invisible with normal sight
      expect(store.canSeeEntity(observerId, targetId, 5, 1.0)).toBe(false);
      
      // Can see invisible with truesight
      expect(store.canSeeEntity(observerId, targetId, 10, 1.0)).toBe(true);
      
      // Can see invisible with blindsight
      expect(store.canSeeEntity(observerId, targetId, 2, 1.0)).toBe(true);
      
      // Cannot see invisible beyond truesight range
      expect(store.canSeeEntity(observerId, targetId, 15, 1.0)).toBe(false);
    });

    it('should handle ethereal targets correctly', () => {
      const observerId = 1;
      const targetId = 2;
      
      store.add(observerId, { 
        sightRange: 6,
        truesightRange: 12,
        blindsightRange: 10
      });
      store.add(targetId, { isEthereal: true });
      
      // Cannot see ethereal with normal sight
      expect(store.canSeeEntity(observerId, targetId, 5, 1.0)).toBe(false);
      
      // Cannot see ethereal with blindsight
      expect(store.canSeeEntity(observerId, targetId, 8, 1.0)).toBe(false);
      
      // Can see ethereal with truesight
      expect(store.canSeeEntity(observerId, targetId, 10, 1.0)).toBe(true);
      
      // Cannot see ethereal beyond truesight range
      expect(store.canSeeEntity(observerId, targetId, 15, 1.0)).toBe(false);
    });

    it('should handle blinded observers correctly', () => {
      const observerId = 1;
      const targetId = 2;
      
      store.add(observerId, { 
        sightRange: 6,
        isBlinded: true
      });
      store.add(targetId);
      
      // Blinded observer cannot see
      expect(store.canSeeEntity(observerId, targetId, 3, 1.0)).toBe(false);
      
      // Unless immune to blindness
      store.add(observerId, { 
        sightRange: 6,
        isBlinded: true,
        immuneToBlindness: true
      });
      expect(store.canSeeEntity(observerId, targetId, 3, 1.0)).toBe(true);
    });

    it('should handle light sensitivity correctly', () => {
      const observerId = 1;
      const targetId = 2;
      
      store.add(observerId, { 
        sightRange: 6,
        lightSensitivity: 0.5 // Sensitive to bright light
      });
      store.add(targetId);
      
      // Cannot see in bright light due to sensitivity
      expect(store.canSeeEntity(observerId, targetId, 3, 0.8)).toBe(false);
      
      // Can see in dim light
      expect(store.canSeeEntity(observerId, targetId, 3, 0.3)).toBe(true);
      
      // Unless immune to blindness
      store.add(observerId, { 
        sightRange: 6,
        lightSensitivity: 0.5,
        immuneToBlindness: true
      });
      expect(store.canSeeEntity(observerId, targetId, 3, 0.8)).toBe(true);
    });

    it('should handle darkvision correctly', () => {
      const observerId = 1;
      const targetId = 2;
      
      store.add(observerId, { 
        sightRange: 6,
        darkvisionRange: 12
      });
      store.add(targetId);
      
      // Normal sight in bright light
      expect(store.canSeeEntity(observerId, targetId, 5, 1.0)).toBe(true);
      
      // Darkvision in darkness
      expect(store.canSeeEntity(observerId, targetId, 10, 0.0)).toBe(true);
      
      // Beyond darkvision range in darkness
      expect(store.canSeeEntity(observerId, targetId, 15, 0.0)).toBe(false);
    });

    it('should handle devil\'s sight with magical darkness', () => {
      const observerId = 1;
      const targetId = 2;
      
      store.add(observerId, { 
        sightRange: 6,
        hasDevilsSight: true,
        hasMagicalDarkness: true
      });
      store.add(targetId);
      
      // Devil's sight penetrates magical darkness
      expect(store.canSeeEntity(observerId, targetId, 5, 0.0)).toBe(true);
      
      // Still limited by sight range
      expect(store.canSeeEntity(observerId, targetId, 10, 0.0)).toBe(false);
    });

    it('should handle invisibility detection immunity', () => {
      const observerId = 1;
      const targetId = 2;
      
      store.add(observerId, { 
        sightRange: 6,
        canSeeInvisible: true
      });
      store.add(targetId, { 
        isInvisible: true,
        immuneToInvisibilityDetection: true
      });
      
      // Cannot see invisible target with immunity
      expect(store.canSeeEntity(observerId, targetId, 5, 1.0)).toBe(false);
    });

    it('should prioritize truesight over other vision types', () => {
      const observerId = 1;
      const targetId = 2;
      
      store.add(observerId, { 
        sightRange: 6,
        darkvisionRange: 12,
        blindsightRange: 8,
        truesightRange: 15
      });
      store.add(targetId, { 
        isInvisible: true,
        isEthereal: true
      });
      
      // Truesight sees invisible and ethereal
      expect(store.canSeeEntity(observerId, targetId, 12, 0.0)).toBe(true);
      
      // Beyond truesight range
      expect(store.canSeeEntity(observerId, targetId, 18, 0.0)).toBe(false);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing vision range methods', () => {
      const entityId = 1;
      store.add(entityId, { sightRange: 6 });
      
      store.setSightRange(entityId, 10);
      expect(store.get(entityId)?.sightRange).toBe(10);
      
      store.setDarkvision(entityId, 12);
      expect(store.get(entityId)?.darkvisionRange).toBe(12);
      
      store.setBlindsight(entityId, 8);
      expect(store.get(entityId)?.blindsightRange).toBe(8);
      
      store.setTruesight(entityId, 15);
      expect(store.get(entityId)?.truesightRange).toBe(15);
    });

    it('should maintain fog of war functionality', () => {
      const entityId = 1;
      store.add(entityId, { fogOfWarEnabled: true });
      
      store.revealArea(entityId, '10,20');
      expect(store.isAreaRevealed(entityId, '10,20')).toBe(true);
      
      store.setVisibleAreas(entityId, new Set(['5,5', '10,10']));
      expect(store.isAreaVisible(entityId, '5,5')).toBe(true);
      expect(store.isAreaVisible(entityId, '10,10')).toBe(true);
      
      store.clearFogOfWar(entityId);
      expect(store.isAreaRevealed(entityId, '10,20')).toBe(false);
      expect(store.isAreaVisible(entityId, '5,5')).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should handle complex visibility calculations efficiently', () => {
      const startTime = performance.now();
      
      // Create multiple entities with various vision types
      for (let i = 0; i < 100; i++) {
        store.add(i, {
          sightRange: 6,
          darkvisionRange: 12,
          blindsightRange: 4,
          truesightRange: 8,
          isInvisible: i % 3 === 0,
          isEthereal: i % 5 === 0,
          hasDevilsSight: i % 7 === 0
        });
      }
      
      // Perform visibility checks
      let visibilityChecks = 0;
      for (let observer = 0; observer < 10; observer++) {
        for (let target = 0; target < 100; target++) {
          if (observer !== target) {
            store.canSeeEntity(observer, target, 8, 0.5);
            visibilityChecks++;
          }
        }
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(visibilityChecks).toBe(990); // 10 * 99
      expect(duration).toBeLessThan(500); // Should complete within reasonable time
    });
  });
});
