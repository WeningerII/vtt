import { Transform2DStore } from "./components/Transform2D";
import { MovementStore } from "./components/Movement";
import { AppearanceStore } from "./components/Appearance";
export class World {
  constructor(capacity = 10000) {
    this.free = [];
    this.nextId = 0;
    this.capacity = capacity;
    this.alive = new Uint8Array(capacity);
    this.transforms = new Transform2DStore(capacity);
    this.movement = new MovementStore(capacity);
    this.appearance = new AppearanceStore(capacity);
  }
  create() {
    const id = this.free.length ? this.free.pop() : this.nextId++;
    if (id >= this.capacity) throw new Error("World capacity exceeded");
    this.alive[id] = 1;
    return id;
  }
  destroy(id) {
    if (!this.alive[id]) return;
    this.alive[id] = 0;
    this.transforms.remove(id);
    this.movement.remove(id);
    this.appearance.remove(id);
    this.free.push(id);
  }
  isAlive(id) {
    return this.alive[id] === 1;
  }
  *iterMoveable() {
    for (let id = 0; id < this.nextId; id++) {
      if (this.alive[id] && this.transforms.has(id) && this.movement.has(id)) {
        yield id;
      }
    }
  }
  // Additional methods needed by GameSession
  createEntity(id) {
    if (id !== undefined) {
      if (id >= this.capacity) throw new Error("Entity ID exceeds world capacity");
      if (this.alive[id]) throw new Error("Entity already exists");
      this.alive[id] = 1;
      this.nextId = Math.max(this.nextId, id + 1);
      return id;
    }
    return this.create();
  }
  destroyEntity(id) {
    this.destroy(id);
  }
  getComponent(componentType) {
    switch (componentType) {
      case "Transform2D":
        return this.transforms;
      case "Movement":
        return this.movement;
      case "Appearance":
        return this.appearance;
      default:
        return null;
    }
  }
  getEntities() {
    const entities = [];
    for (let id = 0; id < this.nextId; id++) {
      if (this.alive[id]) {
        entities.push(id);
      }
    }
    return entities;
  }
  update(deltaTime) {
    // Update world simulation
    // This is a placeholder for world update logic
  }
}
//# sourceMappingURL=World.js.map
