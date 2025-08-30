/**
 * Content publishing and distribution system
 */

import { EventEmitter } from 'events';
import { logger } from '@vtt/logging';
import type { Buffer } from 'node:buffer';

import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import JSZip from 'jszip';
import { AssetManager, _AssetMetadata} from './AssetManager';
import { Campaign } from './CampaignBuilder';
import { Scene } from './ContentEditor';

export interface ContentPackage {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: 'campaign' | 'adventure' | 'asset_pack' | 'ruleset' | 'supplement';
  system: string;
  tags: string[];
  
  // Content
  assets: string[];
  scenes: Scene[];
  campaigns: Campaign[];
  
  // Metadata
  license: string;
  requiredVersion: string;
  dependencies: Array<{
    packageId: string;
    version: string;
    optional: boolean;
  }>;
  
  // Publishing info
  publishedDate?: Date;
  downloads: number;
  rating: number;
  reviewCount: number;
  
  // File info
  size: number;
  checksum: string;
  filePath?: string;
  
  created: Date;
  modified: Date;
}

export interface PublishingConfig {
  exportPath: string;
  compressionLevel: number;
  includeAssets: boolean;
  includeThumbnails: boolean;
  validateContent: boolean;
  generateManifest: boolean;
  
  // Distribution
  platforms: Array<{
    name: string;
    endpoint: string;
    apiKey?: string;
    enabled: boolean;
  }>;
  
  // Metadata
  defaultLicense: string;
  authorInfo: {
    name: string;
    email: string;
    website?: string;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    type: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    path?: string;
    severity: number;
  }>;
  warnings: Array<{
    type: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    path?: string;
    severity: number;
  }>;
  stats: {
    totalAssets: number;
    totalSize: number;
    missingAssets: number;
    brokenReferences: number;
  };
}

export class PublishingManager extends EventEmitter {
  private assetManager: AssetManager;
  private config: PublishingConfig;
  private packages = new Map<string, ContentPackage>();

  constructor(assetManager: AssetManager, config: PublishingConfig) {
    super();
    this.assetManager = assetManager;
    this.config = config;
  }

  // Package creation
  async createPackage(
    name: string,
    version: string,
    description: string,
    category: ContentPackage['category'],
    system: string,
    content: {
      assets?: string[];
      scenes?: Scene[];
      campaigns?: Campaign[];
    }
  ): Promise<ContentPackage> {
    const pkg: ContentPackage = {
      id: this.generateId(),
      name,
      version,
      description,
      author: this.config.authorInfo.name,
      category,
      system,
      tags: [],
      
      assets: content.assets || [],
      scenes: content.scenes || [],
      campaigns: content.campaigns || [],
      
      license: this.config.defaultLicense,
      requiredVersion: '1.0.0',
      dependencies: [],
      
      downloads: 0,
      rating: 0,
      reviewCount: 0,
      
      size: 0,
      checksum: '',
      
      created: new Date(),
      modified: new Date()
    };

    this.packages.set(pkg.id, pkg);
    this.emit('packageCreated', pkg);
    return pkg;
  }

  // Content validation
  async validatePackage(packageId: string): Promise<ValidationResult> {
    const pkg = this.packages.get(packageId);
    if (!pkg) {
      throw new Error(`Package not found: ${packageId}`);
    }

    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      stats: {
        totalAssets: pkg.assets.length,
        totalSize: 0,
        missingAssets: 0,
        brokenReferences: 0
      }
    };

    // Validate basic package info
    if (!pkg.name.trim()) {
      result.errors.push({
        type: 'error',
        code: 'MISSING_NAME',
        message: 'Package name is required',
        severity: 10
      });
    }

    if (!pkg.version.match(/^\d+\.\d+\.\d+$/)) {
      result.errors.push({
        type: 'error',
        code: 'INVALID_VERSION',
        message: 'Version must follow semantic versioning (x.y.z)',
        severity: 8
      });
    }

    if (!pkg.description.trim()) {
      result.warnings.push({
        type: 'warning',
        code: 'MISSING_DESCRIPTION',
        message: 'Package description is recommended',
        severity: 3
      });
    }

