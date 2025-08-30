/**
 * Content Export System
 * Handles exporting content to various formats and packages
 */

import { EventEmitter } from 'events';
import JSZip from 'jszip';
import { v4 as _uuidv4 } from 'uuid';
import { AssetManager, AssetMetadata, AssetType, AssetCategory } from './AssetManager';
import { PackageManifest, PackageAssetEntry } from './ContentImporter';

export interface ExportOptions {
  format: ExportFormat;
  includeMetadata?: boolean;
  compressAssets?: boolean;
  includePreview?: boolean;
  filterByType?: AssetType[];
  filterByCategory?: AssetCategory[];
  filterByTags?: string[];
  customManifest?: Partial<PackageManifest>;
}

export type ExportFormat = 'zip' | 'content-package' | 'json' | 'individual';

export interface ExportResult {
  success: boolean;
  data?: ArrayBuffer;
  files?: Map<string, ArrayBuffer>; // For individual export
  manifest?: PackageManifest;
  exportedAssets: string[];
  skippedAssets: string[];
  totalSize: number;
  compressedSize?: number;
  warnings: string[];
}

export interface ExportProgress {
  stage: 'preparing' | 'collecting' | 'processing' | 'compressing' | 'complete';
  current: number;
  total: number;
  currentAsset?: string;
  bytes?: number;
  totalBytes?: number;
}

export interface ExportPreset {
  name: string;
  description: string;
  options: ExportOptions;
}

export class ContentExporter extends EventEmitter {
  private assetManager: AssetManager;
  private presets = new Map<string, ExportPreset>();

  constructor(assetManager: AssetManager) {
    super();
    this.assetManager = assetManager;
    this.setupDefaultPresets();
  }

