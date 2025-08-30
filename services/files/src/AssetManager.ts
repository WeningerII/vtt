import type { Buffer } from "node:buffer";
import { logger } from "@vtt/logging";
/**
 * Asset management system for handling file uploads, storage, and organization
 */

export interface Asset {
  id: string;
  name: string;
  originalName: string;
  type: AssetType;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  metadata: AssetMetadata;
  tags: string[];
  ownerId: string;
  gameId?: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type AssetType = "image" | "audio" | "video" | "document" | "map" | "token" | "other";

export interface AssetMetadata {
  width?: number;
  height?: number;
  duration?: number;
  format?: string;
  compression?: string;
  gridSize?: { width: number; height: number };
  dpi?: number;
  [key: string]: any;
}

export interface AssetUploadRequest {
  file: File | Buffer;
  name: string;
  type: AssetType;
  tags?: string[];
  gameId?: string;
  isPublic?: boolean;
  metadata?: Partial<AssetMetadata>;
}

export interface AssetSearchQuery {
  type?: AssetType;
  tags?: string[];
  gameId?: string;
  ownerId?: string;
  isPublic?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AssetStorage {
  upload(key: string, data: Buffer, contentType: string): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
  exists(key: string): Promise<boolean>;
}

export interface AssetRepository {
  create(asset: Omit<Asset, "id" | "createdAt" | "updatedAt">): Promise<Asset>;
  findById(id: string): Promise<Asset | null>;
  findByOwner(ownerId: string, query?: AssetSearchQuery): Promise<Asset[]>;
  findByGame(gameId: string, query?: AssetSearchQuery): Promise<Asset[]>;
  search(query: AssetSearchQuery): Promise<Asset[]>;
  update(id: string, updates: Partial<Asset>): Promise<Asset>;
  delete(id: string): Promise<void>;
  updateTags(id: string, tags: string[]): Promise<Asset>;
}

export class AssetManager {
  private storage: AssetStorage;
  private repository: AssetRepository;
  private imageProcessor: ImageProcessor;
  private maxFileSize: number;
  private allowedTypes: Set<string>;

  constructor(
    storage: AssetStorage,
    repository: AssetRepository,
    imageProcessor: ImageProcessor,
    maxFileSize = 50 * 1024 * 1024, // 50MB
    allowedTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "audio/mpeg",
      "audio/wav",
      "audio/ogg",
      "video/mp4",
      "video/webm",
      "application/pdf",
    ]),
  ) {
    this.storage = storage;
    this.repository = repository;
    this.imageProcessor = imageProcessor;
    this.maxFileSize = maxFileSize;
    this.allowedTypes = allowedTypes;
  }

  async uploadAsset(request: AssetUploadRequest, userId: string): Promise<Asset> {
    const fileData =
      request.file instanceof File ? Buffer.from(await request.file.arrayBuffer()) : request.file;

    // Validate file
    await this.validateFile(fileData, request);

    // Generate unique ID and storage key
    const assetId = this.generateAssetId();
    const storageKey = this.generateStorageKey(assetId, request.name);

    // Detect MIME type if not provided
    const mimeType = await this.detectMimeType(fileData, request.name);

    if (!this.allowedTypes.has(mimeType)) {
      throw new Error(`File type ${mimeType} is not allowed`);
    }

    // Process metadata
    const metadata = await this.extractMetadata(fileData, mimeType, request.metadata);

    // Upload file to storage
    const url = await this.storage.upload(storageKey, fileData, mimeType);

    // Generate thumbnail for images
    let thumbnailUrl: string | undefined;
    if (mimeType.startsWith("image/")) {
      try {
        const thumbnailData = await this.imageProcessor.generateThumbnail(fileData, 200, 200);
        const thumbnailKey = this.generateStorageKey(assetId, request.name, "thumb");
        thumbnailUrl = await this.storage.upload(thumbnailKey, thumbnailData, "image/jpeg");
      } catch (error) {
        logger.warn("Failed to generate thumbnail:", error);
      }
    }

    // Create asset record
    const assetData: Omit<Asset, "id" | "createdAt" | "updatedAt"> = {
      name: request.name,
      originalName: request.name,
      type: request.type,
      mimeType,
      size: fileData.length,
      url,
      metadata,
      tags: request.tags || [],
      ownerId: userId,
      isPublic: request.isPublic || false,
    };

    if (thumbnailUrl !== undefined) {
      assetData.thumbnailUrl = thumbnailUrl;
    }

    if (request.gameId !== undefined) {
      assetData.gameId = request.gameId;
    }

    const asset = await this.repository.create(assetData);

    return asset;
  }

