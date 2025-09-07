import { EventEmitter } from 'events';
import { VisionStore, VisionData, EntityId } from '@vtt/core-ecs';
import { AIProvider } from './types';
import { CacheManager, CacheConfig } from '@vtt/performance';
import { logger } from '@vtt/logging';

export interface TokenAnalysis {
  entityId: EntityId;
  entities: EntityId[];
  description: string;
  detectedFeatures: string[];
  threatLevel: 'none' | 'low' | 'medium' | 'high' | 'extreme';
  emotions: string[];
  equipment: string[];
  magicalAuras: string[];
  species: string;
  confidence: number;
}

export interface MapAnalysis {
  sceneId: string;
  environment: string;
  lighting: 'bright' | 'dim' | 'dark' | 'magical';
  hazards: Array<{
    type: string;
    location: { x: number; y: number };
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
  interestPoints: Array<{
    type: 'door' | 'chest' | 'altar' | 'trap' | 'secret' | 'decoration';
    location: { x: number; y: number };
    description: string;
  }>;
  atmosphere: string;
  suggestedMusic: string[];
}

export interface VisionEvent {
  observerId: EntityId;
  targetId: EntityId;
  eventType: 'spotted' | 'lost_sight' | 'analyzed' | 'threat_detected';
  timestamp: number;
  analysis?: TokenAnalysis;
  confidence: number;
}

export interface VisionAIConfig {
  aiProvider: AIProvider;
  visionStore: VisionStore;
  cacheManager: CacheManager;
  analysisInterval: number;
  enableAutoAnalysis: boolean;
  detectionThreshold: number;
  maxAnalysisDistance: number;
}

/**
 * Vision AI Integration - Connects image analysis to map/token vision systems
 * Provides intelligent analysis of what NPCs and players can see
 */
export class VisionAIIntegration extends EventEmitter {
  private config: VisionAIConfig;
  private tokenAnalysisCache = new Map<string, TokenAnalysis>();
  private mapAnalysisCache = new Map<string, MapAnalysis>();
  private visionEventHistory: VisionEvent[] = [];
  // Implementation moved from abstract declaration
  private analysisTimer?: NodeJS.Timeout;
  private pendingAnalysis = new Set<string>();

  constructor(config: VisionAIConfig) {
    super();
    this.config = config;
    this.setMaxListeners(100);
    
    if (config.enableAutoAnalysis) {
      this.startPeriodicAnalysis();
    }
  }

  /**
   * Analyze a token/character using AI vision
   */
  async analyzeToken(
    entityId: EntityId, 
    imageData: string | ArrayBuffer,
    context?: {
      lighting: number;
      distance: number;
      observerId: EntityId;
    }
  ): Promise<TokenAnalysis | null> {
    try {
      const cacheKey = `token_${entityId}_${this.hashImageData(imageData)}`;
      
      // Check cache first
      const cached = await this.config.cacheManager.get<TokenAnalysis>(cacheKey);
      if (cached) {
        this.emit('tokenAnalyzed', { entityId, analysis: cached, fromCache: true });
        return cached;
      }

      // Prevent duplicate analysis
      if (this.pendingAnalysis.has(cacheKey)) {
        return null;
      }
      this.pendingAnalysis.add(cacheKey);

      const prompt = this.buildTokenAnalysisPrompt(context);
      
      if (!this.config.aiProvider?.analyzeImage) {return null;}

      const response = await this.config.aiProvider.analyzeImage({
        image: imageData as any, // Type assertion for compatibility
        prompt,
        maxTokens: 600,
        model: 'claude-3-sonnet'
      });

      this.pendingAnalysis.delete(cacheKey);

      if (response && response.analysis) {
        const analysis = this.parseTokenAnalysis(response.analysis, entityId, context);
        
        if (analysis) {
          // Cache the analysis
          await this.config.cacheManager.set(cacheKey, analysis, {
            ttl: 10 * 60 * 1000, // 10 minutes
            tags: ['token-analysis', `entity-${entityId}`],
            priority: 0.7
          });

          this.tokenAnalysisCache.set(entityId.toString(), analysis);
          this.emit('tokenAnalyzed', { entityId, analysis, fromCache: false });
          
          // Update vision data with analysis results
          this.updateVisionDataFromAnalysis(entityId, analysis);
          
          return analysis;
        }
      }

      return null;
    } catch (error) {
      logger.error(`Error analyzing token ${entityId}:`, error as Error);
      this.pendingAnalysis.delete(`token_${entityId}_${this.hashImageData(imageData)}`);
      return null;
    }
  }

