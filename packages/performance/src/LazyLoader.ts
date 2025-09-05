/**
 * Lazy Loading System
 * Provides intelligent loading strategies for assets, components, and data
 */

import { EventEmitter } from "events";

export interface LazyLoadable {
  id: string;
  load(): Promise<any>;
  unload?(): void;
  priority: number; // 0-1, higher = more important
  estimatedSize: number; // bytes
  dependencies?: string[]; // IDs of other loadables
}

export interface LoadStrategy {
  name: string;
  shouldLoad(item: LazyLoadable, context: LoadContext): boolean;
  getPriority(item: LazyLoadable, context: LoadContext): number;
}

export interface LoadContext {
  viewport?: { x: number; y: number; width: number; height: number };
  userPosition?: { x: number; y: number };
  memoryBudget: number; // Available memory in bytes
  bandwidthBudget: number; // Available bandwidth in bytes/sec
  currentlyLoaded: Set<string>;
  loadQueue: string[];
  timestamp: number;
}

export interface LoadGroup {
  id: string;
  items: LazyLoadable[];
  strategy: LoadStrategy;
  concurrency: number; // Max simultaneous loads
  enabled: boolean;
}

export interface LoadResult {
  id: string;
  success: boolean;
  data?: any;
  loadTime: number;
  size: number;
  error?: Error;
}

export interface LoadProgress {
  totalItems: number;
  loadedItems: number;
  failedItems: number;
  currentlyLoading: number;
  estimatedTimeRemaining: number;
  loadedBytes: number;
  totalBytes: number;
}

export class LazyLoader extends EventEmitter {
  private items = new Map<string, LazyLoadable>();
  private groups = new Map<string, LoadGroup>();
  private loadedData = new Map<string, any>();
  private loadingPromises = new Map<string, Promise<LoadResult>>();
  private strategies = new Map<string, LoadStrategy>();
  private context: LoadContext;
  private updateInterval: NodeJS.Timeout | undefined;

  constructor() {
    super();
    this.context = {
      memoryBudget: 100 * 1024 * 1024, // 100MB default
      bandwidthBudget: 1 * 1024 * 1024, // 1MB/sec default
      currentlyLoaded: new Set(),
      loadQueue: [],
      timestamp: Date.now(),
    };
    this.setupDefaultStrategies();
    this.startUpdateLoop();
  }

  /**
   * Register a lazy loadable item
   */
  register(item: LazyLoadable, groupId = "default"): void {
    this.items.set(item.id, item);

    if (!this.groups.has(groupId)) {
      this.groups.set(groupId, {
        id: groupId,
        items: [],
        strategy: this.strategies.get("viewport")!,
        concurrency: 3,
        enabled: true,
      });
    }

    const group = this.groups.get(groupId)!;
    if (!group.items.some((i) => i.id === item.id)) {
      group.items.push(item);
    }

    this.emit("registered", { item, groupId });
  }

  /**
   * Unregister an item
   */
  unregister(itemId: string): void {
    const item = this.items.get(itemId);
    if (!item) {return;}

    // Remove from all groups
    for (const group of this.groups.values()) {
      group.items = group.items.filter((i) => i.id !== itemId);
    }

    // Unload if loaded
    this.unload(itemId);

    this.items.delete(itemId);
    this.emit("unregistered", { itemId });
  }

