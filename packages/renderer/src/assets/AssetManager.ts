import { _TextureManager } from "../engine/TextureManager";
import { _GeometryManager } from "../engine/GeometryManager";

export enum AssetType {
  TEXTURE = "texture",
  MODEL = "model",
  AUDIO = "audio",
  MATERIAL = "material",
  SHADER = "shader",
  ANIMATION = "animation",
  FONT = "font",
  JSON = "json",
  BINARY = "binary",
}

export enum AssetState {
  UNLOADED = "unloaded",
  LOADING = "loading",
  LOADED = "loaded",
  ERROR = "error",
  UNLOADING = "unloading",
}

export interface AssetMetadata {
  id: string;
  path: string;
  type: AssetType;
  size?: number;
  dependencies?: string[];
  tags?: string[];
  version?: string;
  checksum?: string;
  lastModified?: number;
  [key: string]: any;
}

export interface LoadedAsset<T = any> {
  metadata: AssetMetadata;
  data: T;
  state: AssetState;
  loadTime: number;
  lastAccessed: number;
  referenceCount: number;
  error?: Error;
}

export interface AssetLoadOptions {
  priority?: number;
  timeout?: number;
  retries?: number;
  cache?: boolean;
  dependencies?: boolean;
  [key: string]: any;
}

export interface AssetLoader<T = any> {
  supportedTypes: AssetType[];
  load(metadata: AssetMetadata, options?: AssetLoadOptions): Promise<T>;
  unload?(asset: LoadedAsset<T>): void;
  validate?(data: T): boolean;
}

export class AssetManager {
  private assets = new Map<string, LoadedAsset>();
  private loaders = new Map<AssetType, AssetLoader>();
  private loadingQueue: { metadata: AssetMetadata; options?: AssetLoadOptions }[] = [];
  private loadingPromises = new Map<string, Promise<any>>();
  private dependencies = new Map<string, Set<string>>();
  private dependents = new Map<string, Set<string>>();

  // Configuration
  private maxCacheSize = 1024 * 1024 * 512; // 512MB default
  private maxConcurrentLoads = 8;
  private currentLoads = 0;
  private gcThreshold = 0.9; // Trigger GC when 90% full

  // Statistics
  private stats = {
    totalLoads: 0,
    totalLoadTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0,
    currentMemoryUsage: 0,
  };

  constructor() {
    this.setupDefaultLoaders();
    this.startGarbageCollector();
  }

  private setupDefaultLoaders(): void {
    // Register built-in loaders
    this.registerLoader(new TextureLoader());
    this.registerLoader(new ModelLoader());
    this.registerLoader(new AudioLoader());
    this.registerLoader(new JSONLoader());
    this.registerLoader(new BinaryLoader());
    this.registerLoader(new MaterialLoader());
    this.registerLoader(new ShaderLoader());
  }

  registerLoader(loader: AssetLoader): void {
    for (const type of loader.supportedTypes) {
      this.loaders.set(type, loader);
    }
  }

  async loadAsset<T = any>(
    metadata: AssetMetadata,
    options: AssetLoadOptions = {},
  ): Promise<LoadedAsset<T>> {
    const { id, _type } = metadata;

    // Check if already loaded
    if (this.assets.has(id)) {
      const asset = this.assets.get(id)! as LoadedAsset<T>;
      asset.lastAccessed = Date.now();
      asset.referenceCount++;
      this.stats.cacheHits++;
      return asset;
    }

    // Check if already loading
    if (this.loadingPromises.has(id)) {
      return this.loadingPromises.get(id)!;
    }

    this.stats.cacheMisses++;

    // Create loading promise
    const loadingPromise = this._loadAsset<T>(metadata, options);
    this.loadingPromises.set(id, loadingPromise);

    try {
      const asset = await loadingPromise;
      this.loadingPromises.delete(id);
      return asset;
    } catch (error) {
      this.loadingPromises.delete(id);
      throw error;
    }
  }

