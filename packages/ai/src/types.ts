/**
 * Enhanced type definitions for modern AI provider integration
 */

// Core AI Context and Request Types
export interface AIContext {
  traceId?: string;
  budgetUSD?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  userId?: string;
  sessionId?: string;
}

export interface ProviderCallMeta {
  provider: string;
  model: string;
  costUSD: number;
  latencyMs: number;
  tokensUsed?: {
    input: number;
    output: number;
    total: number;
  };
}

// Enhanced Provider Interface
export interface AIProvider {
  name: string;
  version: string;
  deprecationDate?: Date;
  
  capabilities(): AICapability[];
  
  // Core generation methods
  generateText?(req: TextGenerationRequest, ctx?: AIContext): Promise<TextGenerationResult>;
  generateImage?(req: ImageGenerationRequest, ctx?: AIContext): Promise<ImageGenerationResult>;
  generateAudio?(req: AudioGenerationRequest, ctx?: AIContext): Promise<AudioGenerationResult>;
  generateVideo?(req: VideoGenerationRequest, ctx?: AIContext): Promise<VideoGenerationResult>;
  
  // Analysis methods
  analyzeImage?(req: ImageAnalysisRequest, ctx?: AIContext): Promise<ImageAnalysisResult>;
  analyzeAudio?(req: AudioAnalysisRequest, ctx?: AIContext): Promise<AudioAnalysisResult>;
  transcribe?(req: TranscriptionRequest, ctx?: AIContext): Promise<TranscriptionResult>;
  
  // Embedding methods
  generateEmbedding?(req: EmbeddingRequest, ctx?: AIContext): Promise<EmbeddingResult>;
  
  // Health check
  healthCheck(): Promise<HealthStatus>;
}

// Capability System
export interface AICapability {
  type: 'text' | 'image' | 'audio' | 'video' | 'embedding' | 'multimodal';
  subtype?: 'generation' | 'analysis' | 'transcription' | 'translation';
  models: ModelInfo[];
  limits?: CapabilityLimits;
}

export interface ModelInfo {
  id: string;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportedFormats?: string[];
  pricing: PricingInfo;
  deprecationDate?: Date;
  replacementModel?: string;
  features?: ModelFeature[];
}

export interface ModelFeature {
  name: string;
  description: string;
  enabled: boolean;
}

export interface PricingInfo {
  input: number; // Cost per 1K tokens
  output: number; // Cost per 1K tokens
  currency: string;
  lastUpdated: Date;
}

export interface CapabilityLimits {
  maxRequestsPerMinute?: number;
  maxTokensPerRequest?: number;
  maxConcurrentRequests?: number;
  maxFileSize?: number;
}

// Text Generation
export interface TextGenerationRequest {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  systemPrompt?: string;
  stopSequences?: string[];
  
  // Advanced features
  reasoning?: boolean;
  outputFormat?: 'text' | 'json' | 'markdown';
  safetyLevel?: 'low' | 'standard' | 'high';
  reasoningEffort?: 'low' | 'standard' | 'high';
  outputStructure?: any;
  
  // Tool use
  tools?: Tool[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  parallelToolCalls?: boolean;
  
  // Context management
  context?: string;
  cachedContent?: string;
}

export interface TextGenerationResult extends ProviderCallMeta {
  text: string;
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  toolCalls?: ToolCall[];
  reasoning?: string;
}

// Image Generation
export interface ImageGenerationRequest {
  prompt: string;
  model?: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  count?: number;
  seed?: number;
  
  // Style controls
  stylePreset?: string;
  guidanceScale?: number;
  aspectRatio?: string;
  format?: 'png' | 'jpeg' | 'webp';
  
  // Advanced features
  referenceImage?: ImageDataRef;
  maskImage?: ImageDataRef;
  strength?: number;
}

export interface ImageGenerationResult extends ProviderCallMeta {
  images: ImageDataRef[];
  seed?: number;
  revisedPrompt?: string;
}

// Audio Generation
export interface AudioGenerationRequest {
  text?: string;
  model?: string;
  voice?: string;
  speed?: number;
  format?: 'mp3' | 'wav' | 'ogg';
  
  // Music generation
  prompt?: string;
  duration?: number;
  genre?: string;
  mood?: string;
}

export interface AudioGenerationResult extends ProviderCallMeta {
  audio: AudioDataRef;
  duration?: number;
}

// Video Generation
export interface VideoGenerationRequest {
  prompt: string;
  model?: string;
  duration?: number;
  fps?: number;
  resolution?: '720p' | '1080p' | '4k';
  aspectRatio?: '16:9' | '9:16' | '1:1';
  
  // Style controls
  motionIntensity?: 'low' | 'medium' | 'high';
  cameraMovement?: string;
  referenceImage?: ImageDataRef;
}

export interface VideoGenerationResult extends ProviderCallMeta {
  video: VideoDataRef;
  thumbnail?: ImageDataRef;
  duration: number;
}

// Analysis Requests
export interface ImageAnalysisRequest {
  image: ImageDataRef;
  prompt: string;
  model?: string;
  maxTokens?: number;
  
