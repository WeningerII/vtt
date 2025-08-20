import type { EntityId } from './Transform2D';

export class MovementStore {
  readonly capacity: number;
  readonly present: Uint8Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly maxSpeed: Float32Array;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.present = new Uint8Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.maxSpeed = new Float32Array(capacity).fill(Infinity);
  }

  add(id: EntityId, m?: Partial<{ vx: number; vy: number; maxSpeed: number }>) {
    this.present[id] = 1;
    if (m?.vx !== undefined) this.vx[id] = m.vx;
    if (m?.vy !== undefined) this.vy[id] = m.vy;
    if (m?.maxSpeed !== undefined) this.maxSpeed[id] = m.maxSpeed;
  }

  remove(id: EntityId) { this.present[id] = 0; }
  has(id: EntityId) { return this.present[id] === 1; }
}
