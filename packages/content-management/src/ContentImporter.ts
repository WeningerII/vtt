/**
 * Content Import System
 * Handles importing content from various formats and sources
 */

import { EventEmitter } from "events";
import JSZip from "jszip";
import * as mime from "mime-types";
import { v4 as _uuidv4 } from "uuid";
import { AssetManager, AssetMetadata, AssetType, AssetCategory } from "./AssetManager";

export interface ImportOptions {
  overwriteExisting?: boolean;
  validateContent?: boolean;
  generateThumbnails?: boolean;
  extractMetadata?: boolean;
  maxFileSize?: number; // bytes
  allowedTypes?: string[]; // MIME types
  defaultCategory?: AssetCategory;
  defaultTags?: string[];
}

export interface ImportResult {
  success: boolean;
  imported: AssetMetadata[];
  failed: ImportFailure[];
  warnings: string[];
  totalFiles: number;
  totalSize: number;
}

export interface ImportFailure {
  filename: string;
  reason: string;
  error?: Error;
}

export interface ContentPackage {
  manifest: PackageManifest;
  assets: Map<string, ArrayBuffer>;
  metadata: Map<string, any>;
}

export interface PackageManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  created: string;
  assets: PackageAssetEntry[];
  dependencies?: string[];
  tags?: string[];
}

export interface PackageAssetEntry {
  id: string;
  path: string;
  name: string;
  type: AssetType;
  category: AssetCategory;
  size: number;
  checksum: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface ImportProgress {
  stage: "reading" | "validating" | "processing" | "storing" | "complete";
  current: number;
  total: number;
  currentFile?: string;
  errors: string[];
}

export class ContentImporter extends EventEmitter {
  private assetManager: AssetManager;
  private processors = new Map<string, ContentProcessor>();

  constructor(assetManager: AssetManager) {
    super();
    this.assetManager = assetManager;
    this.setupDefaultProcessors();
  }

  /**
   * Import files from a file list (e.g., drag & drop)
   */
  async importFiles(files: FileList, options: ImportOptions = {}): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      imported: [],
      failed: [],
      warnings: [],
      totalFiles: files.length,
      totalSize: 0,
    };

    this.emitProgress("reading", 0, files.length);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      this.emitProgress("reading", i + 1, files.length, file.name);