  /**
   * Analyze a map/scene using AI vision
   */
  async analyzeMap(
    sceneId: string,
    imageData: string | ArrayBuffer,
    context?: {
      gridSize: number;
      scale: string;
      gameSystem: string;
    }
  ): Promise<MapAnalysis | null> {
    try {
      const cacheKey = `map_${sceneId}_${this.hashImageData(imageData)}`;
      
      // Check cache first
      const cached = await this.config.cacheManager.get<MapAnalysis>(cacheKey);
      if (cached) {
        this.emit('mapAnalyzed', { sceneId, analysis: cached, fromCache: true });
        return cached;
      }

      const prompt = this.buildMapAnalysisPrompt(context);
      
      if (!this.config.aiProvider?.analyzeImage) {return null;}

      const response = await this.config.aiProvider.analyzeImage({
        image: imageData as any, // Type assertion for compatibility
        prompt,
        maxTokens: 800,
        model: 'claude-3-sonnet'
      });

      if (response && response.analysis) {
        const analysis = this.parseMapAnalysis(response.analysis, sceneId);
        
        if (analysis) {
          // Cache the analysis
          await this.config.cacheManager.set(cacheKey, analysis, {
            ttl: 60 * 60 * 1000, // 1 hour
            tags: ['map-analysis', `scene-${sceneId}`],
            priority: 0.8
          });

          this.mapAnalysisCache.set(sceneId, analysis);
          this.emit('mapAnalyzed', { sceneId, analysis, fromCache: false });
          
          return analysis;
        }
      }

      return null;
    } catch (error) {
      logger.error(`Error analyzing map ${sceneId}:`, error as Error);
      return null;
    }
  }

  /**
   * Process vision events - what entities can see
   */
  async processVisionEvent(
    observerId: EntityId,
    visibleEntities: Array<{
      id: EntityId;
      distance: number;
      lightLevel: number;
      imageData?: string | ArrayBuffer;
    }>
  ): Promise<VisionEvent[]> {
    const events: VisionEvent[] = [];
    const observer = this.config.visionStore.get(observerId);
    
    if (!observer) {return events;}

    for (const entity of visibleEntities) {
      // Check if entity is within detection range
      if (entity.distance > this.config.maxAnalysisDistance) {continue;}

      // Can the observer actually see this entity?
      const canSee = this.config.visionStore.canSeeEntity(
        observerId,
        entity.id,
        entity.distance,
        entity.lightLevel
      );

      if (!canSee) {continue;}

      // Check if this is a new sighting
      const wasVisible = this.wasEntityVisible(observerId, entity.id);
      
      if (!wasVisible) {
        // New entity spotted
        let analysis: TokenAnalysis | null = null;
        
        if (entity.imageData) {
          analysis = await this.analyzeToken(entity.id, entity.imageData, {
            lighting: entity.lightLevel,
            distance: entity.distance,
            observerId
          });
        }

        const event: VisionEvent = {
          observerId,
          targetId: entity.id,
          eventType: 'spotted',
          timestamp: Date.now(),
          ...(analysis && { analysis }),
          confidence: this.calculateDetectionConfidence(observer, entity.distance, entity.lightLevel)
        };

        events.push(event);
        this.visionEventHistory.push(event);
        
        // Check for threats
        if (analysis?.threatLevel && ['medium', 'high', 'extreme'].includes(analysis.threatLevel)) {
          const threatEvent: VisionEvent = {
            observerId,
            targetId: entity.id,
            eventType: 'threat_detected',
            timestamp: Date.now(),
            analysis,
            confidence: event.confidence
          };
          
          events.push(threatEvent);
          this.visionEventHistory.push(threatEvent);
        }
      }
    }

    // Check for entities that are no longer visible
    const currentlyVisible = new Set(visibleEntities.map(e => e.id));
    const previouslyVisible = this.getPreviouslyVisibleEntities(observerId);
    
    for (const entityId of previouslyVisible) {
      if (!currentlyVisible.has(entityId)) {
        const event: VisionEvent = {
          observerId,
          targetId: entityId,
          eventType: 'lost_sight',
          timestamp: Date.now(),
          confidence: 1.0
        };
        
        events.push(event);
        this.visionEventHistory.push(event);
      }
    }

    // Limit history size
    if (this.visionEventHistory.length > 1000) {
      this.visionEventHistory = this.visionEventHistory.slice(-500);
    }

    return events;
  }

