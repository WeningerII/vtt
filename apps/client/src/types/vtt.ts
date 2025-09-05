/**
 * Core VTT Type Definitions
 * Defines the fundamental data structures for the Virtual Tabletop application
 */

export interface Token {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  color: number;
  imageUrl?: string;
  locked?: boolean;
  visible?: boolean;
  layer?: "background" | "objects" | "tokens" | "gm";
  stats?: {
    hp?: number;
    maxHp?: number;
    ac?: number;
    speed?: number;
  };
}

export interface GridSettings {
  type: "square" | "hex" | "none";
  size: number;
  offsetX: number;
  offsetY: number;
  color?: string;
  opacity?: number;
  snap?: boolean;
}

export interface Scene {
  id: string;
  name: string;
  description?: string;
  backgroundImage?: string;
  backgroundColor?: string;
  gridSettings: GridSettings;
  tokens: Token[];
  fogOfWar?: {
    enabled: boolean;
    data?: Uint8Array;
  };
  lighting?: {
    enabled: boolean;
    ambientLight?: number;
    sources?: Array<{
      x: number;
      y: number;
      radius: number;
      intensity: number;
      color?: string;
    }>;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  activeSceneId?: string;
  scenes: Scene[];
  players: string[];
  gameMaster: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  text: string;
  author: string;
  timestamp: Date;
  type: "message" | "roll" | "system" | "whisper";
  target?: string; // For whispers
  rollResult?: {
    dice: string;
    result: number;
    breakdown: string;
  };
}

export interface User {
  id: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  role?: "player" | "gm" | "admin";
}

// Socket Events
export interface SocketEvents {
  // Authentication
  authenticate: (data: { userId: string; campaignId?: string }) => void;
  authenticated: (data: { user: User }) => void;
  auth_error: (data: { message: string }) => void;

  // Scene Management
  join_scene: (data: { sceneId: string }) => void;
  leave_scene: (data: { sceneId: string }) => void;
  scene_joined: (data: { scene: Scene }) => void;
  scene_updated: (data: { scene: Scene }) => void;

  // User Events
  user_joined_scene: (data: { user: User; sceneId: string }) => void;
  user_left_scene: (data: { userId: string; sceneId: string }) => void;

  // Token Events
  token_moved: (data: { tokenId: string; x: number; y: number }) => void;
  token_added: (data: { token: Token }) => void;
  token_removed: (data: { tokenId: string }) => void;
  token_updated: (data: { token: Token }) => void;

  // Chat Events
  send_message: (data: { text: string; channel?: string; type?: string }) => void;
  new_message: (data: ChatMessage) => void;

  // System Events
  error: (data: { message: string }) => void;
}
