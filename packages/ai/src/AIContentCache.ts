import { EventEmitter } from 'events';
import { CacheManager, CacheConfig } from '@vtt/performance/CacheManager';
import { AIProvider } from './types';
import { logger } from '@vtt/logging';

export interface AIContentCacheConfig {
  textGenerationCache: Partial<CacheConfig>;
  imageAnalysisCache: Partial<CacheConfig>;
  behaviorCache: Partial<CacheConfig>;
  dialogueCache: Partial<CacheConfig>;
  enablePredictiveCache: boolean;
  maxPredictiveCacheSize: number;
  cacheHitThreshold: number; // Minimum hits to trigger predictive caching
}

export interface CachedContent {
  key: string;
  content: any;
  contentType: 'text' | 'analysis' | 'behavior' | 'dialogue';
  prompt: string;
  model: string;
  parameters: Record<string, any>;
  generatedAt: Date;
  accessCount: number;
  lastAccessed: Date;
  averageGenerationTime: number;
  tokens?: number;
  cost?: number;
}

export interface CacheAnalytics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  tokensGenerated: number;
  tokensSaved: number;
  estimatedCostSaved: number;
  averageResponseTime: number;
  topCachedContent: Array<{
    key: string;
    hits: number;
    content: string;
  }>;
}

export interface PredictiveCacheEntry {
  prompt: string;
  model: string;
  parameters: Record<string, any>;
  predictedUseTime: number;
  priority: number;
}

/**
 * Advanced AI content caching system with predictive caching and analytics
 */
export class AIContentCache extends EventEmitter {
  private textCache: CacheManager;
  private imageCache: CacheManager;
  private behaviorCache: CacheManager;
  private dialogueCache: CacheManager;
  private config: AIContentCacheConfig;
  private analytics: {
    requests: number;
    hits: number;
    misses: number;
    responseTimes: number[];
    tokensGenerated: number;
    tokensSaved: number;
    costSaved: number;
  };
  private contentMetrics: Map<string, CachedContent>;
  private predictiveQueue: PredictiveCacheEntry[];

  constructor(config: AIContentCacheConfig) {
    super();
    this.config = config;
    this.analytics = {
      requests: 0,
      hits: 0,
      misses: 0,
      responseTimes: [],
      tokensGenerated: 0,
      tokensSaved: 0,
      costSaved: 0
    };
    this.contentMetrics = new Map();
    this.predictiveQueue = [];

    // Initialize cache managers with explicit config properties
    this.textCache = new CacheManager({
      maxMemorySize: config.textGenerationCache.maxMemorySize || 1024 * 1024 * 10, // 10MB
      maxEntries: config.textGenerationCache.maxEntries || 1000,
      defaultTtl: config.textGenerationCache.defaultTtl || 3600000,
      evictionPolicy: config.textGenerationCache.evictionPolicy || 'lru',
      compressionEnabled: config.textGenerationCache.compressionEnabled || false,
      persistentStorage: config.textGenerationCache.persistentStorage || false,
      cleanupInterval: config.textGenerationCache.cleanupInterval || 300000
    });

    this.imageCache = new CacheManager({
      maxMemorySize: config.imageAnalysisCache.maxMemorySize || 1024 * 1024 * 50, // 50MB
      maxEntries: config.imageAnalysisCache.maxEntries || 500,
      defaultTtl: config.imageAnalysisCache.defaultTtl || 7200000,
      evictionPolicy: config.imageAnalysisCache.evictionPolicy || 'lru',
      compressionEnabled: config.imageAnalysisCache.compressionEnabled || false,
      persistentStorage: config.imageAnalysisCache.persistentStorage || false,
      cleanupInterval: config.imageAnalysisCache.cleanupInterval || 300000
    });

    this.behaviorCache = new CacheManager({
      maxMemorySize: config.behaviorCache.maxMemorySize || 1024 * 1024 * 20, // 20MB
      maxEntries: config.behaviorCache.maxEntries || 2000,
      defaultTtl: config.behaviorCache.defaultTtl || 1800000,
      evictionPolicy: config.behaviorCache.evictionPolicy || 'lru',
      compressionEnabled: config.behaviorCache.compressionEnabled || false,
      persistentStorage: config.behaviorCache.persistentStorage || false,
      cleanupInterval: config.behaviorCache.cleanupInterval || 300000
    });

    this.dialogueCache = new CacheManager({
      maxMemorySize: config.dialogueCache.maxMemorySize || 1024 * 1024 * 15, // 15MB
      maxEntries: config.dialogueCache.maxEntries || 1500,
      defaultTtl: config.dialogueCache.defaultTtl || 2700000,
      evictionPolicy: config.dialogueCache.evictionPolicy || 'lru',
      compressionEnabled: config.dialogueCache.compressionEnabled || false,
      persistentStorage: config.dialogueCache.persistentStorage || false,
      cleanupInterval: config.dialogueCache.cleanupInterval || 300000
    });

    this.setupCacheEventHandlers();
    
    if (config.enablePredictiveCache) {
      this.startPredictiveCaching();
    }
  }

