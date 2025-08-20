export type EntityId = number;

export class Transform2DStore {
  readonly capacity: number;
  readonly present: Uint8Array;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly rot: Float32Array;
  readonly sx: Float32Array;
  readonly sy: Float32Array;
  readonly zIndex: Int16Array;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.present = new Uint8Array(capacity);
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.rot = new Float32Array(capacity);
    this.sx = new Float32Array(capacity).fill(1);
    this.sy = new Float32Array(capacity).fill(1);
    this.zIndex = new Int16Array(capacity);
  }

  add(id: EntityId, t?: Partial<{x:number;y:number;rot:number;sx:number;sy:number;zIndex:number}>) {
    this.present[id] = 1;
    if (t?.x !== undefined) this.x[id] = t.x;
    if (t?.y !== undefined) this.y[id] = t.y;
    if (t?.rot !== undefined) this.rot[id] = t.rot;
    if (t?.sx !== undefined) this.sx[id] = t.sx;
    if (t?.sy !== undefined) this.sy[id] = t.sy;
    if (t?.zIndex !== undefined) this.zIndex[id] = t.zIndex | 0;
  }

  remove(id: EntityId) { this.present[id] = 0; }
  has(id: EntityId) { return this.present[id] === 1; }
}
