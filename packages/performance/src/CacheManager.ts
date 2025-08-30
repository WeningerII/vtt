/**
 * Multi-level Cache Management System
 * Provides memory, LRU, persistent, and distributed caching with intelligent eviction policies
 */

import { EventEmitter } from 'events';
import { logger } from '@vtt/logging';

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  size: number;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  priority: number; // 0-1, higher means more important
  ttl?: number; // Time to live in milliseconds
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  averageAccessTime: number;
  memoryUsage: number;
  diskUsage?: number;
  hits: number;
  misses: number;
  size: number;
}

export interface CacheConfig {
  maxMemorySize: number; // bytes
  maxEntries: number;
  defaultTtl: number; // milliseconds
  evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'adaptive';
  compressionEnabled: boolean;
  persistentStorage?: boolean;
  storageAdapter?: CacheStorageAdapter;
  cleanupInterval: number; // milliseconds
  maxSize?: number; // Alternative name for maxMemorySize (for compatibility)
}

export interface CacheStorageAdapter {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  size(): Promise<number>;
  keys(): Promise<string[]>;
}

export interface CacheQuery {
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  accessedAfter?: Date;
  accessedBefore?: Date;
  minPriority?: number;
  pattern?: RegExp;
}

export class CacheManager extends EventEmitter {
  private cache = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    accessTimes: [] as number[],
  };
  private cleanupTimer?: NodeJS.Timeout | undefined;

  constructor(config: CacheConfig) {
    super();
    this.config = config;
    this.startCleanupTimer();
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const start = performance.now();
    
    let entry = this.cache.get(key);
    
    // Try persistent storage if not in memory
    if (!entry && this.config.storageAdapter) {
      try {
        const persistedValue = await this.config.storageAdapter.get(key);
        if (persistedValue !== undefined) {
          entry = this.createEntry(key, persistedValue, {});
          this.cache.set(key, entry);
        }
      } catch (error) {
        this.emit('storageError', { operation: 'get', key, error });
      }
    }

    const accessTime = performance.now() - start;
    this.stats.accessTimes.push(accessTime);
    
    if (entry && !this.isExpired(entry)) {
      // Update access information
      entry.lastAccessed = new Date();
      entry.accessCount++;
      
      this.stats.hits++;
      this.emit('hit', { key, entry, accessTime });
      
      return entry.value as T;
    } else {
      // Remove expired entry
      if (entry) {
        this.delete(key);
      }
      
      this.stats.misses++;
      this.emit('miss', { key, accessTime });
      
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: string, 
    value: T, 
    options: {
      ttl?: number;
      priority?: number;
      tags?: string[];
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    const size = this.calculateSize(value);
    
    // Check if we need to evict entries
    await this.ensureCapacity(size);
    
    const entry: CacheEntry<T> = {
      key,
      value,
      size,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0,
      priority: options.priority ?? 0.5,
      ttl: options.ttl ?? this.config.defaultTtl,
      ...(options.tags && { tags: options.tags }),
      ...(options.metadata && { metadata: options.metadata }),
    };

    this.cache.set(key, entry);
    
    // Persist to storage if configured
    if (this.config.storageAdapter) {
      try {
        await this.config.storageAdapter.set(key, value, entry.ttl);
      } catch (error) {
        this.emit('storageError', { operation: 'set', key, error });
      }
    }

    this.emit('set', { key, entry, size });
  }

  /**
   * Delete entry from cache
   */
  async delete(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    const deleted = this.cache.delete(key);
    
    if (this.config.storageAdapter) {
      try {
        await this.config.storageAdapter.delete(key);
      } catch (error) {
        this.emit('storageError', { operation: 'delete', key, error });
      }
    }

    if (deleted && entry) {
      this.emit('delete', { key, entry });
    }

    return deleted;
  }

  /**
   * Clear cache entries matching query
   */
  async clear(query?: CacheQuery): Promise<number> {
    let deletedCount = 0;
    
    if (!query) {
      // Clear all
      deletedCount = this.cache.size;
      this.cache.clear();
      
      if (this.config.storageAdapter) {
        try {
          await this.config.storageAdapter.clear();
        } catch (error) {
          this.emit('storageError', { operation: 'clear', error });
        }
      }
    } else {
      // Clear matching entries
      const keysToDelete: string[] = [];
      
      for (const [key, entry] of this.cache) {
        if (this.matchesQuery(entry, query)) {
          keysToDelete.push(key);
        }
      }

      for (const key of keysToDelete) {
        await this.delete(key);
        deletedCount++;
      }
    }

    this.emit('clear', { query, deletedCount });
    return deletedCount;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalAccesses = this.stats.hits + this.stats.misses;
    const avgAccessTime = this.stats.accessTimes.length > 0 
      ? this.stats.accessTimes.reduce((a, b) => a + b, 0) / this.stats.accessTimes.length
      : 0;

    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }

    return {
      totalEntries: this.cache.size,
      totalSize,
      hitRate: totalAccesses > 0 ? this.stats.hits / totalAccesses : 0,
      missRate: totalAccesses > 0 ? this.stats.misses / totalAccesses : 0,
      evictionCount: this.stats.evictions,
      averageAccessTime: avgAccessTime,
      memoryUsage: totalSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
    };
  }

  /**
   * Get entries matching query
   */
  query(query: CacheQuery): CacheEntry[] {
    const results: CacheEntry[] = [];
    
    for (const entry of this.cache.values()) {
      if (this.matchesQuery(entry, query)) {
        results.push({ ...entry }); // Return copy to prevent mutation
      }
    }

    return results;
  }

  /**
   * Invalidate entries by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    return this.clear({ tags });
  }

  /**
   * Prefetch multiple keys
   */
  async prefetch(keys: string[], fetcher: (key: string) => Promise<any>): Promise<void> {
    const promises = keys.map(async (key) => {
      const cached = await this.get(key);
      if (cached === null) {
        try {
          const value = await fetcher(key);
          await this.set(key, value);
        } catch (error) {
          this.emit('prefetchError', { key, error });
        }
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Set multiple key-value pairs
   */
  async setMany<T>(entries: Array<{ key: string; value: T; options?: any }>): Promise<void> {
    const promises = entries.map(({ key, value, options }) => this.set(key, value, options));
    await Promise.allSettled(promises);
  }

  /**
   * Get multiple values by keys
   */
  async getMany<T>(keys: string[]): Promise<Array<{ key: string; value: T | null }>> {
    const promises = keys.map(async (key) => ({
      key,
      value: await this.get<T>(key)
    }));
    return Promise.all(promises);
  }

  /**
   * Delete multiple keys
   */
  async deleteMany(keys: string[]): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];
    
    for (const key of keys) {
      try {
        await this.delete(key);
        success.push(key);
      } catch (_error) {
        failed.push(key);
      }
    }
    
    return { success, failed };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
    this.stats.accessTimes = [];
  }

  /**
   * Warm up cache with commonly accessed data
   */
  async warmup(warmupData: Array<{ key: string; value: any; options?: any }>): Promise<void> {
    const promises = warmupData.map(({ key, value, options }) => 
      this.set(key, value, options)
    );

    await Promise.allSettled(promises);
    this.emit('warmup', { count: warmupData.length });
  }

  private async ensureCapacity(newEntrySize: number): Promise<void> {
    const currentSize = this.getCurrentSize();
    const currentEntries = this.cache.size;

    // Check if we need to evict based on size or count
    if (currentSize + newEntrySize > this.config.maxMemorySize || 
        currentEntries >= this.config.maxEntries) {
      
      const entriesToEvict = this.selectEntriesForEviction(newEntrySize);
      
      for (const key of entriesToEvict) {
        await this.delete(key);
        this.stats.evictions++;
        this.emit('evict', { key, reason: 'capacity' });
      }
    }
  }

  private selectEntriesForEviction(newEntrySize: number): string[] {
    const entries = Array.from(this.cache.entries());
    const keysToEvict: string[] = [];
    let freedSize = 0;

    switch (this.config.evictionPolicy) {
      case 'lru':
        entries.sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());
        break;
      
      case 'lfu':
        entries.sort(([, a], [, b]) => a.accessCount - b.accessCount);
        break;
      
      case 'fifo':
        entries.sort(([, a], [, b]) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
      
      case 'adaptive':
        entries.sort(([, a], [, b]) => {
          const scoreA = this.calculateAdaptiveScore(a);
          const scoreB = this.calculateAdaptiveScore(b);
          return scoreA - scoreB;
        });
        break;
    }

    // Evict entries until we have enough space
    const targetSize = Math.max(newEntrySize, this.config.maxMemorySize * 0.1);
    
    for (const [key, entry] of entries) {
      if (freedSize >= targetSize) break;
      
      keysToEvict.push(key);
      freedSize += entry.size;
    }

    return keysToEvict;
  }

  private calculateAdaptiveScore(entry: CacheEntry): number {
    const now = Date.now();
    const age = now - entry.createdAt.getTime();
    const timeSinceAccess = now - entry.lastAccessed.getTime();
    const sizeRatio = entry.size / this.config.maxMemorySize;
    
    // Lower score = more likely to be evicted
    return (entry.priority * 0.4) + 
           (entry.accessCount * 0.3) + 
           (1 / (timeSinceAccess + 1) * 0.2) + 
           (1 / (age + 1) * 0.1) - 
           (sizeRatio * 0.1);
  }

  private getCurrentSize(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  private calculateSize(value: any): number {
    // Rough estimation of object size
    const str = JSON.stringify(value);
    return new Blob([str]).size;
  }

  private createEntry<T>(key: string, value: T, options: { ttl?: number; tags?: string[]; metadata?: Record<string, any>; } = {}): CacheEntry<T> {
    return {
      key,
      value,
      size: this.calculateSize(value),
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0,
      priority: 0.5,
      ttl: options.ttl ?? this.config.defaultTtl,
      ...(options.tags && { tags: options.tags }),
      ...(options.metadata && { metadata: options.metadata }),
    };
  }

  private isExpired(entry: CacheEntry): boolean {
    if (!entry.ttl) return false;
    return Date.now() - entry.createdAt.getTime() > entry.ttl;
  }

  private matchesQuery(entry: CacheEntry, query: CacheQuery): boolean {
    if (query.tags && (!entry.tags || !query.tags.some(tag => entry.tags!.includes(tag)))) {
      return false;
    }

    if (query.createdAfter && entry.createdAt < query.createdAfter) {
      return false;
    }

    if (query.createdBefore && entry.createdAt > query.createdBefore) {
      return false;
    }

    if (query.accessedAfter && entry.lastAccessed < query.accessedAfter) {
      return false;
    }

    if (query.accessedBefore && entry.lastAccessed > query.accessedBefore) {
      return false;
    }

    if (query.minPriority && entry.priority < query.minPriority) {
      return false;
    }

    if (query.pattern && !query.pattern.test(entry.key)) {
      return false;
    }

    return true;
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private async cleanup(): Promise<void> {
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      await this.delete(key);
      this.emit('evict', { key, reason: 'expired' });
    }

    // Trim access times array to prevent memory leak
    if (this.stats.accessTimes.length > 10000) {
      this.stats.accessTimes = this.stats.accessTimes.slice(-5000);
    }

    this.emit('cleanup', { expiredCount: keysToDelete.length });
  }

  /**
   * Destroy cache manager and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cleanupTimer = undefined;
    
    this.cache.clear();
    this.removeAllListeners();
  }
}

/**
 * Browser LocalStorage cache adapter
 */
export class LocalStorageCacheAdapter implements CacheStorageAdapter {
  private prefix: string;

  constructor(prefix = 'vtt_cache') {
    this.prefix = prefix;
  }

  async get(key: string): Promise<any> {
    try {
      const stored = localStorage.getItem(this.prefix + key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.expires && Date.now() > parsed.expires) {
          await this.delete(key);
          return undefined;
        }
        return parsed.value;
      }
    } catch (error) {
      logger.warn('LocalStorage cache get error:', error);
    }
    return undefined;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const data = {
        value,
        expires: ttl ? Date.now() + ttl : undefined,
        stored: Date.now(),
      };
      localStorage.setItem(this.prefix + key, JSON.stringify(data));
    } catch (error) {
      logger.warn('LocalStorage cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(this.prefix + key);
  }

  async clear(): Promise<void> {
    const keys = await this.keys();
    for (const key of keys) {
      await this.delete(key);
    }
  }

  async size(): Promise<number> {
    const keys = await this.keys();
    return keys.length;
  }

  async keys(): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keys.push(key.substring(this.prefix.length));
      }
    }
    return keys;
  }
}

/**
 * Default cache configurations for different scenarios
 */
export const _DEFAULT_CACHE_CONFIGS = {
  // Small memory cache for frequently accessed data
  memory: {
    maxMemorySize: 50 * 1024 * 1024, // 50MB
    maxEntries: 1000,
    defaultTtl: 30 * 60 * 1000, // 30 minutes
    evictionPolicy: 'lru' as const,
    compressionEnabled: false,
    persistentStorage: false,
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
  },

  // Large persistent cache for assets
  persistent: {
    maxMemorySize: 200 * 1024 * 1024, // 200MB
    maxEntries: 5000,
    defaultTtl: 24 * 60 * 60 * 1000, // 24 hours
    evictionPolicy: 'adaptive' as const,
    compressionEnabled: true,
    persistentStorage: true,
    storageAdapter: new LocalStorageCacheAdapter(),
    cleanupInterval: 15 * 60 * 1000, // 15 minutes
  },

  // High-performance cache for real-time data
  realtime: {
    maxMemorySize: 10 * 1024 * 1024, // 10MB
    maxEntries: 500,
    defaultTtl: 5 * 60 * 1000, // 5 minutes
    evictionPolicy: 'lfu' as const,
    compressionEnabled: false,
    persistentStorage: false,
    cleanupInterval: 30 * 1000, // 30 seconds
  },
};
