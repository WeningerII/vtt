/**
 * Memory-efficient sparse set implementation for ECS component storage
 * Provides O(1) insertion, deletion, and lookup with minimal memory overhead
 */
export class SparseSet<T> {
  private sparse: number[] = []; // Maps entity IDs to dense indices
  private dense: number[] = []; // Packed array of entity IDs
  private components: T[] = []; // Component data aligned with dense array
  private size = 0;
  private maxEntityId = 0;

  constructor(private initialCapacity: number = 1000) {
    this.sparse = new Array(initialCapacity).fill(-1);
  }

  /**
   * Add a component for an entity
   */
  set(entityId: number, component: T): void {
    this.ensureCapacity(entityId);

    if (this.has(entityId)) {
      // Update existing component
      const denseIndex = this.sparse[entityId]!;
      this.components[denseIndex] = component;
    } else {
      // Add new component
      this.sparse[entityId] = this.size;
      this.dense[this.size] = entityId;
      this.components[this.size] = component;
      this.size++;
    }

    this.maxEntityId = Math.max(this.maxEntityId, entityId);
  }

  /**
   * Get a component for an entity
   */
  get(entityId: number): T | undefined {
    if (entityId >= this.sparse.length) {return undefined;}

    const denseIndex = this.sparse[entityId];
    if (denseIndex === undefined || denseIndex === -1 || denseIndex >= this.size) {return undefined;}

    return this.components[denseIndex]!;
  }

  /**
   * Check if an entity has a component
   */
  has(entityId: number): boolean {
    if (entityId >= this.sparse.length) {return false;}

    const denseIndex = this.sparse[entityId];
    if (denseIndex === undefined) {return false;}
    return denseIndex !== -1 && denseIndex < this.size && this.dense[denseIndex] === entityId;
  }

  /**
   * Remove a component for an entity
   */
  delete(entityId: number): boolean {
    if (!this.has(entityId)) {return false;}

    const denseIndex = this.sparse[entityId]!;
    const lastIndex = this.size - 1;
    const lastEntityId = this.dense[lastIndex]!;

    // Swap with last element to maintain packed array
    this.dense[denseIndex] = lastEntityId;
    this.components[denseIndex] = this.components[lastIndex]!;
    this.sparse[lastEntityId] = denseIndex;

    // Mark as removed
    this.sparse[entityId] = -1;
    this.size--;

    return true;
  }

  /**
   * Clear all components
   */
  clear(): void {
    this.sparse.fill(-1);
    this.size = 0;
    this.maxEntityId = 0;
  }

  /**
   * Get all entities that have this component
   */
  entities(): number[] {
    return this.dense.slice(0, this.size);
  }

  /**
   * Get all components (aligned with entities array)
   */
  values(): T[] {
    return this.components.slice(0, this.size);
  }

  /**
   * Iterate over all entity-component pairs
   */
  *entries(): IterableIterator<[number, T]> {
    for (let i = 0; i < this.size; i++) {
      yield [this.dense[i]!, this.components[i]!];
    }
  }

  /**
   * Get the number of components
   */
  length(): number {
    return this.size;
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats() {
    return {
      sparseSize: this.sparse.length,
      denseSize: this.size,
      capacity: this.components.length,
      utilization: this.size / this.sparse.length,
      memoryEfficiency: this.size / (this.maxEntityId + 1),
    };
  }

  /**
   * Ensure sparse array can hold the given entity ID
   */
  private ensureCapacity(entityId: number): void {
    if (entityId >= this.sparse.length) {
      const newSize = Math.max(entityId + 1, this.sparse.length * 2);
      const newSparse = new Array(newSize).fill(-1);

      // Copy existing data
      for (let i = 0; i < this.sparse.length; i++) {
        newSparse[i] = this.sparse[i];
      }

      this.sparse = newSparse;
    }

    // Ensure dense and components arrays have enough capacity
    if (this.dense.length <= this.size) {
      const newCapacity = Math.max(this.dense.length * 2, 16);
      this.dense.length = newCapacity;
      this.components.length = newCapacity;
    }
  }

  /**
   * Compact the sparse array to save memory
   */
  compact(): void {
    if (this.maxEntityId + 1 < this.sparse.length / 2) {
      const newSize = Math.max(this.maxEntityId + 1, 16);
      const newSparse = new Array(newSize).fill(-1);

      for (let i = 0; i <= this.maxEntityId; i++) {
        newSparse[i] = this.sparse[i];
      }

      this.sparse = newSparse;
    }
  }
}

/**
 * Multi-component sparse set for storing multiple component types efficiently
 */
export class MultiSparseSet {
  private sparseSets = new Map<string, SparseSet<any>>();
  private entityVersions = new Map<number, number>();
  private globalVersion = 0;

