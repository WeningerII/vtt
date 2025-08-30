/**
 * Unified Asset Manager - Consolidates asset handling across all VTT systems
 * Provides comprehensive asset loading, caching, processing, and management
 */

import { EventEmitter, SystemEvents } from './EventEmitter';
import { logger } from '@vtt/logging';
import { 
  AssetManager as IAssetManager, 
  AssetInfo, 
  AssetType, 
  AssetLoadOptions,
  Disposable 
} from './SharedInterfaces';

export interface AssetManagerConfig {
  maxCacheSize: number;
  maxConcurrentLoads: number;
  enableCompression: boolean;
  enableCaching: boolean;
  defaultTimeout: number;
  retryAttempts: number;
  cachePersistence: boolean;
}

export interface ProcessingPipeline {
  name: string;
  process: (data: any, asset: AssetInfo) => Promise<any>;
  priority: number;
  enabled: boolean;
}

export interface AssetBundle {
  id: string;
  name: string;
  assets: string[];
  metadata: Record<string, any>;
  loadedAt?: Date;
}

export class UnifiedAssetManager extends EventEmitter<SystemEvents> implements IAssetManager {
  private config: AssetManagerConfig;
  private assets = new Map<string, AssetInfo>();
  private cache = new Map<string, any>();
  private loadingPromises = new Map<string, Promise<any>>();
  private bundles = new Map<string, AssetBundle>();
  private processingPipelines = new Map<string, ProcessingPipeline[]>();
  
  private currentLoads = 0;
  private totalCacheSize = 0;
  private assetCounter = 0;

  constructor(config: Partial<AssetManagerConfig> = {}) {
    super();
    
    this.config = {
      maxCacheSize: 512 * 1024 * 1024, // 512MB
      maxConcurrentLoads: 10,
      enableCompression: false,
      enableCaching: true,
      defaultTimeout: 30000,
      retryAttempts: 3,
      cachePersistence: true,
      ...config
    };

    this.initializeProcessingPipelines();
  }

  /**
   * Initialize the asset manager
   */
  async initialize(): Promise<void> {
    try {
      if (this.config.cachePersistence) {
        await this.loadCacheFromStorage();
      }
      
      this.emit('ready', undefined);
    } catch (error) {
      logger.error('Failed to initialize asset manager:', error);
      throw error;
    }
  }

  /**
   * Register an asset
   */
  async register(path: string, type: AssetType, metadata: Record<string, any> = {}): Promise<string> {
    const id = this.generateAssetId();
    const checksum = await this.calculateChecksum(path);
    
    const assetInfo: AssetInfo = {
      id,
      path,
      type,
      format: this.detectFormat(path),
      size: 0, // Will be updated on load
      checksum,
      metadata,
      dependencies: metadata.dependencies || []
    };

    this.assets.set(id, assetInfo);
    return id;
  }

  /**
   * Load an asset
   */
  async load<T = any>(id: string, options: AssetLoadOptions = {}): Promise<T> {
    const asset = this.assets.get(id);
    if (!asset) {
      throw new Error(`Asset with id '${id}' not found`);
    }

    // Check cache first
    if (this.config.enableCaching && this.cache.has(id)) {
      return this.cache.get(id);
    }

    // Check if already loading
    if (this.loadingPromises.has(id)) {
      return this.loadingPromises.get(id)!;
    }

    // Check concurrent load limit
    if (this.currentLoads >= this.config.maxConcurrentLoads) {
      await this.waitForLoadSlot();
    }

    const loadPromise = this.performLoad<T>(asset, options);
    this.loadingPromises.set(id, loadPromise);

    try {
      const result = await loadPromise;
      
      // Cache the result
      if (this.config.enableCaching && (options.cache !== false)) {
        this.addToCache(id, result, asset);
      }
      
      asset.loadedAt = new Date();
      return result;
    } finally {
      this.loadingPromises.delete(id);
      this.currentLoads--;
    }
  }

  /**
   * Unload an asset from cache
   */
  unload(id: string): void {
    if (this.cache.has(id)) {
      const asset = this.assets.get(id);
      if (asset) {
        this.totalCacheSize -= asset.size;
      }
      this.cache.delete(id);
    }
  }

  /**
   * Get cached asset data
   */
  get<T = any>(id: string): T | null {
    return this.cache.get(id) || null;
  }