    // Validate assets
    for (const assetId of pkg.assets) {
      const asset = this.assetManager.getAsset(assetId);
      if (!asset) {
        result.errors.push({
          type: 'error',
          code: 'MISSING_ASSET',
          message: `Referenced asset not found: ${assetId}`,
          path: `assets/${assetId}`,
          severity: 9
        });
        result.stats.missingAssets++;
      } else {
        result.stats.totalSize += asset.size;
      }
    }

    // Validate scenes
    for (let i = 0; i < pkg.scenes.length; i++) {
      const scene = pkg.scenes[i];
      if (!scene) continue;
      const sceneErrors = await this.validateScene(scene);
      
      sceneErrors.forEach(error => {
        error.path = `scenes/${i}/${error.path || ''}`;
        if (error.type === 'error') {
          result.errors.push(error);
        } else {
          result.warnings.push(error);
        }
      });
    }

    // Validate campaigns
    for (let i = 0; i < pkg.campaigns.length; i++) {
      const campaign = pkg.campaigns[i];
      if (!campaign) continue;
      const campaignErrors = await this.validateCampaign(campaign);
      
      campaignErrors.forEach(error => {
        error.path = `campaigns/${i}/${error.path || ''}`;
        if (error.type === 'error') {
          result.errors.push(error);
        } else {
          result.warnings.push(error);
        }
      });
    }

    // Check dependencies
    for (const dep of pkg.dependencies) {
      if (!this.packages.has(dep.packageId) && !dep.optional) {
        result.warnings.push({
          type: 'warning',
          code: 'MISSING_DEPENDENCY',
          message: `Required dependency not available: ${dep.packageId}`,
          severity: 6
        });
      }
    }

