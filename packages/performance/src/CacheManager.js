/**
 * Multi-level Cache Management System
 * Provides memory, LRU, persistent, and distributed caching with intelligent eviction policies
 */
import { EventEmitter } from "events";
import { logger } from "@vtt/logging";
export class CacheManager extends EventEmitter {
    constructor(config) {
        super();
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            accessTimes: [],
        };
        this.config = config;
        this.startCleanupTimer();
    }
    /**
     * Get value from cache
     */
    async get(key) {
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
            }
            catch (error) {
                this.emit("storageError", { operation: "get", key, error });
            }
        }
        const accessTime = performance.now() - start;
        this.stats.accessTimes.push(accessTime);
        if (entry && !this.isExpired(entry)) {
            // Update access information
            entry.lastAccessed = new Date();
            entry.accessCount++;
            this.stats.hits++;
            this.emit("hit", { key, entry, accessTime });
            return entry.value;
        }
        else {
            // Remove expired entry
            if (entry) {
                this.delete(key);
            }
            this.stats.misses++;
            this.emit("miss", { key, accessTime });
            return null;
        }
    }
    /**
     * Set value in cache
     */
    async set(key, value, options = {}) {
        const size = this.calculateSize(value);
        // Check if we need to evict entries
        await this.ensureCapacity(size);
        const entry = {
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
            }
            catch (error) {
                this.emit("storageError", { operation: "set", key, error });
            }
        }
        this.emit("set", { key, entry, size });
    }
    /**
     * Delete entry from cache
     */
    async delete(key) {
        const entry = this.cache.get(key);
        const deleted = this.cache.delete(key);
        if (this.config.storageAdapter) {
            try {
                await this.config.storageAdapter.delete(key);
            }
            catch (error) {
                this.emit("storageError", { operation: "delete", key, error });
            }
        }
        if (deleted && entry) {
            this.emit("delete", { key, entry });
        }
        return deleted;
    }
    /**
     * Clear cache entries matching query
     */
    async clear(query) {
        let deletedCount = 0;
        if (!query) {
            // Clear all
            deletedCount = this.cache.size;
            this.cache.clear();
            if (this.config.storageAdapter) {
                try {
                    await this.config.storageAdapter.clear();
                }
                catch (error) {
                    this.emit("storageError", { operation: "clear", error });
                }
            }
        }
        else {
            // Clear matching entries
            const keysToDelete = [];
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
        this.emit("clear", { query, deletedCount });
        return deletedCount;
    }
    /**
     * Get cache statistics
     */
    getStats() {
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
    query(query) {
        const results = [];
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
    async invalidateByTags(tags) {
        return this.clear({ tags });
    }
    /**
     * Prefetch multiple keys
     */
    async prefetch(keys, fetcher) {
        const promises = keys.map(async (key) => {
            const cached = await this.get(key);
            if (cached === null) {
                try {
                    const value = await fetcher(key);
                    await this.set(key, value);
                }
                catch (error) {
                    this.emit("prefetchError", { key, error });
                }
            }
        });
        await Promise.allSettled(promises);
    }
    /**
     * Check if key exists in cache
     */
    has(key) {
        return this.cache.has(key);
    }
    /**
     * Set multiple key-value pairs
     */
    async setMany(entries) {
        const promises = entries.map(({ key, value, options }) => this.set(key, value, options));
        await Promise.allSettled(promises);
    }
    /**
     * Get multiple values by keys
     */
    async getMany(keys) {
        const promises = keys.map(async (key) => ({
            key,
            value: await this.get(key),
        }));
        return Promise.all(promises);
    }
    /**
     * Delete multiple keys
     */
    async deleteMany(keys) {
        const success = [];
        const failed = [];
        for (const key of keys) {
            try {
                await this.delete(key);
                success.push(key);
            }
            catch (_error) {
                failed.push(key);
            }
        }
        return { success, failed };
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats.hits = 0;
        this.stats.misses = 0;
        this.stats.evictions = 0;
        this.stats.accessTimes = [];
    }
    /**
     * Warm up cache with commonly accessed data
     */
    async warmup(warmupData) {
        const promises = warmupData.map(({ key, value, options }) => this.set(key, value, options));
        await Promise.allSettled(promises);
        this.emit("warmup", { count: warmupData.length });
    }
    async ensureCapacity(newEntrySize) {
        const currentSize = this.getCurrentSize();
        const currentEntries = this.cache.size;
        // Check if we need to evict based on size or count
        if (currentSize + newEntrySize > this.config.maxMemorySize ||
            currentEntries >= this.config.maxEntries) {
            const entriesToEvict = this.selectEntriesForEviction(newEntrySize);
            for (const key of entriesToEvict) {
                await this.delete(key);
                this.stats.evictions++;
                this.emit("evict", { key, reason: "capacity" });
            }
        }
    }
    selectEntriesForEviction(newEntrySize) {
        const entries = Array.from(this.cache.entries());
        const keysToEvict = [];
        let freedSize = 0;
        switch (this.config.evictionPolicy) {
            case "lru":
                entries.sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());
                break;
            case "lfu":
                entries.sort(([, a], [, b]) => a.accessCount - b.accessCount);
                break;
            case "fifo":
                entries.sort(([, a], [, b]) => a.createdAt.getTime() - b.createdAt.getTime());
                break;
            case "adaptive":
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
            if (freedSize >= targetSize)
                break;
            keysToEvict.push(key);
            freedSize += entry.size;
        }
        return keysToEvict;
    }
    calculateAdaptiveScore(entry) {
        const now = Date.now();
        const age = now - entry.createdAt.getTime();
        const timeSinceAccess = now - entry.lastAccessed.getTime();
        const sizeRatio = entry.size / this.config.maxMemorySize;
        // Lower score = more likely to be evicted
        return (entry.priority * 0.4 +
            entry.accessCount * 0.3 +
            (1 / (timeSinceAccess + 1)) * 0.2 +
            (1 / (age + 1)) * 0.1 -
            sizeRatio * 0.1);
    }
    getCurrentSize() {
        let totalSize = 0;
        for (const entry of this.cache.values()) {
            totalSize += entry.size;
        }
        return totalSize;
    }
    calculateSize(value) {
        // Rough estimation of object size
        const str = JSON.stringify(value);
        return new Blob([str]).size;
    }
    createEntry(key, value, options = {}) {
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
    isExpired(entry) {
        if (!entry.ttl)
            return false;
        return Date.now() - entry.createdAt.getTime() > entry.ttl;
    }
    matchesQuery(entry, query) {
        if (query.tags && (!entry.tags || !query.tags.some((tag) => entry.tags.includes(tag)))) {
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
    startCleanupTimer() {
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval);
    }
    async cleanup() {
        const keysToDelete = [];
        for (const [key, entry] of this.cache) {
            if (this.isExpired(entry)) {
                keysToDelete.push(key);
            }
        }
        for (const key of keysToDelete) {
            await this.delete(key);
            this.emit("evict", { key, reason: "expired" });
        }
        // Trim access times array to prevent memory leak
        if (this.stats.accessTimes.length > 10000) {
            this.stats.accessTimes = this.stats.accessTimes.slice(-5000);
        }
        this.emit("cleanup", { expiredCount: keysToDelete.length });
    }
    /**
     * Destroy cache manager and cleanup resources
     */
    destroy() {
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
export class LocalStorageCacheAdapter {
    constructor(prefix = "vtt_cache") {
        this.prefix = prefix;
    }
    async get(key) {
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
        }
        catch (error) {
            logger.warn("LocalStorage cache get error:", error);
        }
        return undefined;
    }
    async set(key, value, ttl) {
        try {
            const data = {
                value,
                expires: ttl ? Date.now() + ttl : undefined,
                stored: Date.now(),
            };
            localStorage.setItem(this.prefix + key, JSON.stringify(data));
        }
        catch (error) {
            logger.warn("LocalStorage cache set error:", error);
        }
    }
    async delete(key) {
        localStorage.removeItem(this.prefix + key);
    }
    async clear() {
        const keys = await this.keys();
        for (const key of keys) {
            await this.delete(key);
        }
    }
    async size() {
        const keys = await this.keys();
        return keys.length;
    }
    async keys() {
        const keys = [];
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
        evictionPolicy: "lru",
        compressionEnabled: false,
        persistentStorage: false,
        cleanupInterval: 5 * 60 * 1000, // 5 minutes
    },
    // Large persistent cache for assets
    persistent: {
        maxMemorySize: 200 * 1024 * 1024, // 200MB
        maxEntries: 5000,
        defaultTtl: 24 * 60 * 60 * 1000, // 24 hours
        evictionPolicy: "adaptive",
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
        evictionPolicy: "lfu",
        compressionEnabled: false,
        persistentStorage: false,
        cleanupInterval: 30 * 1000, // 30 seconds
    },
};
//# sourceMappingURL=CacheManager.js.map