  /**
   * Cache-aware text generation
   */
  async generateText(
    provider: AIProvider,
    request: {
      prompt: string;
      maxTokens?: number;
      temperature?: number;
      model?: string;
      [key: string]: any;
    }
  ): Promise<any> {
    const startTime = performance.now();
    this.analytics.requests++;

    const cacheKey = this.generateCacheKey('text', request.prompt, request.model || 'default', request);
    
    // Try cache first
    const cached = await this.textCache.get<any>(cacheKey);
    if (cached) {
      this.analytics.hits++;
      this.updateContentMetrics(cacheKey, 'text', request.prompt, request.model || 'default', request, cached, true);
      
      const responseTime = performance.now() - startTime;
      this.analytics.responseTimes.push(responseTime);
      
      this.emit('cacheHit', { type: 'text', key: cacheKey, responseTime });
      return { ...cached, fromCache: true };
    }

    // Generate new content
    this.analytics.misses++;
    
    if (!provider.generateText) {
      throw new Error(`Provider ${provider.name} does not support text generation`);
    }

    const response = await provider.generateText(request);
    const responseTime = performance.now() - startTime;
    this.analytics.responseTimes.push(responseTime);

    if (response && response.text) {
      // Cache the response
      const cacheOptions = {
        ttl: this.calculateTTL('text', request),
        priority: this.calculatePriority('text', request),
        tags: this.generateTags('text', request),
        metadata: {
          model: request.model,
          tokens: response.tokensUsed?.total || 0,
          cost: response.costUSD || 0,
          generationTime: responseTime
        }
      };

      await this.textCache.set(cacheKey, response, cacheOptions);
      this.updateContentMetrics(cacheKey, 'text', request.prompt, request.model || 'default', request, response, false);
      
      // Track analytics
      if (response.tokensUsed?.total) {
        this.analytics.tokensGenerated += response.tokensUsed.total;
      }

      this.emit('cacheMiss', { type: 'text', key: cacheKey, responseTime, cached: true });
      
      // Consider for predictive caching
      if (this.config.enablePredictiveCache) {
        this.considerPredictiveCache('text', request);
      }
    } else {
      this.emit('cacheMiss', { type: 'text', key: cacheKey, responseTime, cached: false, error: 'Generation failed' });
    }

    return response;
  }

  /**
   * Cache-aware image analysis
   */
  async analyzeImage(
    provider: AIProvider,
    request: {
      image: string | ArrayBuffer;
      prompt: string;
      model?: string;
      [key: string]: any;
    }
  ): Promise<any> {
    if (!provider.analyzeImage) {
      throw new Error(`Provider ${provider.name} does not support image analysis`);
    }

    const startTime = performance.now();
    this.analytics.requests++;

    const imageHash = this.hashImageData(request.image);
    const cacheKey = this.generateCacheKey('image', request.prompt + imageHash, request.model || 'default', request);
    
    // Try cache first
    try {
      const cached = await this.imageCache.get<any>(cacheKey);
      if (cached) {
        this.analytics.hits++;
        this.updateContentMetrics(cacheKey, 'analysis', request.prompt, request.model || 'default', request, cached, true);
        
        const responseTime = performance.now() - startTime;
        this.analytics.responseTimes.push(responseTime);
        
        this.emit('cacheHit', { type: 'image', key: cacheKey, responseTime });
        return { ...cached, fromCache: true };
      }
    } catch (error) {
      this.emit('cacheError', { type: 'image', key: cacheKey, error: error as any });
    }

    // Analyze new image
    this.analytics.misses++;
    const response = await provider.analyzeImage({
      image: { uri: typeof request.image === 'string' ? request.image : 'data:image/jpeg;base64,' + request.image.toString() },
      prompt: request.prompt,
      ...(request.model && { model: request.model })
    });
    const responseTime = performance.now() - startTime;
    this.analytics.responseTimes.push(responseTime);

    if (response && response.analysis) {
      // Cache the analysis - images are expensive so longer TTL
      const cacheOptions = {
        ttl: this.calculateTTL('image', request),
        priority: this.calculatePriority('image', request),
        tags: this.generateTags('image', request),
        metadata: {
          model: request.model,
          imageHash,
          analysisTime: responseTime
        }
      };

      await this.imageCache.set(cacheKey, response, cacheOptions);
      this.updateContentMetrics(cacheKey, 'analysis', request.prompt, request.model || 'default', request, response, false);
      
      this.emit('cacheMiss', { type: 'image', key: cacheKey, responseTime, cached: true });
    } else {
      this.emit('cacheMiss', { type: 'image', key: cacheKey, responseTime, cached: false });
    }

    return response;
  }