  /**
   * Load a specific item
   */
  async load(itemId: string, force = false): Promise<LoadResult> {
    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`Item not found: ${itemId}`);
    }

    // Return existing data if already loaded and not forcing
    if (!force && this.loadedData.has(itemId)) {
      return {
        id: itemId,
        success: true,
        data: this.loadedData.get(itemId),
        loadTime: 0,
        size: item.estimatedSize,
      };
    }

    // Return existing loading promise if already loading
    if (this.loadingPromises.has(itemId)) {
      return this.loadingPromises.get(itemId)!;
    }

    const loadPromise = this.performLoad(item);
    this.loadingPromises.set(itemId, loadPromise);

    try {
      const result = await loadPromise;

      if (result.success) {
        this.loadedData.set(itemId, result.data);
        this.context.currentlyLoaded.add(itemId);
      }

      this.emit("loaded", result);
      return result;
    } finally {
      this.loadingPromises.delete(itemId);
    }
  }

  /**
   * Unload an item to free memory
   */
  unload(itemId: string): boolean {
    const item = this.items.get(itemId);
    const wasLoaded = this.loadedData.has(itemId);

    if (item?.unload) {
      item.unload();
    }

    this.loadedData.delete(itemId);
    this.context.currentlyLoaded.delete(itemId);

    if (wasLoaded) {
      this.emit("unloaded", { itemId });
    }

    return wasLoaded;
  }

  /**
   * Load items based on current context and strategies
   */
  async loadByStrategy(groupIds?: string[]): Promise<LoadResult[]> {
    const targetGroups = groupIds
      ? (groupIds.map((id) => this.groups.get(id)).filter(Boolean) as LoadGroup[])
      : Array.from(this.groups.values());

    const results: LoadResult[] = [];

    for (const group of targetGroups.filter((g) => g.enabled)) {
      const itemsToLoad = this.selectItemsToLoad(group);
      const groupResults = await this.loadItemsConcurrently(itemsToLoad, group.concurrency);
      results.push(...groupResults);
    }

    return results;
  }

  /**
   * Preload items that are likely to be needed
   */
  async preload(criteria: {
    distance?: number; // Distance from user position
    priority?: number; // Minimum priority
    groupIds?: string[];
  }): Promise<LoadResult[]> {
    const items: LazyLoadable[] = [];

    for (const group of this.groups.values()) {
      if (criteria.groupIds && !criteria.groupIds.includes(group.id)) {continue;}

      for (const item of group.items) {
        if (criteria.priority && item.priority < criteria.priority) {continue;}

        if (criteria.distance && this.context.userPosition) {
          // Simple distance check - in real use would be more sophisticated
          const distance = Math.abs(item.priority - 1) * 1000; // Mock distance
          if (distance > criteria.distance) {continue;}
        }

        if (!this.loadedData.has(item.id)) {
          items.push(item);
        }
      }
    }

    // Sort by priority
    items.sort((a, b) => b.priority - a.priority);

    return this.loadItemsConcurrently(items, 2); // Lower concurrency for preloading
  }

  /**
   * Update context (viewport, user position, etc.)
   */
  updateContext(updates: Partial<LoadContext>): void {
    this.context = { ...this.context, ...updates, timestamp: Date.now() };
    this.emit("contextUpdated", this.context);
  }

  /**
   * Get loading progress
   */
  getProgress(): LoadProgress {
    let totalItems = 0;
    let totalBytes = 0;
    let loadedBytes = 0;

    for (const group of this.groups.values()) {
      for (const item of group.items) {
        totalItems++;
        totalBytes += item.estimatedSize;

        if (this.loadedData.has(item.id)) {
          loadedBytes += item.estimatedSize;
        }
      }
    }

    const loadedItems = this.context.currentlyLoaded.size;
    const currentlyLoading = this.loadingPromises.size;
    const failedItems = totalItems - loadedItems - currentlyLoading;

    // Estimate time remaining based on recent load times
    const avgLoadTime = 1000; // Mock - would track real load times
    const estimatedTimeRemaining = (totalItems - loadedItems - currentlyLoading) * avgLoadTime;

    return {
      totalItems,
      loadedItems,
      failedItems: Math.max(0, failedItems),
      currentlyLoading,
      estimatedTimeRemaining,
      loadedBytes,
      totalBytes,
    };
  }

  /**
   * Create a load group with custom strategy
   */
  createGroup(
    id: string,
    strategy: LoadStrategy,
    options: {
      concurrency?: number;
      enabled?: boolean;
    } = {},
  ): LoadGroup {
    const group: LoadGroup = {
      id,
      items: [],
      strategy,
      concurrency: options.concurrency || 3,
      enabled: options.enabled ?? true,
    };

    this.groups.set(id, group);
    this.emit("groupCreated", { group });

    return group;
  }

  /**
   * Register a custom loading strategy
   */
  registerStrategy(strategy: LoadStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Get memory usage statistics
   */
  getMemoryUsage(): {
    loadedItems: number;
    estimatedMemoryUsage: number;
    memoryBudget: number;
    utilizationRatio: number;
  } {
    let estimatedMemoryUsage = 0;

    for (const itemId of this.context.currentlyLoaded) {
      const item = this.items.get(itemId);
      if (item) {
        estimatedMemoryUsage += item.estimatedSize;
      }
    }

    return {
      loadedItems: this.context.currentlyLoaded.size,
      estimatedMemoryUsage,
      memoryBudget: this.context.memoryBudget,
      utilizationRatio: estimatedMemoryUsage / this.context.memoryBudget,
    };
  }

  /**
   * Optimize memory usage by unloading low-priority items
   */
  optimizeMemory(): number {
    const usage = this.getMemoryUsage();

    if (usage.utilizationRatio < 0.8) {
      return 0; // No optimization needed
    }

    // Get loaded items sorted by priority (lowest first)
    const loadedItems = Array.from(this.context.currentlyLoaded)
      .map((id) => this.items.get(id))
      .filter(Boolean) as LazyLoadable[];

    loadedItems.sort((a, b) => a.priority - b.priority);

    let freedMemory = 0;
    let unloadedCount = 0;
    const targetReduction = usage.estimatedMemoryUsage * 0.3; // Free 30%

    for (const item of loadedItems) {
      if (freedMemory >= targetReduction) {break;}

      this.unload(item.id);
      freedMemory += item.estimatedSize;
      unloadedCount++;
    }

    this.emit("memoryOptimized", { unloadedCount, freedMemory });
    return unloadedCount;
  }

  private async performLoad(item: LazyLoadable): Promise<LoadResult> {
    const start = performance.now();

    try {
      // Load dependencies first
      if (item.dependencies) {
        await Promise.all(item.dependencies.map((depId) => this.load(depId)));
      }

      const data = await item.load();
      const loadTime = performance.now() - start;

      return {
        id: item.id,
        success: true,
        data,
        loadTime,
        size: item.estimatedSize,
      };
    } catch (error) {
      const loadTime = performance.now() - start;

      return {
        id: item.id,
        success: false,
        loadTime,
        size: 0,
        error: error instanceof Error ? error : new Error("Unknown load error"),
      };
    }
  }

  private selectItemsToLoad(group: LoadGroup): LazyLoadable[] {
    const items: LazyLoadable[] = [];

    for (const item of group.items) {
      if (this.loadedData.has(item.id) || this.loadingPromises.has(item.id)) {
        continue; // Already loaded or loading
      }

      if (group.strategy.shouldLoad(item, this.context)) {
        items.push(item);
      }
    }

    // Sort by strategy priority
    items.sort((a, b) => {
      const priorityA = group.strategy.getPriority(a, this.context);
      const priorityB = group.strategy.getPriority(b, this.context);
      return priorityB - priorityA;
    });

    return items;
  }

  private async loadItemsConcurrently(
    items: LazyLoadable[],
    concurrency: number,
  ): Promise<LoadResult[]> {
    const results: LoadResult[] = [];
    const semaphore = new Semaphore(concurrency);

    const loadPromises = items.map(async (item) => {
      await semaphore.acquire();
      try {
        const result = await this.load(item.id);
        results.push(result);
        return result;
      } finally {
        semaphore.release();
      }
    });

    await Promise.allSettled(loadPromises);
    return results;
  }

  private setupDefaultStrategies(): void {
    // Viewport-based loading strategy
    this.strategies.set("viewport", {
      name: "viewport",
      shouldLoad: (item, _context) => {
        // Mock viewport check - in real implementation would check actual bounds
        return item.priority > 0.3;
      },
      getPriority: (item, _context) => {
        // Higher priority for items closer to viewport center
        return item.priority * 0.8 + 0.2;
      },
    });

    // Distance-based loading strategy
    this.strategies.set("distance", {
      name: "distance",
      shouldLoad: (item, context) => {
        if (!context.userPosition) {return item.priority > 0.5;}

        // Mock distance calculation
        const distance = Math.abs(item.priority - 0.5) * 100;
        return distance < 50; // Within 50 units
      },
      getPriority: (item, context) => {
        if (!context.userPosition) {return item.priority;}

        const distance = Math.abs(item.priority - 0.5) * 100;
        return Math.max(0, 1 - distance / 100) * item.priority;
      },
    });

    // Priority-only strategy
    this.strategies.set("priority", {
      name: "priority",
      shouldLoad: (item) => item.priority > 0.6,
      getPriority: (item) => item.priority,
    });

    // Memory-conscious strategy
    this.strategies.set("memory", {
      name: "memory",
      shouldLoad: (item, context) => {
        const currentUsage = Array.from(context.currentlyLoaded).reduce((sum, id) => {
          const loadedItem = this.items.get(id);
          return sum + (loadedItem?.estimatedSize || 0);
        }, 0);

        return currentUsage + item.estimatedSize < context.memoryBudget * 0.8;
      },
      getPriority: (item, context) => {
        // Prefer smaller items when memory is constrained
        const sizeRatio = item.estimatedSize / context.memoryBudget;
        return item.priority * (1 - sizeRatio * 0.3);
      },
    });
  }

  private startUpdateLoop(): void {
    this.updateInterval = setInterval(() => {
      this.updateContext({ timestamp: Date.now() });

      // Trigger automatic loading based on strategies
      this.loadByStrategy().catch((error) => {
        this.emit("loadError", error);
      });
    }, 1000); // Update every second
  }

  /**
   * Destroy the lazy loader and cleanup resources
   */
  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }

    // Unload all items
    for (const itemId of this.context.currentlyLoaded) {
      this.unload(itemId);
    }

    this.items.clear();
    this.groups.clear();
    this.loadedData.clear();
    this.loadingPromises.clear();
    this.removeAllListeners();
  }
}

