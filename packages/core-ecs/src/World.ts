import { Transform2DStore, type EntityId } from "./components/Transform2D";
import { MovementStore } from "./components/Movement";
import { AppearanceStore } from "./components/Appearance";
import { StatsStore } from "./components/Stats";
import { CombatStore } from "./components/Combat";
import { HealthStore } from "./components/Health";
import { ConditionsStore } from "./components/Conditions";

export class World {
  readonly capacity: number;
  readonly alive: Uint8Array;
  private free: number[] = [];
  private nextId = 0;

  readonly transforms: Transform2DStore;
  readonly movement: MovementStore;
  readonly appearance: AppearanceStore;
  readonly stats: StatsStore;
  readonly combat: CombatStore;
  readonly health: HealthStore;
  readonly conditions: ConditionsStore;

  constructor(capacity = 10_000) {
    this.capacity = capacity;
    this.alive = new Uint8Array(capacity);
    this.transforms = new Transform2DStore(capacity);
    this.movement = new MovementStore(capacity);
    this.appearance = new AppearanceStore(capacity);
    this.stats = new StatsStore(capacity);
    this.combat = new CombatStore(capacity);
    this.health = new HealthStore(capacity);
    this.conditions = new ConditionsStore(capacity);
  }

  create(): EntityId {
    return this.createEntity();
  }

  createEntity(): EntityId {
    const id = this.free.length ? (this.free.pop() as number) : this.nextId++;
    if (id >= this.capacity) {
      throw new Error("World capacity exceeded");
    }
    this.alive[id] = 1;
    return id;
  }

  destroy(id: EntityId) {
    return this.destroyEntity(id);
  }

  destroyEntity(id: EntityId) {
    if (!this.alive[id]) {
      return;
    }
    this.alive[id] = 0;
    this.transforms.remove(id);
    this.movement.remove(id);
    this.appearance.remove(id);
    this.stats.remove(id);
    this.combat.remove(id);
    this.health.remove(id);
    this.conditions.remove(id);
    this.free.push(id);
  }

  isAlive(id: EntityId) {
    return this.alive[id] === 1;
  }

  /**
   * Get all alive entity IDs as an array
   * @returns Array of all currently alive entity IDs
   */
  getEntities(): EntityId[] {
    const entities: EntityId[] = [];
    for (let id = 0; id < this.nextId; id++) {
      if (this.alive[id]) {
        entities.push(id);
      }
    }
    return entities;
  }

  /**
   * Iterate over all alive entities
   * @yields EntityId for each alive entity
   */
  *iterAllEntities(): Iterable<EntityId> {
    for (let id = 0; id < this.nextId; id++) {
      if (this.alive[id]) {
        yield id;
      }
    }
  }

  /**
   * Get entities that have specific components
   * @param components Component store names to check
   * @returns Array of entity IDs that have all specified components
   */
  getEntitiesWithComponents(...components: (keyof this)[]): EntityId[] {
    const entities: EntityId[] = [];
    for (let id = 0; id < this.nextId; id++) {
      if (
        this.alive[id] &&
        components.every((comp) => (this[comp] as { has: (id: number) => boolean })?.has?.(id))
      ) {
        entities.push(id);
      }
    }
    return entities;
  }

  *iterMoveable(): Iterable<number> {
    for (let id = 0; id < this.nextId; id++) {
      if (this.alive[id] && this.transforms.has(id) && this.movement.has(id)) {
        yield id;
      }
    }
  }
}
export type { EntityId } from "./components/Transform2D";