  /**
   * Get asset information
   */
  getInfo(id: string): AssetInfo | null {
    return this.assets.get(id) || null;
  }

  /**
   * Query assets by filter
   */
  query(filter: Partial<AssetInfo>): AssetInfo[] {
    const results: AssetInfo[] = [];
    
    for (const asset of this.assets.values()) {
      let matches = true;
      
      for (const [key, value] of Object.entries(filter)) {
        if (key === 'metadata') {
          // Handle metadata filtering
          for (const [metaKey, metaValue] of Object.entries(value as Record<string, any>)) {
            if (asset.metadata[metaKey] !== metaValue) {
              matches = false;
              break;
            }
          }
        } else if ((asset as any)[key] !== value) {
          matches = false;
          break;
        }
      }
      
      if (matches) {
        results.push(asset);
      }
    }
    
    return results;
  }

  /**
   * Create asset bundle
   */
  createBundle(name: string, assetIds: string[], metadata: Record<string, any> = {}): string {
    const id = this.generateBundleId();
    const bundle: AssetBundle = {
      id,
      name,
      assets: assetIds,
      metadata
    };

    this.bundles.set(id, bundle);
    return id;
  }

  /**
   * Load asset bundle
   */
  async loadBundle(bundleId: string, options: AssetLoadOptions = {}): Promise<Record<string, any>> {
    const bundle = this.bundles.get(bundleId);
    if (!bundle) {
      throw new Error(`Bundle with id '${bundleId}' not found`);
    }

    const results: Record<string, any> = {};
    const loadPromises = bundle.assets.map(async (assetId) => {
      const asset = await this.load(assetId, options);
      results[assetId] = asset;
    });

    await Promise.all(loadPromises);
    bundle.loadedAt = new Date();
    
    return results;
  }