  /**
   * Get analytics data
   */
  getAnalytics(): CacheAnalytics {
    const totalRequests = this.analytics.requests || 0;
    const hitRate = totalRequests > 0 ? (this.analytics.hits / totalRequests) * 100 : 0;
    const avgResponseTime = this.analytics.responseTimes.length > 0 
      ? this.analytics.responseTimes.reduce((a, b) => a + b, 0) / this.analytics.responseTimes.length 
      : 0;

    // Get top cached content
    const contentArray = Array.from(this.contentMetrics.values());
    const topContent = contentArray
      .sort((a, b) => (b as any).accessCount - (a as any).accessCount)
      .slice(0, 10)
      .map(content => ({
        key: (content as any).key,
        hits: (content as any).accessCount,
        content: (content as any).prompt?.substring(0, 100) || 'Unknown'
      }));

    return {
      totalRequests,
      cacheHits: this.analytics.hits || 0,
      cacheMisses: this.analytics.misses || 0,
      hitRate,
      tokensGenerated: this.analytics.tokensGenerated || 0,
      tokensSaved: this.analytics.tokensSaved || 0,
      estimatedCostSaved: this.analytics.costSaved || 0,
      averageResponseTime: avgResponseTime,
      topCachedContent: topContent
    };
  }

  /**
   * Invalidate cache entries by type or query
   */
  async invalidateCache(
    type?: 'text' | 'image' | 'behavior' | 'dialogue',
    query?: string
  ): Promise<number> {
    let totalInvalidated = 0;
    const caches = type ? [this.getCacheByType(type)] : [this.textCache, this.imageCache, this.behaviorCache, this.dialogueCache];
    
    for (const cache of caches) {
      if (!cache) continue;
      
      if (query) {
        // Invalidate entries matching query - simplified approach
        const entries = Array.from((cache as any).cache?.keys() || []) as string[];
        const matchingKeys = entries.filter((key: string) => key.includes(query));
        for (const key of matchingKeys) {
          await cache.delete(key);
          totalInvalidated++;
        }
      } else {
        // Clear entire cache
        await cache.clear();
        totalInvalidated += (cache as any).cache?.size || 0;
      }
    }

    this.emit('cacheInvalidation', { type, query, totalInvalidated });
    return totalInvalidated;
  }

  /**
   * Warm up cache with common requests
   */
  async warmupCache(provider: AIProvider, warmupData: Array<{ type: string; request: any }>): Promise<void> {
    if (!warmupData?.length) return;

    const promises = warmupData.map(async ({ type, request }) => {
      try {
        if (type === 'text' && provider.generateText) {
          return this.generateText(provider, request as any);
        } else if (type === 'image' && provider.analyzeImage) {
          return this.analyzeImage(provider, request as any);
        }
      } catch (error) {
        logger.warn(`Warmup failed for ${type}:`, error as any);
      }
    });

    await Promise.allSettled(promises);
    this.emit('cacheWarmup', { requests: warmupData.length });
  }

  // Private helper methods
  private generateCacheKey(
    type: string,
    content: string,
    model: string,
    parameters: Record<string, any>
  ): string {
    const paramStr = parameters ? JSON.stringify(parameters) : '';
    const hash = this.simpleHash(content + model + paramStr);
    return `${type}:${hash}`;
  }

  private calculateTTL(type: string, request: any): number {
    switch (type) {
      case 'text': return 3600000; // 1 hour
      case 'image': return 7200000; // 2 hours
      case 'behavior': return 1800000; // 30 minutes
      case 'dialogue': return 2700000; // 45 minutes
      default: return 3600000;
    }
  }

  private calculatePriority(type: string, request: any): number {
    switch (type) {
      case 'text': return 1;
      case 'image': return 2;
      case 'behavior': return 1;
      case 'dialogue': return 1;
      default: return 1;
    }
  }

