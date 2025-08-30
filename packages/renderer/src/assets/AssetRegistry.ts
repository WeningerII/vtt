import { AssetType, AssetMetadata } from './AssetManager';
import { logger } from '@vtt/logging';

export interface AssetManifest {
  version: string;
  assets: AssetMetadata[];
  bundles?: AssetBundle[];
  baseUrl?: string;
}

export interface AssetBundle {
  id: string;
  name: string;
  assets: string[];
  priority?: number;
  preload?: boolean;
  dependencies?: string[];
}

export interface AssetDiscoveryOptions {
  recursive?: boolean;
  includeTypes?: AssetType[];
  excludeTypes?: AssetType[];
  includeExtensions?: string[];
  excludeExtensions?: string[];
  includePaths?: string[];
  excludePaths?: string[];
}

export class AssetRegistry {
  private assets = new Map<string, AssetMetadata>();
  private bundles = new Map<string, AssetBundle>();
  private pathIndex = new Map<string, string>(); // path -> id
  private typeIndex = new Map<AssetType, Set<string>>(); // type -> ids
  private tagIndex = new Map<string, Set<string>>(); // tag -> ids
  private dependencyGraph = new Map<string, Set<string>>(); // id -> dependencies
  private manifest: AssetManifest | null = null;
  
  private readonly supportedExtensions = new Map<string, AssetType>([
    // Textures
    ['.png', AssetType.TEXTURE],
    ['.jpg', AssetType.TEXTURE],
    ['.jpeg', AssetType.TEXTURE],
    ['.webp', AssetType.TEXTURE],
    ['.bmp', AssetType.TEXTURE],
    ['.tga', AssetType.TEXTURE],
    ['.dds', AssetType.TEXTURE],
    ['.ktx', AssetType.TEXTURE],
    ['.ktx2', AssetType.TEXTURE],
    
    // Models
    ['.gltf', AssetType.MODEL],
    ['.glb', AssetType.MODEL],
    ['.obj', AssetType.MODEL],
    ['.fbx', AssetType.MODEL],
    ['.dae', AssetType.MODEL],
    ['.3ds', AssetType.MODEL],
    ['.ply', AssetType.MODEL],
    
    // Audio
    ['.mp3', AssetType.AUDIO],
    ['.wav', AssetType.AUDIO],
    ['.ogg', AssetType.AUDIO],
    ['.m4a', AssetType.AUDIO],
    ['.flac', AssetType.AUDIO],
    ['.aac', AssetType.AUDIO],
    
    // Materials
    ['.mtl', AssetType.MATERIAL],
    ['.material', AssetType.MATERIAL],
    
    // Shaders
    ['.vert', AssetType.SHADER],
    ['.frag', AssetType.SHADER],
    ['.glsl', AssetType.SHADER],
    ['.hlsl', AssetType.SHADER],
    
    // Animations
    ['.anim', AssetType.ANIMATION],
    ['.fbx', AssetType.ANIMATION], // Can contain animations
    
    // Fonts
    ['.ttf', AssetType.FONT],
    ['.otf', AssetType.FONT],
    ['.woff', AssetType.FONT],
    ['.woff2', AssetType.FONT],
    
    // Data
    ['.json', AssetType.JSON],
    ['.bin', AssetType.BINARY],
    ['.data', AssetType.BINARY],
  ]);

  async loadManifest(manifestPath: string): Promise<void> {
    const response = await fetch(manifestPath);
    const manifest: AssetManifest = await response.json();
    
    this.manifest = manifest;
    
    // Register all assets from manifest
    for (const assetMetadata of manifest.assets) {
      this.registerAsset({
        ...assetMetadata,
        path: this.resolveAssetPath(assetMetadata.path, manifest.baseUrl)
      });
    }
    
    // Register bundles
    if (manifest.bundles) {
      for (const bundle of manifest.bundles) {
        this.registerBundle(bundle);
      }
    }
  }

  private resolveAssetPath(path: string, baseUrl?: string): string {
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/')) {
      return path;
    }
    
    if (baseUrl) {
      return `${baseUrl.replace(//$/, '')}/${path}`;
    }
    