  // Analysis types
  detectObjects?: boolean;
  readText?: boolean;
  describeScene?: boolean;
  identifyPeople?: boolean;
}

export interface ImageAnalysisResult extends ProviderCallMeta {
  analysis: string;
  objects?: DetectedObject[];
  text?: ExtractedText[];
  faces?: DetectedFace[];
  confidence?: number;
}

export interface AudioAnalysisRequest {
  audio: AudioDataRef;
  model?: string;
  
  // Analysis types
  transcribe?: boolean;
  detectSpeakers?: boolean;
  analyzeSentiment?: boolean;
  detectLanguage?: boolean;
}

export interface AudioAnalysisResult extends ProviderCallMeta {
  transcription?: string;
  speakers?: SpeakerInfo[];
  sentiment?: SentimentInfo;
  language?: string;
  confidence?: number;
}

// Transcription
export interface TranscriptionRequest {
  audio: AudioDataRef;
  model?: string;
  language?: string;
  
  // Options
  timestamps?: boolean;
  speakerLabels?: boolean;
  punctuation?: boolean;
  profanityFilter?: boolean;
}

export interface TranscriptionResult extends ProviderCallMeta {
  text: string;
  segments?: TranscriptionSegment[];
  speakers?: SpeakerInfo[];
  language?: string;
  confidence?: number;
}

// Embeddings
export interface EmbeddingRequest {
  input: string | string[];
  model?: string;
  dimensions?: number;
  
  // Task-specific
  taskType?: 'search' | 'similarity' | 'classification';
}

export interface EmbeddingResult extends ProviderCallMeta {
  embeddings: number[][];
  dimensions: number;
}

// Data References
export interface ImageDataRef {
  uri: string;
  width?: number;
  height?: number;
  mimeType?: string;
  size?: number;
}

export interface AudioDataRef {
  uri: string;
  duration?: number;
  mimeType?: string;
  size?: number;
  sampleRate?: number;
}

export interface VideoDataRef {
  uri: string;
  duration: number;
  width?: number;
  height?: number;
  mimeType?: string;
  size?: number;
  fps?: number;
}

// Tool System
export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any; // JSON Schema
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// Detection Results
export interface DetectedObject {
  label: string;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface DetectedFace {
  confidence: number;
  boundingBox: BoundingBox;
  landmarks?: FaceLandmark[];
  emotions?: EmotionScore[];
}

export interface ExtractedText {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceLandmark {
  type: string;
  x: number;
  y: number;
}

export interface EmotionScore {
  emotion: string;
  score: number;
}

// Audio Analysis
export interface SpeakerInfo {
  id: string;
  label?: string;
  confidence?: number;
  segments?: TimeSegment[];
}

export interface SentimentInfo {
  overall: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
}

export interface TranscriptionSegment {
  text: string;
  startTime: number;
  endTime: number;
  speakerId?: string;
  confidence?: number;
}

export interface TimeSegment {
  startTime: number;
  endTime: number;
}

// Health Status
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  lastCheck: Date;
  details?: Record<string, any>;
}

// Model Mapping
export interface ModelMapping {
  providers: Record<string, string>;
  capabilities: string[];
  contextWindow: number;
  fallbackChain: string[];
  costTier?: 'low' | 'medium' | 'high';
}

// Circuit Breaker
export interface CircuitState {
  status: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailure?: Date;
  openedAt?: number;
  nextAttempt?: number;
}

export interface ProviderMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  lastUpdated: Date;
}

// Configuration
export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  monitoringWindowMs: number;
  halfOpenMaxCalls: number;
}

export interface DeprecationInfo {
  provider: string;
  model: string;
  deprecationDate: Date;
  replacementModel?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface MigrationPlan {
  deprecatedModel: string;
  replacementModel: string;
  migrationSteps: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
  codeChanges: CodeChange[];
}

export interface CodeChange {
  file: string;
  line: number;
  oldCode: string;
  newCode: string;
  description: string;
}

// Task Constraints
export interface TaskConstraints {
  maxCost?: number;
  maxLatency?: number;
  minContextWindow?: number;
  requiredCapabilities?: string[];
  excludeProviders?: string[];
}

export interface ModelSelection {
  primary: ModelInfo;
  fallbacks: ModelInfo[];
  estimatedCost: number;
  reasoning?: string;
}

// Budget Management
export interface Budget {
  limit: number;
  period: 'daily' | 'weekly' | 'monthly';
  alertThresholds: number[];
}

export interface UsageTracker {
  totalSpent: number;
  spentByProvider: Record<string, number>;
  requestCount: number;
  lastReset: Date;
  
  record(cost: number, provider: string): void;
  reset(): void;
}

// Batch Processing
export interface BatchOptions {
  batchSize?: number;
  delayMs?: number;
  retries?: number;
  failFast?: boolean;
}

// VTT-Specific Types
export interface VTTContentRequest {
  contentType: 'npc' | 'location' | 'quest' | 'item' | 'encounter';
  context: {
    setting?: string;
    theme?: string;
    difficulty?: string;
    playerLevel?: number;
    additionalContext?: string;
  };
  format?: 'json' | 'markdown' | 'text';
}

export interface VTTContentResult extends ProviderCallMeta {
  content: any;
  metadata?: {
    difficulty?: string;
    tags?: string[];
    references?: string[];
  };
}