  /**
   * Add processing pipeline for asset type
   */
  addProcessingPipeline(assetType: AssetType, pipeline: ProcessingPipeline): void {
    if (!this.processingPipelines.has(assetType)) {
      this.processingPipelines.set(assetType, []);
    }
    
    const pipelines = this.processingPipelines.get(assetType)!;
    pipelines.push(pipeline);
    pipelines.sort((_a, _b) => b.priority - a.priority);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { 
    size: number; 
    maxSize: number; 
    items: number; 
    hitRate: number;
    totalLoads: number;
  } {
    return {
      size: this.totalCacheSize,
      maxSize: this.config.maxCacheSize,
      items: this.cache.size,
      hitRate: 0, // Would track in real implementation
      totalLoads: this.assetCounter
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.totalCacheSize = 0;
  }

  /**
   * Preload assets
   */
  async preload(assetIds: string[], options: AssetLoadOptions = {}): Promise<void> {
    const loadPromises = assetIds.map(id => this.load(id, options));
    await Promise.all(loadPromises);
  }

  /**
   * Get all asset IDs by type
   */
  getAssetIdsByType(type: AssetType): string[] {
    const results: string[] = [];
    for (const [id, asset] of this.assets) {
      if (asset.type === type) {
        results.push(id);
      }
    }
    return results;
  }

  /**
   * Dispose of the asset manager
   */
  dispose(): void {
    this.clearCache();
    this.assets.clear();
    this.bundles.clear();
    this.loadingPromises.clear();
    this.processingPipelines.clear();
    this.removeAllListeners();
  }

  // Private helper methods

  private async performLoad<T>(asset: AssetInfo, options: AssetLoadOptions): Promise<T> {
    this.currentLoads++;
    
    try {
      let data = await this.fetchAsset(asset, options);
      
      // Apply processing pipelines
      const pipelines = this.processingPipelines.get(asset.type) || [];
      for (const pipeline of pipelines) {
        if (pipeline.enabled) {
          data = await pipeline.process(data, asset);
        }
      }

      // Apply custom transform
      if (options.transform) {
        data = options.transform(data);
      }

      // Update asset size
      asset.size = this.estimateDataSize(data);
      
      return data;
    } catch (error) {
      logger.error(`Failed to load asset ${asset.id}:`, error);
      throw error;
    }
  }

  private async fetchAsset(asset: AssetInfo, options: AssetLoadOptions): Promise<any> {
    const timeout = options.timeout || this.config.defaultTimeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(asset.path, {
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Determine how to parse based on asset type
      switch (asset.type) {
        case 'texture':
          return await this.loadImageData(response);
        case 'audio':
          return await response.arrayBuffer();
        case 'model':
          return await response.arrayBuffer();
        case 'data':
          return await response.json();
        case 'shader':
          return await response.text();
        default:
          return await response.arrayBuffer();
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async loadImageData(response: Response): Promise<ImageBitmap> {
    const blob = await response.blob();
    return createImageBitmap(blob);
  }

  private addToCache(id: string, data: any, asset: AssetInfo): void {
    // Check if adding would exceed cache size
    if (this.totalCacheSize + asset.size > this.config.maxCacheSize) {
      this.evictCacheItems(asset.size);
    }

    this.cache.set(id, data);
    this.totalCacheSize += asset.size;
  }

  private evictCacheItems(requiredSpace: number): void {
    // Simple LRU-style eviction based on loadedAt timestamp
    const sortedAssets = Array.from(this.assets.entries())
      .filter(_([id]) => this.cache.has(id))
      .sort(_([, _a], _[, _b]) => {
        const aTime = a.loadedAt?.getTime() || 0;
        const bTime = b.loadedAt?.getTime() || 0;
        return aTime - bTime;
      });

    let freedSpace = 0;
    for (const [id, asset] of sortedAssets) {
      if (freedSpace >= requiredSpace) break;
      
      this.cache.delete(id);
      freedSpace += asset.size;
      this.totalCacheSize -= asset.size;
    }
  }

  private async waitForLoadSlot(): Promise<void> {
    return new Promise(_resolve => {
      const checkSlot = () => {
        if (this.currentLoads < this.config.maxConcurrentLoads) {
          resolve();
        } else {
          setTimeout(checkSlot, 100);
        }
      };
      checkSlot();
    });
  }

  private async calculateChecksum(path: string): Promise<string> {
    // Simple checksum based on path - would use actual file content in production
    const encoder = new TextEncoder();
    const data = encoder.encode(path);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private detectFormat(path: string): string {
    const extension = path.split('.').pop()?.toLowerCase() || '';
    const formatMap: Record<string, string> = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'webp': 'image/webp',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'gltf': 'model/gltf+json',
      'glb': 'model/gltf-binary',
      'obj': 'model/obj',
      'json': 'application/json',
      'wgsl': 'text/wgsl',
      'glsl': 'text/glsl'
    };
    return formatMap[extension] || 'application/octet-stream';
  }

  private estimateDataSize(data: any): number {
    if (data instanceof ArrayBuffer) {
      return data.byteLength;
    } else if (data instanceof ImageBitmap) {
      return data.width * data.height * 4; // Assume RGBA
    } else if (typeof data === 'string') {
      return new TextEncoder().encode(data).length;
    } else if (typeof data === 'object') {
      return new TextEncoder().encode(JSON.stringify(data)).length;
    }
    return 1024; // Default estimate
  }

  private generateAssetId(): string {
    return `asset_${++this.assetCounter}_${Date.now()}`;
  }

  private generateBundleId(): string {
    return `bundle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async loadCacheFromStorage(): Promise<void> {
    // Placeholder for cache persistence - would implement with IndexedDB or similar
    try {
      const savedCache = localStorage.getItem('vtt_asset_cache');
      if (savedCache) {
        const _cacheData = JSON.parse(savedCache);
        // Would restore cache data here
      }
    } catch (error) {
      logger.warn('Failed to load asset cache from storage:', error);
    }
  }

  private initializeProcessingPipelines(): void {
    // Texture processing pipeline
    this.addProcessingPipeline('texture', _{
      name: 'texture_optimizer',
      _process: async (data: ImageBitmap) => {
        // Placeholder for texture optimization
        return data;
      },
      priority: 10,
      enabled: true
    });

    // Audio processing pipeline
    this.addProcessingPipeline('audio', _{
      name: 'audio_decoder',
      _process: async (data: ArrayBuffer) => {
        // Placeholder for audio decoding
        return data;
      },
      priority: 10,
      enabled: true
    });

    // Model processing pipeline
    this.addProcessingPipeline('model', _{
      name: 'model_parser',
      _process: async (data: ArrayBuffer) => {
        // Placeholder for model parsing
        return data;
      },
      priority: 10,
      enabled: true
    });

    // Data processing pipeline
    this.addProcessingPipeline('data', _{
      name: 'data_validator',
      _process: async (data: any) => {
        // Placeholder for data validation
        return data;
      },
      priority: 10,
      enabled: true
    });
  }
}
