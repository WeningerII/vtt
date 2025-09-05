/**
 * Memory Optimizer - Reduces memory usage and prevents duplication across VTT systems
 * Provides object pooling, weak references, and memory profiling capabilities
 */

import { EventEmitter, SystemEvents } from "./EventEmitter";
import { logger } from '@vtt/logging';
import { Disposable } from "./SharedInterfaces";

// Declare WeakRef and FinalizationRegistry if not available
interface WeakRef<T extends object> {
  deref(): T | undefined;
}

interface FinalizationRegistry<T> {
  register(target: object, heldValue: T, unregisterToken?: object): void;
  unregister(unregisterToken: object): boolean;
}

declare const WeakRef: {
  new <T extends object>(target: T): WeakRef<T>;
};

declare const FinalizationRegistry: {
  new <T>(cleanupCallback: (heldValue: T) => void): FinalizationRegistry<T>;
};

export interface MemoryConfig {
  enableObjectPooling: boolean;
  enableWeakRefs: boolean;
  gcThreshold: number; // Memory usage percentage to trigger GC
  maxPoolSize: number;
  profileInterval: number;
  enableMemoryProfiling: boolean;
}

export interface ObjectPool<T> {
  acquire(): T;
  release(obj: T): void;
  size(): number;
  clear(): void;
}

export interface MemoryProfile {
  timestamp: Date;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number | undefined;
  objectCount: number;
  poolStats: Record<string, { size: number; active: number }>;
}

export class GenericObjectPool<T> implements ObjectPool<T> {
  private pool: T[] = [];
  private active = new Set<T>();
  private factory: () => T;
  private reset: ((_obj: T) => void) | undefined;
  private maxSize: number;

  constructor(_factory: () => T, maxSize: number = 100, reset?: (_obj: T) => void) {
    this.factory = _factory;
    this.maxSize = maxSize;
    this.reset = reset;
  }

  acquire(): T {
    let obj = this.pool.pop();

    if (!obj) {
      obj = this.factory();
    }

    this.active.add(obj);
    return obj;
  }

  release(obj: T): void {
    if (!this.active.has(obj)) {
      return;
    }

    this.active.delete(obj);

    if (this.reset) {
      this.reset(obj);
    }

    if (this.pool.length < this.maxSize) {
      this.pool.push(obj);
    }
  }

  size(): number {
    return this.pool.length;
  }

  getActiveCount(): number {
    return this.active.size;
  }

  clear(): void {
    this.pool = [];
    this.active.clear();
  }
}

export class WeakRefCache<K, V extends object> {
  private cache = new Map<K, WeakRef<V>>();
  private registry = new FinalizationRegistry<K>((_key) => {
    this.cache.delete(_key);
  });

  set(key: K, value: V): void {
    const existingRef = this.cache.get(key);
    if (existingRef?.deref()) {
      // Value already exists and is still alive
      return;
    }

    this.cache.set(key, new WeakRef(value));
    this.registry.register(value, key);
  }

  get(key: K): V | undefined {
    const ref = this.cache.get(key);
    if (!ref) {return undefined;}

    const value = ref.deref();
    if (!value) {
      this.cache.delete(key);
      return undefined;
    }

    return value;
  }

