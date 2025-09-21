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
  LightSource,
  FogArea,
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
  private static readonly TOKEN_CATEGORIES: Token["tokenData"]["category"][] = [
    "humanoid",
    "beast",
    "undead",
    "construct",
    "elemental",
    "fey",
    "fiend",
    "celestial",
    "dragon",
    "giant",
    "monstrosity",
    "ooze",
    "plant",
    "aberration",
    "other",
  ];

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
  async createToken(assetId: string, userId: string, tokenData: unknown): Promise<Token | null> {
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
      tokenData: this.normalizeTokenData(tokenData),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.assets.set(tokenId, token);
    return token;
  }

  /**
   * Create map from image asset
   */
  async createMap(assetId: string, userId: string, mapData: unknown): Promise<GameMap | null> {
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
      mapData: this.normalizeMapData(mapData, assetId),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.assets.set(mapId, map);
    return map;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  }

  private toNumber(value: unknown): number | undefined {
    return typeof value === "number" ? value : undefined;
  }

  private normalizeTokenData(input: unknown): Token["tokenData"] {
    const data = this.toRecord(input);
    const statsRecord = this.toRecord(data.stats);

    const rawCategory = typeof data.category === "string" ? data.category : "other";
    const category = AssetService.TOKEN_CATEGORIES.includes(rawCategory as Token["tokenData"]["category"])
      ? (rawCategory as Token["tokenData"]["category"])
      : "other";

    const statsCandidate: Token["tokenData"]["stats"] = {
      ac: this.toNumber(statsRecord.ac),
      hp: this.toNumber(statsRecord.hp),
      speed: this.toNumber(statsRecord.speed),
      cr: typeof statsRecord.cr === "string" ? statsRecord.cr : undefined,
    };

    const hasStats = Object.values(statsCandidate ?? {}).some((value) => value !== undefined);

    return {
      gridSize: this.toNumber(data.gridSize) ?? 1,
      isPC: typeof data.isPC === "boolean" ? data.isPC : false,
      category,
      ...(hasStats ? { stats: statsCandidate } : {}),
    };
  }

  private normalizeMapData(input: unknown, assetId: string): GameMap["mapData"] {
    const data = this.toRecord(input);
    const scenesInput = Array.isArray(data.scenes) ? data.scenes : [];
    const scenes = scenesInput
      .map((scene) => this.normalizeScene(scene, assetId))
      .filter((scene): scene is GameMap["mapData"]["scenes"][number] => Boolean(scene));

    const gridType = typeof data.gridType === "string" && ["square", "hex", "none"].includes(data.gridType)
      ? (data.gridType as GameMap["mapData"]["gridType"])
      : "square";

    return {
      gridType,
      gridSize: this.toNumber(data.gridSize) ?? 50,
      gridOffsetX: this.toNumber(data.gridOffsetX) ?? 0,
      gridOffsetY: this.toNumber(data.gridOffsetY) ?? 0,
      scenes: scenes.length > 0 ? scenes : [this.createDefaultScene(assetId)],
    };
  }

  private normalizeScene(scene: unknown, assetId: string): GameMap["mapData"]["scenes"][number] {
    const record = this.toRecord(scene);
    const lightingRecord = this.toRecord(record.lighting);
    const fogRecord = this.toRecord(record.fog);

    return {
      id: typeof record.id === "string" ? record.id : uuidv4(),
      name: typeof record.name === "string" ? record.name : "Scene",
      description: typeof record.description === "string" ? record.description : undefined,
      backgroundAssetId: typeof record.backgroundAssetId === "string" ? record.backgroundAssetId : assetId,
      overlayAssetIds: Array.isArray(record.overlayAssetIds)
        ? record.overlayAssetIds.filter((value): value is string => typeof value === "string")
        : [],
      lighting: {
        ambientLight: this.toNumber(lightingRecord.ambientLight) ?? 0.3,
        lightSources: Array.isArray(lightingRecord.lightSources)
          ? lightingRecord.lightSources.filter((value): value is LightSource => this.isLightSource(value))
          : [],
      },
      fog: {
        enabled: typeof fogRecord.enabled === "boolean" ? fogRecord.enabled : false,
        exploredAreas: Array.isArray(fogRecord.exploredAreas)
          ? fogRecord.exploredAreas.filter((value): value is FogArea => this.isFogArea(value))
          : [],
        hiddenAreas: Array.isArray(fogRecord.hiddenAreas)
          ? fogRecord.hiddenAreas.filter((value): value is FogArea => this.isFogArea(value))
          : [],
      },
    };
  }

  private createDefaultScene(assetId: string): GameMap["mapData"]["scenes"][number] {
    return {
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
    };
  }

  private isLightSource(value: unknown): value is LightSource {
    const record = this.toRecord(value);
    return (
      typeof record.id === "string" &&
      typeof record.x === "number" &&
      typeof record.y === "number" &&
      typeof record.radius === "number" &&
      typeof record.intensity === "number" &&
      typeof record.color === "string"
    );
  }

  private isFogArea(value: unknown): value is FogArea {
    const record = this.toRecord(value);
    if (typeof record.id !== "string" || typeof record.type !== "string") {
      return false;
    }

    if (!Array.isArray(record.points)) {
      return false;
    }

    return record.points.every((point) => {
      const pointRecord = this.toRecord(point);
      return typeof pointRecord.x === "number" && typeof pointRecord.y === "number";
    });
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
