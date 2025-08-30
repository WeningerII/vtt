import { Transform2DStore, type EntityId } from "./components/Transform2D";
import { MovementStore } from "./components/Movement";
import { AppearanceStore } from "./components/Appearance";
export declare class World {
  readonly capacity: number;
  readonly alive: Uint8Array;
  private free;
  private nextId;
  readonly transforms: Transform2DStore;
  readonly movement: MovementStore;
  readonly appearance: AppearanceStore;
  constructor(capacity?: number);
  create(): EntityId;
  destroy(id: EntityId): void;
  isAlive(id: EntityId): boolean;
  iterMoveable(): Iterable<number>;
  createEntity(id?: EntityId): EntityId;
  destroyEntity(id: EntityId): void;
  getComponent(componentType: string): any;
  getEntities(): EntityId[];
  update(deltaTime: number): void;
}
export type { EntityId } from "./components/Transform2D";
//# sourceMappingURL=World.d.ts.map
