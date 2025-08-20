import { Transform2DStore } from './components/Transform2D';
import { MovementStore } from './components/Movement';
import { AppearanceStore } from './components/Appearance';
export class World {
    capacity;
    alive;
    free = [];
    nextId = 0;
    transforms;
    movement;
    appearance;
    constructor(capacity = 10_000) {
        this.capacity = capacity;
        this.alive = new Uint8Array(capacity);
        this.transforms = new Transform2DStore(capacity);
        this.movement = new MovementStore(capacity);
        this.appearance = new AppearanceStore(capacity);
    }
    create() {
        const id = this.free.length ? this.free.pop() : this.nextId++;
        if (id >= this.capacity)
            throw new Error('World capacity exceeded');
        this.alive[id] = 1;
        return id;
    }
    destroy(id) {
        if (!this.alive[id])
            return;
        this.alive[id] = 0;
        this.transforms.remove(id);
        this.movement.remove(id);
        this.appearance.remove(id);
        this.free.push(id);
    }
    isAlive(id) { return this.alive[id] === 1; }
    *iterMoveable() {
        for (let id = 0; id < this.nextId; id++) {
            if (this.alive[id] && this.transforms.has(id) && this.movement.has(id)) {
                yield id;
            }
        }
    }
}
//# sourceMappingURL=World.js.map