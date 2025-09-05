/**
 * Asset management service
 */

import {
  Asset,
  AssetUploadRequest,
  AssetUpdateRequest,
  AssetSearchQuery,
  AssetType,
  Token,
  GameMap,
  AssetLibrary,
} from "./types";
import type { Buffer } from "node:buffer";

import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);

export class AssetService {
  private assets = new Map<string, Asset>();
  private libraries = new Map<string, AssetLibrary>();
  private uploadPath: string;

  constructor(uploadPath: string = "./uploads") {
    this.uploadPath = uploadPath;
    this.ensureUploadDirectory();
  }

  private async ensureUploadDirectory(): Promise<void> {
    try {
      await access(this.uploadPath);
    } catch {
      await mkdir(this.uploadPath, { recursive: true });
    }
  }

  /**
   * Upload and create a new asset
   */
  async uploadAsset(
    userId: string,
    request: AssetUploadRequest,
    fileBuffer: Buffer,
    originalFilename: string,
    mimeType: string,
  ): Promise<Asset> {
    const assetId = uuidv4();
    const now = new Date();

    // Generate unique filename
    const extension = path.extname(originalFilename);
    const filename = `${assetId}${extension}`;
    const filePath = path.join(this.uploadPath, filename);

    // Save file to disk
    await writeFile(filePath, fileBuffer);

    // Detect asset type if not provided
    const assetType = request.type || this.detectAssetType(mimeType, originalFilename);

    // Get file dimensions for images
    let width: number | undefined;
    let height: number | undefined;
    if (assetType === "image") {
      ({ width, height } = await this.getImageDimensions(fileBuffer));
    }

    const asset: Asset = {
      id: assetId,
      name: request.name,
      type: assetType,
      ...(request.description !== undefined && { description: request.description }),
      filename,
      originalFilename,
      mimeType,
      size: fileBuffer.length,
      ...(width !== undefined && { width }),
      ...(height !== undefined && { height }),
      userId,
      ...(request.campaignId !== undefined && { campaignId: request.campaignId }),
      isPublic: request.isPublic || false,
      tags: request.tags || [],
      metadata: {} as Record<string, any>,
      createdAt: now,
      updatedAt: now,
    };

    this.assets.set(assetId, asset);
    return asset;
  }

  /**
   * Get asset by ID
   */
  async getAsset(assetId: string): Promise<Asset | null> {
    return this.assets.get(assetId) || null;
  }

  /**
   * Get asset file buffer
   */
  async getAssetFile(assetId: string): Promise<Buffer | null> {
    const asset = this.assets.get(assetId);
    if (!asset) {return null;}

    try {
      const filePath = path.join(this.uploadPath, asset.filename);
      return await readFile(filePath);
    } catch {
      return null;
    }
  }

  /**
   * Search assets
   */
  async searchAssets(query: AssetSearchQuery): Promise<{ assets: Asset[]; total: number }> {
    let results = Array.from(this.assets.values());

    // Apply filters
    if (query.name) {
      const searchTerm = query.name.toLowerCase();
      results = results.filter(
        (asset) =>
          asset.name.toLowerCase().includes(searchTerm) ||
          asset.description?.toLowerCase().includes(searchTerm),
      );
    }

    if (query.type) {
      results = results.filter((asset) => asset.type === query.type);
    }

    if (query.userId) {
      results = results.filter((asset) => asset.userId === query.userId);
    }

    if (query.campaignId) {
      results = results.filter((asset) => asset.campaignId === query.campaignId);
    }

    if (query.isPublic !== undefined) {
      results = results.filter((asset) => asset.isPublic === query.isPublic);
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter((asset) => query.tags!.some((tag) => asset.tags.includes(tag)));
    }

    const total = results.length;

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    results = results.slice(offset, offset + limit);

    return { assets: results, total };
  }

  /**
   * Update asset metadata
   */
  async updateAsset(
    assetId: string,
    userId: string,
    update: AssetUpdateRequest,
  ): Promise<Asset | null> {
    const asset = this.assets.get(assetId);

    if (!asset || asset.userId !== userId) {
      return null; // Only owner can update
    }

    // Apply updates
    if (update.name) {asset.name = update.name;}
    if (update.description !== undefined) {asset.description = update.description;}
    if (update.isPublic !== undefined) {asset.isPublic = update.isPublic;}
    if (update.tags) {asset.tags = update.tags;}
    if (update.metadata) {Object.assign(asset.metadata, update.metadata);}

    asset.updatedAt = new Date();
    return asset;
  }

  /**
   * Delete asset
   */
  async deleteAsset(assetId: string, userId: string): Promise<boolean> {
    const asset = this.assets.get(assetId);

    if (!asset || asset.userId !== userId) {
      return false; // Only owner can delete
    }

    // Remove file from disk
    try {
      const filePath = path.join(this.uploadPath, asset.filename);
      await unlink(filePath);
    } catch {
      // File may not exist, continue with deletion
    }

    return this.assets.delete(assetId);
  }