/**
 * Simple semaphore for controlling concurrency
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    const next = this.waitQueue.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }
}

/**
 * Asset lazy loadable implementation
 */
export class AssetLoadable implements LazyLoadable {
  constructor(
    public id: string,
    public url: string,
    public priority: number,
    public estimatedSize: number,
    public type: "image" | "audio" | "model" | "data" = "data",
  ) {}

  async load(): Promise<any> {
    switch (this.type) {
      case "image":
        return this.loadImage();
      case "audio":
        return this.loadAudio();
      case "model":
        return this.loadModel();
      default:
        return this.loadData();
    }
  }

  private async loadImage(): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${this.url}`));
      img.src = this.url;
    });
  }

  private async loadAudio(): Promise<ArrayBuffer> {
    const response = await fetch(this.url);
    if (!response.ok) {
      throw new Error(`Failed to load audio: ${response.statusText}`);
    }
    return response.arrayBuffer();
  }

  private async loadModel(): Promise<ArrayBuffer> {
    const response = await fetch(this.url);
    if (!response.ok) {
      throw new Error(`Failed to load model: ${response.statusText}`);
    }
    return response.arrayBuffer();
  }

  private async loadData(): Promise<any> {
    const response = await fetch(this.url);
    if (!response.ok) {
      throw new Error(`Failed to load data: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("json")) {
      return response.json();
    } else {
      return response.text();
    }
  }
}
