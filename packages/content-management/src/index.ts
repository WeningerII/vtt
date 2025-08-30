/**
 * Content Management Package
 * Comprehensive asset management, import/export, validation, and processing pipeline
 */

import { EventEmitter } from 'events';

// Core Asset Management
export * from './AssetManager';
export * from './ContentImporter';  
export * from './ContentExporter';
export * from './ContentValidator';
export * from './AssetPipeline';

// Re-export commonly used types and interfaces
export type {
  AssetMetadata,
  AssetType,
  AssetCategory,
  AssetFilter,
  AssetSearchResult,
  StorageProvider,
  AssetEvent,
} from './AssetManager';

export type {
  ImportOptions,
  ImportResult,
  ImportFailure,
  ContentPackage,
  PackageManifest,
  PackageAssetEntry,
  ImportProgress,
  ContentProcessor,
} from './ContentImporter';

export type {
  ExportOptions,
  ExportFormat,
  ExportResult,
  ExportProgress,
  ExportPreset,
} from './ContentExporter';

export type {
  ValidationRule,
  ValidationContext,
  ValidationResult,
  ValidationIssue,
  ContentPolicy,
} from './ContentValidator';

export type {
  PipelineStage,
  AssetProcessor,
  ProcessingResult,
  PipelineConfig,
  PipelineProgress,
} from './AssetPipeline';

// Default configurations and utilities
export { DEFAULT_VTT_POLICY } from './ContentValidator';
export { _DEFAULT_PIPELINE_CONFIGS } from './AssetPipeline';

/**
 * Content Management System
 * High-level orchestrator for all content management operations
 */
import { AssetManager, StorageProvider, MemoryStorageProvider } from './AssetManager';
import { ContentImporter } from './ContentImporter';
import { ContentExporter } from './ContentExporter';
import { ContentValidator, DEFAULT_VTT_POLICY, ContentPolicy } from './ContentValidator';
import { AssetPipeline, _DEFAULT_PIPELINE_CONFIGS, PipelineConfig } from './AssetPipeline';

export interface ContentManagementConfig {
  storageProvider?: StorageProvider;
  contentPolicy?: ContentPolicy;
  pipelineConfig?: PipelineConfig;
  enableValidation?: boolean;
  enableProcessing?: boolean;
}

export class ContentManagementSystem extends EventEmitter {
  public readonly assetManager: AssetManager;
  public readonly importer: ContentImporter;
  public readonly exporter: ContentExporter;
  public readonly validator: ContentValidator;
  public readonly pipeline: AssetPipeline;

  constructor(config: ContentManagementConfig = {}) {
    super();
    
    // Initialize storage provider
    const storageProvider = config.storageProvider || new MemoryStorageProvider();
    
    // Initialize core components
    this.assetManager = new AssetManager(storageProvider);
    this.importer = new ContentImporter(this.assetManager);
    this.exporter = new ContentExporter(this.assetManager);
    
    // Initialize validation
    const contentPolicy = config.contentPolicy || DEFAULT_VTT_POLICY;
    this.validator = new ContentValidator(contentPolicy);
    
    // Initialize processing pipeline
    const pipelineConfig = config.pipelineConfig || _DEFAULT_PIPELINE_CONFIGS.development;
    this.pipeline = new AssetPipeline(pipelineConfig);

    // Setup event forwarding for centralized monitoring
    this.setupEventForwarding();
  }

