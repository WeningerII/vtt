import { SparseSet, MultiSparseSet } from "./SparseSet";

export interface ComponentChange {
  entityId: number;
  componentType: string;
  changeType: "added" | "modified" | "removed";
  timestamp: number;
  version: number;
}

export interface ComponentQuery {
  required: string[];
  optional?: string[];
  excluded?: string[];
}

/**
 * High-performance component manager using sparse sets and dirty tracking
 */
export class ComponentManager {
  private componentStorage = new MultiSparseSet();
  private changeLog: ComponentChange[] = [];
  private dirtyEntities = new Set<number>();
  private systemQueries = new Map<string, ComponentQuery>();
  private queryResultCache = new Map<string, { entities: number[]; version: number }>();
  private globalVersion = 0;
  private maxChangeLogSize = 1000;

  /**
   * Register a component type with optional initialization
   */
  registerComponent<T>(componentType: string, _initializer?: () => T): void {
    this.componentStorage.getSet<T>(componentType);
  }

  /**
   * Add or update a component for an entity
   */
  setComponent<T>(entityId: number, componentType: string, component: T): void {
    const hadComponent = this.componentStorage.hasComponent(entityId, componentType);

    this.componentStorage.setComponent(entityId, componentType, component);

    // Track changes
    this.recordChange(entityId, componentType, hadComponent ? "modified" : "added");
    this.markEntityDirty(entityId);
    this.invalidateQueriesForComponent(componentType);
  }

  /**
   * Get a component for an entity
   */
  getComponent<T>(entityId: number, componentType: string): T | undefined {
    return this.componentStorage.getComponent<T>(entityId, componentType);
  }

  /**
   * Check if an entity has a component
   */
  hasComponent(entityId: number, componentType: string): boolean {
    return this.componentStorage.hasComponent(entityId, componentType);
  }

  /**
   * Remove a component from an entity
   */
  removeComponent(entityId: number, componentType: string): boolean {
    if (this.componentStorage.removeComponent(entityId, componentType)) {
      this.recordChange(entityId, componentType, "removed");
      this.markEntityDirty(entityId);
      this.invalidateQueriesForComponent(componentType);
      return true;
    }
    return false;
  }

  /**
   * Remove all components for an entity
   */
  removeEntity(entityId: number): void {
    // Get all component types for this entity before removal
    const componentTypes = this.getEntityComponentTypes(entityId);

    this.componentStorage.removeEntity(entityId);

    // Record changes for all removed components
    for (const componentType of componentTypes) {
      this.recordChange(entityId, componentType, "removed");
    }

    this.markEntityDirty(entityId);
    this.invalidateAllQueries();
  }

  /**
   * Query entities based on component requirements
   */
  queryEntities(query: ComponentQuery): number[] {
    const queryKey = this.getQueryKey(query);
    const cached = this.queryResultCache.get(queryKey);

    // Return cached result if still valid
    if (cached && cached.version === this.globalVersion) {
      return [...cached.entities];
    }

    // Execute query
    const entities = this.executeQuery(query);

    // Cache result
    this.queryResultCache.set(queryKey, {
      entities: [...entities],
      version: this.globalVersion,
    });

    return entities;
  }

  /**
   * Register a system's query for optimization
   */
  registerSystemQuery(systemName: string, query: ComponentQuery): void {
    this.systemQueries.set(systemName, query);
  }

  /**
   * Get entities that match a registered system query
   */
  getSystemEntities(systemName: string): number[] {
    const query = this.systemQueries.get(systemName);
    if (!query) {
      throw new Error(`System query not registered: ${systemName}`);
    }
    return this.queryEntities(query);
  }

  /**
   * Get entities that have been modified since last update
   */
  getDirtyEntities(): Set<number> {
    return new Set(this.dirtyEntities);
  }

  /**
   * Clear dirty flags (call after processing updates)
   */
  clearDirtyFlags(): void {
    this.dirtyEntities.clear();
  }

  /**
   * Get recent component changes
   */
  getRecentChanges(sinceVersion?: number): ComponentChange[] {
    if (sinceVersion === undefined) {
      return [...this.changeLog];
    }
    return this.changeLog.filter((change) => change.version > sinceVersion);
  }

