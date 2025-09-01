// Minimal ECS exports to unblock server startup
// Full ECS implementation has build errors that need separate resolution

export type EntityId = number;

interface ComponentStore {
  has(id: EntityId): boolean;
  x: Record<EntityId, number>;
  y: Record<EntityId, number>;
  rot: Record<EntityId, number>;
  sx: Record<EntityId, number>;
  sy: Record<EntityId, number>;
  zIndex: Record<EntityId, number>;
}

interface AppearanceStore {
  has(id: EntityId): boolean;
  sprite: Record<EntityId, number>;
  tintR: Record<EntityId, number>;
  tintG: Record<EntityId, number>;
  tintB: Record<EntityId, number>;
  alpha: Record<EntityId, number>;
  frame: Record<EntityId, number>;
}

interface MovementStore {
  has(id: EntityId): boolean;
  vx: Record<EntityId, number>;
  vy: Record<EntityId, number>;
  speed: Record<EntityId, number>;
  targetX: Record<EntityId, number>;
  targetY: Record<EntityId, number>;
}

export class World {
  private entities: Set<EntityId> = new Set();
  private aliveEntities: Set<EntityId> = new Set();
  private nextId = 1;
  public readonly capacity: number;
  
  public transforms: ComponentStore;
  public appearance: AppearanceStore;
  public movement: MovementStore;

  constructor(capacity: number = 1000) {
    this.capacity = capacity;
    
    // Initialize component stores
    this.transforms = {
      has: (id: EntityId) => this.aliveEntities.has(id),
      x: {},
      y: {},
      rot: {},
      sx: {},
      sy: {},
      zIndex: {}
    };
    
    this.appearance = {
      has: (id: EntityId) => this.aliveEntities.has(id),
      sprite: {},
      tintR: {},
      tintG: {},
      tintB: {},
      alpha: {},
      frame: {}
    };
    
    this.movement = {
      has: (id: EntityId) => this.aliveEntities.has(id),
      vx: {},
      vy: {},
      speed: {},
      targetX: {},
      targetY: {}
    };
  }

  create(): EntityId {
    const id = this.nextId++;
    this.entities.add(id);
    this.aliveEntities.add(id);
    return id;
  }

  createEntity(): EntityId {
    return this.create();
  }

  removeEntity(id: EntityId): void {
    this.entities.delete(id);
    this.aliveEntities.delete(id);
  }
  
  destroyEntity(id: EntityId): void {
    this.removeEntity(id);
  }

  hasEntity(id: EntityId): boolean {
    return this.entities.has(id);
  }
  
  isAlive(id: EntityId): boolean {
    return this.aliveEntities.has(id);
  }

  getEntities(): EntityId[] {
    return Array.from(this.entities);
  }
  
  update(deltaTime: number): void {
    // Stub implementation for world update
  }
}

export class NetworkSyncSystem {
  private seq = 0;
  private last = new Map<EntityId, any>();

  constructor() {}

  update(world: World): {
    seq: number;
    baseSeq: number;
    created: any[];
    updated: any[];
    removed: number[];
  } {
    const next = new Map<EntityId, any>();
    const created: any[] = [];
    const updated: any[] = [];
    const removed: number[] = [];
    
    // Collect current state for all alive entities that have transforms
    for (let id = 0; id < world.capacity; id++) {
      if (!world.isAlive(id)) continue;
      if (!world.transforms.has(id)) continue;
      
      const state = {
        id,
        x: world.transforms.x[id] ?? 0,
        y: world.transforms.y[id] ?? 0,
        rot: world.transforms.rot[id] ?? 0,
        sx: world.transforms.sx[id] ?? 1,
        sy: world.transforms.sy[id] ?? 1,
        zIndex: world.transforms.zIndex[id] ?? 0
      };
      
      next.set(id, state);
      const prev = this.last.get(id);
      
      if (!prev) {
        created.push(state);
      } else if (JSON.stringify(prev) !== JSON.stringify(state)) {
        updated.push(state);
      }
    }
    
    // Compute removals
    for (const id of this.last.keys()) {
      if (!next.has(id)) removed.push(id);
    }
    
    const baseSeq = this.seq;
    this.seq = baseSeq + 1;
    this.last = next;
    
    return { seq: this.seq, baseSeq, created, updated, removed };
  }
  
  getSnapshot(): { seq: number; entities: any[] } {
    return { seq: this.seq, entities: Array.from(this.last.values()) };
  }
}

export function MovementSystem(world: World, deltaTime: number): void {
  // Process movement for all entities with movement components
  for (const id of world.getEntities()) {
    if (!world.movement.has(id)) continue;
    if (!world.transforms.has(id)) continue;
    
    const vx = world.movement.vx[id] ?? 0;
    const vy = world.movement.vy[id] ?? 0;
    
    if (vx !== 0 || vy !== 0) {
      world.transforms.x[id] = (world.transforms.x[id] ?? 0) + vx * deltaTime;
      world.transforms.y[id] = (world.transforms.y[id] ?? 0) + vy * deltaTime;
    }
  }
}
