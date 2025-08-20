import type { World } from '../World';

/** Advance positions by velocity; dt is in seconds. */
export function MovementSystem(world: World, dt: number) {
  const { transforms: T, movement: M } = world;

  for (const id of world.iterMoveable()) {
    // Safe reads with defaults (TS: noUncheckedIndexedAccess)
    let vx = M.vx[id] ?? 0;
    let vy = M.vy[id] ?? 0;
    const max = M.maxSpeed[id] ?? Infinity;

    const speed = Math.hypot(vx, vy);
    if (speed > max && speed > 0) {
      const s = max / speed;
      vx *= s; vy *= s;
      // keep store consistent after clamp
      M.vx[id] = vx;
      M.vy[id] = vy;
    }

    const x0 = T.x[id] ?? 0;
    const y0 = T.y[id] ?? 0;
    T.x[id] = x0 + vx * dt;
    T.y[id] = y0 + vy * dt;
  }
}