  has(key: K): boolean {
    const ref = this.cache.get(key);
    if (!ref) {return false;}

    const value = ref.deref();
    if (!value) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  size(): number {
    // Clean up dead references
    for (const [key, ref] of this.cache) {
      if (!ref.deref()) {
        this.cache.delete(key);
      }
    }
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}

export class MemoryOptimizer extends EventEmitter<SystemEvents> implements Disposable {
  private config: MemoryConfig;
  private objectPools = new Map<string, GenericObjectPool<any>>();
  private weakCaches = new Map<string, WeakRefCache<any, any>>();
  private memoryProfiles: MemoryProfile[] = [];
  private profileTimer: NodeJS.Timeout | undefined;
  private lastGCTime = 0;

  constructor(config: Partial<MemoryConfig> = {}) {
    super();

    this.config = {
      enableObjectPooling: true,
      enableWeakRefs: true,
      gcThreshold: 0.8, // 80%
      maxPoolSize: 100,
      profileInterval: 10000, // 10 seconds
      enableMemoryProfiling: true,
      ...config,
    };

    if (this.config.enableMemoryProfiling) {
      this.startMemoryProfiling();
    }
  }

  /**
   * Create an object pool
   */
  createPool<T>(_name: string, _factory: () => T, reset?: (_obj: T) => void): ObjectPool<T> {
    if (!this.config.enableObjectPooling) {
      // Return a no-op pool that just creates new objects
      return {
        acquire: _factory,
        release: () => {},
        size: () => 0,
        clear: () => {},
      };
    }

    const pool = new GenericObjectPool(_factory, this.config.maxPoolSize, reset);
    this.objectPools.set(_name, pool);
    return pool;
  }

  /**
   * Get an existing pool
   */
  getPool<T>(name: string): ObjectPool<T> | null {
    return this.objectPools.get(name) || null;
  }

  /**
   * Create a weak reference cache
   */
  createWeakCache<K, V extends object>(name: string): WeakRefCache<K, V> {
    if (!this.config.enableWeakRefs) {
      // Return a regular Map wrapper
      const regularMap = new Map<K, V>();
      return {
        set: (_k, _v) => {
          regularMap.set(_k, _v);
        },
        get: (_k) => regularMap.get(_k),
        has: (_k) => regularMap.has(_k),
        delete: (_k) => regularMap.delete(_k),
        size: () => regularMap.size,
        clear: () => regularMap.clear(),
      } as WeakRefCache<K, V>;
    }

    const cache = new WeakRefCache<K, V>();
    this.weakCaches.set(name, cache);
    return cache;
  }

  /**
   * Get an existing weak cache
   */
  getWeakCache<K, V extends object>(name: string): WeakRefCache<K, V> | null {
    return this.weakCaches.get(name) || null;
  }

  /**
   * Force garbage collection (if available)
   */
  forceGC(): void {
    if (typeof global !== "undefined" && (global as any).gc) {
      (global as any).gc();
      this.lastGCTime = Date.now();
    }
  }

  /**
   * Check if GC should be triggered based on memory usage
   */
  shouldTriggerGC(): boolean {
    const memInfo = this.getMemoryInfo();
    if (!memInfo) {return false;}

    const usageRatio = memInfo.heapUsed / memInfo.heapTotal;
    return usageRatio > this.config.gcThreshold;
  }

  /**
   * Get current memory information
   */
  getMemoryInfo(): { heapUsed: number; heapTotal: number; external: number; rss?: number } | null {
    if (typeof process !== "undefined" && process.memoryUsage) {
      return process.memoryUsage();
    }

    // Browser environment - use performance.memory if available
    if (typeof performance !== "undefined" && (performance as any).memory) {
      const mem = (performance as any).memory;
      return {
        heapUsed: mem.usedJSHeapSize,
        heapTotal: mem.totalJSHeapSize,
        external: 0,
      };
    }

    return null;
  }

  /**
   * Get memory profiles
   */
  getMemoryProfiles(limit?: number): MemoryProfile[] {
    return limit ? this.memoryProfiles.slice(-limit) : [...this.memoryProfiles];
  }

  /**
   * Clear old memory profiles
   */
  clearOldProfiles(maxAge: number = 300000): void {
    // 5 minutes
    const cutoff = Date.now() - maxAge;
    this.memoryProfiles = this.memoryProfiles.filter((p) => p.timestamp.getTime() > cutoff);
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): Record<string, { size: number; active: number }> {
    const stats: Record<string, { size: number; active: number }> = {};

    for (const [name, pool] of this.objectPools) {
      if (pool instanceof GenericObjectPool) {
        stats[name] = {
          size: pool.size(),
          active: pool.getActiveCount(),
        };
      }
    }

    return stats;
  }

  /**
   * Clear all pools
   */
  clearAllPools(): void {
    for (const pool of this.objectPools.values()) {
      pool.clear();
    }
  }

  /**
   * Clear all weak caches
   */
  clearAllCaches(): void {
    for (const cache of this.weakCaches.values()) {
      cache.clear();
    }
  }

  /**
   * Optimize memory usage
   */
  optimize(): void {
    // Clear old profiles
    this.clearOldProfiles();

    // Clean up weak caches
    for (const cache of this.weakCaches.values()) {
      cache.size(); // This triggers cleanup of dead references
    }

    // Trigger GC if needed
    if (this.shouldTriggerGC()) {
      this.forceGC();
    }

    this.emit("ready", undefined);
  }

  /**
   * Create optimized arrays with object pooling
   */
  createOptimizedArray<T>(name: string, initialCapacity: number = 100): OptimizedArray<T> {
    return new OptimizedArray<T>(this, name, initialCapacity);
  }

  /**
   * Dispose of the memory optimizer
   */
  dispose(): void {
    if (this.profileTimer) {
      clearInterval(this.profileTimer);
      this.profileTimer = undefined as NodeJS.Timeout | undefined;
    }

    this.clearAllPools();
    this.clearAllCaches();
    this.objectPools.clear();
    this.weakCaches.clear();
    this.memoryProfiles = [];
    this.removeAllListeners();
  }

  // Private helper methods

  private startMemoryProfiling(): void {
    this.profileTimer = setInterval(() => {
      this.createMemoryProfile();
    }, this.config.profileInterval);
  }

  private createMemoryProfile(): void {
    const memInfo = this.getMemoryInfo();
    if (!memInfo) {return;}

    const profile: MemoryProfile = {
      timestamp: new Date(),
      heapUsed: memInfo.heapUsed,
      heapTotal: memInfo.heapTotal,
      external: memInfo.external,
      rss: memInfo.rss,
      objectCount: this.estimateObjectCount(),
      poolStats: this.getPoolStats(),
    };

    this.memoryProfiles.push(profile);

    // Keep only last 100 profiles
    if (this.memoryProfiles.length > 100) {
      this.memoryProfiles.shift();
    }
  }

  private estimateObjectCount(): number {
    let count = 0;

    // Count objects in pools
    for (const pool of this.objectPools.values()) {
      if (pool instanceof GenericObjectPool) {
        count += pool.size() + pool.getActiveCount();
      }
    }

    // Count objects in weak caches
    for (const cache of this.weakCaches.values()) {
      count += cache.size();
    }

    return count;
  }
}

/**
 * Optimized array that reuses objects to reduce allocations
 */
export class OptimizedArray<T> {
  private items: T[] = [];
  private pool: ObjectPool<T>;
  private factory: () => T;
  private reset: ((_obj: T) => void) | undefined;

  constructor(
    optimizer: MemoryOptimizer,
    _poolName: string,
    _initialCapacity: number = 100,
    _factory?: () => T,
    reset?: (_obj: T) => void,
  ) {
    this.factory = _factory || (() => ({}) as T);
    this.reset = reset;

    this.pool = optimizer.getPool(_poolName) || optimizer.createPool(_poolName, this.factory, reset);

    // Pre-allocate capacity
    this.items.length = _initialCapacity;
  }

  push(item?: T): T {
    const obj = item || this.pool.acquire();
    this.items.push(obj);
    return obj;
  }

  pop(): T | undefined {
    const item = this.items.pop();
    if (item && !this.factory) {
      this.pool.release(item);
    }
    return item;
  }

  get(index: number): T | undefined {
    return this.items[index];
  }

  set(index: number, item: T): void {
    this.items[index] = item;
  }

  get length(): number {
    return this.items.length;
  }

  clear(): void {
    // Return all items to pool
    for (const item of this.items) {
      this.pool.release(item);
    }
    this.items.length = 0;
  }

  forEach(_callback: (item: T, _index: number) => void): void {
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if (item !== undefined) {
        _callback(item, i);
      }
    }
  }

  filter(_predicate: (item: T) => boolean): T[] {
    return this.items.filter(_predicate);
  }

  map<U>(_mapper: (item: T) => U): U[] {
    return this.items.map(_mapper);
  }
}

// Export singleton instance
export const _memoryOptimizer = new MemoryOptimizer();