  async getAsset(id: string, userId: string): Promise<Asset | null> {
    const asset = await this.repository.findById(id);

    if (!asset) return null;

    // Check permissions
    if (!this.canAccessAsset(asset, userId)) {
      throw new Error("Access denied");
    }

    return asset;
  }

  async downloadAsset(id: string, userId: string): Promise<{ data: Buffer; asset: Asset }> {
    const asset = await this.getAsset(id, userId);
    if (!asset) {
      throw new Error("Asset not found");
    }

    const storageKey = this.extractStorageKey(asset.url);
    const data = await this.storage.download(storageKey);

    return { data, asset };
  }

  async deleteAsset(id: string, userId: string): Promise<void> {
    const asset = await this.repository.findById(id);

    if (!asset) {
      throw new Error("Asset not found");
    }

    // Check permissions - only owner can delete
    if (asset.ownerId !== userId) {
      throw new Error("Access denied");
    }

    // Delete from storage
    const storageKey = this.extractStorageKey(asset.url);
    await this.storage.delete(storageKey);

    // Delete thumbnail if exists
    if (asset.thumbnailUrl) {
      const thumbnailKey = this.extractStorageKey(asset.thumbnailUrl);
      await this.storage.delete(thumbnailKey);
    }

    // Delete from repository
    await this.repository.delete(id);
  }

  async searchAssets(query: AssetSearchQuery, userId: string): Promise<Asset[]> {
    // Add user access restrictions to query
    const assets = await this.repository.search(query);

    // Filter by access permissions
    return assets.filter((asset) => this.canAccessAsset(asset, userId));
  }

  async getUserAssets(userId: string, query?: AssetSearchQuery): Promise<Asset[]> {
    return this.repository.findByOwner(userId, query);
  }

  async getGameAssets(gameId: string, userId: string, query?: AssetSearchQuery): Promise<Asset[]> {
    const assets = await this.repository.findByGame(gameId, query);

    // Filter by access permissions
    return assets.filter((asset) => this.canAccessAsset(asset, userId));
  }

  async updateAssetTags(id: string, tags: string[], userId: string): Promise<Asset> {
    const asset = await this.repository.findById(id);

    if (!asset) {
      throw new Error("Asset not found");
    }

    // Check permissions - only owner can update
    if (asset.ownerId !== userId) {
      throw new Error("Access denied");
    }

    return this.repository.updateTags(id, tags);
  }

  async updateAssetVisibility(id: string, isPublic: boolean, userId: string): Promise<Asset> {
    const asset = await this.repository.findById(id);

    if (!asset) {
      throw new Error("Asset not found");
    }

    // Check permissions - only owner can update
    if (asset.ownerId !== userId) {
      throw new Error("Access denied");
    }

    return this.repository.update(id, { isPublic });
  }

