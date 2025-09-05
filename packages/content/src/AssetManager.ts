/**
 * Comprehensive asset management system for VTT content
 */

import { EventEmitter } from 'events';
import { logger } from '@vtt/logging';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { createReadStream, createWriteStream} from 'fs';
import * as semver from 'semver';

export type AssetType = 'image' | 'audio' | 'video' | 'model' | 'texture' | 'map' | 'token' | 'character' | 'campaign' | 'ruleset' | 'script' | 'shader' | 'font' | 'data';

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  version: string;
  filePath: string;
  size: number;
  checksum: string;
  created: Date;
  modified: Date;
}

export interface AssetSearchCriteria {
  query?: string;
  type?: AssetType;
  category?: string;
  tags?: string[];
  author?: string;
  limit?: number;
  offset?: number;
}

export interface AssetSearchResult {
  assets: AssetMetadata[];
  total: number;
  offset: number;
  limit: number;
}

export interface AssetStatistics {
  totalAssets: number;
  totalSize: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  topTags: Array<{ tag: string; count: number }>;
}

export interface AssetMetadata {
  id: string;
  name: string;
  type: AssetType;
  version: string;
  description: string;
  tags: string[];
  author: string;
  created: Date;
  modified: Date;
  size: number;
  checksum: string;
  filePath: string;
  
  // Technical metadata
  dimensions?: { width: number; height: number };
  duration?: number; // for audio/video
  format: string;
  compression?: string;
  colorSpace?: string;
  bitrate?: number;
  sampleRate?: number;
  
  // Content metadata  
  category: string;
  subcategory?: string;
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  license: string;
  dependencies: string[];
  compatibleSystems: string[];
  
  // Usage metadata
  downloadCount: number;
  rating: number;
  reviewCount: number;
  lastUsed?: Date;
  
  // Publishing metadata
  published: boolean;
  publishDate?: Date;
  marketplace?: boolean;
  price?: number;
  currency?: string;
  
  // Storage metadata
  path: string;
  cdnUrl?: string;
  thumbnailPath?: string;
  previewUrls?: string[];
  variants?: Array<{
    quality: string;
    path: string;
    size: number;
  }>;
}

export interface AssetCollection {
  id: string;
  name: string;
  description: string;
  assets: string[];
  tags: string[];
  author: string;
  created: Date;
  modified: Date;
  published: boolean;
  version: string;
}

export interface AssetImportOptions {
  generateThumbnails: boolean;
  generatePreviews: boolean;
  optimizeAssets: boolean;
  validateAssets: boolean;
  extractMetadata: boolean;
  createVariants: boolean;
  overwrite: boolean;
}

