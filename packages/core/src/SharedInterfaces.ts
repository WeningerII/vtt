/**
 * Shared Interfaces and Types for the VTT Platform
 * Centralizes all common data structures and type definitions
 */

// ==================== BASIC TYPES ====================

export interface Vector2 {
  x: number;
  y: number;
}

export interface Vector3 extends Vector2 {
  z: number;
}

export interface Vector4 extends Vector3 {
  w: number;
}

export interface Matrix4 {
  elements: Float32Array;
}

export interface Transform {
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
}

export interface AABB {
  min: Vector3;
  max: Vector3;
}

export interface Color {
  r: number;
  g: number;
  b: number;
  a?: number;
}

// ==================== DISPOSABLE PATTERN ====================

export interface Disposable {
  dispose(): void;
}

// ==================== GPU RESOURCE MANAGEMENT ====================

export interface GPUResourceInfo {
  id: string;
  type: "buffer" | "texture" | "pipeline" | "sampler";
  size: number;
  usage: number;
  label?: string;
  createdAt: Date;
  lastUsed: Date;
}

export interface GPUResourceManager extends Disposable {
  initialize(): Promise<void>;
  createBuffer(size: number, usage: number, label?: string): string;
  createTexture(
    width: number,
    height: number,
    format: string,
    usage: number,
    label?: string,
  ): string;
  getResource(id: string): GPUResourceInfo | null;
  destroyResource(id: string): void;
  getMemoryUsage(): { used: number; total: number };
}

// ==================== ASSET MANAGEMENT ====================

export interface AssetInfo {
  id: string;
  path: string;
  type: AssetType;
  format: string;
  size: number;
  checksum: string;
  metadata: Record<string, any>;
  dependencies: string[];
  loadedAt?: Date;
}

export type AssetType =
  | "texture"
  | "model"
  | "audio"
  | "data"
  | "shader"
  | "material"
  | "animation";

export interface AssetLoadOptions {
  priority?: number;
  cache?: boolean;
  timeout?: number;
  transform?: (_data: any) => any;
}

export interface AssetManager extends Disposable {
  initialize(): Promise<void>;
  register(path: string, type: AssetType, metadata?: Record<string, any>): Promise<string>;
  load<T = any>(id: string, options?: AssetLoadOptions): Promise<T>;
  unload(id: string): void;
  get<T = any>(id: string): T | null;
  getInfo(id: string): AssetInfo | null;
  query(filter: Partial<AssetInfo>): AssetInfo[];
}

// ==================== AI PROVIDER INTERFACES ====================

export interface AIProvider {
  readonly name: string;
  readonly type: "chat" | "completion" | "embedding" | "image" | "audio";
  readonly capabilities: AICapability[];
  generateText?(prompt: string, options?: AITextOptions): Promise<AITextResponse>;
  generateImage?(prompt: string, options?: AIImageOptions): Promise<AIImageResponse>;
  generateAudio?(prompt: string, options?: AIAudioOptions): Promise<AIAudioResponse>;
  generateCode?(prompt: string, options?: AICodeOptions): Promise<AICodeResponse>;
  createEmbeddings?(text: string): Promise<number[]>;
}

export type AICapability =
  | "text_generation"
  | "code_generation"
  | "image_generation"
  | "audio_generation"
  | "embeddings"
  | "vision"
  | "function_calling";

export interface AITextOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  systemPrompt?: string;
  context?: string[];
}

export interface AITextResponse {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: "stop" | "length" | "tool_calls";
}

export interface AIImageOptions {
  model?: string;
  size?: "256x256" | "512x512" | "1024x1024" | "1792x1024" | "1024x1792";
  quality?: "standard" | "hd";
  style?: "vivid" | "natural";
  n?: number;
}

export interface AIImageResponse {
  images: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
  created: number;
}

export interface AIAudioOptions {
  model?: string;
  voice?: string;
  format?: "mp3" | "opus" | "aac" | "flac";
  speed?: number;
}

export interface AIAudioResponse {
  audio: ArrayBuffer;
  format: string;
  duration: number;
}

export interface AICodeOptions {
  language?: string;
  style?: "functional" | "object-oriented" | "modern";
  complexity?: "simple" | "intermediate" | "advanced";
  includeTests?: boolean;
  includeComments?: boolean;
}

export interface AICodeResponse {
  code: string;
  language: string;
  explanation?: string;
  tests?: string;
}

// ==================== STATE MANAGEMENT ====================

export interface StateManager<T = any> extends Disposable {
  getState(): T;
  setState(newState: Partial<T>): void;
  subscribe(listener: StateListener<T>): () => void;
  snapshot(): StateSnapshot<T>;
  restore(snapshot: StateSnapshot<T>): void;
  reset(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): boolean;
  redo(): boolean;
  save(): Promise<void>;
  load(): Promise<void>;
  batch(_updates: () => void): void;
}

export type StateListener<T> = (_newState: T, _previousState: T) => void;

export interface StateEvents<T = any> {
  stateChanged: { newState: T; previousState: T };
  stateReset: { state: T };
  stateLoaded: { timestamp: Date };
  undoPerformed: { state: T };
  redoPerformed: { state: T };
  snapshotCreated: { snapshot: StateSnapshot<T> };
}

export interface StateSnapshot<T = any> {
  id: string;
  timestamp: Date;
  state: T;
  metadata?: Record<string, any>;
}

