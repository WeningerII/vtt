import type { EntityId } from './Transform2D';

export class AppearanceStore {
  readonly capacity: number;
  readonly present: Uint8Array;
  readonly sprite: Uint32Array;
  readonly tintR: Uint8Array;
  readonly tintG: Uint8Array;
  readonly tintB: Uint8Array;
  readonly alpha: Float32Array;
  readonly frame: Uint16Array;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.present = new Uint8Array(capacity);
    this.sprite = new Uint32Array(capacity);
    this.tintR = new Uint8Array(capacity);
    this.tintG = new Uint8Array(capacity);
    this.tintB = new Uint8Array(capacity);
    this.alpha = new Float32Array(capacity).fill(1);
    this.frame = new Uint16Array(capacity);
  }

  add(id: EntityId, a?: Partial<{ sprite: number; tintR: number; tintG: number; tintB: number; alpha: number; frame: number }>) {
    this.present[id] = 1;
    if (a?.sprite !== undefined) {this.sprite[id] = a.sprite;}
    if (a?.tintR !== undefined) {this.tintR[id] = a.tintR;}
    if (a?.tintG !== undefined) {this.tintG[id] = a.tintG;}
    if (a?.tintB !== undefined) {this.tintB[id] = a.tintB;}
    if (a?.alpha !== undefined) {this.alpha[id] = a.alpha;}
    if (a?.frame !== undefined) {this.frame[id] = a.frame;}
  }

  remove(id: EntityId) { this.present[id] = 0; }
  has(id: EntityId) { return this.present[id] === 1; }
}
