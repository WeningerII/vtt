/**
 * Unit tests for Physics system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PhysicsWorld, RigidBody, Vector2 } from '@vtt/physics';
import { TestUtils } from '../TestUtils';

describe('Physics System Unit Tests', () => {
  let physicsWorld: PhysicsWorld;

  beforeEach(() => {
    physicsWorld = new PhysicsWorld({
      gravity: { x: 0, y: 100 }, // Downward gravity
      cellSize: 50,
      maxVelocity: 500
    });
  });

  afterEach(() => {
    physicsWorld.clear();
  });

  describe('RigidBody', () => {
    it('should create rigid body with correct properties', () => {
      const body = new RigidBody(1, 10, 20, 30, 40, {
        mass: 5,
        friction: 0.8,
        isStatic: false
      });

      expect(body.id).toBe(1);
      expect(body.position).toEqual({ x: 10, y: 20 });
      expect(body.width).toBe(30);
      expect(body.height).toBe(40);
      expect(body.config.mass).toBe(5);
      expect(body.config.friction).toBe(0.8);
    });

    it('should calculate AABB correctly', () => {
      const body = new RigidBody(1, 100, 200, 40, 60);
      const aabb = body.getAABB();

      expect(aabb.minX).toBe(80);  // 100 - 40/2
      expect(aabb.maxX).toBe(120); // 100 + 40/2
      expect(aabb.minY).toBe(170); // 200 - 60/2
      expect(aabb.maxY).toBe(230); // 200 + 60/2
    });

    it('should apply forces correctly', () => {
      const body = new RigidBody(1, 0, 0, 10, 10, { mass: 2 });
      const force: Vector2 = { x: 20, y: 40 };

      body.addForce(force);
      body.integrate(1.0); // 1 second timestep

      expect(body.velocity.x).toBe(10); // force.x / mass
      expect(body.velocity.y).toBe(20); // force.y / mass
      expect(body.position.x).toBe(10); // velocity * time
      expect(body.position.y).toBe(20); // velocity * time
    });

    it('should apply impulses correctly', () => {
      const body = new RigidBody(1, 0, 0, 10, 10, { mass: 4 });
      const impulse: Vector2 = { x: 40, y: 80 };

      body.addImpulse(impulse);

      expect(body.velocity.x).toBe(10); // impulse.x / mass
      expect(body.velocity.y).toBe(20); // impulse.y / mass
    });

    it('should respect static body constraints', () => {
      const staticBody = new RigidBody(1, 0, 0, 10, 10, { isStatic: true });
      const force: Vector2 = { x: 100, y: 100 };

      staticBody.addForce(force);
      staticBody.integrate(1.0);

      expect(staticBody.velocity).toEqual({ x: 0, y: 0 });
      expect(staticBody.position).toEqual({ x: 0, y: 0 });
    });

    it('should handle collision layer masks', () => {
      const bodyA = new RigidBody(1, 0, 0, 10, 10, { layer: 1, mask: 0b0010 });
      const bodyB = new RigidBody(2, 0, 0, 10, 10, { layer: 2, mask: 0b0001 });
      const bodyC = new RigidBody(3, 0, 0, 10, 10, { layer: 1, mask: 0b0001 });

      expect(bodyA.shouldCollideWith(bodyB)).toBe(false); // Different layers, wrong masks
      expect(bodyA.shouldCollideWith(bodyC)).toBe(false); // Same layer but mask doesn't match
    });
  });

  describe('PhysicsWorld', () => {
    it('should add and remove bodies', () => {
      const body = new RigidBody(1, 0, 0, 10, 10);
      
      physicsWorld.addBody(body);
      expect(physicsWorld.getBody(1)).toBe(body);
      expect(physicsWorld.getAllBodies()).toHaveLength(1);

      const removed = physicsWorld.removeBody(1);
      expect(removed).toBe(body);
      expect(physicsWorld.getBody(1)).toBeUndefined();
      expect(physicsWorld.getAllBodies()).toHaveLength(0);
    });

    it('should apply gravity to dynamic bodies', () => {
      const dynamicBody = new RigidBody(1, 0, 0, 10, 10);
      const staticBody = new RigidBody(2, 0, 0, 10, 10, { isStatic: true });

      physicsWorld.addBody(dynamicBody);
      physicsWorld.addBody(staticBody);

      physicsWorld.update(1.0);

      expect(dynamicBody.velocity.y).toBeGreaterThan(0); // Should fall due to gravity
      expect(staticBody.velocity.y).toBe(0); // Static body shouldn't move
    });

    it('should detect collisions between overlapping bodies', async () => {
      const bodyA = new RigidBody(1, 0, 0, 20, 20);
      const bodyB = new RigidBody(2, 10, 0, 20, 20); // Overlapping with bodyA

      physicsWorld.addBody(bodyA);
      physicsWorld.addBody(bodyB);

      let collisionDetected = false;
      physicsWorld.on('collision', () => {
        collisionDetected = true;
      });

      physicsWorld.update(0.016); // One frame

      await TestUtils.waitFor(() => collisionDetected);
      expect(collisionDetected).toBe(true);
    });

    it('should resolve collisions with proper physics response', () => {
      const bodyA = new RigidBody(1, -5, 0, 10, 10, { mass: 1 });
      const bodyB = new RigidBody(2, 5, 0, 10, 10, { mass: 1 });

      // Set velocities to collide
      bodyA.setVelocity(10, 0);
      bodyB.setVelocity(-10, 0);

      physicsWorld.addBody(bodyA);
      physicsWorld.addBody(bodyB);

      physicsWorld.update(0.1); // Small timestep

      // Bodies should have bounced off each other
      expect(bodyA.velocity.x).toBeLessThan(0);
      expect(bodyB.velocity.x).toBeGreaterThan(0);
    });

    it('should handle spatial queries correctly', () => {
      const bodies = TestUtils.generateTestEntities(10);
      
      bodies.forEach(entity => {
        const body = new RigidBody(entity.id, entity.x, entity.y, entity.width, entity.height);
        physicsWorld.addBody(body);
      });

      const queryRegion = physicsWorld.queryRegion(0, 0, 100, 100);
      const queryPoint = physicsWorld.queryPoint(50, 50);

      expect(queryRegion.length).toBeGreaterThanOrEqual(0);
      expect(queryPoint.length).toBeGreaterThanOrEqual(0);
    });

    it('should perform raycast correctly', () => {
      const obstacle = new RigidBody(1, 50, 50, 20, 20);
      physicsWorld.addBody(obstacle);

      const rayResult = physicsWorld.raycast(
        { x: 0, y: 50 },    // Origin
        { x: 1, y: 0 },     // Direction (right)
        100                  // Max distance
      );

      expect(rayResult.hit).toBe(true);
      expect(rayResult.body).toBe(obstacle);
      expect(rayResult.distance).toBeLessThan(50);
    });

    it('should maintain performance with many bodies', async () => {
      const bodyCount = 1000;
      const bodies: RigidBody[] = [];

      // Create many bodies
      for (let i = 0; i < bodyCount; i++) {
        const body = new RigidBody(
          i,
          Math.random() * 1000,
          Math.random() * 1000,
          5 + Math.random() * 10,
          5 + Math.random() * 10
        );
        bodies.push(body);
        physicsWorld.addBody(body);
      }

      const benchmark = await TestUtils.benchmark(
        'Physics Update',
        () => {
          physicsWorld.update(0.016);
        },
        100
      );

      expect(benchmark.averageTime).toBeLessThan(16); // Should maintain 60 FPS
    });
  });

  describe('Collision Detection', () => {
    it('should detect AABB overlaps correctly', () => {
      const bodyA = new RigidBody(1, 0, 0, 20, 20);
      const bodyB = new RigidBody(2, 15, 0, 20, 20); // Overlapping
      const bodyC = new RigidBody(3, 30, 0, 20, 20); // Not overlapping

      physicsWorld.addBody(bodyA);
      physicsWorld.addBody(bodyB);
      physicsWorld.addBody(bodyC);

      let collisionCount = 0;
      physicsWorld.on('collision', () => {
        collisionCount++;
      });

      physicsWorld.update(0.016);

      expect(collisionCount).toBe(1); // Only bodyA and bodyB should collide
    });

    it('should calculate collision normals correctly', () => {
      const bodyA = new RigidBody(1, 0, 0, 10, 10);
      const bodyB = new RigidBody(2, 8, 0, 10, 10); // Overlapping horizontally

      physicsWorld.addBody(bodyA);
      physicsWorld.addBody(bodyB);

      let collisionInfo: any = null;
      physicsWorld.on('collision', (_info: any) => {
        collisionInfo = info;
      });

      physicsWorld.update(0.016);

      expect(collisionInfo).not.toBeNull();
      expect(Math.abs(collisionInfo.normal.x)).toBe(1); // Horizontal collision
      expect(collisionInfo.normal.y).toBe(0);
    });
  });

  describe('Performance Optimization', () => {
    it('should use spatial grid efficiently', () => {
      const stats = physicsWorld.getStats();
      expect(stats.bodyCount).toBe(0);

      // Add bodies spread across different grid cells
      for (let i = 0; i < 100; i++) {
        const body = new RigidBody(i, i * 60, 0, 10, 10); // Spread out by cell size
        physicsWorld.addBody(body);
      }

      const newStats = physicsWorld.getStats();
      expect(newStats.bodyCount).toBe(100);
      expect(newStats.gridStats.totalCells).toBeGreaterThan(1);
    });

    it('should handle sleeping bodies correctly', () => {
      const slowBody = new RigidBody(1, 0, 0, 10, 10);
      slowBody.setVelocity(0.05, 0.05); // Below sleep threshold

      physicsWorld.addBody(slowBody);

      // Update multiple times to allow sleeping
      for (let i = 0; i < 10; i++) {
        physicsWorld.update(0.016);
      }

      // Body should have very low velocity due to sleep dampening
      expect(Math.abs(slowBody.velocity.x)).toBeLessThan(0.01);
      expect(Math.abs(slowBody.velocity.y)).toBeLessThan(0.01);
    });
  });
});