  /**
   * Get all component types for an entity
   */
  getEntityComponentTypes(entityId: number): string[] {
    const types: string[] = [];
    const stats = this.componentStorage.getMemoryStats();

    for (const componentType in stats.componentStats) {
      if (this.componentStorage.hasComponent(entityId, componentType)) {
        types.push(componentType);
      }
    }

    return types;
  }

  /**
   * Get performance and memory statistics
   */
  getStats() {
    const memoryStats = this.componentStorage.getMemoryStats();
    const queryCacheSize = this.queryResultCache.size;
    const changeLogSize = this.changeLog.length;

    return {
      ...memoryStats,
      dirtyEntities: this.dirtyEntities.size,
      changeLogSize,
      queryCacheSize,
      registeredSystems: this.systemQueries.size,
      globalVersion: this.globalVersion,
    };
  }

  /**
   * Compact storage to save memory
   */
  compact(): void {
    this.componentStorage.compact();

    // Trim change log if too large
    if (this.changeLog.length > this.maxChangeLogSize) {
      this.changeLog = this.changeLog.slice(-this.maxChangeLogSize / 2);
    }

    // Clear old query cache
    this.queryResultCache.clear();
  }

  /**
   * Batch operations for better performance
   */
  batch(operations: (() => void)[]): void {
    const startVersion = this.globalVersion;

    // Execute all operations without triggering individual updates
    for (const operation of operations) {
      operation();
    }

    // Single version increment for the entire batch
    if (this.globalVersion === startVersion) {
      this.globalVersion++;
    }

    // Clear query cache once for the entire batch
    this.queryResultCache.clear();
  }

  /**
   * Execute a component query
   */
  private executeQuery(query: ComponentQuery): number[] {
    if (query.required.length === 0) {
      return [];
    }

    // Start with entities that have the first required component
    let entities = this.componentStorage.getEntitiesWithComponent(query.required[0]!);

    // Filter by remaining required components
    for (let i = 1; i < query.required.length; i++) {
      const req = query.required[i]!;
      entities = entities.filter((entityId) => this.componentStorage.hasComponent(entityId, req));
    }

    // Filter out excluded components
    if (query.excluded) {
      entities = entities.filter(
        (entityId) =>
          !query.excluded!.some((excludedType) =>
            this.componentStorage.hasComponent(entityId, excludedType),
          ),
      );
    }

    return entities;
  }

  /**
   * Generate a unique key for a query
   */
  private getQueryKey(query: ComponentQuery): string {
    const required = query.required.sort().join(",");
    const optional = query.optional ? query.optional.sort().join(",") : "";
    const excluded = query.excluded ? query.excluded.sort().join(",") : "";
    return `req:${required}|opt:${optional}|exc:${excluded}`;
  }

  /**
   * Record a component change
   */
  private recordChange(
    entityId: number,
    componentType: string,
    changeType: ComponentChange["changeType"],
  ): void {
    this.globalVersion++;

    const change: ComponentChange = {
      entityId,
      componentType,
      changeType,
      timestamp: Date.now(),
      version: this.globalVersion,
    };

    this.changeLog.push(change);

    // Limit change log size
    if (this.changeLog.length > this.maxChangeLogSize) {
      this.changeLog.shift();
    }
  }

  /**
   * Mark an entity as dirty
   */
  private markEntityDirty(entityId: number): void {
    this.dirtyEntities.add(entityId);
  }

  /**
   * Invalidate queries that depend on a component type
   */
  private invalidateQueriesForComponent(componentType: string): void {
    for (const [queryKey, _cached] of this.queryResultCache) {
      if (queryKey.includes(componentType)) {
        this.queryResultCache.delete(queryKey);
      }
    }
  }

  /**
   * Invalidate all cached queries
   */
  private invalidateAllQueries(): void {
    this.queryResultCache.clear();
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.componentStorage.clear();
    this.changeLog = [];
    this.dirtyEntities.clear();
    this.queryResultCache.clear();
    this.globalVersion = 0;
  }
}
