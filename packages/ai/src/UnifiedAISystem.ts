import { EventEmitter } from 'events';
import { DynamicNPCManager, DynamicNPCConfig, NPCBehaviorContext } from './DynamicNPCManager';
import { VisionAIIntegration, VisionAIConfig, TokenAnalysis, MapAnalysis } from './VisionAIIntegration';
import { AIContentCache, AIContentCacheConfig } from './AIContentCache';
import { ProductionProviderRegistry, IntelligentProviderRouter } from './providers/RealProviders';
import { CampaignAssistant } from './campaign/CampaignAssistant';
import { NPCBehaviorSystem, NPCActor, BehaviorContext } from './NPCBehaviorSystem';
import { VisionStore, VisionData, EntityId } from '@vtt/core-ecs';
import { CacheManager, CacheConfig } from '@vtt/performance';
import { AIProvider } from './types';
import { logger } from '@vtt/logging';

// Default cache configurations
const _DEFAULT_CACHE_CONFIGS = {
  memory: { 
    maxMemorySize: 50 * 1024 * 1024, // 50MB
    maxEntries: 100,
    defaultTtl: 300000, // 5 minutes
    evictionPolicy: "lru" as const,
    compressionEnabled: false,
    cleanupInterval: 60000 // 1 minute
  },
  persistent: { 
    maxMemorySize: 200 * 1024 * 1024, // 200MB
    maxEntries: 1000,
    defaultTtl: 3600000, // 1 hour
    evictionPolicy: "lfu" as const,
    compressionEnabled: true,
    persistentStorage: true,
    cleanupInterval: 300000 // 5 minutes
  },
  realtime: { 
    maxMemorySize: 10 * 1024 * 1024, // 10MB
    maxEntries: 50,
    defaultTtl: 60000, // 1 minute
    evictionPolicy: "fifo" as const,
    compressionEnabled: false,
    cleanupInterval: 30000 // 30 seconds
  }
};

export interface UnifiedAIConfig {
  providers: {
    anthropic?: { apiKey: string; baseURL?: string; defaultModel?: string; };
    google?: { apiKey: string; baseURL?: string; projectId?: string; defaultModel?: string; };
    azure?: { apiKey: string; endpoint: string; deployments?: Record<string, any>; };
  };
  npc: {
    updateInterval: number;
    creativityLevel: number;
    maxContextLength: number;
  };
  vision: {
    analysisInterval: number;
    enableAutoAnalysis: boolean;
    detectionThreshold: number;
    maxAnalysisDistance: number;
  };
  cache: {
    enablePredictiveCache: boolean;
    maxPredictiveCacheSize: number;
    cacheHitThreshold: number;
  };
  performance: {
    enableMetrics: boolean;
    metricsInterval: number;
    maxEventHistory: number;
  };
}

export interface AISystemMetrics {
  npc: {
    activeNPCs: number;
    behaviorsGenerated: number;
    dialogueGenerated: number;
    personalitiesEvolved: number;
    averageResponseTime: number;
  };
  vision: {
    tokensAnalyzed: number;
    mapsAnalyzed: number;
    threatsDetected: number;
    cacheHitRate: number;
  };
  cache: {
    totalRequests: number;
    hitRate: number;
    tokensSaved: number;
    costSaved: number;
  };
  providers: {
    healthStatus: Record<string, { status: string; lastCheck: number; }>;
    totalRequests: number;
    failoverEvents: number;
  };
}

export interface AISystemEvent {
  type: 'npc_behavior_generated' | 'vision_analysis_complete' | 'threat_detected' | 'cache_optimized' | 'provider_failed' | 'system_initialized';
  timestamp: number;
  data: any;
  source: 'npc' | 'vision' | 'cache' | 'provider' | 'system';
}

/**
 * Unified AI System - Central coordinator for all AI subsystems
 * Provides a single interface for AI functionality with intelligent resource management
 */
export class UnifiedAISystem extends EventEmitter {
  private config: UnifiedAIConfig;
  private providerRegistry!: ProductionProviderRegistry;
  private providerRouter!: IntelligentProviderRouter;
  private aiContentCache!: AIContentCache;
  private dynamicNPCManager!: DynamicNPCManager;
  private visionAIIntegration!: VisionAIIntegration;
  
