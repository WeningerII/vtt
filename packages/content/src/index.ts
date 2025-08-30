/**
 * @vtt/content - Comprehensive content creation and asset management
 *
 * This package provides tools for creating, managing, and publishing VTT content
 * including assets, scenes, campaigns, and content packages.
 */

// Core managers
export { AssetManager } from "./AssetManager";
export { ContentEditor } from "./ContentEditor";
export { CampaignBuilder } from "./CampaignBuilder";
export { PublishingManager } from "./PublishingManager";

// Types and interfaces
export type {
  // Asset management
  Asset,
  AssetMetadata,
  AssetCollection,
  AssetSearchCriteria,
  AssetSearchResult,
  AssetStatistics,
  AssetType,
} from "./AssetManager";

export type { EditorTool, Layer, DrawingElement, Scene, EditorState } from "./ContentEditor";

export type {
  Character,
  Quest,
  Location,
  Faction,
  Campaign,
  CampaignTemplate,
} from "./CampaignBuilder";

export type { ContentPackage, PublishingConfig, ValidationResult } from "./PublishingManager";

// Utility functions
export const _ContentUtils = {
  /**
   * Create a complete content creation suite
   */
  createContentSuite: (config?: {
    assetStoragePath?: string;
    exportPath?: string;
    authorInfo?: {
      name: string;
      email: string;
      website?: string;
    };
  }) => {
    import { AssetManager } from "./AssetManager";
    import { ContentEditor } from "./ContentEditor";
    import { CampaignBuilder } from "./CampaignBuilder";
    import { PublishingManager } from "./PublishingManager";

    const assetManager = new AssetManager(config?.assetStoragePath || "./assets");

    const contentEditor = new ContentEditor(assetManager);
    const campaignBuilder = new CampaignBuilder(assetManager);

    const publishingConfig = {
      exportPath: config?.exportPath || "./exports",
      compressionLevel: 6,
      includeAssets: true,
      includeThumbnails: true,
      validateContent: true,
      generateManifest: true,
      platforms: [],
      defaultLicense: "CC BY-SA 4.0",
      authorInfo: config?.authorInfo || {
        name: "Unknown Author",
        email: "author@example.com",
      },
    };

    const publishingManager = new PublishingManager(assetManager, publishingConfig);

    return {
      assetManager,
      contentEditor,
      campaignBuilder,
      publishingManager,
    };
  },

  /**
   * Generate unique IDs for content items
   */
  generateId: (): string => {
    return Math.random().toString(36).substr(2, 9);
  },

  /**
   * Validate file extensions for different asset types
   */
  validateAssetType: (filename: string, expectedType?: string): boolean => {
    const ext = filename.toLowerCase().split(".").pop();
    if (!ext) return false;

    const typeMap: Record<string, string[]> = {
      image: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "tiff"],
      audio: ["mp3", "wav", "ogg", "flac", "aac", "m4a"],
      video: ["mp4", "webm", "avi", "mov", "mkv", "wmv"],
      document: ["pdf", "txt", "md", "rtf", "doc", "docx"],
      model: ["gltf", "glb", "obj", "fbx", "dae", "blend"],
      archive: ["zip", "rar", "7z", "tar", "gz"],
    };

    if (expectedType && typeMap[expectedType]) {
      return typeMap[expectedType].includes(ext);
    }

    return Object.values(typeMap).some((exts) => exts.includes(ext));
  },

  /**
   * Calculate file size in human readable format
   */
  formatFileSize: (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  },

  /**
   * Sanitize filename for cross-platform compatibility
   */
  sanitizeFilename: (filename: string): string => {
    return filename
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, "")
      .toLowerCase();
  },

  /**
   * Check if a file is an image that can be processed
   */
  isProcessableImage: (filename: string): boolean => {
    const ext = filename.toLowerCase().split(".").pop();
    return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff"].includes(ext || "");
  },

  /**
   * Check if a file is an audio file
   */
  isAudioFile: (filename: string): boolean => {
    const ext = filename.toLowerCase().split(".").pop();
    return ["mp3", "wav", "ogg", "flac", "aac", "m4a"].includes(ext || "");
  },

  /**
   * Check if a file is a video file
   */
  isVideoFile: (filename: string): boolean => {
    const ext = filename.toLowerCase().split(".").pop();
    return ["mp4", "webm", "avi", "mov", "mkv", "wmv"].includes(ext || "");
  },

  /**
   * Check if a file is a 3D model
   */
  is3DModel: (filename: string): boolean => {
    const ext = filename.toLowerCase().split(".").pop();
    return ["gltf", "glb", "obj", "fbx", "dae", "blend"].includes(ext || "");
  },

  /**
   * Generate thumbnail filename from original filename
   */
  getThumbnailFilename: (originalFilename: string): string => {
    const ext = originalFilename.split(".").pop();
    const name = originalFilename.replace(`.${ext}`, "");
    return `${name}_thumb.jpg`;
  },

  /**
   * Generate preview filename from original filename
   */
  getPreviewFilename: (originalFilename: string): string => {
    const ext = originalFilename.split(".").pop();
    const name = originalFilename.replace(`.${ext}`, "");
    return `${name}_preview.jpg`;
  },

  /**
   * Validate semantic version string
   */
  isValidVersion: (version: string): boolean => {
    return /^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?(\+[a-zA-Z0-9-]+)?$/.test(version);
  },
};

// Constants
export const _SUPPORTED_FORMATS = {
  IMAGE: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "tiff"],
  AUDIO: ["mp3", "wav", "ogg", "flac", "aac", "m4a"],
  VIDEO: ["mp4", "webm", "avi", "mov", "mkv", "wmv"],
  DOCUMENT: ["pdf", "txt", "md", "rtf", "doc", "docx"],
  MODEL: ["gltf", "glb", "obj", "fbx", "dae", "blend"],
  ARCHIVE: ["zip", "rar", "7z", "tar", "gz"],
};

export const _DEFAULT_SETTINGS = {
  THUMBNAIL_SIZE: { width: 256, height: 256 },
  PREVIEW_SIZE: { width: 512, height: 512 },
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  SUPPORTED_SYSTEMS: ["dnd5e", "pf2e", "savage-worlds", "fate", "generic"],
  DEFAULT_GRID_SIZE: 50,
  DEFAULT_LAYER_OPACITY: 1.0,
  MAX_HISTORY_SIZE: 100,
};

// Version information
export const _VERSION = "1.0.0";
export const _PACKAGE_NAME = "@vtt/content";