// ==================== PERFORMANCE MONITORING ====================

export interface PerformanceMonitor extends Disposable {
  startProfiling(name: string, trackMemory?: boolean): PerformanceProfiler;
  endProfiling(profiler: PerformanceProfiler): PerformanceMeasurement;
  addMeasurement(name: string, duration: number, tags?: Record<string, string>): void;
  getMeasurements(name?: string): PerformanceMeasurement[];
  getStats(): PerformanceStats;
  clearMeasurements(): void;
  trackFPS(fps: number, frameTime: number): void;
  getMemoryInfo(): MemoryInfo;
  increment(counter: string, value?: number): void;
  decrement(counter: string, value?: number): void;
  gauge(metric: string, value: number): void;
}

export interface PerformanceProfiler {
  readonly name: string;
  readonly startTime: number;
  addTag(key: string, value: string): void;
  getTags(): Record<string, string>;
  getElapsedTime(): number;
  getMemoryDelta(): MemoryMeasurement | null;
}

export interface PerformanceMeasurement {
  name: string;
  duration: number;
  timestamp: number;
  tags: Record<string, string>;
  memory?: MemoryMeasurement;
}

export interface PerformanceStats {
  totalMeasurements: number;
  averageDuration: number;
  averageFrameTime: number;
  minDuration: number;
  maxDuration: number;
  p50: number;
  p95: number;
  p99: number;
  counters: Record<string, number>;
  gauges: Record<string, number>;
}

export interface PerformanceMetrics extends PerformanceStats {
  fps: number;
  frameCount: number;
  memoryUsage: MemoryInfo;
}

export interface MemoryInfo {
  used: number;
  total: number;
  limit: number;
  available: number;
}

export interface MemoryMeasurement {
  used: number;
  total: number;
  delta: number;
}

// ==================== NETWORKING ====================

export interface NetworkManager extends Disposable {
  connect(url: string, options?: ConnectionOptions): Promise<void>;
  disconnect(): void;
  send(message: NetworkMessage): void;
  subscribe(type: string, handler: MessageHandler): () => void;
  getConnectionState(): ConnectionState;
  getLatency(): number;
}

export interface ConnectionOptions {
  timeout?: number;
  retries?: number;
  reconnect?: boolean;
  heartbeat?: number;
}

export interface NetworkMessage {
  type: string;
  data: any;
  id?: string;
  timestamp?: number;
}

export type MessageHandler = (_message: NetworkMessage) => void;

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

// ==================== COMPONENT SYSTEM ====================

export interface Component {
  readonly id: string;
  name: string;
  type: ComponentType;
  properties: ComponentProperties;
  children: Component[];
  parent: Component | undefined;
  initialize(): Promise<void>;
  update(deltaTime: number): void;
  render(): void;
  destroy(): void;
  addEventListener(event: string, handler: EventListener): void;
  removeEventListener(event: string, handler: EventListener): void;
  addChild(child: Component): void;
  removeChild(child: Component): void;
  findChild(id: string): Component | null;
  findChildByType(type: ComponentType): Component | null;
}

export type ComponentType =
  | "ui_element"
  | "panel"
  | "dialog"
  | "layout"
  | "widget"
  | "control"
  | "game_object"
  | "system"
  | "behavior"
  | "effect";

export interface ComponentProperties {
  [key: string]: any;
}

export interface ComponentFactory extends Disposable {
  create(type: ComponentType, properties?: ComponentProperties): Component;
  register(type: ComponentType, constructor: ComponentConstructor): void;
  getAvailableTypes(): ComponentType[];
}

export type ComponentConstructor = new (_properties?: ComponentProperties) => Component;

// ==================== PLUGIN SYSTEM ====================

export interface PluginManager extends Disposable {
  register(plugin: Plugin): void;
  unregister(id: string): void;
  get(id: string): Plugin | null;
  getAll(): Plugin[];
  isEnabled(id: string): boolean;
  enable(id: string): void;
  disable(id: string): void;
}

export interface Plugin extends Disposable {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly dependencies: string[];
  readonly author: string;
  readonly description: string;
  initialize(): Promise<void>;
  activate(): void;
  deactivate(): void;
}

// ==================== ERROR HANDLING ====================

export interface ErrorInfo {
  message: string;
  stack?: string;
  code?: string;
  timestamp: Date;
  context?: Record<string, any>;
}

export interface ErrorHandlerInterface {
  handleError(error: Error, context?: Record<string, any>): void;
  getErrors(): ErrorInfo[];
  clearErrors(): void;
}

// ==================== UTILITY TYPES ====================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredKeys<T> = {
  [K in keyof T]-?: object extends Pick<T, K> ? never : K;
}[keyof T];

export type OptionalKeys<T> = {
  [K in keyof T]-?: object extends Pick<T, K> ? K : never;
}[keyof T];

// ==================== EVENT TYPES ====================

export interface SystemEvent {
  type: string;
  timestamp: Date;
  source: string;
  data?: any;
}

export type EventCallback<T = any> = (_event: T) => void;

// ==================== CONFIGURATION ====================

export interface ConfigManager {
  get<T = any>(key: string, defaultValue?: T): T;
  set(key: string, value: any): void;
  has(key: string): boolean;
  remove(key: string): void;
  getAll(): Record<string, any>;
  save(): Promise<void>;
  load(): Promise<void>;
}