  // Core systems (injected)
  private campaignAssistant: CampaignAssistant;
  private npcBehaviorSystem: NPCBehaviorSystem;
  private visionStore: VisionStore;
  
  // Metrics and monitoring
  private metrics: AISystemMetrics;
  private eventHistory: AISystemEvent[] = [];
  private metricsTimer?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(
    config: UnifiedAIConfig,
    dependencies: {
      campaignAssistant: CampaignAssistant;
      npcBehaviorSystem: NPCBehaviorSystem;
      visionStore: VisionStore;
    }
  ) {
    super();
    this.config = config;
    this.campaignAssistant = dependencies.campaignAssistant;
    this.npcBehaviorSystem = dependencies.npcBehaviorSystem;
    this.visionStore = dependencies.visionStore;
    
    this.metrics = this.initializeMetrics();
    this.setMaxListeners(200);
  }

  /**
   * Initialize the unified AI system
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Unified AI System...');

      // Initialize provider registry and router
      await this.initializeProviders();

      // Initialize AI content cache
      await this.initializeCache();

      // Initialize subsystems
      await this.initializeSubsystems();

      // Setup cross-system integrations
      this.setupIntegrations();

      // Start monitoring
      if (this.config.performance.enableMetrics) {
        this.startMetricsCollection();
      }

      this.isInitialized = true;
      this.emitEvent({
        type: 'system_initialized',
        timestamp: Date.now(),
        data: { subsystems: ['providers', 'cache', 'npc', 'vision'] },
        source: 'system'
      });

      logger.info('Unified AI System initialized successfully');
    } catch (error) {
      logger.error('Error initializing AI system:', error as Record<string, any>);
      throw error;
    }
  }

  /**
   * Generate dynamic NPC behavior with integrated AI
   */
  async generateNPCBehavior(
    npcId: string,
    gameContext: BehaviorContext,
    campaignId: string
  ): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('AI System not initialized');
    }

    try {
      const campaignContext = this.campaignAssistant.getCampaignContext?.(campaignId);
      if (!campaignContext) {
        throw new Error(`Campaign context not found: ${campaignId}`);
      }

      const npcBehaviorContext: NPCBehaviorContext = {
        npc: this.npcBehaviorSystem.getNPC(npcId)!,
        gameContext,
        campaignContext,
        recentEvents: [],
        playerActions: gameContext.playerActions
      };

      const behavior = await this.dynamicNPCManager.generateNPCBehavior(npcId, npcBehaviorContext);
      
      if (behavior) {
        this.metrics.npc.behaviorsGenerated++;
        this.emitEvent({
          type: 'npc_behavior_generated',
          timestamp: Date.now(),
          data: { npcId, behavior },
          source: 'npc'
        });
      }

      return behavior;
    } catch (error) {
      logger.error(`Error generating NPC behavior for ${npcId}:`, error as Record<string, any>);
      throw error;
    }
  }

  /**
   * Analyze token with vision AI and integrate results
   */
  async analyzeTokenWithVision(
    entityId: EntityId,
    imageData: string | ArrayBuffer,
    context?: {
      lighting: number;
      distance: number;
      observerId: EntityId;
    }
  ): Promise<TokenAnalysis | null> {
    if (!this.isInitialized) {
      throw new Error('AI System not initialized');
    }

    try {
      const analysis = await this.visionAIIntegration.analyzeToken(entityId, imageData, context);
      
      if (analysis) {
        this.metrics.vision.tokensAnalyzed++;
        
        // Check for threats and integrate with NPC system
        if (analysis.threatLevel !== 'none') {
          this.handleThreatDetection(analysis, context);
        }

        // Update NPC knowledge if this is an NPC analyzing another entity
        if (context?.observerId) {
          await this.updateNPCKnowledge(context.observerId, analysis);
        }

        return analysis;
      }

      return null;
    } catch (error) {
      logger.error(`Error analyzing tokens:`, error as Record<string, any>);
      throw error;
    }
  }

  /**
   * Process player interaction with intelligent NPC response
   */
  async processPlayerInteraction(
    npcId: string,
    playerId: string,
    interaction: string,
    gameContext: BehaviorContext,
    campaignId: string
  ): Promise<{ response: string; actions: any[]; analysis?: TokenAnalysis }> {
    if (!this.isInitialized) {
      throw new Error('AI System not initialized');
    }

    try {
      const campaignContext = this.campaignAssistant.getCampaignContext?.(campaignId);
      if (!campaignContext) {
        throw new Error(`Campaign context not found: ${campaignId}`);
      }

      const npcBehaviorContext: NPCBehaviorContext = {
        npc: this.npcBehaviorSystem.getNPC(npcId)!,
        gameContext,
        campaignContext,
        recentEvents: [],
        playerActions: gameContext.playerActions
      };

      // Process the interaction
      const result = await this.dynamicNPCManager.processPlayerInteraction(
        npcId,
        playerId,
        interaction,
        gameContext,
        {} // campaignContext
      );

      // Optionally analyze player token for NPC awareness
      const playerEntity = gameContext.visibleEntities.find(e => e.id === playerId);
      let playerAnalysis: TokenAnalysis | undefined;
      
      if (playerEntity && playerEntity.distance <= 30) {
        // In a real implementation, you'd get the player's token image
        // playerAnalysis = await this.analyzeTokenWithVision(playerId, playerImageData);
      }

      this.metrics.npc.dialogueGenerated++;

      return {
        response: result.response,
        actions: result.actions || [],
        ...(playerAnalysis && { analysis: playerAnalysis }),
        ...(result.sentiment && { sentiment: result.sentiment })
      };
    } catch (error) {
      logger.error('Error processing NPC dialogue:', error as Record<string, any>);
      throw error;
    }
  }

  /**
   * Generate comprehensive scene description using AI
   */
  async generateSceneDescription(
    sceneId: string,
    mapImageData?: string | ArrayBuffer,
    visibleEntities?: Array<{ id: EntityId; imageData?: string | ArrayBuffer }>
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('AI System not initialized');
    }

    try {
      let mapAnalysis: MapAnalysis | null = null;
      const tokenAnalyses: TokenAnalysis[] = [];

      // Analyze map if provided
      if (mapImageData) {
        mapAnalysis = await this.visionAIIntegration.analyzeMap(sceneId, mapImageData);
        if (mapAnalysis) {
          this.metrics.vision.mapsAnalyzed++;
        }
      }

      // Analyze visible entities
      if (visibleEntities) {
        for (const entity of visibleEntities) {
          if (entity.imageData) {
            const analysis = await this.visionAIIntegration.analyzeToken(entity.id, entity.imageData);
            if (analysis) {
              tokenAnalyses.push(analysis);
            }
          }
        }
      }

      // Generate comprehensive description using cached AI
      const provider = await this.getOptimalProvider('text-generation');
      const description = await this.aiContentCache.generateText(provider, {
        prompt: this.buildSceneDescriptionPrompt(mapAnalysis, tokenAnalyses),
        maxTokens: 400,
        temperature: 0.7,
        model: 'claude-3-sonnet'
      });

      return description.success ? description.text : 'The area is shrouded in mystery.';
    } catch (error) {
      logger.error(`Error generating scene description for ${sceneId}:`, error as Record<string, any>);
      return 'The area is difficult to make out.';
    }
  }

  /**
   * Get system metrics and performance data
   */
  getMetrics(): AISystemMetrics {
    return {
      ...this.metrics,
      cache: {
        ...this.aiContentCache.getAnalytics(),
        costSaved: this.aiContentCache.getAnalytics().estimatedCostSaved
      },
      providers: {
        healthStatus: this.providerRouter.getHealthStatus(),
        totalRequests: this.metrics.providers.totalRequests,
        failoverEvents: this.metrics.providers.failoverEvents
      }
    };
  }

  /**
   * Optimize system performance
   */
  async optimizePerformance(): Promise<void> {
    try {
      // Analyze cache performance
      const cacheMetrics = this.aiContentCache.getAnalytics();
      
      if (cacheMetrics.hitRate < 0.6) {
        logger.info('Cache hit rate low, warming up frequently accessed content');
        // In a real implementation, identify and warm up commonly accessed content
      }

      // Cleanup old event history
      if (this.eventHistory.length > this.config.performance.maxEventHistory) {
        this.eventHistory = this.eventHistory.slice(-Math.floor(this.config.performance.maxEventHistory * 0.8));
      }

      // Trigger cache optimization
      this.emitEvent({
        type: 'cache_optimized',
        timestamp: Date.now(),
        data: { hitRate: cacheMetrics.hitRate, optimization: 'automatic' },
        source: 'cache'
      });

      logger.info('Performance optimization completed');
    } catch (error) {
      logger.error('Error during performance optimization:', error as Record<string, any>);
    }
  }

  private async initializeProviders(): Promise<void> {
    this.providerRegistry = new ProductionProviderRegistry();
    await this.providerRegistry.initializeFromConfig(this.config.providers);
    this.providerRouter = new IntelligentProviderRouter(this.providerRegistry);
  }

  private async initializeCache(): Promise<void> {
    const cacheConfig: AIContentCacheConfig = {
      textGenerationCache: _DEFAULT_CACHE_CONFIGS.memory,
      imageAnalysisCache: _DEFAULT_CACHE_CONFIGS.persistent,
      behaviorCache: _DEFAULT_CACHE_CONFIGS.realtime,
      dialogueCache: _DEFAULT_CACHE_CONFIGS.realtime,
      enablePredictiveCache: this.config.cache.enablePredictiveCache,
      maxPredictiveCacheSize: this.config.cache.maxPredictiveCacheSize,
      cacheHitThreshold: this.config.cache.cacheHitThreshold
    };

    this.aiContentCache = new AIContentCache(cacheConfig);
  }

  private async initializeSubsystems(): Promise<void> {
    // Initialize NPC manager
    const npcConfig: DynamicNPCConfig = {
      aiProvider: await this.getOptimalProvider('text-generation'),
      campaignAssistant: this.campaignAssistant,
      behaviorSystem: this.npcBehaviorSystem,
      updateInterval: this.config.npc.updateInterval,
      maxContextLength: this.config.npc.maxContextLength,
      creativityLevel: this.config.npc.creativityLevel
    };
    this.dynamicNPCManager = new DynamicNPCManager(npcConfig);

    // Initialize vision AI
    const visionConfig: VisionAIConfig = {
      aiProvider: await this.getOptimalProvider('image-analysis'),
      visionStore: this.visionStore,
      cacheManager: new CacheManager(_DEFAULT_CACHE_CONFIGS.persistent),
      analysisInterval: this.config.vision.analysisInterval,
      enableAutoAnalysis: this.config.vision.enableAutoAnalysis,
      detectionThreshold: this.config.vision.detectionThreshold,
      maxAnalysisDistance: this.config.vision.maxAnalysisDistance
    };
    this.visionAIIntegration = new VisionAIIntegration(visionConfig);
  }

  private setupIntegrations(): void {
    // Connect NPC manager events
    this.dynamicNPCManager.on('behaviorGenerated', (data) => {
      this.emitEvent({
        type: 'npc_behavior_generated',
        timestamp: Date.now(),
        data,
        source: 'npc'
      });
    });

    // Connect vision AI events
    this.visionAIIntegration.on('threatDetected', (data) => {
      this.metrics.vision.threatsDetected++;
      this.emitEvent({
        type: 'threat_detected',
        timestamp: Date.now(),
        data,
        source: 'vision'
      });
    });

    // Connect cache events
    this.aiContentCache.on('cacheHit', () => {
      this.metrics.cache.totalRequests++;
    });
  }

  private async getOptimalProvider(category: string): Promise<AIProvider> {
    const result = await this.providerRouter.selectProvider(category);
    return result.provider;
  }

  private handleThreatDetection(analysis: TokenAnalysis, context?: any): void {
    // Notify all NPCs in the area about the threat
    const nearbyNPCs = this.npcBehaviorSystem.getActiveNPCs().filter(npc => {
      if (!context?.observerId) {return false;}
      const distance = this.calculateDistance(npc.position, context);
      return distance <= 100; // Within 100 units
    });

    for (const npc of nearbyNPCs) {
      // Update NPC threat awareness
      npc.behaviorState.alertLevel = Math.min(1, npc.behaviorState.alertLevel + 0.3);
      npc.behaviorState.lastThreatTime = Date.now();
    }

    this.emitEvent({
      type: 'threat_detected',
      timestamp: Date.now(),
      data: { analysis, affectedNPCs: nearbyNPCs.length },
      source: 'vision'
    });
  }

  private async updateNPCKnowledge(observerId: EntityId, analysis: TokenAnalysis): Promise<void> {
    const npc = this.npcBehaviorSystem.getNPC(observerId.toString());
    if (!npc) {return;}

    // Add to NPC memory
    npc.behaviorState.memory.push({
      id: `analysis_${Date.now()}`,
      type: analysis.threatLevel !== 'none' ? 'threat' : 'ally',
      entityId: analysis.entityId.toString(),
      description: analysis.description,
      importance: analysis.threatLevel === 'extreme' ? 0.9 : 0.5,
      timestamp: Date.now(),
      decay: 0.1
    });
  }

  private buildSceneDescriptionPrompt(mapAnalysis: MapAnalysis | null, tokenAnalyses: TokenAnalysis[]): string {
    let prompt = 'Describe this RPG scene in vivid detail for players:\n\n';
    
    if (mapAnalysis) {
      prompt += `Environment: ${mapAnalysis.environment}\n`;
      prompt += `Lighting: ${mapAnalysis.lighting}\n`;
      prompt += `Atmosphere: ${mapAnalysis.atmosphere}\n`;
      
      if (mapAnalysis.interestPoints.length > 0) {
        prompt += `Notable features: ${mapAnalysis.interestPoints.map(p => p.description).join(', ')}\n`;
      }
    }

    if (tokenAnalyses.length > 0) {
      prompt += `\nVisible creatures/characters:\n`;
      tokenAnalyses.forEach(analysis => {
        prompt += `- ${analysis.description} (${analysis.species}, ${analysis.threatLevel} threat)\n`;
      });
    }

    prompt += '\nGenerate a 2-3 sentence atmospheric description that captures the scene\'s mood and important details.';
    
    return prompt;
  }

  private calculateDistance(pos1: { x: number; y: number }, pos2: { x: number; y: number }): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private initializeMetrics(): AISystemMetrics {
    return {
      npc: {
        activeNPCs: 0,
        behaviorsGenerated: 0,
        dialogueGenerated: 0,
        personalitiesEvolved: 0,
        averageResponseTime: 0
      },
      vision: {
        tokensAnalyzed: 0,
        mapsAnalyzed: 0,
        threatsDetected: 0,
        cacheHitRate: 0
      },
      cache: {
        totalRequests: 0,
        hitRate: 0,
        tokensSaved: 0,
        costSaved: 0
      },
      providers: {
        healthStatus: {},
        totalRequests: 0,
        failoverEvents: 0
      }
    };
  }

  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.updateMetrics();
    }, this.config.performance.metricsInterval);
  }

  private updateMetrics(): void {
    // Update NPC metrics
    this.metrics.npc.activeNPCs = this.npcBehaviorSystem.getActiveNPCs().length;
    
    // Update cache metrics from AIContentCache
    const cacheAnalytics = this.aiContentCache.getAnalytics();
    this.metrics.cache = {
      totalRequests: cacheAnalytics.totalRequests,
      hitRate: cacheAnalytics.hitRate,
      tokensSaved: cacheAnalytics.tokensSaved,
      costSaved: cacheAnalytics.estimatedCostSaved
    };
  }

  private emitEvent(event: AISystemEvent): void {
    this.eventHistory.push(event);
    this.emit('aiSystemEvent', event);
    
    // Emit specific event types
    this.emit(event.type, event.data);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }

    this.dynamicNPCManager?.dispose();
    this.visionAIIntegration?.dispose();
    this.aiContentCache?.dispose();
    
    this.eventHistory = [];
    this.removeAllListeners();
    
    logger.info('Unified AI System disposed');
  }
}