  private async validateFile(data: Buffer, request: AssetUploadRequest): Promise<void> {
    if (data.length === 0) {
      throw new Error("File is empty");
    }

    if (data.length > this.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.maxFileSize} bytes`);
    }

    // Validate file name
    if (!request.name || request.name.trim().length === 0) {
      throw new Error("File name is required");
    }

    // Check for malicious file extensions
    const dangerousExtensions = [".exe", ".bat", ".cmd", ".scr", ".pif", ".com"];
    const extension = request.name.toLowerCase().split(".").pop();
    if (extension && dangerousExtensions.includes(`.${extension}`)) {
      throw new Error("File type not allowed for security reasons");
    }
  }

  private async detectMimeType(data: Buffer, filename: string): Promise<string> {
    // Simple MIME type detection based on file signatures
    const signatures: Record<string, string> = {
      ffd8ff: "image/jpeg",
      "89504e": "image/png",
      "474946": "image/gif",
      "524946": "image/webp",
      "255044": "application/pdf",
    };

    const header = data.slice(0, 4).toString("hex");
    for (const [sig, mimeType] of Object.entries(signatures)) {
      if (header.startsWith(sig)) {
        return mimeType;
      }
    }

    // Fallback to extension-based detection
    const extension = filename.toLowerCase().split(".").pop();
    const extensionMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      ogg: "audio/ogg",
      mp4: "video/mp4",
      webm: "video/webm",
      pdf: "application/pdf",
    };

    return extension
      ? extensionMap[extension] || "application/octet-stream"
      : "application/octet-stream";
  }

  private async extractMetadata(
    data: Buffer,
    mimeType: string,
    providedMetadata?: Partial<AssetMetadata>,
  ): Promise<AssetMetadata> {
    const metadata: AssetMetadata = { ...providedMetadata };

    if (mimeType.startsWith("image/")) {
      try {
        const imageInfo = await this.imageProcessor.getImageInfo(data);
        metadata.width = imageInfo.width;
        metadata.height = imageInfo.height;
        metadata.format = imageInfo.format;
      } catch (error) {
        logger.warn("Failed to extract image metadata:", error);
      }
    }

    return metadata;
  }

  private canAccessAsset(asset: Asset, userId: string): boolean {
    // Owner can always access
    if (asset.ownerId === userId) return true;

    // Public assets can be accessed by anyone
    if (asset.isPublic) return true;

    // Game assets can be accessed by game participants (simplified check)
    // In a real implementation, you'd check if user is part of the game
    if (asset.gameId) return true;

    return false;
  }

  private generateAssetId(): string {
    return `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateStorageKey(assetId: string, filename: string, suffix?: string): string {
    const extension = filename.split(".").pop();
    const key = suffix ? `${assetId}_${suffix}` : assetId;
    return extension ? `${key}.${extension}` : key;
  }

  private extractStorageKey(url: string): string {
    // Extract storage key from URL - implementation depends on storage provider
    return url.split("/").pop() || "";
  }
}

// Image processing utilities
export interface ImageProcessor {
  generateThumbnail(data: Buffer, width: number, height: number): Promise<Buffer>;
  getImageInfo(data: Buffer): Promise<{ width: number; height: number; format: string }>;
  resize(data: Buffer, width: number, height: number): Promise<Buffer>;
  compress(data: Buffer, quality: number): Promise<Buffer>;
}

// Simple image processor implementation (would use sharp or similar in production)
export class SimpleImageProcessor implements ImageProcessor {
  async generateThumbnail(data: Buffer, _width: number, _height: number): Promise<Buffer> {
    // Simplified implementation - in production use sharp or canvas
    return data; // Return original for now
  }

  async getImageInfo(data: Buffer): Promise<{ width: number; height: number; format: string }> {
    // Simplified implementation - parse image headers
    if (data.slice(0, 3).toString("hex") === "ffd8ff") {
      return { width: 800, height: 600, format: "jpeg" }; // Mock values
    }

    if (data.slice(0, 8).toString() === "\x89PNG\r\n\x1a\n") {
      return { width: 800, height: 600, format: "png" }; // Mock values
    }

    return { width: 800, height: 600, format: "unknown" };
  }

  async resize(data: Buffer, _width: number, _height: number): Promise<Buffer> {
    return data; // Return original for now
  }

  async compress(data: Buffer, _quality: number): Promise<Buffer> {
    return data; // Return original for now
  }
}