  /**
   * Export assets based on provided options
   */
  async exportContent(assetIds: string[], options: ExportOptions): Promise<ExportResult> {
    const result: ExportResult = {
      success: false,
      exportedAssets: [],
      skippedAssets: [],
      totalSize: 0,
      warnings: [],
    };

    this.emitProgress('preparing', 0, assetIds.length);

    // Filter and validate assets
    const assetsToExport = await this.prepareAssets(assetIds, options);
    
    if (assetsToExport.length === 0) {
      throw new Error('No valid assets to export');
    }

    this.emitProgress('collecting', 0, assetsToExport.length);

    // Collect asset data
    const assetData = new Map<string, { metadata: AssetMetadata; data: ArrayBuffer }>();
    let totalBytes = 0;

    for (let i = 0; i < assetsToExport.length; i++) {
      const asset = assetsToExport[i];
      this.emitProgress('collecting', i + 1, assetsToExport.length, asset.name);

      try {
        const data = await this.assetManager.getAssetData(asset.id);
        assetData.set(asset.id, { metadata: asset, data });
        totalBytes += data.byteLength;
        result.exportedAssets.push(asset.id);
      } catch (error) {
        result.skippedAssets.push(asset.id);
        result.warnings.push(`Failed to export ${asset.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    result.totalSize = totalBytes;

    // Export based on format
    switch (options.format) {
      case 'zip':
        result.data = await this.exportAsZip(assetData, options);
        break;
      
      case 'content-package': {
        const packageResult = await this.exportAsContentPackage(assetData, options);
        result.data = packageResult.data;
        result.manifest = packageResult.manifest;
    }
        break;
      
      case 'json':
        result.data = await this.exportAsJSON(assetData, options);
        break;
      
      case 'individual':
        result.files = await this.exportAsIndividualFiles(assetData, options);
        break;
    }

    result.success = true;
    this.emitProgress('complete', assetsToExport.length, assetsToExport.length);

    return result;
  }

  /**
   * Export using a preset configuration
   */
  async exportWithPreset(assetIds: string[], presetName: string, overrides?: Partial<ExportOptions>): Promise<ExportResult> {
    const preset = this.presets.get(presetName);
    if (!preset) {
      throw new Error(`Export preset not found: ${presetName}`);
    }

    const options = { ...preset.options, ...overrides };
    return this.exportContent(assetIds, options);
  }

  /**
   * Export all assets of specific types/categories
   */
  async exportByFilter(filter: {
    types?: AssetType[];
    categories?: AssetCategory[];
    tags?: string[];
    uploadedBy?: string;
  }, options: ExportOptions): Promise<ExportResult> {
    const searchResult = this.assetManager.searchAssets({
      type: filter.types,
      category: filter.categories,
      tags: filter.tags,
      uploadedBy: filter.uploadedBy,
    }, 1, 1000); // Get first 1000 assets

    const assetIds = searchResult.assets.map(a => a.id);
    return this.exportContent(assetIds, options);
  }

  /**
   * Create a content package with custom structure
   */
  async createContentPackage(
    name: string,
    version: string,
    assetIds: string[],
    packageOptions: {
      description?: string;
      author?: string;
      license?: string;
      tags?: string[];
      dependencies?: string[];
      customStructure?: Map<string, string>; // assetId -> custom path
    }
  ): Promise<ExportResult> {
    const manifest: PackageManifest = {
      name,
      version,
      description: packageOptions.description,
      author: packageOptions.author,
      license: packageOptions.license,
      created: new Date().toISOString(),
      assets: [],
      dependencies: packageOptions.dependencies,
      tags: packageOptions.tags,
    };

    const options: ExportOptions = {
      format: 'content-package',
      includeMetadata: true,
      customManifest: manifest,
    };

    return this.exportContent(assetIds, options);
  }

  /**
   * Register a custom export preset
   */
  registerPreset(preset: ExportPreset): void {
    this.presets.set(preset.name, preset);
  }

  /**
   * Get available export presets
   */
  getPresets(): ExportPreset[] {
    return Array.from(this.presets.values());
  }

  /**
   * Estimate export size
   */
  async estimateExportSize(assetIds: string[]): Promise<{
    totalSize: number;
    compressedEstimate: number;
    assetCount: number;
  }> {
    let totalSize = 0;
    let validAssets = 0;

    for (const assetId of assetIds) {
      const asset = this.assetManager.getAsset(assetId);
      if (asset) {
        totalSize += asset.size;
        validAssets++;
      }
    }

    // Rough compression estimate (varies by content type)
    const compressionRatio = 0.7; // 30% compression on average
    const compressedEstimate = Math.floor(totalSize * compressionRatio);

    return {
      totalSize,
      compressedEstimate,
      assetCount: validAssets,
    };
  }

  private async prepareAssets(assetIds: string[], options: ExportOptions): Promise<AssetMetadata[]> {
    const assets: AssetMetadata[] = [];

    for (const assetId of assetIds) {
      const asset = this.assetManager.getAsset(assetId);
      if (!asset) {
        continue;
      }

      // Apply filters
      if (options.filterByType && !options.filterByType.includes(asset.type)) {
        continue;
      }

      if (options.filterByCategory && !options.filterByCategory.includes(asset.category)) {
        continue;
      }

      if (options.filterByTags && !options.filterByTags.some(tag => asset.tags.includes(tag))) {
        continue;
      }

      assets.push(asset);
    }

    return assets;
  }

  private async exportAsZip(
    assetData: Map<string, { metadata: AssetMetadata; data: ArrayBuffer }>, 
    options: ExportOptions
  ): Promise<ArrayBuffer> {
    const zip = new JSZip();

    this.emitProgress('processing', 0, assetData.size);

    let current = 0;
    for (const [_assetId, { metadata, data }] of assetData) {
      current++;
      this.emitProgress('processing', current, assetData.size, metadata.name);

      const filename = this.generateSafeFilename(metadata.name, metadata.type);
      zip.file(filename, data);

      if (options.includeMetadata) {
        zip.file(`${filename}.meta.json`, JSON.stringify(metadata, null, 2));
      }
    }

    this.emitProgress('compressing', assetData.size, assetData.size);

    return await zip.generateAsync({
      type: 'arraybuffer',
      compression: options.compressAssets ? 'DEFLATE' : 'STORE',
      compressionOptions: { level: 6 },
    });
  }

  private async exportAsContentPackage(
    assetData: Map<string, { metadata: AssetMetadata; data: ArrayBuffer }>,
    options: ExportOptions
  ): Promise<{ data: ArrayBuffer; manifest: PackageManifest }> {
    const zip = new JSZip();
    
    // Create manifest
    const manifest: PackageManifest = {
      name: options.customManifest?.name || 'Exported Content',
      version: options.customManifest?.version || '1.0.0',
      description: options.customManifest?.description || 'Exported from VTT',
      author: options.customManifest?.author || 'VTT Export',
      license: options.customManifest?.license,
      created: new Date().toISOString(),
      assets: [],
      dependencies: options.customManifest?.dependencies,
      tags: options.customManifest?.tags,
    };

    // Create assets folder and manifest entries
    this.emitProgress('processing', 0, assetData.size);

    let current = 0;
    for (const [assetId, { metadata, data }] of assetData) {
      current++;
      this.emitProgress('processing', current, assetData.size, metadata.name);

      const filename = this.generateSafeFilename(metadata.name, metadata.type);
      const assetPath = `assets/${filename}`;
      
      // Add asset to zip
      zip.file(assetPath, data);

      // Calculate checksum
      const checksum = await this.calculateChecksum(data);

      // Add to manifest
      const manifestEntry: PackageAssetEntry = {
        id: assetId,
        path: assetPath,
        name: metadata.name,
        type: metadata.type,
        category: metadata.category,
        size: metadata.size,
        checksum,
        tags: metadata.tags,
        metadata: metadata.customProperties,
      };

      manifest.assets.push(manifestEntry);
    }

    // Add manifest to zip
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    // Add metadata if requested
    if (options.includeMetadata) {
      const metadataObj: Record<string, any> = {};
      for (const [assetId, { metadata }] of assetData) {
        metadataObj[assetId] = metadata;
      }
      zip.file('metadata.json', JSON.stringify(metadataObj, null, 2));
    }

    this.emitProgress('compressing', assetData.size, assetData.size);

    const data = await zip.generateAsync({
      type: 'arraybuffer',
      compression: options.compressAssets ? 'DEFLATE' : 'STORE',
      compressionOptions: { level: 6 },
    });

    return { data, manifest };
  }

  private async exportAsJSON(
    assetData: Map<string, { metadata: AssetMetadata; data: ArrayBuffer }>,
    options: ExportOptions
  ): Promise<ArrayBuffer> {
    const exportData: {
      metadata: AssetMetadata[];
      assets: Record<string, string>; // assetId -> base64 data
    } = {
      metadata: [],
      assets: Record<string, any>,
    };

    this.emitProgress('processing', 0, assetData.size);

    let current = 0;
    for (const [assetId, { metadata, data }] of assetData) {
      current++;
      this.emitProgress('processing', current, assetData.size, metadata.name);

      exportData.metadata.push(metadata);
      
      // Convert to base64
      const base64 = Buffer.from(data).toString('base64');
      exportData.assets[assetId] = base64;
    }

    const json = JSON.stringify(exportData, null, 2);
    return new TextEncoder().encode(json);
  }

  private async exportAsIndividualFiles(
    assetData: Map<string, { metadata: AssetMetadata; data: ArrayBuffer }>,
    options: ExportOptions
  ): Promise<Map<string, ArrayBuffer>> {
    const files = new Map<string, ArrayBuffer>();

    this.emitProgress('processing', 0, assetData.size);

    let current = 0;
    for (const [_assetId, { metadata, data }] of assetData) {
      current++;
      this.emitProgress('processing', current, assetData.size, metadata.name);

      const filename = this.generateSafeFilename(metadata.name, metadata.type);
      files.set(filename, data);

      if (options.includeMetadata) {
        const metadataJson = JSON.stringify(metadata, null, 2);
        files.set(`${filename}.meta.json`, new TextEncoder().encode(metadataJson));
      }
    }

    return files;
  }

  private generateSafeFilename(name: string, type: AssetType): string {
    // Remove unsafe characters and ensure valid filename
    let safeName = name.replace(/[<>:"/\\|?*]/g, '');
    
    // Ensure it has an extension based on type
    if (!safeName.includes('.')) {
      const extension = this.getDefaultExtension(type);
      safeName += `.${extension}`;
    }

    return safeName;
  }

  private getDefaultExtension(type: AssetType): string {
    switch (type) {
      case 'image': return 'png';
      case 'audio': return 'wav';
      case 'model': return 'obj';
      case 'shader': return 'glsl';
      case 'font': return 'ttf';
      case 'data': return 'json';
      default: return 'bin';
    }
  }

  private async calculateChecksum(data: ArrayBuffer): Promise<string> {
    const crypto = globalThis.crypto || require('crypto');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private setupDefaultPresets(): void {
    // Complete export preset
    this.presets.set('complete', {
      name: 'Complete Export',
      description: 'Export all assets with full metadata',
      options: {
        format: 'content-package',
        includeMetadata: true,
        compressAssets: true,
        includePreview: true,
      },
    });

    // Images only preset
    this.presets.set('images', {
      name: 'Images Only',
      description: 'Export only image assets',
      options: {
        format: 'zip',
        filterByType: ['image'],
        compressAssets: false,
        includeMetadata: false,
      },
    });

    // Audio only preset
    this.presets.set('audio', {
      name: 'Audio Only',
      description: 'Export only audio assets',
      options: {
        format: 'zip',
        filterByType: ['audio'],
        compressAssets: true,
        includeMetadata: true,
      },
    });

    // Campaign export preset
    this.presets.set('campaign', {
      name: 'Campaign Export',
      description: 'Export complete campaign with scenes, tokens, and maps',
      options: {
        format: 'content-package',
        filterByType: ['scene', 'token', 'map', 'image'],
        includeMetadata: true,
        compressAssets: true,
        includePreview: true,
      },
    });

    // Minimal export preset
    this.presets.set('minimal', {
      name: 'Minimal Export',
      description: 'Export assets without metadata or compression',
      options: {
        format: 'individual',
        includeMetadata: false,
        compressAssets: false,
      },
    });
  }

  private emitProgress(stage: ExportProgress['stage'], current: number, total: number, currentAsset?: string): void {
    this.emit('progress', {
      stage,
      current,
      total,
      currentAsset,
    } as ExportProgress);
  }
}
