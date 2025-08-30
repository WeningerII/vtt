/**
 * Asset management types and interfaces
 */

export type AssetType = "image" | "audio" | "map" | "token" | "texture" | "model" | "document";

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  description?: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number; // bytes
  width?: number; // for images
  height?: number; // for images
  duration?: number; // for audio/video
  userId: string; // owner
  campaignId?: string; // if campaign-specific
  isPublic: boolean;
  tags: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssetUploadRequest {
  name: string;
  type?: AssetType;
  description?: string;
  campaignId?: string;
  isPublic?: boolean;
  tags?: string[];
}

export interface AssetUpdateRequest {
  name?: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface AssetSearchQuery {
  name?: string;
  type?: AssetType;
  userId?: string;
  campaignId?: string;
  isPublic?: boolean;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface Token extends Asset {
  type: "token";
  tokenData: {
    gridSize: number; // 1x1, 2x2, etc.
    isPC: boolean; // player character vs NPC
    category:
      | "humanoid"
      | "beast"
      | "undead"
      | "construct"
      | "elemental"
      | "fey"
      | "fiend"
      | "celestial"
      | "dragon"
      | "giant"
      | "monstrosity"
      | "ooze"
      | "plant"
      | "aberration"
      | "other";
    stats?: {
      ac?: number;
      hp?: number;
      speed?: number;
      cr?: string; // challenge rating
    };
  };
}

export interface GameMap extends Asset {
  type: "map";
  mapData: {
    gridType: "square" | "hex" | "none";
    gridSize: number; // pixels per grid square
    gridOffsetX: number;
    gridOffsetY: number;
    scenes: MapScene[];
  };
}

export interface MapScene {
  id: string;
  name: string;
  description?: string;
  backgroundAssetId?: string;
  overlayAssetIds: string[];
  lighting: {
    ambientLight: number; // 0-1
    lightSources: LightSource[];
  };
  fog: {
    enabled: boolean;
    exploredAreas: FogArea[];
    hiddenAreas: FogArea[];
  };
}

export interface LightSource {
  id: string;
  x: number;
  y: number;
  radius: number;
  intensity: number; // 0-1
  color: string; // hex color
  type: "bright" | "dim" | "torch" | "candle" | "magical";
}

export interface FogArea {
  id: string;
  type: "polygon" | "circle" | "rectangle";
  points: Array<{ x: number; y: number }>;
  radius?: number; // for circles
  width?: number; // for rectangles
  height?: number; // for rectangles
}

export interface AssetLibrary {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  isPublic: boolean;
  assets: string[]; // asset IDs
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}