    result.valid = result.errors.length === 0;
    this.emit('packageValidated', pkg, result);
    return result;
  }

  // Export and packaging
  async exportPackage(packageId: string, outputPath?: string): Promise<string> {
    const pkg = this.packages.get(packageId);
    if (!pkg) {
      throw new Error(`Package not found: ${packageId}`);
    }

    // Validate before export if configured
    if (this.config.validateContent) {
      const validation = await this.validatePackage(packageId);
      if (!validation.valid) {
        throw new Error(`Package validation failed: ${validation.errors.length} errors`);
      }
    }

    const zip = new JSZip();
    const exportPath = outputPath || path.join(this.config.exportPath, `${pkg.name}-${pkg.version}.vttp`);

    // Add manifest
    if (this.config.generateManifest) {
      const manifest = this.generateManifest(pkg);
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    }

    // Add package metadata
    zip.file('package.json', JSON.stringify({
      id: pkg.id,
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      author: pkg.author,
      category: pkg.category,
      system: pkg.system,
      tags: pkg.tags,
      license: pkg.license,
      requiredVersion: pkg.requiredVersion,
      dependencies: pkg.dependencies,
      created: pkg.created,
      modified: pkg.modified
    }, null, 2));

    // Add content
    if (pkg.scenes.length > 0) {
      zip.file('scenes.json', JSON.stringify(pkg.scenes, null, 2));
    }

    if (pkg.campaigns.length > 0) {
      zip.file('campaigns.json', JSON.stringify(pkg.campaigns, null, 2));
    }

    // Add assets if configured
    if (this.config.includeAssets) {
      const assetsFolder = zip.folder('assets');
      
      for (const assetId of pkg.assets) {
        const asset = this.assetManager.getAsset(assetId);
        if (asset && asset.filePath) {
          try {
            const assetData = await fs.readFile(asset.filePath);
            const assetPath = path.basename(asset.filePath);
            assetsFolder?.file(assetPath, assetData);

            // Add thumbnails if configured
            if (this.config.includeThumbnails && asset.thumbnailPath) {
              const thumbnailData = await fs.readFile(asset.thumbnailPath);
              const thumbnailPath = `thumbnails/${path.basename(asset.thumbnailPath)}`;
              zip.file(thumbnailPath, thumbnailData);
            }
          } catch (error) {
            logger.warn(`Failed to include asset ${assetId}:`, error);
          }
        }
      }
    }

    // Generate and save package
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: {
        level: this.config.compressionLevel
      }
    });

    await fs.writeFile(exportPath, zipBuffer);

    // Update package info
    pkg.size = zipBuffer.length;
    pkg.checksum = this.calculateChecksum(zipBuffer);
    pkg.filePath = exportPath;
    pkg.modified = new Date();

    this.emit('packageExported', pkg, exportPath);
    return exportPath;
  }

  // Import and installation
  async importPackage(filePath: string): Promise<ContentPackage> {
    const zipData = await fs.readFile(filePath);
    const zip = await JSZip.loadAsync(zipData);

    // Read package metadata
    const packageFile = zip.file('package.json');
    if (!packageFile) {
      throw new Error('Invalid package: missing package.json');
    }

    const packageData = JSON.parse(await packageFile.async('text'));
    
    // Verify checksum
    const expectedChecksum = this.calculateChecksum(zipData);
    
    const pkg: ContentPackage = {
      ...packageData,
      size: zipData.length,
      checksum: expectedChecksum,
      filePath,
      downloads: packageData.downloads || 0,
      rating: packageData.rating || 0,
      reviewCount: packageData.reviewCount || 0
    };

    // Import scenes
    const scenesFile = zip.file('scenes.json');
    if (scenesFile) {
      pkg.scenes = JSON.parse(await scenesFile.async('text'));
    }

    // Import campaigns
    const campaignsFile = zip.file('campaigns.json');
    if (campaignsFile) {
      pkg.campaigns = JSON.parse(await campaignsFile.async('text'));
    }

    // Import assets
    const assetsFolder = zip.folder('assets');
    if (assetsFolder) {
      for (const [_filename, file] of Object.entries(assetsFolder.files)) {
        if (file && typeof file === 'object' && 'dir' in file && !file.dir && 'async' in file) {
          const _assetData = await (file as any).async('nodebuffer');
          // Import asset to asset manager
          // This would integrate with AssetManager.importAsset()
        }
      }
    }

    this.packages.set(pkg.id, pkg);
    this.emit('packageImported', pkg);
    return pkg;
  }

  // Publishing to platforms
  async publishToMarketplace(packageId: string, platformName?: string): Promise<void> {
    const pkg = this.packages.get(packageId);
    if (!pkg) {
      throw new Error(`Package not found: ${packageId}`);
    }

    const platforms = platformName 
      ? this.config.platforms.filter(p => p.name === platformName && p.enabled)
      : this.config.platforms.filter(p => p.enabled);

    if (platforms.length === 0) {
      throw new Error('No enabled publishing platforms configured');
    }

    // Export package first
    const exportPath = await this.exportPackage(packageId);

    for (const platform of platforms) {
      try {
        await this.publishToPlatform(pkg, exportPath, platform);
        this.emit('packagePublished', pkg, platform.name);
      } catch (error) {
        this.emit('publishFailed', pkg, platform.name, error);
        throw error;
      }
    }

    pkg.publishedDate = new Date();
    pkg.modified = new Date();
  }

  // Package management
  getPackage(packageId: string): ContentPackage | undefined {
    return this.packages.get(packageId);
  }

  getAllPackages(): ContentPackage[] {
    return Array.from(this.packages.values());
  }

  removePackage(packageId: string): void {
    const pkg = this.packages.get(packageId);
    if (pkg) {
      this.packages.delete(packageId);
      
      // Clean up exported file
      if (pkg.filePath) {
        fs.unlink(pkg.filePath).catch(console.warn);
      }
      
      this.emit('packageRemoved', pkg);
    }
  }

  updatePackage(packageId: string, updates: Partial<ContentPackage>): void {
    const pkg = this.packages.get(packageId);
    if (pkg) {
      Object.assign(pkg, updates, { modified: new Date() });
      this.emit('packageUpdated', pkg);
    }
  }

  // Private methods
  private async validateScene(scene: Scene): Promise<Array<{ type: 'error' | 'warning'; code: string; message: string; path?: string; severity: number }>> {
    const errors: Array<{ type: 'error' | 'warning'; code: string; message: string; path?: string; severity: number }> = [];

    if (!scene.name.trim()) {
      errors.push({
        type: 'error',
        code: 'MISSING_SCENE_NAME',
        message: 'Scene name is required',
        severity: 8
      });
    }

    if (scene.dimensions.width <= 0 || scene.dimensions.height <= 0) {
      errors.push({
        type: 'error',
        code: 'INVALID_DIMENSIONS',
        message: 'Scene dimensions must be positive',
        severity: 7
      });
    }

    // Validate elements reference valid assets
    for (const element of scene.elements) {
      if (element.type === 'image' && element.data?.assetId) {
        const asset = this.assetManager.getAsset(element.data.assetId);
        if (!asset) {
          errors.push({
            type: 'error',
            code: 'MISSING_ELEMENT_ASSET',
            message: `Element references missing asset: ${element.data.assetId}`,
            path: `elements/${element.id}`,
            severity: 6
          });
        }
      }
    }

    return errors;
  }

  private async validateCampaign(campaign: Campaign): Promise<Array<{ type: 'error' | 'warning'; code: string; message: string; path?: string; severity: number }>> {
    const errors: Array<{ type: 'error' | 'warning'; code: string; message: string; path?: string; severity: number }> = [];

    if (!campaign.name.trim()) {
      errors.push({
        type: 'error',
        code: 'MISSING_CAMPAIGN_NAME',
        message: 'Campaign name is required',
        severity: 8
      });
    }

    if (!campaign.system.trim()) {
      errors.push({
        type: 'warning',
        code: 'MISSING_SYSTEM',
        message: 'Game system should be specified',
        severity: 4
      });
    }

    // Validate character references
    for (const character of campaign.characters) {
      if (character.portraitAssetId) {
        const asset = this.assetManager.getAsset(character.portraitAssetId);
        if (!asset) {
          errors.push({
            type: 'warning',
            code: 'MISSING_PORTRAIT',
            message: `Character portrait asset not found: ${character.portraitAssetId}`,
            path: `characters/${character.id}/portrait`,
            severity: 3
          });
        }
      }
    }

    return errors;
  }

  private generateManifest(pkg: ContentPackage): any {
    return {
      formatVersion: '1.0',
      packageId: pkg.id,
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      author: pkg.author,
      category: pkg.category,
      system: pkg.system,
      license: pkg.license,
      created: pkg.created,
      contents: {
        assets: pkg.assets.length,
        scenes: pkg.scenes.length,
        campaigns: pkg.campaigns.length
      },
      requirements: {
        minVersion: pkg.requiredVersion,
        dependencies: pkg.dependencies
      }
    };
  }

  private async publishToPlatform(
    pkg: ContentPackage,
    filePath: string,
    platform: { name: string; endpoint: string; apiKey?: string }
  ): Promise<void> {
    // Mock implementation - would integrate with actual marketplace APIs
    logger.info(`Publishing ${pkg.name} to ${platform.name}`);
    
    // This would typically involve:
    // 1. Uploading the package file
    // 2. Submitting metadata
    // 3. Handling API responses
    // 4. Updating package status
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
  }

  private calculateChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  // Configuration management
  updateConfig(updates: Partial<PublishingConfig>): void {
    Object.assign(this.config, updates);
    this.emit('configUpdated', this.config);
  }

  getConfig(): PublishingConfig {
    return { ...this.config };
  }

  // Statistics and analytics
  getPackageStats(packageId: string): {
    downloads: number;
    rating: number;
    reviews: number;
    size: number;
    created: Date;
    lastModified: Date;
  } | null {
    const pkg = this.packages.get(packageId);
    if (!pkg) return null;

    return {
      downloads: pkg.downloads,
      rating: pkg.rating,
      reviews: pkg.reviewCount,
      size: pkg.size,
      created: pkg.created,
      lastModified: pkg.modified
    };
  }

  getAllStats(): {
    totalPackages: number;
    totalDownloads: number;
    averageRating: number;
    totalSize: number;
    byCategory: Record<string, number>;
    bySystem: Record<string, number>;
  } {
    const packages = Array.from(this.packages.values());
    
    return {
      totalPackages: packages.length,
      totalDownloads: packages.reduce((_sum, _pkg) => sum + pkg.downloads, 0),
      averageRating: packages.length > 0 
        ? packages.reduce((_sum, _pkg) => sum + pkg.rating, 0) / packages.length 
        : 0,
      totalSize: packages.reduce((_sum, _pkg) => sum + pkg.size, 0),
      byCategory: this.groupBy(packages, 'category'),
      bySystem: this.groupBy(packages, 'system')
    };
  }

  private groupBy(array: any[], key: string): Record<string, number> {
    return array.reduce((acc, item) => {
      const value = item[key] || 'unknown';
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }
}