  private async _loadAsset<T>(
    metadata: AssetMetadata,
    options: AssetLoadOptions,
  ): Promise<LoadedAsset<T>> {
    const { id, type } = metadata;

    // Wait for available slot if at max concurrent loads
    while (this.currentLoads >= this.maxConcurrentLoads) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    this.currentLoads++;

    try {
      // Load dependencies first
      if (options.dependencies !== false && metadata.dependencies) {
        await this.loadDependencies(metadata.dependencies, options);
        this.trackDependencies(id, metadata.dependencies);
      }

      // Get appropriate loader
      const loader = this.loaders.get(type);
      if (!loader) {
        throw new Error(`No loader registered for asset type: ${type}`);
      }

      // Create asset entry
      const asset: LoadedAsset<T> = {
        metadata,
        data: null as any,
        state: AssetState.LOADING,
        loadTime: 0,
        lastAccessed: Date.now(),
        referenceCount: 1,
      };

      this.assets.set(id, asset);

      const startTime = Date.now();

      // Load asset data
      const data = await this.withTimeout(loader.load(metadata, options), options.timeout || 30000);

      // Validate if loader supports validation
      if (loader.validate && !loader.validate(data)) {
        throw new Error(`Asset validation failed: ${id}`);
      }

      const loadTime = Date.now() - startTime;

      // Update asset
      asset.data = data;
      asset.state = AssetState.LOADED;
      asset.loadTime = loadTime;

      // Update statistics
      this.stats.totalLoads++;
      this.stats.totalLoadTime += loadTime;
      this.updateMemoryUsage();

      // Trigger garbage collection if needed
      if (this.stats.currentMemoryUsage > this.maxCacheSize * this.gcThreshold) {
        this.runGarbageCollection();
      }

      return asset;
    } catch (error) {
      this.stats.errors++;

      // Update asset state if it exists
      const asset = this.assets.get(id);
      if (asset) {
        asset.state = AssetState.ERROR;
        asset.error = error as Error;
      }

      throw error;
    } finally {
      this.currentLoads--;
    }
  }

  private async loadDependencies(dependencies: string[], options: AssetLoadOptions): Promise<void> {
    const depPromises = dependencies.map(async (depId) => {
      // Try to resolve dependency metadata
      // In a real implementation, you'd have a registry or discovery mechanism
      const depMetadata = await this.resolveDependencyMetadata(depId);
      return this.loadAsset(depMetadata, { ...options, dependencies: true });
    });

    await Promise.all(depPromises);
  }

  private async resolveDependencyMetadata(id: string): Promise<AssetMetadata> {
    // This is a placeholder - in a real system you'd have an asset registry
    // or discovery mechanism to resolve asset IDs to metadata
    return {
      id,
      path: `/assets/${id}`,
      type: AssetType.TEXTURE, // Default assumption
    };
  }

  private trackDependencies(assetId: string, dependencies: string[]): void {
    this.dependencies.set(assetId, new Set(dependencies));

    for (const depId of dependencies) {
      if (!this.dependents.has(depId)) {
        this.dependents.set(depId, new Set());
      }
      this.dependents.get(depId)!.add(assetId);
    }
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error("Asset load timeout")), timeoutMs);
      }),
    ]);
  }

  unloadAsset(id: string): void {
    const asset = this.assets.get(id);
    if (!asset) return;

    asset.referenceCount--;

    // Only unload if no more references
    if (asset.referenceCount <= 0) {
      this._unloadAsset(id);
    }
  }

  private _unloadAsset(id: string): void {
    const asset = this.assets.get(id);
    if (!asset) return;

    asset.state = AssetState.UNLOADING;

    // Call loader's unload method if available
    const loader = this.loaders.get(asset.metadata.type);
    if (loader?.unload) {
      loader.unload(asset);
    }

    // Unload dependents first
    const dependents = this.dependents.get(id);
    if (dependents) {
      for (const dependentId of dependents) {
        this._unloadAsset(dependentId);
      }
    }

    // Remove from maps
    this.assets.delete(id);
    this.dependencies.delete(id);
    this.dependents.delete(id);

    // Update memory usage
    this.updateMemoryUsage();
  }

  getAsset<T = any>(id: string): LoadedAsset<T> | null {
    const asset = this.assets.get(id);
    if (asset) {
      asset.lastAccessed = Date.now();
      return asset as LoadedAsset<T>;
    }
    return null;
  }

  hasAsset(id: string): boolean {
    return this.assets.has(id);
  }

  isLoaded(id: string): boolean {
    const asset = this.assets.get(id);
    return asset?.state === AssetState.LOADED;
  }

  isLoading(id: string): boolean {
    const asset = this.assets.get(id);
    return asset?.state === AssetState.LOADING || this.loadingPromises.has(id);
  }

  preloadAssets(metadataList: AssetMetadata[], options: AssetLoadOptions = {}): Promise<void> {
    const promises = metadataList.map((metadata) =>
      this.loadAsset(metadata, { ...options, cache: true }),
    );

    return Promise.allSettled(promises).then(() => {});
  }

  // Memory management
  private updateMemoryUsage(): void {
    let totalMemory = 0;

    for (const asset of this.assets.values()) {
      if (asset.state === AssetState.LOADED) {
        totalMemory += this.estimateAssetSize(asset);
      }
    }

    this.stats.currentMemoryUsage = totalMemory;
  }

  private estimateAssetSize(asset: LoadedAsset): number {
    // Rough estimation - in a real system you'd have more precise measurements
    if (asset.metadata.size) {
      return asset.metadata.size;
    }

    // Default estimates by type
    switch (asset.metadata.type) {
      case AssetType.TEXTURE:
        return 1024 * 1024; // 1MB average
      case AssetType.MODEL:
        return 512 * 1024; // 512KB average
      case AssetType.AUDIO:
        return 2 * 1024 * 1024; // 2MB average
      default:
        return 64 * 1024; // 64KB default
    }
  }

  private runGarbageCollection(): void {
    const assets = Array.from(this.assets.entries())
      .filter(([_, asset]) => asset.referenceCount === 0)
      .sort((_a, _b) => a[1].lastAccessed - b[1].lastAccessed);

    let freedMemory = 0;
    const targetMemory = this.maxCacheSize * 0.7; // Free to 70%

    for (const [id, asset] of assets) {
      if (this.stats.currentMemoryUsage - freedMemory <= targetMemory) {
        break;
      }

      freedMemory += this.estimateAssetSize(asset);
      this._unloadAsset(id);
    }
  }

  private startGarbageCollector(): void {
    setInterval(() => {
      this.runGarbageCollection();
    }, 30000); // Run every 30 seconds
  }

  // Statistics and monitoring
  getStats() {
    return {
      ...this.stats,
      loadedAssets: this.assets.size,
      loadingAssets: this.loadingPromises.size,
      memoryUsage: this.stats.currentMemoryUsage,
      memoryLimit: this.maxCacheSize,
      memoryUtilization: this.stats.currentMemoryUsage / this.maxCacheSize,
      averageLoadTime:
        this.stats.totalLoads > 0 ? this.stats.totalLoadTime / this.stats.totalLoads : 0,
      cacheHitRate:
        this.stats.cacheHits / Math.max(1, this.stats.cacheHits + this.stats.cacheMisses),
    };
  }

  setMemoryLimit(bytes: number): void {
    this.maxCacheSize = bytes;
  }

  clear(): void {
    // Unload all assets
    for (const id of this.assets.keys()) {
      this._unloadAsset(id);
    }

    // Clear all maps
    this.assets.clear();
    this.dependencies.clear();
    this.dependents.clear();
    this.loadingPromises.clear();
    this.loadingQueue.length = 0;

    // Reset statistics
    this.stats.currentMemoryUsage = 0;
  }

  dispose(): void {
    this.clear();
  }
}

