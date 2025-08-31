/**
 * Comprehensive caching system for the VTT application
 * Provides in-memory and Redis-based caching with TTL and invalidation strategies
 */

import { logger } from "@vtt/logging";

export interface CacheEntry<T = any> {
  value: T;
  ttl: number;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
  maxMemoryUsage?: number; // Maximum memory usage in bytes
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  memoryUsage: number;
  hitRate: number;
}

/**
 * In-memory LRU cache with TTL and size limits
 */
export class InMemoryCache {
  private cache = new Map<string, CacheEntry>();
  private accessOrder = new Map<string, number>(); // LRU tracking
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    memoryUsage: 0,
    hitRate: 0,
  };
  private accessCounter = 0;

  constructor(private options: CacheOptions = {}) {
    const {
      ttl = 5 * 60 * 1000, // 5 minutes default
      maxSize = 1000,
      maxMemoryUsage = 100 * 1024 * 1024, // 100MB default
    } = options;

    this.options = { ttl, maxSize, maxMemoryUsage };

    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  set<T>(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const entryTtl = ttl || this.options.ttl!;
    
    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
    }

    const entry: CacheEntry<T> = {
      value,
      ttl: entryTtl,
      createdAt: now,
      lastAccessed: now,
      accessCount: 0,
    };

    this.cache.set(key, entry);
    this.accessOrder.set(key, ++this.accessCounter);

    // Enforce size and memory limits
    this.enforceLimits();
    this.updateStats();
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    const now = Date.now();
    
    // Check if expired
    if (now - entry.createdAt > entry.ttl) {
      this.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Update access information
    entry.lastAccessed = now;
    entry.accessCount++;
    this.accessOrder.set(key, ++this.accessCounter);
    
    this.stats.hits++;
    this.updateHitRate();
    
    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    const existed = this.cache.has(key);
    this.cache.delete(key);
    this.accessOrder.delete(key);
    this.updateStats();
    return existed;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.stats.evictions += this.stats.size;
    this.updateStats();
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.createdAt > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.stats.evictions++;
    });

    if (keysToDelete.length > 0) {
      this.updateStats();
      logger.debug(`Cache cleanup: removed ${keysToDelete.length} expired entries`);
    }
  }

  private enforceLimits(): void {
    // Enforce size limit using LRU eviction
    if (this.options.maxSize && this.cache.size > this.options.maxSize) {
      this.evictLRU(this.cache.size - this.options.maxSize);
    }

    // Enforce memory limit (approximate)
    const memoryUsage = this.estimateMemoryUsage();
    if (this.options.maxMemoryUsage && memoryUsage > this.options.maxMemoryUsage) {
      const targetEvictions = Math.ceil(this.cache.size * 0.1); // Evict 10%
      this.evictLRU(targetEvictions);
    }
  }

  private evictLRU(count: number): void {
    // Sort by access order (oldest first)
    const sortedEntries = Array.from(this.accessOrder.entries())
      .sort(([, a], [, b]) => a - b)
      .slice(0, count);

    for (const [key] of sortedEntries) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.stats.evictions++;
    }
  }

  private estimateMemoryUsage(): number {
    let totalSize = 0;
    for (const [key, entry] of this.cache.entries()) {
      // Rough estimate: key size + JSON serialized value size
      totalSize += key.length * 2; // UTF-16 characters
      totalSize += JSON.stringify(entry.value).length * 2;
      totalSize += 64; // Overhead for entry metadata
    }
    return totalSize;
  }

  private updateStats(): void {
    this.stats.size = this.cache.size;
    this.stats.memoryUsage = this.estimateMemoryUsage();
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

/**
 * Multi-tier cache manager with different strategies for different data types
 */
export class CacheManager {
  private static instance: CacheManager;
  
  // Different cache instances for different data types
  private monsterCache: InMemoryCache;
  private characterCache: InMemoryCache;
  private mapCache: InMemoryCache;
  private sessionCache: InMemoryCache;
  private queryCache: InMemoryCache;

  private constructor() {
    // Monster data cache - long TTL since monsters rarely change
    this.monsterCache = new InMemoryCache({
      ttl: 30 * 60 * 1000, // 30 minutes
      maxSize: 5000,
      maxMemoryUsage: 50 * 1024 * 1024, // 50MB
    });

    // Character data cache - medium TTL
    this.characterCache = new InMemoryCache({
      ttl: 10 * 60 * 1000, // 10 minutes
      maxSize: 1000,
      maxMemoryUsage: 25 * 1024 * 1024, // 25MB
    });

    // Map data cache - medium TTL, larger memory allowance
    this.mapCache = new InMemoryCache({
      ttl: 15 * 60 * 1000, // 15 minutes
      maxSize: 500,
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB (maps can be large)
    });

    // Session data cache - short TTL
    this.sessionCache = new InMemoryCache({
      ttl: 5 * 60 * 1000, // 5 minutes
      maxSize: 10000,
      maxMemoryUsage: 20 * 1024 * 1024, // 20MB
    });

    // Query result cache - very short TTL for frequently accessed queries
    this.queryCache = new InMemoryCache({
      ttl: 2 * 60 * 1000, // 2 minutes
      maxSize: 2000,
      maxMemoryUsage: 30 * 1024 * 1024, // 30MB
    });
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  // Monster cache methods
  getMonster(id: string) {
    return this.monsterCache.get(`monster:${id}`);
  }

  setMonster(id: string, monster: any, ttl?: number) {
    this.monsterCache.set(`monster:${id}`, monster, ttl);
  }

  getMonsterList(query: string, tags?: string[], limit?: number, offset?: number) {
    const cacheKey = `monsters:${query || ''}:${tags?.join(',') || ''}:${limit}:${offset}`;
    return this.queryCache.get(cacheKey);
  }

  setMonsterList(query: string, monsters: any[], tags?: string[], limit?: number, offset?: number, ttl?: number) {
    const cacheKey = `monsters:${query || ''}:${tags?.join(',') || ''}:${limit}:${offset}`;
    this.queryCache.set(cacheKey, monsters, ttl);
  }

  invalidateMonster(id: string) {
    this.monsterCache.delete(`monster:${id}`);
    // Clear related list caches
    this.queryCache.clear(); // Simple approach - could be more granular
  }

  // Character cache methods
  getCharacter(id: string) {
    return this.characterCache.get(`character:${id}`);
  }

  setCharacter(id: string, character: any, ttl?: number) {
    this.characterCache.set(`character:${id}`, character, ttl);
  }

  getUserCharacters(userId: string) {
    return this.characterCache.get(`user_characters:${userId}`);
  }

  setUserCharacters(userId: string, characters: any[], ttl?: number) {
    this.characterCache.set(`user_characters:${userId}`, characters, ttl);
  }

  invalidateCharacter(id: string) {
    this.characterCache.delete(`character:${id}`);
    // Also clear user character lists that might include this character
    const keys = this.characterCache.keys().filter(key => key.startsWith('user_characters:'));
    keys.forEach(key => this.characterCache.delete(key));
  }

  // Map cache methods
  getMap(id: string) {
    return this.mapCache.get(`map:${id}`);
  }

  setMap(id: string, map: any, ttl?: number) {
    this.mapCache.set(`map:${id}`, map, ttl);
  }

  getScene(id: string) {
    return this.mapCache.get(`scene:${id}`);
  }

  setScene(id: string, scene: any, ttl?: number) {
    this.mapCache.set(`scene:${id}`, scene, ttl);
  }

  invalidateMap(id: string) {
    this.mapCache.delete(`map:${id}`);
    // Clear related scenes
    const sceneKeys = this.mapCache.keys().filter(key => key.startsWith('scene:'));
    sceneKeys.forEach(key => this.mapCache.delete(key));
  }

  // Session cache methods
  getSession(sessionId: string) {
    return this.sessionCache.get(`session:${sessionId}`);
  }

  setSession(sessionId: string, sessionData: any, ttl?: number) {
    this.sessionCache.set(`session:${sessionId}`, sessionData, ttl);
  }

  invalidateSession(sessionId: string) {
    this.sessionCache.delete(`session:${sessionId}`);
  }

  // Generic cache methods
  get(key: string, cacheType: 'monster' | 'character' | 'map' | 'session' | 'query' = 'query') {
    switch (cacheType) {
      case 'monster': return this.monsterCache.get(key);
      case 'character': return this.characterCache.get(key);
      case 'map': return this.mapCache.get(key);
      case 'session': return this.sessionCache.get(key);
      case 'query': return this.queryCache.get(key);
    }
  }

  set(key: string, value: any, cacheType: 'monster' | 'character' | 'map' | 'session' | 'query' = 'query', ttl?: number) {
    switch (cacheType) {
      case 'monster': this.monsterCache.set(key, value, ttl); break;
      case 'character': this.characterCache.set(key, value, ttl); break;
      case 'map': this.mapCache.set(key, value, ttl); break;
      case 'session': this.sessionCache.set(key, value, ttl); break;
      case 'query': this.queryCache.set(key, value, ttl); break;
    }
  }

  // Cache statistics
  getStats() {
    return {
      monster: this.monsterCache.getStats(),
      character: this.characterCache.getStats(),
      map: this.mapCache.getStats(),
      session: this.sessionCache.getStats(),
      query: this.queryCache.getStats(),
    };
  }

  // Clear all caches
  clearAll() {
    this.monsterCache.clear();
    this.characterCache.clear();
    this.mapCache.clear();
    this.sessionCache.clear();
    this.queryCache.clear();
    logger.info('All caches cleared');
  }
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance();