  private generateTags(type: string, request: any): string[] {
    const tags = [type];
    if (request.model) tags.push(`model:${request.model}`);
    if (request.temperature) tags.push(`temp:${request.temperature}`);
    if (request.maxTokens) tags.push(`tokens:${request.maxTokens}`);
    return tags;
  }

  private updateContentMetrics(
    key: string,
    contentType: CachedContent['contentType'],
    prompt: string,
    model: string,
    parameters: Record<string, any>,
    content: any,
    wasHit: boolean
  ): void {
    let metrics = this.contentMetrics.get(key);
    if (!metrics) {
      metrics = {
        key,
        content,
        contentType,
        prompt,
        model,
        parameters,
        generatedAt: new Date(),
        accessCount: 0,
        lastAccessed: new Date(),
        averageGenerationTime: 0,
        tokens: content.tokensUsed?.total || 0,
        cost: content.costUSD || 0
      };
      this.contentMetrics.set(key, metrics);
    }

    metrics.accessCount++;
    metrics.lastAccessed = new Date();
    
    if (wasHit) {
      this.analytics.tokensSaved += metrics.tokens || 0;
      this.analytics.costSaved += metrics.cost || 0;
    }
  }

  private considerPredictiveCache(type: string, request: any): void {
    const key = this.generateCacheKey(type, request.prompt, request.model || 'default', request);
    const metrics = this.contentMetrics.get(key);
    
    if (metrics && metrics.accessCount >= this.config.cacheHitThreshold) {
      // Generate related prompts for predictive caching
      const relatedPrompts = this.generateRelatedPrompts(request.prompt);
      
      for (const relatedPrompt of relatedPrompts) {
        this.addToPredictiveQueue({
          prompt: relatedPrompt,
          model: request.model || 'default',
          parameters: request as Record<string, any>,
          predictedUseTime: Date.now() + 300000, // 5 minutes from now
          priority: metrics.accessCount
        });
      }
    }
  }

  private generateRelatedPrompts(originalPrompt: string): string[] {
    // Simple related prompt generation - in production, this could use AI
    const variations = [
      originalPrompt.replace(/\b(he|she|it)\b/gi, 'they'),
      originalPrompt.replace(/\b(his|her|its)\b/gi, 'their'),
      originalPrompt + ' Please be more specific.',
      originalPrompt + ' What are the implications?'
    ];
    
    return variations.filter(v => v !== originalPrompt);
  }

  private addToPredictiveQueue(entry: PredictiveCacheEntry): void {
    if (this.predictiveQueue.length >= this.config.maxPredictiveCacheSize) {
      // Remove lowest priority entry
      this.predictiveQueue.sort((a, b) => a.priority - b.priority);
      this.predictiveQueue.shift();
    }
    
    this.predictiveQueue.push(entry);
  }

  private processPredictiveCache(): void {
    const now = Date.now();
    const readyEntries = this.predictiveQueue.filter(entry => entry.predictedUseTime <= now);
    
    if (readyEntries.length === 0) return;
    
    // Process one entry to avoid overwhelming the system
    const entry = readyEntries[0];
    this.predictiveQueue = this.predictiveQueue.filter(e => e !== entry);
    
    try {
      // This would need an AIProvider instance - in production, maintain a reference
      this.emit('predictiveCache', { entry: entry as any, success: true });
    } catch (error) {
      this.emit('predictiveCache', { entry: entry as any, success: false, error: error as any });
      logger.warn('Predictive caching failed:', error as any);
    }
  }

  private getCacheByType(type: string): CacheManager | null {
    switch (type) {
      case 'text': return this.textCache;
      case 'image': return this.imageCache;
      case 'behavior': return this.behaviorCache;
      case 'dialogue': return this.dialogueCache;
      default: return null;
    }
  }

  private setupCacheEventHandlers(): void {
    // Set up event handlers for cache events
    this.on('cacheHit', (data) => {
      logger.debug('Cache hit:', data);
    });

    this.on('cacheMiss', (data) => {
      logger.debug('Cache miss:', data);
    });

    this.on('cacheError', (data) => {
      logger.error('Cache error:', data);
    });
  }

  private startPredictiveCaching(): void {
    // Start predictive caching interval
    setInterval(() => {
      this.processPredictiveCache();
    }, 60000); // Check every minute
  }

  private hashImageData(image: string | ArrayBuffer): string {
    // Simple hash for image data
    const str = typeof image === 'string' ? image : image.toString();
    return this.simpleHash(str.substring(0, 1000)); // Hash first 1000 chars
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}
