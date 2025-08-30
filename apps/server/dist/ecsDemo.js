import { World, MovementSystem } from '@vtt/core-ecs';
import { logger } from '@vtt/logging';
const w = new World(1024);
const N = 3;
for (let i = 0; i < N; i++) {
    const e = w.create();
    w.transforms.add(e, { x: i * 2, y: 0 });
    w.movement.add(e, { vx: 2 + i, vy: 0, maxSpeed: 4 });
}
let t = 0;
const dt = 1 / 10; // 10 Hz
for (let tick = 0; tick < 10; tick++) {
    MovementSystem(w, dt);
    t += dt;
}
const out = [];
for (let id = 0; id < N; id++) {
    // Defaults to satisfy noUncheckedIndexedAccess
    const x = w.transforms.x[id] ?? 0;
    const y = w.transforms.y[id] ?? 0;
    out.push({ id, x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) });
}
logger.info('Positions after', t.toFixed(2), 's:', out);
//# sourceMappingURL=ecsDemo.js.map