// Default asset loaders
class TextureLoader implements AssetLoader<WebGLTexture> {
  supportedTypes = [AssetType.TEXTURE];

  async load(_metadata: AssetMetadata): Promise<WebGLTexture> {
    // This would integrate with TextureManager
    throw new Error("TextureLoader requires WebGL context integration");
  }
}

class ModelLoader implements AssetLoader {
  supportedTypes = [AssetType.MODEL];

  async load(metadata: AssetMetadata): Promise<any> {
    const response = await fetch(metadata.path);
    const data = await response.arrayBuffer();

    // Parse based on file extension
    const ext = metadata.path.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "gltf":
      case "glb":
        return this.parseGLTF(data);
      case "obj":
        return this.parseOBJ(new TextDecoder().decode(data));
      default:
        throw new Error(`Unsupported model format: ${ext}`);
    }
  }

  private parseGLTF(data: ArrayBuffer): any {
    // GLTF parsing logic
    return { format: "gltf", data };
  }

  private parseOBJ(text: string): any {
    // OBJ parsing logic
    return { format: "obj", data: text };
  }
}

class AudioLoader implements AssetLoader<AudioBuffer> {
  supportedTypes = [AssetType.AUDIO];
  private audioContext: AudioContext | null = null;

  async load(metadata: AssetMetadata): Promise<AudioBuffer> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    const response = await fetch(metadata.path);
    const arrayBuffer = await response.arrayBuffer();
    return this.audioContext.decodeAudioData(arrayBuffer);
  }

  unload(_asset: LoadedAsset<AudioBuffer>): void {
    // AudioBuffer doesn't need explicit cleanup
  }
}

class JSONLoader implements AssetLoader<any> {
  supportedTypes = [AssetType.JSON];

  async load(metadata: AssetMetadata): Promise<any> {
    const response = await fetch(metadata.path);
    return response.json();
  }
}

class BinaryLoader implements AssetLoader<ArrayBuffer> {
  supportedTypes = [AssetType.BINARY];

  async load(metadata: AssetMetadata): Promise<ArrayBuffer> {
    const response = await fetch(metadata.path);
    return response.arrayBuffer();
  }
}

class MaterialLoader implements AssetLoader<any> {
  supportedTypes = [AssetType.MATERIAL];

  async load(metadata: AssetMetadata): Promise<any> {
    const response = await fetch(metadata.path);
    return response.json();
  }
}

class ShaderLoader implements AssetLoader<{ vertex: string; fragment: string }> {
  supportedTypes = [AssetType.SHADER];

  async load(metadata: AssetMetadata): Promise<{ vertex: string; fragment: string }> {
    // Load vertex and fragment shaders
    const vertexResponse = await fetch(`${metadata.path}.vert`);
    const fragmentResponse = await fetch(`${metadata.path}.frag`);

    return {
      vertex: await vertexResponse.text(),
      fragment: await fragmentResponse.text(),
    };
  }
}