      try {
        // Validate file
        const validation = this.validateFile(file, options);
        if (!validation.valid) {
          result.failed.push({
            filename: file.name,
            reason: validation.reason!,
          });
          continue;
        }

        // Read file data
        const data = await this.readFile(file);
        result.totalSize += data.byteLength;

        // Determine asset type and category
        const assetType = this.determineAssetType(file);
        const category = options.defaultCategory || this.determineCategory(assetType);

        // Process the file
        const processed = await this.processFile(file, data, assetType, options);

        // Create asset metadata
        const metadata: Omit<
          AssetMetadata,
          "id" | "createdAt" | "updatedAt" | "version" | "size" | "checksum"
        > = {
          name: processed.name || file.name,
          type: assetType,
          category,
          mimeType: file.type || mime.lookup(file.name) || "application/octet-stream",
          tags: [...(options.defaultTags || []), ...(processed.tags || [])],
          uploadedBy: "import",
          customProperties: processed.metadata || {},
        };

        // Add to asset manager
        const asset = await this.assetManager.addAsset(processed.data, metadata);
        result.imported.push(asset);
      } catch (error) {
        result.failed.push({
          filename: file.name,
          reason: error instanceof Error ? error.message : "Unknown error",
          error: error instanceof Error ? error : undefined,
        });
      }
    }

    result.success = result.failed.length === 0;
    this.emitProgress("complete", result.totalFiles, result.totalFiles);

    return result;
  }

  /**
   * Import from a ZIP archive
   */
  async importZip(zipData: ArrayBuffer, options: ImportOptions = {}): Promise<ImportResult> {
    const zip = await JSZip.loadAsync(zipData);
    const files: { name: string; data: ArrayBuffer }[] = [];

    // Extract all files
    for (const [path, zipEntry] of Object.entries(zip.files)) {
      if (!zipEntry.dir) {
        const data = await zipEntry.async("arraybuffer");
        files.push({ name: path, data });
      }
    }

    const result: ImportResult = {
      success: true,
      imported: [],
      failed: [],
      warnings: [],
      totalFiles: files.length,
      totalSize: 0,
    };

    this.emitProgress("processing", 0, files.length);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      this.emitProgress("processing", i + 1, files.length, file.name);

      try {
        // Create a File-like object for validation
        const fileObj = {
          name: file.name,
          size: file.data.byteLength,
          type: mime.lookup(file.name) || "application/octet-stream",
        } as File;

        // Validate
        const validation = this.validateFile(fileObj, options);
        if (!validation.valid) {
          result.failed.push({
            filename: file.name,
            reason: validation.reason!,
          });
          continue;
        }

        result.totalSize += file.data.byteLength;

        // Determine types
        const assetType = this.determineAssetTypeFromPath(file.name);
        const category = options.defaultCategory || this.determineCategory(assetType);

        // Process
        const processed = await this.processFile(fileObj, file.data, assetType, options);

        // Create metadata
        const metadata: Omit<
          AssetMetadata,
          "id" | "createdAt" | "updatedAt" | "version" | "size" | "checksum"
        > = {
          name: processed.name || file.name,
          type: assetType,
          category,
          mimeType: fileObj.type,
          tags: [...(options.defaultTags || []), ...(processed.tags || [])],
          uploadedBy: "import",
          customProperties: processed.metadata || {},
        };

        const asset = await this.assetManager.addAsset(processed.data, metadata);
        result.imported.push(asset);
      } catch (error) {
        result.failed.push({
          filename: file.name,
          reason: error instanceof Error ? error.message : "Unknown error",
          error: error instanceof Error ? error : undefined,
        });
      }
    }

    result.success = result.failed.length === 0;
    this.emitProgress("complete", result.totalFiles, result.totalFiles);

    return result;
  }

  /**
   * Import a content package
   */
  async importContentPackage(
    packageData: ArrayBuffer,
    options: ImportOptions = {},
  ): Promise<ImportResult> {
    const contentPackage = await this.parseContentPackage(packageData);

    const result: ImportResult = {
      success: true,
      imported: [],
      failed: [],
      warnings: [],
      totalFiles: contentPackage.assets.size,
      totalSize: 0,
    };

    this.emitProgress("validating", 0, contentPackage.assets.size);

    // Validate manifest
    if (!this.validateManifest(contentPackage.manifest)) {
      throw new Error("Invalid content package manifest");
    }

    let current = 0;
    for (const [assetId, data] of contentPackage.assets) {
      current++;
      this.emitProgress("storing", current, contentPackage.assets.size, assetId);

      try {
        const manifestEntry = contentPackage.manifest.assets.find((a) => a.id === assetId);
        if (!manifestEntry) {
          result.failed.push({
            filename: assetId,
            reason: "Asset not found in manifest",
          });
          continue;
        }

        result.totalSize += data.byteLength;

        // Verify checksum
        const checksum = await this.calculateChecksum(data);
        if (checksum !== manifestEntry.checksum) {
          result.warnings.push(`Checksum mismatch for ${manifestEntry.name}`);
        }

        // Create metadata from manifest
        const metadata: Omit<
          AssetMetadata,
          "id" | "createdAt" | "updatedAt" | "version" | "size" | "checksum"
        > = {
          name: manifestEntry.name,
          type: manifestEntry.type,
          category: manifestEntry.category,
          mimeType: mime.lookup(manifestEntry.path) || "application/octet-stream",
          tags: [...(options.defaultTags || []), ...(manifestEntry.tags || [])],
          uploadedBy: "package-import",
          customProperties: manifestEntry.metadata || {},
        };

        const asset = await this.assetManager.addAsset(data, metadata);
        result.imported.push(asset);
      } catch (error) {
        result.failed.push({
          filename: assetId,
          reason: error instanceof Error ? error.message : "Unknown error",
          error: error instanceof Error ? error : undefined,
        });
      }
    }

    result.success = result.failed.length === 0;
    this.emitProgress("complete", result.totalFiles, result.totalFiles);

    return result;
  }

  /**
   * Register a custom content processor
   */
  registerProcessor(mimeType: string, processor: ContentProcessor): void {
    this.processors.set(mimeType, processor);
  }

  private validateFile(file: File, options: ImportOptions): { valid: boolean; reason?: string } {
    // Check file size
    if (options.maxFileSize && file.size > options.maxFileSize) {
      return { valid: false, reason: `File too large: ${file.size} bytes` };
    }

    // Check allowed types
    if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
      return { valid: false, reason: `File type not allowed: ${file.type}` };
    }

    // Check for empty files
    if (file.size === 0) {
      return { valid: false, reason: "Empty file" };
    }

    return { valid: true };
  }

  private async readFile(file: File): Promise<ArrayBuffer> {
    return new Promise((_resolve, __reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  private determineAssetType(file: File): AssetType {
    return this.determineAssetTypeFromPath(file.name);
  }

  private determineAssetTypeFromPath(path: string): AssetType {
    const ext = path.split(".").pop()?.toLowerCase();

    switch (ext) {
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "webp":
      case "svg":
        return "image";

      case "mp3":
      case "wav":
      case "ogg":
      case "flac":
        return "audio";

      case "obj":
      case "fbx":
      case "gltf":
      case "glb":
        return "model";

      case "glsl":
      case "vert":
      case "frag":
        return "shader";

      case "ttf":
      case "otf":
      case "woff":
      case "woff2":
        return "font";

      case "json":
      case "xml":
      case "yaml":
      case "yml":
        return "data";

      default:
        return "data";
    }
  }

  private determineCategory(type: AssetType): AssetCategory {
    switch (type) {
      case "image":
      case "model":
        return "characters";
      case "audio":
        return "environments";
      case "shader":
      case "font":
        return "ui";
      default:
        return "user";
    }
  }

  private async processFile(
    file: File,
    data: ArrayBuffer,
    type: AssetType,
    options: ImportOptions,
  ): Promise<{ name?: string; data: ArrayBuffer; tags?: string[]; metadata?: any }> {
    const processor = this.processors.get(file.type);
    if (processor) {
      return await processor.process(file, data, type, options);
    }

    // Default processing - just return as-is
    return { data };
  }

  private async parseContentPackage(data: ArrayBuffer): Promise<ContentPackage> {
    const zip = await JSZip.loadAsync(data);

    // Read manifest
    const manifestFile = zip.file("manifest.json");
    if (!manifestFile) {
      throw new Error("Content package missing manifest.json");
    }

    const manifestData = await manifestFile.async("text");
    const manifest: PackageManifest = JSON.parse(manifestData);

    // Read assets
    const assets = new Map<string, ArrayBuffer>();
    for (const assetEntry of manifest.assets) {
      const assetFile = zip.file(assetEntry.path);
      if (assetFile) {
        const assetData = await assetFile.async("arraybuffer");
        assets.set(assetEntry.id, assetData);
      }
    }

    // Read metadata
    const metadata = new Map<string, any>();
    const metadataFile = zip.file("metadata.json");
    if (metadataFile) {
      const metadataData = await metadataFile.async("text");
      const metadataObj = JSON.parse(metadataData);
      for (const [key, value] of Object.entries(metadataObj)) {
        metadata.set(key, value);
      }
    }

    return { manifest, assets, metadata };
  }

  private validateManifest(manifest: PackageManifest): boolean {
    return !!(
      manifest.name &&
      manifest.version &&
      manifest.assets &&
      Array.isArray(manifest.assets)
    );
  }

  private async calculateChecksum(data: ArrayBuffer): Promise<string> {
    const crypto = globalThis.crypto || require("crypto");
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  private setupDefaultProcessors(): void {
    // Image processor
    this.processors.set("image/jpeg", new ImageProcessor());
    this.processors.set("image/png", new ImageProcessor());
    this.processors.set("image/gif", new ImageProcessor());
    this.processors.set("image/webp", new ImageProcessor());

    // Audio processor
    this.processors.set("audio/mpeg", new AudioProcessor());
    this.processors.set("audio/wav", new AudioProcessor());
    this.processors.set("audio/ogg", new AudioProcessor());

    // JSON data processor
    this.processors.set("application/json", new JSONProcessor());
  }

  private emitProgress(
    stage: ImportProgress["stage"],
    current: number,
    total: number,
    currentFile?: string,
  ): void {
    this.emit("progress", {
      stage,
      current,
      total,
      currentFile,
      errors: [],
    } as ImportProgress);
  }
}

export interface ContentProcessor {
  process(
    file: File,
    data: ArrayBuffer,
    type: AssetType,
    options: ImportOptions,
  ): Promise<{
    name?: string;
    data: ArrayBuffer;
    tags?: string[];
    metadata?: any;
  }>;
}

/**
 * Image content processor
 */
class ImageProcessor implements ContentProcessor {
  async process(
    file: File,
    data: ArrayBuffer,
  ): Promise<{ data: ArrayBuffer; tags?: string[]; metadata?: any }> {
    // In a real implementation, you might:
    // - Extract EXIF data
    // - Generate thumbnails
    // - Optimize image size
    // - Extract color palette

    const metadata = {
      originalName: file.name,
      originalSize: data.byteLength,
      lastModified: file.lastModified,
    };

    const tags = ["image"];

    return { data, tags, metadata };
  }
}

/**
 * Audio content processor
 */
class AudioProcessor implements ContentProcessor {
  async process(
    file: File,
    data: ArrayBuffer,
  ): Promise<{ data: ArrayBuffer; tags?: string[]; metadata?: any }> {
    // In a real implementation, you might:
    // - Extract audio metadata (duration, bitrate, etc.)
    // - Generate waveform preview
    // - Normalize audio levels

    const metadata = {
      originalName: file.name,
      originalSize: data.byteLength,
      lastModified: file.lastModified,
    };

    const tags = ["audio"];

    return { data, tags, metadata };
  }
}

/**
 * JSON data processor
 */
class JSONProcessor implements ContentProcessor {
  async process(
    file: File,
    data: ArrayBuffer,
  ): Promise<{ data: ArrayBuffer; tags?: string[]; metadata?: any }> {
    try {
      const text = new TextDecoder().decode(data);
      const json = JSON.parse(text);

      const metadata = {
        originalName: file.name,
        jsonSchema: this.inferSchema(json),
        keys: Object.keys(json).length,
      };

      const tags = ["data", "json"];

      return { data, tags, metadata };
    } catch (error) {
      throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private inferSchema(obj: any): string {
    if (Array.isArray(obj)) {
      return "array";
    } else if (typeof obj === "object" && obj !== null) {
      return "object";
    } else {
      return typeof obj;
    }
  }
}