export interface AssetSearchOptions {
  query?: string;
  type?: AssetType;
  category?: string;
  tags?: string[];
  author?: string;
  license?: string;
  minRating?: number;
  maxSize?: number;
  sortBy?: 'name' | 'created' | 'modified' | 'rating' | 'downloads' | 'size';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export class AssetManager extends EventEmitter {
  private basePath: string;
  private assets = new Map<string, AssetMetadata>();
  private collections = new Map<string, AssetCollection>();
  private tags = new Set<string>();
  private categories = new Set<string>();
  private isInitialized = false;

  constructor(basePath: string) {
    super();
    this.basePath = basePath;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {return;}

    await this.ensureDirectories();
    await this.loadAssets();
    await this.loadCollections();
    
    this.isInitialized = true;
    this.emit('initialized');
  }

  private async ensureDirectories(): Promise<void> {
    const dirs = [
      'assets',
      'thumbnails', 
      'previews',
      'variants',
      'collections',
      'temp',
      'cache'
    ];

    for (const dir of dirs) {
      const fullPath = path.join(this.basePath, dir);
      await fs.mkdir(fullPath, { recursive: true });
    }
  }

  private async loadAssets(): Promise<void> {
    const assetsPath = path.join(this.basePath, 'assets');
    
    try {
      const files = await fs.readdir(assetsPath, { recursive: true });
      
      for (const file of files) {
        if (file.toString().endsWith('.metadata.json')) {
          try {
            const metadataPath = path.join(assetsPath, file.toString());
            const content = await fs.readFile(metadataPath, 'utf-8');
            const metadata: AssetMetadata = JSON.parse(content);
            
            this.assets.set(metadata.id, metadata);
            metadata.tags.forEach(tag => this.tags.add(tag));
            this.categories.add(metadata.category);
            
            if (metadata.subcategory) {
              this.categories.add(metadata.subcategory);
            }
          } catch (error) {
            logger.warn(`Failed to load asset metadata: ${file}`, error as Record<string, any>);
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to load assets directory', error as Record<string, any>);
    }
  }

  private async loadCollections(): Promise<void> {
    const collectionsPath = path.join(this.basePath, 'collections');
    
    try {
      const files = await fs.readdir(collectionsPath);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const collectionPath = path.join(collectionsPath, file);
            const content = await fs.readFile(collectionPath, 'utf-8');
            const collection: AssetCollection = JSON.parse(content);
            
            this.collections.set(collection.id, collection);
          } catch (error) {
            logger.warn(`Failed to load collection: ${file}`, error as Record<string, any>);
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to load collections directory', error as Record<string, any>);
    }
  }

  // Asset management
  async importAsset(
    filePath: string, 
    metadata: Partial<AssetMetadata>,
    options: Partial<AssetImportOptions> = {}
  ): Promise<string> {
    const defaultOptions: AssetImportOptions = {
      generateThumbnails: true,
      generatePreviews: true,
      optimizeAssets: true,
      validateAssets: true,
      extractMetadata: true,
      createVariants: true,
      overwrite: false
    };

    const importOptions = { ...defaultOptions, ...options };
    
    // Generate asset ID
    const assetId = this.generateAssetId();
    const fileName = path.basename(filePath);
    const fileExtension = path.extname(fileName);
    const baseName = path.basename(fileName, fileExtension);
    
    // Determine asset type from extension
    const assetType = this.determineAssetType(fileExtension);
    
    // Read file for checksum and size
    const fileBuffer = await fs.readFile(filePath);
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const size = fileBuffer.length;
    
    // Check for existing asset with same checksum
    if (!importOptions.overwrite) {
      const existing = Array.from(this.assets.values()).find(a => a.checksum === checksum);
      if (existing) {
        throw new Error(`Asset already exists: ${existing.id}`);
      }
    }
    
    // Create asset metadata
    const assetFilePath = `assets/${assetId}${fileExtension}`;
    const fullMetadata: AssetMetadata = {
      id: assetId,
      name: metadata.name || baseName,
      type: assetType,
      version: metadata.version || '1.0.0',
      description: metadata.description || '',
      tags: metadata.tags || [],
      author: metadata.author || 'Unknown',
      created: new Date(),
      modified: new Date(),
      size,
      checksum,
      filePath: assetFilePath,
      format: fileExtension.substring(1).toLowerCase(),
      category: metadata.category || 'general',
      subcategory: metadata.subcategory || '',
      license: metadata.license || 'all-rights-reserved',
      dependencies: metadata.dependencies || [],
      compatibleSystems: metadata.compatibleSystems || ['vtt'],
      downloadCount: 0,
      rating: 0,
      reviewCount: 0,
      published: false,
      path: assetFilePath,
      variants: []
    };

    // Copy asset file
    const assetPath = path.join(this.basePath, fullMetadata.path);
    await fs.writeFile(assetPath, fileBuffer);

    // Extract technical metadata
    if (importOptions.extractMetadata) {
      await this.extractTechnicalMetadata(fullMetadata, assetPath);
    }

    // Validate asset
    if (importOptions.validateAssets) {
      await this.validateAsset(fullMetadata, assetPath);
    }

    // Optimize asset
    if (importOptions.optimizeAssets) {
      await this.optimizeAsset(fullMetadata, assetPath);
    }

    // Generate thumbnails
    if (importOptions.generateThumbnails) {
      await this.generateThumbnail(fullMetadata, assetPath);
    }

    // Generate previews
    if (importOptions.generatePreviews) {
      await this.generatePreviews(fullMetadata, assetPath);
    }

    // Create variants
    if (importOptions.createVariants) {
      await this.createAssetVariants(fullMetadata, assetPath);
    }

    // Save metadata
    await this.saveAssetMetadata(fullMetadata);
    
    // Add to manager
    this.assets.set(assetId, fullMetadata);
    fullMetadata.tags.forEach(tag => this.tags.add(tag));
    this.categories.add(fullMetadata.category);
    
    if (fullMetadata.subcategory) {
      this.categories.add(fullMetadata.subcategory);
    }

    this.emit('assetImported', fullMetadata);
    return assetId;
  }

  async updateAsset(assetId: string, updates: Partial<AssetMetadata>): Promise<void> {
    const asset = this.assets.get(assetId);
    if (!asset) {
      throw new Error(`Asset not found: ${assetId}`);
    }

    // Create updated metadata
    const updatedAsset: AssetMetadata = {
      ...asset,
      ...updates,
      modified: new Date()
    };

    // Validate version if changed
    if (updates.version && !semver.valid(updates.version)) {
      throw new Error(`Invalid version format: ${updates.version}`);
    }

    // Update tags and categories
    if (updates.tags) {
      updates.tags.forEach(tag => this.tags.add(tag));
    }
    
    if (updates.category) {
      this.categories.add(updates.category);
    }
    
    if (updates.subcategory) {
      this.categories.add(updates.subcategory);
    }

    // Save metadata
    await this.saveAssetMetadata(updatedAsset);
    
    // Update manager
    this.assets.set(assetId, updatedAsset);
    
    this.emit('assetUpdated', updatedAsset);
  }

  async deleteAsset(assetId: string, deleteFiles: boolean = true): Promise<void> {
    const asset = this.assets.get(assetId);
    if (!asset) {
      throw new Error(`Asset not found: ${assetId}`);
    }

    if (deleteFiles) {
      // Delete main asset file
      try {
        await fs.unlink(path.join(this.basePath, asset.path));
      } catch (error) {
        logger.warn(`Failed to delete asset file: ${asset.path}`, error as Record<string, any>);
      }

      // Delete thumbnail
      if (asset.thumbnailPath) {
        try {
          await fs.unlink(path.join(this.basePath, asset.thumbnailPath));
        } catch (error) {
          logger.warn(`Failed to delete thumbnail: ${asset.thumbnailPath}`, error as Record<string, any>);
        }
      }

      // Delete previews
      if (asset.previewUrls) {
        for (const previewUrl of asset.previewUrls) {
          try {
            await fs.unlink(path.join(this.basePath, previewUrl));
          } catch (error) {
            logger.warn(`Failed to delete preview: ${previewUrl}`, error as Record<string, any>);
          }
        }
      }

      // Delete variants
      if (asset.variants) {
        for (const variant of asset.variants) {
          try {
            await fs.unlink(path.join(this.basePath, variant.path));
          } catch (error) {
            logger.warn(`Failed to delete variant: ${variant.path}`, error as Record<string, any>);
          }
        }
      }

      // Delete metadata file
      try {
        const metadataPath = path.join(this.basePath, 'assets', `${assetId}.metadata.json`);
        await fs.unlink(metadataPath);
      } catch (error) {
        logger.warn(`Failed to delete metadata file for asset: ${assetId}`, error as Record<string, any>);
      }
    }

    // Remove from manager
    this.assets.delete(assetId);
    
    // Remove from collections
    for (const collection of this.collections.values()) {
      const index = collection.assets.indexOf(assetId);
      if (index !== -1) {
        collection.assets.splice(index, 1);
        await this.saveCollection(collection);
      }
    }

    this.emit('assetDeleted', asset);
  }

  // Asset search and retrieval
  async searchAssets(options: AssetSearchOptions = {}): Promise<AssetMetadata[]> {
    let results = Array.from(this.assets.values());

    // Apply filters
    if (options.query) {
      const query = options.query.toLowerCase();
      results = results.filter(asset => 
        asset.name.toLowerCase().includes(query) ||
        asset.description?.toLowerCase().includes(query) ||
        asset.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (options.type) {
      results = results.filter(asset => asset.type === options.type);
    }

    if (options.category) {
      results = results.filter(asset => asset.category === options.category);
    }

    if (options.tags?.length) {
      results = results.filter(asset => 
        options.tags!.some(tag => asset.tags.includes(tag))
      );
    }

    if (options.author) {
      results = results.filter(asset => asset.author === options.author);
    }

    if (options.license) {
      results = results.filter(asset => asset.license === options.license);
    }

    if (options.minRating) {
      results = results.filter(asset => asset.rating >= options.minRating!);
    }

    if (options.maxSize) {
      results = results.filter(asset => asset.size <= options.maxSize!);
    }

    // Apply sorting
    if (options.sortBy) {
      results.sort((_a, _b) => {
        let aVal: any, bVal: any;
        
        switch (options.sortBy) {
          case 'name':
            aVal = _a.name.toLowerCase();
            bVal = _b.name.toLowerCase();
            break;
          case 'created':
            aVal = _a.created.getTime();
            bVal = _b.created.getTime();
            break;
          case 'modified':
            aVal = _a.modified.getTime();
            bVal = _b.modified.getTime();
            break;
          case 'rating':
            aVal = _a.rating;
            bVal = _b.rating;
            break;
          case 'downloads':
            aVal = _a.downloadCount;
            bVal = _b.downloadCount;
            break;
          case 'size':
            aVal = _a.size;
            bVal = _b.size;
            break;
          default:
            aVal = _a.name.toLowerCase();
            bVal = _b.name.toLowerCase();
        }

        if (options.sortOrder === 'desc') {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        } else {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        }
      });
    }

    // Apply pagination
    if (options.offset || options.limit) {
      const start = options.offset || 0;
      const end = options.limit ? start + options.limit : undefined;
      results = results.slice(start, end);
    }

    return results;
  }

  getAsset(assetId: string): AssetMetadata | undefined {
    return this.assets.get(assetId);
  }

  getAllAssets(): AssetMetadata[] {
    return Array.from(this.assets.values());
  }

  getAssetsByType(type: AssetType): AssetMetadata[] {
    return Array.from(this.assets.values()).filter(asset => asset.type === type);
  }

  getAssetsByCategory(category: string): AssetMetadata[] {
    return Array.from(this.assets.values()).filter(asset => asset.category === category);
  }

  getAssetsByTag(tag: string): AssetMetadata[] {
    return Array.from(this.assets.values()).filter(asset => asset.tags.includes(tag));
  }

  // Asset streaming and access
  async getAssetStream(assetId: string, variant?: string): Promise<NodeJS.ReadableStream> {
    const asset = this.assets.get(assetId);
    if (!asset) {
      throw new Error(`Asset not found: ${assetId}`);
    }

    let filePath: string;
    
    if (variant && asset.variants) {
      const variantInfo = asset.variants.find(v => v.quality === variant);
      if (!variantInfo) {
        throw new Error(`Variant not found: ${variant}`);
      }
      filePath = path.join(this.basePath, variantInfo.path);
    } else {
      filePath = path.join(this.basePath, asset.path);
    }

    // Update usage stats
    asset.lastUsed = new Date();
    await this.saveAssetMetadata(asset);

    return createReadStream(filePath);
  }

  async getAssetUrl(assetId: string, variant?: string): Promise<string> {
    const asset = this.assets.get(assetId);
    if (!asset) {
      throw new Error(`Asset not found: ${assetId}`);
    }

    // Return CDN URL if available
    if (asset.cdnUrl && !variant) {
      return asset.cdnUrl;
    }

    // Return local file path
    if (variant && asset.variants) {
      const variantInfo = asset.variants.find(v => v.quality === variant);
      if (variantInfo) {
        return `file://${path.join(this.basePath, variantInfo.path)}`;
      }
    }

    return `file://${path.join(this.basePath, asset.path)}`;
  }

  // Helper methods
  private generateAssetId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private determineAssetType(extension: string): AssetType {
    const ext = extension.toLowerCase();
    
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff'].includes(ext)) {
      return 'image';
    }
    if (['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'].includes(ext)) {
      return 'audio';
    }
    if (['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv'].includes(ext)) {
      return 'video';
    }
    if (['.obj', '.fbx', '.gltf', '.glb', '.dae', '.3ds', '.blend'].includes(ext)) {
      return 'model';
    }
    if (['.ttf', '.otf', '.woff', '.woff2'].includes(ext)) {
      return 'font';
    }
    if (['.glsl', '.vert', '.frag', '.hlsl'].includes(ext)) {
      return 'shader';
    }
    if (['.js', '.ts', '.lua', '.py'].includes(ext)) {
      return 'script';
    }
    if (['.json', '.xml', '.yaml', '.yml', '.csv'].includes(ext)) {
      return 'data';
    }
    
    return 'data'; // Default fallback
  }

  private async extractTechnicalMetadata(asset: AssetMetadata, _filePath: string): Promise<void> {
    // This would use appropriate libraries to extract metadata
    // For now, basic implementation
    if (asset.type === 'image') {
      // Would use Sharp or similar to extract image metadata
      asset.dimensions = { width: 1024, height: 1024 }; // Placeholder
      asset.colorSpace = 'sRGB';
    } else if (asset.type === 'audio') {
      // Would use node-ffmpeg or similar to extract audio metadata
      asset.duration = 120; // Placeholder
      asset.sampleRate = 44100;
      asset.bitrate = 320;
    } else if (asset.type === 'video') {
      // Would extract video metadata
      asset.duration = 300; // Placeholder
      asset.dimensions = { width: 1920, height: 1080 };
      asset.bitrate = 5000;
    }
  }

  private async validateAsset(_asset: AssetMetadata, _filePath: string): Promise<void> {
    // Asset validation logic would go here
    // Check file integrity, format compliance, etc.
  }

  private async optimizeAsset(_asset: AssetMetadata, _filePath: string): Promise<void> {
    // Asset optimization logic would go here
    // Compress images, optimize audio/video, etc.
  }

  private async generateThumbnail(asset: AssetMetadata, _filePath: string): Promise<void> {
    if (asset.type === 'image' || asset.type === 'video') {
      const thumbnailPath = `thumbnails/${asset.id}.jpg`;
      asset.thumbnailPath = thumbnailPath;
      // Would generate actual thumbnail using Sharp or ffmpeg
    }
  }

  private async generatePreviews(asset: AssetMetadata, _filePath: string): Promise<void> {
    // Generate preview files for different asset types
    asset.previewUrls = [];
  }

  private async createAssetVariants(asset: AssetMetadata, _filePath: string): Promise<void> {
    // Create different quality/resolution variants
    if (asset.type === 'image') {
      asset.variants = [
        { quality: 'low', path: `variants/${asset.id}_low.jpg`, size: 0 },
        { quality: 'medium', path: `variants/${asset.id}_medium.jpg`, size: 0 },
        { quality: 'high', path: `variants/${asset.id}_high.jpg`, size: 0 }
      ];
    }
  }

  private async saveAssetMetadata(asset: AssetMetadata): Promise<void> {
    const metadataPath = path.join(this.basePath, 'assets', `${asset.id}.metadata.json`);
    await fs.writeFile(metadataPath, JSON.stringify(asset, null, 2));
  }

  private async saveCollection(collection: AssetCollection): Promise<void> {
    const collectionPath = path.join(this.basePath, 'collections', `${collection.id}.json`);
    await fs.writeFile(collectionPath, JSON.stringify(collection, null, 2));
  }

  // Collection management
  async createCollection(name: string, description: string, author: string): Promise<string> {
    const collectionId = this.generateAssetId();
    
    const collection: AssetCollection = {
      id: collectionId,
      name,
      description,
      assets: [],
      tags: [],
      author,
      created: new Date(),
      modified: new Date(),
      published: false,
      version: '1.0.0'
    };

    await this.saveCollection(collection);
    this.collections.set(collectionId, collection);
    
    this.emit('collectionCreated', collection);
    return collectionId;
  }

  async addAssetToCollection(collectionId: string, assetId: string): Promise<void> {
    const collection = this.collections.get(collectionId);
    if (!collection) {
      throw new Error(`Collection not found: ${collectionId}`);
    }

    const asset = this.assets.get(assetId);
    if (!asset) {
      throw new Error(`Asset not found: ${assetId}`);
    }

    if (!collection.assets.includes(assetId)) {
      collection.assets.push(assetId);
      collection.modified = new Date();
      await this.saveCollection(collection);
      
      this.emit('assetAddedToCollection', collection, asset);
    }
  }

  getCollection(collectionId: string): AssetCollection | undefined {
    return this.collections.get(collectionId);
  }

  getAllCollections(): AssetCollection[] {
    return Array.from(this.collections.values());
  }

  // Statistics and analytics
  getAssetStats(): {
    totalAssets: number;
    totalSize: number;
    typeBreakdown: Record<AssetType, number>;
    categoryBreakdown: Record<string, number>;
    averageFileSize: number;
    mostPopularTags: Array<{ tag: string; count: number }>;
  } {
    const assets = Array.from(this.assets.values());
    
    const typeBreakdown: Record<AssetType, number> = {} as any;
    const categoryBreakdown: Record<string, number> = {};
    const tagCounts = new Map<string, number>();
    
    let totalSize = 0;
    
    for (const asset of assets) {
      totalSize += asset.size;
      
      typeBreakdown[asset.type] = (typeBreakdown[asset.type] || 0) + 1;
      categoryBreakdown[asset.category] = (categoryBreakdown[asset.category] || 0) + 1;
      
      for (const tag of asset.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    
    const mostPopularTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return {
      totalAssets: assets.length,
      totalSize,
      typeBreakdown,
      categoryBreakdown,
      averageFileSize: assets.length > 0 ? totalSize / assets.length : 0,
      mostPopularTags
    };
  }

  getTags(): string[] {
    return Array.from(this.tags);
  }

  getCategories(): string[] {
    return Array.from(this.categories);
  }
}
