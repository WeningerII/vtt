import { describe, it, expect } from 'vitest';
import { World, MovementSystem } from '../src';

describe('MovementSystem', () => {
  it('moves an entity by velocity * dt and clamps to maxSpeed', () => {
    const w = new World(16);
    const e = w.create();
    w.transforms.add(e, { x: 0, y: 0 });
    w.movement.add(e, { vx: 10, vy: 0, maxSpeed: 5 }); // will be clamped to 5
    MovementSystem(w, 1.0); // 1 second
    expect(w.transforms.x[e]).toBeCloseTo(5); // not 10, clamped
    expect(w.transforms.y[e]).toBeCloseTo(0);
  });
});
