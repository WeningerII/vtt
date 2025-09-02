/**
 * Type definitions for AI Integration Systems
 */

// Core AI Integration Types
export interface AIIntegrationContext {
  sessionId?: string;
  userId?: string;
  campaignId?: string;
  timestamp: number;
}

// NPC Behavior Types
export interface NPCBehaviorContext {
  npc: {
    id: string;
    name: string;
    personality?: {
      traits: string[];
      motivations: string[];
      fears: string[];
      goals: string[];
      relationships: Map<string, number>;
    };
  };
  location: string;
  nearbyEntities: string[];
  currentGoal: string;
  threatLevel: 'none' | 'low' | 'medium' | 'high';
  gameState?: Record<string, any>;
}

export interface GeneratedBehavior {
  action: string;
  description: string;
  priority: number;
  duration?: number;
  conditions?: string[];
}

export interface InteractionHistory {
  timestamp: number;
  playerId: string;
  action: string;
  npcResponse: string;
  sentiment: number;
}

export interface PersonalityEvolution {
  traits: string[];
  motivations: string[];
  fears: string[];
  goals: string[];
  relationships: Map<string, number>;
  changes: string[];
}

export interface NPCResponse {
  response: string;
  actions: ActionResult[];
  analysis?: TokenAnalysis;
}

export interface ActionResult {
  type: string;
  description: string;
  success: boolean;
}

// Vision AI Types
export interface TokenAnalysis {
  species: string;
  threatLevel: 'none' | 'low' | 'medium' | 'high';
  equipment: string[];
  emotions: string[];
  confidence: number;
}

export interface VisionEvent {
  type: 'token_moved' | 'token_added' | 'token_removed' | 'visibility_changed';
  entityId: string;
  position?: { x: number; y: number };
  data?: Record<string, any>;
}

export interface VisionAnalysisResult {
  entityId: string;
  analysis: TokenAnalysis;
  timestamp: number;
  cached: boolean;
}

// Cache Types
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  priority: number;
  accessCount: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
  hitRate: number;
}

// AI Provider Compatibility Types
export interface CompatibleAIProvider {
  name: string;
  generateText?: (params: {
    prompt: string;
    maxTokens?: number;
    temperature?: number;
    model?: string;
  }) => Promise<{ text?: string; tokens?: number; cost?: number }>;
  analyzeImage?: (params: {
    prompt: string;
    image: string;
  }) => Promise<{ analysis?: string; success: boolean }>;
}

// Event Types
export interface AISystemEvent {
  type: string;
  timestamp: number;
  data: Record<string, any>;
}

export interface BehaviorGeneratedEvent extends AISystemEvent {
  type: 'behaviorGenerated';
  data: {
    npcId: string;
    behavior: GeneratedBehavior;
    context: Record<string, any>;
  };
}

export interface DialogueGeneratedEvent extends AISystemEvent {
  type: 'dialogueGenerated';
  data: {
    npcId: string;
    dialogue: string[];
    topic?: string;
  };
}

export interface PersonalityEvolvedEvent extends AISystemEvent {
  type: 'personalityEvolved';
  data: {
    npcId: string;
    evolution: PersonalityEvolution;
    interactions: InteractionHistory[];
  };
}

export interface PlayerInteractionEvent extends AISystemEvent {
  type: 'playerInteraction';
  data: {
    npcId: string;
    playerId: string;
    interaction: string;
    response: string;
  };
}

export interface VisionAnalysisEvent extends AISystemEvent {
  type: 'visionAnalysis';
  data: {
    entityId: string;
    analysis: TokenAnalysis;
    cached: boolean;
  };
}

// Configuration Types
export interface DynamicNPCConfig {
  aiProvider: CompatibleAIProvider;
  campaignAssistant: {
    context?: Record<string, any>;
  };
  behaviorSystem: {
    getNPC: (id: string) => any;
  };
  updateInterval: number;
  maxContextLength: number;
  creativityLevel: number;
}

export interface VisionAIConfig {
  aiProvider: CompatibleAIProvider;
  visionStore: any;
  cacheManager: any;
  analysisInterval: number;
  enableAutoAnalysis: boolean;
  detectionThreshold: number;
  maxAnalysisDistance: number;
}

export interface AIContentCacheConfig {
  maxSize: number;
  defaultTTL: number;
  cleanupInterval: number;
  enablePredictiveCache: boolean;
  cacheTypes: {
    textGeneration: { ttl: number; priority: number };
    imageAnalysis: { ttl: number; priority: number };
    npcBehavior: { ttl: number; priority: number };
    dialogue: { ttl: number; priority: number };
  };
}

export interface UnifiedAISystemConfig {
  providerRegistry: any;
  providerRouter: any;
  cacheManager: any;
  campaignAssistant: any;
  behaviorSystem: any;
  visionStore: any;
  enableMetrics: boolean;
  updateInterval: number;
}

// Metrics Types
export interface AISystemMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  totalCost: number;
  cacheHitRate: number;
  activeNPCs: number;
  lastUpdated: number;
}

export interface ProviderMetrics {
  provider: string;
  requests: number;
  successes: number;
  failures: number;
  averageLatency: number;
  totalCost: number;
}