  /**
   * Get or create a sparse set for a component type
   */
  getSet<T>(componentType: string): SparseSet<T> {
    if (!this.sparseSets.has(componentType)) {
      this.sparseSets.set(componentType, new SparseSet<T>());
    }
    return this.sparseSets.get(componentType)!;
  }

  /**
   * Set a component for an entity
   */
  setComponent<T>(entityId: number, componentType: string, component: T): void {
    const set = this.getSet<T>(componentType);
    set.set(entityId, component);
    this.updateEntityVersion(entityId);
  }

  /**
   * Get a component for an entity
   */
  getComponent<T>(entityId: number, componentType: string): T | undefined {
    const set = this.sparseSets.get(componentType);
    return set?.get(entityId);
  }

  /**
   * Check if an entity has a component
   */
  hasComponent(entityId: number, componentType: string): boolean {
    const set = this.sparseSets.get(componentType);
    return set?.has(entityId) ?? false;
  }

  /**
   * Remove a component from an entity
   */
  removeComponent(entityId: number, componentType: string): boolean {
    const set = this.sparseSets.get(componentType);
    if (set?.delete(entityId)) {
      this.updateEntityVersion(entityId);
      return true;
    }
    return false;
  }

  /**
   * Remove all components for an entity
   */
  removeEntity(entityId: number): void {
    for (const set of this.sparseSets.values()) {
      set.delete(entityId);
    }
    this.updateEntityVersion(entityId);
  }

  /**
   * Get all entities that have a specific component
   */
  getEntitiesWithComponent(componentType: string): number[] {
    const set = this.sparseSets.get(componentType);
    return set?.entities() ?? [];
  }

  /**
   * Get all entities that have ALL specified components
   */
  getEntitiesWithComponents(componentTypes: string[]): number[] {
    if (componentTypes.length === 0) {return [];}

    const firstType = componentTypes[0]!;
    const firstSet = this.sparseSets.get(firstType);
    if (!firstSet) {return [];}

    const candidates = firstSet.entities();

    return candidates.filter((entityId) =>
      componentTypes.every((type) => this.hasComponent(entityId, type)),
    );
  }

  /**
   * Get entity version for change tracking
   */
  getEntityVersion(entityId: number): number {
    return this.entityVersions.get(entityId) ?? 0;
  }

  /**
   * Update entity version
   */
  private updateEntityVersion(entityId: number): void {
    this.globalVersion++;
    this.entityVersions.set(entityId, this.globalVersion);
  }

  /**
   * Get memory usage statistics for all component types
   */
  getMemoryStats() {
    const stats: Record<string, any> = {};
    let totalUtilization = 0;
    let totalSets = 0;

    for (const [type, set] of this.sparseSets) {
      const setStats = set.getMemoryStats();
      stats[type] = setStats;
      totalUtilization += setStats.utilization;
      totalSets++;
    }

    return {
      componentTypes: totalSets,
      averageUtilization: totalSets > 0 ? totalUtilization / totalSets : 0,
      globalVersion: this.globalVersion,
      entityVersions: this.entityVersions.size,
      componentStats: stats,
    };
  }

  /**
   * Compact all sparse sets to save memory
   */
  compact(): void {
    for (const set of this.sparseSets.values()) {
      set.compact();
    }
  }

  /**
   * Clear all components
   */
  clear(): void {
    for (const set of this.sparseSets.values()) {
      set.clear();
    }
    this.entityVersions.clear();
    this.globalVersion = 0;
  }
}