    return path;
  }

  registerAsset(metadata: AssetMetadata): void {
    const { id,  path,  type,  tags,  dependencies  } = metadata;
    
    // Validate required fields
    if (!id || !path || !type) {
      throw new Error('Asset metadata must include id, path, and type');
    }
    
    // Infer type from extension if not explicit
    if (!Object.values(AssetType).includes(type)) {
      const inferredType = this.inferAssetType(path);
      if (inferredType) {
        metadata.type = inferredType;
      } else {
        throw new Error(`Unknown asset type: ${type} for ${path}`);
      }
    }
    
    // Register in main map
    this.assets.set(id, metadata);
    
    // Index by path
    this.pathIndex.set(path, id);
    
    // Index by type
    if (!this.typeIndex.has(type)) {
      this.typeIndex.set(type, new Set());
    }
    this.typeIndex.get(type)!.add(id);
    
    // Index by tags
    if (tags) {
      for (const tag of tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(id);
      }
    }
    
    // Register dependencies
    if (dependencies) {
      this.dependencyGraph.set(id, new Set(dependencies));
    }
  }

  registerBundle(bundle: AssetBundle): void {
    this.bundles.set(bundle.id, bundle);
  }

  private inferAssetType(path: string): AssetType | null {
    const extension = this.getFileExtension(path);
    return this.supportedExtensions.get(extension) || null;
  }

  private getFileExtension(path: string): string {
    const lastDot = path.lastIndexOf('.');
    return lastDot >= 0 ? path.substring(lastDot).toLowerCase() : '';
  }

  getAssetMetadata(id: string): AssetMetadata | null {
    return this.assets.get(id) || null;
  }

  getAssetByPath(path: string): AssetMetadata | null {
    const id = this.pathIndex.get(path);
    return id ? this.assets.get(id) || null : null;
  }

  getAssetsByType(type: AssetType): AssetMetadata[] {
    const ids = this.typeIndex.get(type);
    if (!ids) return [];
    
    return Array.from(ids)
      .map(id => this.assets.get(id)!)
      .filter(Boolean);
  }

  getAssetsByTag(tag: string): AssetMetadata[] {
    const ids = this.tagIndex.get(tag);
    if (!ids) return [];
    
    return Array.from(ids)
      .map(id => this.assets.get(id)!)
      .filter(Boolean);
  }

  getAssetDependencies(id: string, recursive = false): string[] {
    const dependencies = this.dependencyGraph.get(id);
    if (!dependencies) return [];
    
    if (!recursive) {
      return Array.from(dependencies);
    }
    
    // Recursively collect all dependencies
    const allDeps = new Set<string>();
    const visited = new Set<string>();
    
    const collectDeps = (_assetId: string) => {
      if (visited.has(assetId)) return;
      visited.add(assetId);
      
      const deps = this.dependencyGraph.get(assetId);
      if (deps) {
        for (const dep of deps) {
          allDeps.add(dep);
          collectDeps(dep);
        }
      }
    };
    
    collectDeps(id);
    return Array.from(allDeps);
  }

  getBundleAssets(bundleId: string): AssetMetadata[] {
    const bundle = this.bundles.get(bundleId);
    if (!bundle) return [];
    
    return bundle.assets
      .map(id => this.assets.get(id))
      .filter(Boolean) as AssetMetadata[];
  }

  getBundle(bundleId: string): AssetBundle | null {
    return this.bundles.get(bundleId) || null;
  }

  getBundles(): AssetBundle[] {
    return Array.from(this.bundles.values());
  }

  searchAssets(query: string, options: AssetDiscoveryOptions = {}): AssetMetadata[] {
    let results = Array.from(this.assets.values());
    
    // Filter by types
    if (options.includeTypes) {
      results = results.filter(asset => options.includeTypes!.includes(asset.type));
    }
    if (options.excludeTypes) {
      results = results.filter(asset => !options.excludeTypes!.includes(asset.type));
    }
    
    // Filter by extensions
    if (options.includeExtensions) {
      results = results.filter(asset => {
        const ext = this.getFileExtension(asset.path);
        return options.includeExtensions!.includes(ext);
      });
    }
    if (options.excludeExtensions) {
      results = results.filter(asset => {
        const ext = this.getFileExtension(asset.path);
        return !options.excludeExtensions!.includes(ext);
      });
    }
    
    // Filter by paths
    if (options.includePaths) {
      results = results.filter(asset => 
        options.includePaths!.some(path => asset.path.includes(path))
      );
    }
    if (options.excludePaths) {
      results = results.filter(asset => 
        !options.excludePaths!.some(path => asset.path.includes(path))
      );
    }
    
    // Text search in id, path, and tags
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(asset => {
        return asset.id.toLowerCase().includes(lowerQuery) ||
               asset.path.toLowerCase().includes(lowerQuery) ||
               (asset.tags && asset.tags.some(tag => tag.toLowerCase().includes(lowerQuery)));
      });
    }
    
    return results;
  }

  async discoverAssets(basePaths: string[], options: AssetDiscoveryOptions = {}): Promise<AssetMetadata[]> {
    const discovered: AssetMetadata[] = [];
    
    for (const basePath of basePaths) {
      try {
        const assets = await this.discoverAssetsInPath(basePath, options);
        discovered.push(...assets);
      } catch (error) {
        logger.warn(`Failed to discover assets in ${basePath}:`, error);
      }
    }
    
    // Register discovered assets
    for (const asset of discovered) {
      if (!this.assets.has(asset.id)) {
        this.registerAsset(asset);
      }
    }
    
    return discovered;
  }

  private async discoverAssetsInPath(
    basePath: string,
    options: AssetDiscoveryOptions
  ): Promise<AssetMetadata[]> {
    // This is a simplified version - in a real implementation you'd need
    // proper file system access or a server endpoint to list directory contents
    
    const assets: AssetMetadata[] = [];
    
    try {
      // Try to fetch directory listing (would need server support)
      const response = await fetch(`${basePath}?list=true`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const files = await response.json() as string[];
      
      for (const file of files) {
        const fullPath = `${basePath}/${file}`;
        const extension = this.getFileExtension(file);
        const type = this.supportedExtensions.get(extension);
        
        if (type && this.shouldIncludeAsset(fullPath, type, options)) {
          const id = this.generateAssetId(fullPath);
          
          assets.push({
            id,
            path: fullPath,
            type,
            lastModified: Date.now()
          });
        }
      }
    } catch (error) {
      // Fallback: try common asset file names
      const commonAssets = this.generateCommonAssetList(basePath);
      
      for (const asset of commonAssets) {
        if (this.shouldIncludeAsset(asset.path, asset.type, options)) {
          try {
            // Test if asset exists
            const testResponse = await fetch(asset.path, { method: 'HEAD' });
            if (testResponse.ok) {
              assets.push(asset);
            }
          } catch {
            // Asset doesn't exist, skip
          }
        }
      }
    }
    
    return assets;
  }

  private shouldIncludeAsset(
    path: string,
    type: AssetType,
    options: AssetDiscoveryOptions
  ): boolean {
    if (options.includeTypes && !options.includeTypes.includes(type)) {
      return false;
    }
    
    if (options.excludeTypes && options.excludeTypes.includes(type)) {
      return false;
    }
    
    if (options.includePaths && !options.includePaths.some(p => path.includes(p))) {
      return false;
    }
    
    if (options.excludePaths && options.excludePaths.some(p => path.includes(p))) {
      return false;
    }
    
    const extension = this.getFileExtension(path);
    
    if (options.includeExtensions && !options.includeExtensions.includes(extension)) {
      return false;
    }
    
    if (options.excludeExtensions && options.excludeExtensions.includes(extension)) {
      return false;
    }
    
    return true;
  }

  private generateCommonAssetList(basePath: string): AssetMetadata[] {
    const common = [
      // Common texture names
      'diffuse.png', 'albedo.png', 'color.png',
      'normal.png', 'normalmap.png',
      'roughness.png', 'metallic.png', 'specular.png',
      'occlusion.png', 'ao.png',
      'emissive.png', 'emission.png',
      
      // Common model files
      'model.gltf', 'mesh.glb', 'scene.gltf',
      
      // Common audio files
      'ambient.ogg', 'music.mp3', 'sfx.wav',
      
      // Common data files
      'config.json', 'metadata.json', 'data.bin'
    ];
    
    return common.map(filename => {
      const fullPath = `${basePath}/${filename}`;
      const extension = this.getFileExtension(filename);
      const type = this.supportedExtensions.get(extension) || AssetType.BINARY;
      
      return {
        id: this.generateAssetId(fullPath),
        path: fullPath,
        type
      };
    });
  }

  private generateAssetId(path: string): string {
    // Generate a unique ID from the path
    return path
      .replace(/^.*//, '') // Remove directory
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[^a-zA-Z0-9]/g, '') // Replace special chars
      .toLowerCase();
  }

  exportManifest(): AssetManifest {
    return {
      version: '1.0.0',
      assets: Array.from(this.assets.values()),
      bundles: Array.from(this.bundles.values())
    };
  }

  getStats() {
    const typeStats = new Map<AssetType, number>();
    
    for (const asset of this.assets.values()) {
      const count = typeStats.get(asset.type) || 0;
      typeStats.set(asset.type, count + 1);
    }
    
    return {
      totalAssets: this.assets.size,
      totalBundles: this.bundles.size,
      assetsByType: Object.fromEntries(typeStats),
      manifestVersion: this.manifest?.version,
      hasDependencies: this.dependencyGraph.size > 0
    };
  }

  clear(): void {
    this.assets.clear();
    this.bundles.clear();
    this.pathIndex.clear();
    this.typeIndex.clear();
    this.tagIndex.clear();
    this.dependencyGraph.clear();
    this.manifest = null;
  }

  dispose(): void {
    this.clear();
  }
}