  /**
   * Import and process files with validation
   */
  async importFiles(files: FileList, importOptions: any = {}, processAssets = true): Promise<any> {
    const importResult = await this.importer.importFiles(files, importOptions);
    
    if (!processAssets) {
      return importResult;
    }

    // Process imported assets through pipeline
    const processedAssets = [];
    for (const asset of importResult.imported) {
      try {
        const data = await this.assetManager.getAssetData(asset.id);
        const processResult = await this.pipeline.processAsset(data, asset);
        
        // Update asset with processed data and metadata
        if (processResult.data !== data) {
          await this.assetManager.updateAsset(asset.id, processResult.metadata);
        }
        
        processedAssets.push({
          asset,
          processed: processResult,
        } as any);
      } catch (error) {
        importResult.warnings.push(`Failed to process ${asset.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      ...importResult,
      processed: processedAssets,
    };
  }

  /**
   * Validate asset integrity and policy compliance
   */
  async validateAsset(assetId: string): Promise<any> {
    const asset = this.assetManager.getAsset(assetId);
    if (!asset) {
      throw new Error(`Asset not found: ${assetId}`);
    }

    const data = await this.assetManager.getAssetData(assetId);
    
    // Run validation
    const validationResult = await this.validator.validateAsset(asset, data);
    
    // Run integrity check
    const integrityResult = await this.validator.validateIntegrity(asset, data);

    return {
      validation: validationResult,
      integrity: integrityResult,
      overall: validationResult.valid && integrityResult.valid,
    };
  }

  /**
   * Get comprehensive system statistics
   */
  getSystemStats(): {
    storage: any;
    validation: { totalRules: number; activeRules: number };
    pipeline: { totalStages: number; enabledStages: number };
  } {
    const storageStats = this.assetManager.getStorageStats();
    const validationRules = this.validator.getRules();
    const pipelineConfig = this.pipeline.getConfig();

    return {
      storage: storageStats,
      validation: {
        totalRules: validationRules.length,
        activeRules: validationRules.filter(r => r.type === 'error').length,
      },
      pipeline: {
        totalStages: pipelineConfig.stages.length,
        enabledStages: pipelineConfig.stages.filter(s => s.enabled).length,
      },
    };
  }

  /**
   * Cleanup and maintenance operations
   */
  async performMaintenance(): Promise<{
    assetsValidated: number;
    cacheCleared: boolean;
    orphanedAssets: string[];
    integrityIssues: string[];
  }> {
    const result = {
      assetsValidated: 0,
      cacheCleared: false,
      orphanedAssets: [] as string[],
      integrityIssues: [] as string[],
    };

    // Clear cache
    this.assetManager.clearCache();
    result.cacheCleared = true;

    // Validate all assets
    const allAssets = this.assetManager.searchAssets({}, 1, 10000).assets;
    
    for (const asset of allAssets) {
      try {
        const validation = await this.validateAsset(asset.id);
        if (!validation.integrity.valid) {
          result.integrityIssues.push(`${asset.name}: ${validation.integrity.issues[0]?.message || 'Integrity check failed'}`);
        }
        result.assetsValidated++;
      } catch (_error) {
        result.orphanedAssets.push(asset.id);
      }
    }

    return result;
  }

  private setupEventForwarding(): void {
    // Forward asset manager events
    this.assetManager.on('assetCreated', (event) => this.emit('asset:created', event));
    this.assetManager.on('assetUpdated', (event) => this.emit('asset:updated', event));
    this.assetManager.on('assetDeleted', (event) => this.emit('asset:deleted', event));
    this.assetManager.on('assetDownloaded', (event) => this.emit('asset:downloaded', event));

    // Forward importer events
    this.importer.on('progress', (progress) => this.emit('import:progress', progress));

    // Forward exporter events
    this.exporter.on('progress', (progress) => this.emit('export:progress', progress));

    // Forward pipeline events
    this.pipeline.on('progress', (progress) => this.emit('pipeline:progress', progress));
    this.pipeline.on('batchProgress', (progress) => this.emit('pipeline:batchProgress', progress));
  }

  // EventEmitter.emit is now inherited from parent class
  // No need for custom emit implementation
}

/**
 * Create a content management system with sensible defaults
 */
export function createContentManagementSystem(config: ContentManagementConfig = {}): ContentManagementSystem {
  return new ContentManagementSystem(config);
}

/**
 * Utility functions for working with content management
 */
export const _ContentUtils = {
  /**
   * Determine asset type from filename
   */
  getAssetTypeFromFilename(filename: string): any {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
      case 'svg':
        return 'image';
      
      case 'mp3':
      case 'wav':
      case 'ogg':
      case 'flac':
        return 'audio';
      
      case 'obj':
      case 'fbx':
      case 'gltf':
      case 'glb':
        return 'model';
      
      case 'glsl':
      case 'vert':
      case 'frag':
        return 'shader';
      
      case 'ttf':
      case 'otf':
      case 'woff':
      case 'woff2':
        return 'font';
      
      case 'json':
      case 'xml':
      case 'yaml':
      case 'yml':
        return 'data';
      
      default:
        return 'data';
    }
  },

  /**
   * Format file size in human-readable format
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  /**
   * Generate safe filename from string
   */
  sanitizeFilename(filename: string): string {
    return filename
    // eslint-disable-next-line no-control-regex
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
      .replace(/^\.+/, '')
      .substring(0, 255);
  },

  /**
   * Extract tags from filename and metadata
   */
  extractTags(filename: string, customProperties: Record<string, any> = {}): string[] {
    const tags: string[] = [];
    
    // Extract from filename
    const nameParts = filename.toLowerCase().split(/[_\-\s\.]+/);
    for (const part of nameParts) {
      if (part.length > 2 && part.length < 20) {
        tags.push(part);
      }
    }

    // Extract from custom properties
    if (customProperties.keywords) {
      if (Array.isArray(customProperties.keywords)) {
        tags.push(...customProperties.keywords);
      } else if (typeof customProperties.keywords === 'string') {
        tags.push(...customProperties.keywords.split(',').map(k => k.trim()));
      }
    }

    // Remove duplicates and return
    return [...new Set(tags)].slice(0, 10); // Limit to 10 tags
  },
};