  /**
   * Get intelligent description of what an entity can see
   */
  async generateVisionDescription(
    observerId: EntityId,
    includeAnalysis: boolean = true
  ): Promise<string> {
    const observer = this.config.visionStore.get(observerId);
    if (!observer) {return "You cannot see anything.";}

    const recentEvents = this.visionEventHistory
      .filter(e => e.observerId === observerId && Date.now() - e.timestamp < 30000)
      .slice(-10);

    const visibleAnalyses = recentEvents
      .filter(e => e.analysis && e.eventType === 'spotted')
      .map(e => e.analysis!);

    if (visibleAnalyses.length === 0) {
      return this.generateBasicVisionDescription(observer);
    }

    try {
      const prompt = `Generate a natural description of what this character can see based on their vision analysis.

Vision Capabilities:
- Sight Range: ${observer.sightRange} units
- Darkvision: ${observer.darkvisionRange} units
- Special Vision: ${observer.truesightRange > 0 ? 'Truesight' : observer.blindsightRange > 0 ? 'Blindsight' : 'Normal'}

Recently Spotted:
${visibleAnalyses.map(a => `- ${a.species} at distance ${a.confidence}, threat level: ${a.threatLevel}, emotions: ${a.emotions.join(', ')}`).join('\n')}

Generate a 2-3 sentence description of what the character observes, focusing on the most important or threatening elements first.`;

      if (!this.config.aiProvider?.generateText) {return 'Unable to generate vision description';}

      const response = await this.config.aiProvider.generateText({
        prompt,
        maxTokens: 400,
        temperature: 0.7,
        model: 'claude-3-sonnet'
      });

      if (response && response.text) {
        return response.text;
      }
    } catch (error) {
      logger.error('Error generating vision description:', error as Error);
    }

    return this.generateBasicVisionDescription(observer);
  }

  /**
   * Update fog of war based on AI analysis
   */
  updateFogOfWar(observerId: EntityId, mapAnalysis: MapAnalysis): void {
    const observer = this.config.visionStore.get(observerId);
    if (!observer || !observer.fogOfWarEnabled) {return;}

    // Reveal areas based on analysis
    for (const point of mapAnalysis.interestPoints) {
      const gridCoord = `${Math.floor(point.location.x)},${Math.floor(point.location.y)}`;
      this.config.visionStore.revealArea(observerId, gridCoord);
    }

    this.emit('fogOfWarUpdated', { observerId, revealedPoints: mapAnalysis.interestPoints.length });
  }

  private buildTokenAnalysisPrompt(context?: any): string {
    return `Analyze this character/token image for a tabletop RPG. Identify:

1. Species/Race (human, elf, orc, dragon, etc.)
2. Equipment and weapons visible
3. Threat level (none/low/medium/high/extreme)
4. Apparent emotions or stance
5. Any magical auras or effects
6. Notable features or characteristics

${context ? `
Context:
- Lighting: ${context.lighting}/1.0
- Distance: ${context.distance} units
- Observer has enhanced vision: ${context.observerId ? 'yes' : 'no'}
` : ''}

Return analysis in JSON format:
{
  "species": "species name",
  "equipment": ["item1", "item2"],
  "threatLevel": "low",
  "emotions": ["calm", "alert"],
  "magicalAuras": ["aura descriptions"],
  "detectedFeatures": ["notable features"],
  "confidence": 0.85
}`;
  }

  private buildMapAnalysisPrompt(context?: any): string {
    return `Analyze this RPG map/scene image. Identify:

1. Environment type (dungeon, forest, tavern, etc.)
2. Lighting conditions
3. Potential hazards or traps
4. Points of interest (doors, chests, altars, etc.)
5. Overall atmosphere and mood
6. Suggested background music style

${context ? `
Context:
- Grid Size: ${context.gridSize}
- Scale: ${context.scale}
- Game System: ${context.gameSystem}
` : ''}

Return analysis in JSON format:
{
  "environment": "dungeon chamber",
  "lighting": "dim",
  "hazards": [{"type": "pit trap", "location": {"x": 10, "y": 15}, "severity": "high"}],
  "interestPoints": [{"type": "chest", "location": {"x": 5, "y": 8}, "description": "ornate wooden chest"}],
  "atmosphere": "mysterious and foreboding",
  "suggestedMusic": ["dungeon ambience", "mystery"]
}`;
  }

