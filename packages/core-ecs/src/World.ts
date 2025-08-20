import { Transform2DStore, type EntityId } from './components/Transform2D';
import { MovementStore } from './components/Movement';
import { AppearanceStore } from './components/Appearance';

export class World {
  readonly capacity: number;
  readonly alive: Uint8Array;
  private free: number[] = [];
  private nextId = 0;

  readonly transforms: Transform2DStore;
  readonly movement: MovementStore;
  readonly appearance: AppearanceStore;

  constructor(capacity = 10_000) {
    this.capacity = capacity;
    this.alive = new Uint8Array(capacity);
    this.transforms = new Transform2DStore(capacity);
    this.movement = new MovementStore(capacity);
    this.appearance = new AppearanceStore(capacity);
  }

  create(): EntityId {
    const id = this.free.length ? (this.free.pop() as number) : this.nextId++;
    if (id >= this.capacity) throw new Error('World capacity exceeded');
    this.alive[id] = 1;
    return id;
  }

  destroy(id: EntityId) {
    if (!this.alive[id]) return;
    this.alive[id] = 0;
    this.transforms.remove(id);
    this.movement.remove(id);
    this.appearance.remove(id);
    this.free.push(id);
  }

  isAlive(id: EntityId) { return this.alive[id] === 1; }

  *iterMoveable(): Iterable<number> {
    for (let id = 0; id < this.nextId; id++) {
      if (this.alive[id] && this.transforms.has(id) && this.movement.has(id)) {
        yield id;
      }
    }
  }
}
export type { EntityId } from './components/Transform2D';