  /**
   * Get user's assets
   */
  async getUserAssets(userId: string): Promise<Asset[]> {
    return Array.from(this.assets.values()).filter((asset) => asset.userId === userId);
  }

  /**
   * Get campaign assets
   */
  async getCampaignAssets(campaignId: string): Promise<Asset[]> {
    return Array.from(this.assets.values()).filter(
      (asset) => asset.campaignId === campaignId || asset.isPublic,
    );
  }

  /**
   * Get public assets
   */
  async getPublicAssets(): Promise<Asset[]> {
    return Array.from(this.assets.values()).filter((asset) => asset.isPublic);
  }

  /**
   * Create token from image asset
   */
  async createToken(assetId: string, userId: string, tokenData: any): Promise<Token | null> {
    const asset = this.assets.get(assetId);

    if (!asset || asset.type !== "image") {
      return null;
    }

    // Create new token asset
    const tokenId = uuidv4();
    const token: Token = {
      ...asset,
      id: tokenId,
      type: "token",
      name: `${asset.name} (Token)`,
      tokenData: {
        gridSize: tokenData.gridSize || 1,
        isPC: tokenData.isPC || false,
        category: tokenData.category || "other",
        stats: tokenData.stats,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.assets.set(tokenId, token);
    return token;
  }

  /**
   * Create map from image asset
   */
  async createMap(assetId: string, userId: string, mapData: any): Promise<GameMap | null> {
    const asset = this.assets.get(assetId);

    if (!asset || asset.type !== "image") {
      return null;
    }

    // Create new map asset
    const mapId = uuidv4();
    const map: GameMap = {
      ...asset,
      id: mapId,
      type: "map",
      name: `${asset.name} (Map)`,
      mapData: {
        gridType: mapData.gridType || "square",
        gridSize: mapData.gridSize || 50,
        gridOffsetX: mapData.gridOffsetX || 0,
        gridOffsetY: mapData.gridOffsetY || 0,
        scenes: mapData.scenes || [
          {
            id: uuidv4(),
            name: "Default Scene",
            backgroundAssetId: assetId,
            overlayAssetIds: [],
            lighting: {
              ambientLight: 0.3,
              lightSources: [],
            },
            fog: {
              enabled: false,
              exploredAreas: [],
              hiddenAreas: [],
            },
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.assets.set(mapId, map);
    return map;
  }

  /**
   * Create asset library
   */
  async createLibrary(
    userId: string,
    name: string,
    description: string,
    isPublic: boolean = false,
  ): Promise<AssetLibrary> {
    const libraryId = uuidv4();
    const now = new Date();

    const library: AssetLibrary = {
      id: libraryId,
      name,
      description,
      ownerId: userId,
      isPublic,
      assets: [],
      tags: [],
      createdAt: now,
      updatedAt: now,
    };

    this.libraries.set(libraryId, library);
    return library;
  }

  /**
   * Add asset to library
   */
  async addAssetToLibrary(libraryId: string, assetId: string, userId: string): Promise<boolean> {
    const library = this.libraries.get(libraryId);
    const asset = this.assets.get(assetId);

    if (!library || !asset || library.ownerId !== userId) {
      return false;
    }

    if (!library.assets.includes(assetId)) {
      library.assets.push(assetId);
      library.updatedAt = new Date();
      return true;
    }

    return false; // Asset already in library
  }

  /**
   * Get user's libraries
   */
  async getUserLibraries(userId: string): Promise<AssetLibrary[]> {
    return Array.from(this.libraries.values()).filter((lib) => lib.ownerId === userId);
  }

  // Helper methods
  private detectAssetType(mimeType: string, filename: string): AssetType {
    if (mimeType.startsWith("image/")) {return "image";}
    if (mimeType.startsWith("audio/")) {return "audio";}
    if (mimeType === "application/pdf") {return "document";}

    const ext = path.extname(filename).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(ext)) {return "image";}
    if ([".mp3", ".wav", ".ogg", ".m4a"].includes(ext)) {return "audio";}
    if ([".pdf", ".txt", ".md"].includes(ext)) {return "document";}

    return "document"; // Default fallback
  }

  private async getImageDimensions(buffer: Buffer): Promise<{ width?: number; height?: number }> {
    // This is a simplified implementation
    // In a real app, you'd use a library like 'sharp' or 'image-size'
    try {
      // Basic PNG header check
      if (buffer.length > 24 && buffer.toString("ascii", 1, 4) === "PNG") {
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        return { width, height };
      }

      // Basic JPEG header check
      if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
        // This would require more complex parsing in a real implementation
        return {};
      }
    } catch {
      // Ignore errors
    }

    return {};
  }

  /**
   * Get asset statistics
   */
  getStats(): any {
    const assets = Array.from(this.assets.values());
    const typeStats = assets.reduce(
      (acc, asset) => {
        acc[asset.type] = (acc[asset.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const totalSize = assets.reduce((sum, asset) => sum + asset.size, 0);

    return {
      totalAssets: assets.length,
      totalSize,
      typeBreakdown: typeStats,
      publicAssets: assets.filter((a) => a.isPublic).length,
      libraries: this.libraries.size,
    };
  }
}