  private parseTokenAnalysis(response: string, entityId: EntityId, context?: any): TokenAnalysis | null {
    try {
      const parsed = JSON.parse(response);
      return {
        entityId,
        entities: [entityId],
        description: `${parsed.species} displaying ${parsed.emotions?.join(', ') || 'neutral emotions'}`,
        detectedFeatures: parsed.detectedFeatures || [],
        threatLevel: parsed.threatLevel || 'none',
        emotions: parsed.emotions || [],
        equipment: parsed.equipment || [],
        magicalAuras: parsed.magicalAuras || [],
        species: parsed.species || 'unknown',
        confidence: parsed.confidence || 0.5
      };
    } catch (error) {
      logger.warn('Failed to parse token analysis:', error as Error);
      return null;
    }
  }

  private parseMapAnalysis(response: string, sceneId: string): MapAnalysis | null {
    try {
      const parsed = JSON.parse(response);
      return {
        sceneId,
        environment: parsed.environment || 'unknown',
        lighting: parsed.lighting || 'dim',
        hazards: parsed.hazards || [],
        interestPoints: parsed.interestPoints || [],
        atmosphere: parsed.atmosphere || 'neutral',
        suggestedMusic: parsed.suggestedMusic || []
      };
    } catch (error) {
      logger.warn('Failed to parse map analysis:', error as Error);
      return null;
    }
  }

  private updateVisionDataFromAnalysis(entityId: EntityId, analysis: TokenAnalysis): void {
    const vision = this.config.visionStore.get(entityId);
    if (!vision) {return;}

    // Update invisibility detection based on magical auras
    if (analysis.magicalAuras.some(aura => aura.toLowerCase().includes('invisible'))) {
      // This entity might be invisible
      this.emit('invisibilityDetected', { entityId, analysis });
    }

    // Update threat response
    if (analysis.threatLevel === 'extreme') {
      this.emit('extremeThreatDetected', { entityId, analysis });
    }
  }

  private calculateDetectionConfidence(
    observer: VisionData,
    distance: number,
    lightLevel: number
  ): number {
    let confidence = 1.0;

    // Reduce confidence based on distance
    const maxRange = Math.max(observer.sightRange, observer.darkvisionRange, observer.truesightRange);
    if (distance > maxRange * 0.5) {
      confidence *= 0.7;
    }

    // Reduce confidence in poor lighting
    if (lightLevel < 0.3 && observer.darkvisionRange === 0) {
      confidence *= 0.5;
    }

    // Blindsight and truesight are very reliable
    if (distance <= observer.truesightRange) {
      confidence = Math.max(confidence, 0.95);
    } else if (distance <= observer.blindsightRange) {
      confidence = Math.max(confidence, 0.9);
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private wasEntityVisible(observerId: EntityId, targetId: EntityId): boolean {
    return this.visionEventHistory.some(
      e => e.observerId === observerId && 
           e.targetId === targetId && 
           e.eventType === 'spotted' &&
           Date.now() - e.timestamp < 60000 // Within last minute
    );
  }

  private getPreviouslyVisibleEntities(observerId: EntityId): Set<EntityId> {
    const visible = new Set<EntityId>();
    
    for (const event of this.visionEventHistory) {
      if (event.observerId === observerId && event.targetId) {
        if (event.eventType === 'spotted') {
          visible.add(event.targetId);
        } else if (event.eventType === 'lost_sight') {
          visible.delete(event.targetId);
        }
      }
    }
    
    return visible;
  }

  private generateBasicVisionDescription(observer: VisionData): string {
    if (observer.isBlinded) {return "You are blinded and cannot see anything.";}
    
    const capabilities: string[] = [];
    if (observer.darkvisionRange > 0) {capabilities.push(`darkvision (${observer.darkvisionRange} units)`);}
    if (observer.truesightRange > 0) {capabilities.push(`truesight (${observer.truesightRange} units)`);}
    if (observer.blindsightRange > 0) {capabilities.push(`blindsight (${observer.blindsightRange} units)`);}
    
    let description = `You can see clearly within ${observer.sightRange} units.`;
    if (capabilities.length > 0) {
      description += ` You also have ${capabilities.join(', ')}.`;
    }
    
    return description;
  }

  private hashImageData(imageData: string | ArrayBuffer): string {
    // Simple hash for caching - in production use proper hashing
    return btoa(imageData.toString().slice(0, 100)).slice(0, 10);
  }

  private startPeriodicAnalysis(): void {
    this.analysisTimer = setInterval(() => {
      this.emit('periodicAnalysis');
    }, this.config.analysisInterval);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
    }
    this.tokenAnalysisCache.clear();
    this.mapAnalysisCache.clear();
    this.visionEventHistory = [];
    this.pendingAnalysis.clear();
    this.removeAllListeners();
  }
}
