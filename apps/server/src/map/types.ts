/**
 * Map and grid system types for tactical combat
 */

export type GridType = "square" | "hex" | "none";
export type GridSnapMode = "center" | "corner" | "edge" | "free";

export interface GridSettings {
  type: GridType;
  size: number; // pixels per grid unit
  offsetX: number;
  offsetY: number;
  snapMode: GridSnapMode;
  visible: boolean;
  color: string;
  opacity: number;
}

export interface MapLayer {
  id: string;
  name: string;
  type: "background" | "overlay" | "tokens" | "effects" | "fog";
  visible: boolean;
  locked: boolean;
  opacity: number;
  zIndex: number;
  assetId?: string; // for background/overlay layers
}

export interface MapScene {
  id: string;
  name: string;
  description?: string;
  width: number;
  height: number;
  campaignId: string;
  mapId: string | null;
  grid: GridSettings;
  layers: MapLayer[];
  lighting: LightingSettings;
  fog: FogSettings;
  weather?: WeatherSettings;
  ambient?: AmbientSettings;
  tokens?: TokenPosition[];
}

export interface LightingSettings {
  enabled: boolean;
  globalIllumination: number; // 0-1
  darkvision: boolean;
  lightSources: LightSource[];
}

export interface LightSource {
  id: string;
  x: number;
  y: number;
  radius: number;
  dimRadius?: number;
  intensity: number; // 0-1
  color: string;
  type: "bright" | "dim" | "torch" | "candle" | "magical" | "custom";
  flickering: boolean;
  animated: boolean;
  ownerId?: string; // token that owns this light
}

export interface FogSettings {
  enabled: boolean;
  mode: "revealed" | "hidden" | "exploration"; // revealed = show all, hidden = hide all, exploration = fog of war
  exploredAreas: FogArea[];
  hiddenAreas: FogArea[];
  lineOfSight: boolean;
  sightRadius: number; // default sight radius for tokens
}

export interface FogArea {
  id: string;
  type: "polygon" | "circle" | "rectangle";
  points: Array<{ x: number; y: number }>;
  radius?: number; // for circles
  width?: number; // for rectangles
  height?: number; // for rectangles
}

export interface WeatherSettings {
  type: "clear" | "rain" | "snow" | "fog" | "storm" | "wind";
  intensity: number; // 0-1
  direction?: number; // degrees for wind
  particles: boolean;
  soundEnabled: boolean;
}

export interface AmbientSettings {
  sounds: AmbientSound[];
  music?: {
    trackId: string;
    volume: number;
    loop: boolean;
    autoPlay: boolean;
  };
}

export interface AmbientSound {
  id: string;
  name: string;
  assetId: string;
  x?: number; // position for positional audio
  y?: number;
  radius?: number; // audio range
  volume: number;
  loop: boolean;
  autoPlay: boolean;
}

export interface TokenPosition {
  id: string;
  actorId: string | null;
  assetId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  isVisible: boolean;
  isLocked: boolean;
  layer: number;
}

export interface TokenMovement {
  tokenId: string;
  path: Array<{ x: number; y: number }>;
  duration: number; // milliseconds
  animation: "linear" | "ease" | "bounce";
}

export interface MeasurementTool {
  id: string;
  type: "ruler" | "template" | "area";
  points: Array<{ x: number; y: number }>;
  color: string;
  visible: boolean;
  ownerId: string;
  measurements: {
    distance: number;
    area?: number;
    units: "feet" | "meters" | "squares";
  };
}

export interface CombatGrid {
  sceneId: string;
  initiative: InitiativeEntry[];
  currentTurn: number;
  round: number;
  phase: "setup" | "combat" | "ended";
  effects: GridEffect[];
}

export interface InitiativeEntry {
  id: string;
  tokenId: string;
  name: string;
  initiative: number;
  hasActed: boolean;
  conditions: string[];
}

export interface GridEffect {
  id: string;
  type: "spell" | "aura" | "trap" | "hazard" | "custom";
  name: string;
  description: string;
  shape: "circle" | "square" | "cone" | "line" | "custom";
  position: { x: number; y: number };
  size: number; // radius or side length
  rotation?: number; // for cones/lines
  color: string;
  opacity: number;
  duration: number; // rounds, -1 for permanent
  visible: boolean;
  affects: "all" | "allies" | "enemies" | "none";
  ownerId?: string;
}

export interface MapUpdateEvent {
  type:
    | "token_move"
    | "token_add"
    | "token_remove"
    | "light_update"
    | "fog_update"
    | "effect_add"
    | "effect_remove";
  sceneId: string;
  data: any;
  timestamp: number;
  userId: string;
}

export interface LineOfSightResult {
  visible: boolean;
  blockedBy?: Array<{ x: number; y: number }>;
  partialCover: boolean;
  totalCover: boolean;
}
