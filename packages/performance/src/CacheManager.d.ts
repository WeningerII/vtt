/**
 * Multi-level Cache Management System
 * Provides memory, LRU, persistent, and distributed caching with intelligent eviction policies
 */
import { EventEmitter } from "events";
export interface CacheEntry<T = any> {
    key: string;
    value: T;
    size: number;
    createdAt: Date;
    lastAccessed: Date;
    accessCount: number;
    priority: number;
    ttl?: number;
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
    maxMemorySize: number;
    maxEntries: number;
    defaultTtl: number;
    evictionPolicy: "lru" | "lfu" | "fifo" | "adaptive";
    compressionEnabled: boolean;
    persistentStorage?: boolean;
    storageAdapter?: CacheStorageAdapter;
    cleanupInterval: number;
    maxSize?: number;
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
export declare class CacheManager extends EventEmitter {
    private cache;
    private config;
    private stats;
    private cleanupTimer?;
    constructor(config: CacheConfig);
    /**
     * Get value from cache
     */
    get<T>(key: string): Promise<T | null>;
    /**
     * Set value in cache
     */
    set<T>(key: string, value: T, options?: {
        ttl?: number;
        priority?: number;
        tags?: string[];
        metadata?: Record<string, any>;
    }): Promise<void>;
    /**
     * Delete entry from cache
     */
    delete(key: string): Promise<boolean>;
    /**
     * Clear cache entries matching query
     */
    clear(query?: CacheQuery): Promise<number>;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats;
    /**
     * Get entries matching query
     */
    query(query: CacheQuery): CacheEntry[];
    /**
     * Invalidate entries by tags
     */
    invalidateByTags(tags: string[]): Promise<number>;
    /**
     * Prefetch multiple keys
     */
    prefetch(keys: string[], fetcher: (key: string) => Promise<any>): Promise<void>;
    /**
     * Check if key exists in cache
     */
    has(key: string): boolean;
    /**
     * Set multiple key-value pairs
     */
    setMany<T>(entries: Array<{
        key: string;
        value: T;
        options?: any;
    }>): Promise<void>;
    /**
     * Get multiple values by keys
     */
    getMany<T>(keys: string[]): Promise<Array<{
        key: string;
        value: T | null;
    }>>;
    /**
     * Delete multiple keys
     */
    deleteMany(keys: string[]): Promise<{
        success: string[];
        failed: string[];
    }>;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Warm up cache with commonly accessed data
     */
    warmup(warmupData: Array<{
        key: string;
        value: any;
        options?: any;
    }>): Promise<void>;
    private ensureCapacity;
    private selectEntriesForEviction;
    private calculateAdaptiveScore;
    private getCurrentSize;
    private calculateSize;
    private createEntry;
    private isExpired;
    private matchesQuery;
    private startCleanupTimer;
    private cleanup;
    /**
     * Destroy cache manager and cleanup resources
     */
    destroy(): void;
}
/**
 * Browser LocalStorage cache adapter
 */
export declare class LocalStorageCacheAdapter implements CacheStorageAdapter {
    private prefix;
    constructor(prefix?: string);
    get(key: string): Promise<any>;
    set(key: string, value: any, ttl?: number): Promise<void>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
    size(): Promise<number>;
    keys(): Promise<string[]>;
}
/**
 * Default cache configurations for different scenarios
 */
export declare const _DEFAULT_CACHE_CONFIGS: {
    memory: {
        maxMemorySize: number;
        maxEntries: number;
        defaultTtl: number;
        evictionPolicy: "lru";
        compressionEnabled: boolean;
        persistentStorage: boolean;
        cleanupInterval: number;
    };
    persistent: {
        maxMemorySize: number;
        maxEntries: number;
        defaultTtl: number;
        evictionPolicy: "adaptive";
        compressionEnabled: boolean;
        persistentStorage: boolean;
        storageAdapter: LocalStorageCacheAdapter;
        cleanupInterval: number;
    };
    realtime: {
        maxMemorySize: number;
        maxEntries: number;
        defaultTtl: number;
        evictionPolicy: "lfu";
        compressionEnabled: boolean;
        persistentStorage: boolean;
        cleanupInterval: number;
    };
};
//# sourceMappingURL=CacheManager.d.ts.map