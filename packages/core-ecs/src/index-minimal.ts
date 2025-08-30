// Minimal ECS exports to unblock server startup
// Full ECS implementation has build errors that need separate resolution

export type EntityId = number;

export class World {
  private entities: Set<EntityId> = new Set();
  private nextId = 1;

  createEntity(): EntityId {
    const id = this.nextId++;
    this.entities.add(id);
    return id;
  }

  removeEntity(id: EntityId): void {
    this.entities.delete(id);
  }

  hasEntity(id: EntityId): boolean {
    return this.entities.has(id);
  }

  getEntities(): EntityId[] {
    return Array.from(this.entities);
  }
}

export class NetworkSyncSystem {
  constructor(private world: World) {}
  
  update(deltaTime: number): void {
    // Stub implementation
  }
}

export class MovementSystem {
  constructor(private world: World) {}
  
  update(deltaTime: number): void {
    // Stub implementation
  }
}
