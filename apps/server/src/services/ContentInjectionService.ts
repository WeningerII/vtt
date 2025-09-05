/**
 * Content Injection Service for live procedural content integration
 * Handles dynamic content injection into active scenes and manages content lifecycle
 */

import { MapService } from "../map/MapService";
import { logger } from "@vtt/logging";
import { GameEventBridge } from "../integration/GameEventBridge";
import { PrismaClient } from "@prisma/client";
import { UnifiedWebSocketManager } from "../websocket/UnifiedWebSocketManager";

export interface ContentInjectionRequest {
  sceneId: string;
  contentType: "encounter" | "npc" | "treasure" | "hazard" | "room" | "dungeon";
  trigger: "manual" | "rule_based" | "ai_decision" | "player_action";
  parameters?: Record<string, any>;
  position?: { x: number; y: number };
  userId?: string;
}

export interface InjectedContent {
  id: string;
  sceneId: string;
  contentType: string;
  data: any;
  position?: { x: number; y: number };
  injectedAt: number;
  expiresAt?: number;
  active: boolean;
}

export class ContentInjectionService {
  private injectedContent = new Map<string, InjectedContent>();
  private contentGenerationQueue: ContentInjectionRequest[] = [];
  private processing = false;

  constructor(
    private mapService: MapService,
    private eventBridge: GameEventBridge,
    private prisma: PrismaClient,
    private webSocketManager: UnifiedWebSocketManager,
  ) {}

  /**
   * Initialize the content injection service
   */
  async initialize(): Promise<void> {
    logger.info("Initializing Content Injection Service...");

    // Set up periodic content processing
    setInterval(() => {
      this.processContentQueue();
      this.cleanupExpiredContent();
    }, 5000); // Process every 5 seconds

    logger.info("Content Injection Service initialized");
  }

  /**
   * Request procedural content injection into a scene
   */
  async requestContentInjection(request: ContentInjectionRequest): Promise<string> {
    logger.info(`Content injection requested: ${request.contentType} for scene ${request.sceneId}`);

    // Add to processing queue
    this.contentGenerationQueue.push(request);

    // Generate unique request ID
    const requestId = `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Process immediately if not already processing
    if (!this.processing) {
      this.processContentQueue();
    }

    return requestId;
  }

  /**
   * Process the content generation queue
   */
  private async processContentQueue(): Promise<void> {
    if (this.processing || this.contentGenerationQueue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      while (this.contentGenerationQueue.length > 0) {
        const request = this.contentGenerationQueue.shift();
        if (request) {
          await this.processContentRequest(request);
        }
      }
    } catch (error) {
      logger.error("Error processing content queue:", error as Error);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process a single content injection request
   */
  private async processContentRequest(request: ContentInjectionRequest): Promise<void> {
    try {
      logger.info(`Processing content request: ${request.contentType}`);

      // Generate content based on type
      const generatedContent = await this.generateContent(request);

      if (!generatedContent) {
        logger.warn(`Failed to generate content for request: ${request.contentType}`);
        return;
      }

      // Inject content into scene
      const injectedId = await this.injectContentIntoScene(
        request.sceneId,
        generatedContent,
        request,
      );

      if (injectedId) {
        // Notify clients of new content
        await this.notifyContentInjection(request.sceneId, injectedId, generatedContent);
      }
    } catch (error) {
      logger.error(`Error processing content request:`, error as Error);
    }
  }

  /**
   * Generate content based on request type
   */
  private async generateContent(request: ContentInjectionRequest): Promise<any> {
    const { contentType, parameters = {} } = request;

    // Basic procedural generation - in a real implementation, this would use
    // the ContentGenerationWorkflows from the rules package
    switch (contentType) {
      case "encounter":
        return this.generateEncounter(parameters);
      case "npc":
        return this.generateNPC(parameters);
      case "treasure":
        return this.generateTreasure(parameters);
      case "hazard":
        return this.generateHazard(parameters);
      case "room":
        return this.generateRoom(parameters);
      default:
        logger.warn(`Unknown content type: ${contentType}`);
        return null;
    }
  }

  /**
   * Generate a random encounter
   */
  private generateEncounter(params: any): any {
    const encounterTypes = ["combat", "puzzle", "social", "exploration"];
    const difficulties = ["easy", "medium", "hard", "deadly"];

    return {
      type: "encounter",
      subtype: encounterTypes[Math.floor(Math.random() * encounterTypes.length)],
      difficulty: difficulties[Math.floor(Math.random() * difficulties.length)],
      description: `A ${params.theme || "mysterious"} encounter appears`,
      creatures: this.generateCreatures(params.partyLevel || 1),
      rewards: this.generateRewards(params.partyLevel || 1),
      position: params.position,
    };
  }

  /**
   * Generate an NPC
   */
  private generateNPC(params: any): any {
    const names = ["Aldric", "Brenna", "Cedric", "Dara", "Elara", "Finn"];
    const roles = ["merchant", "guard", "scholar", "noble", "commoner"];

    return {
      type: "npc",
      name: names[Math.floor(Math.random() * names.length)],
      role: roles[Math.floor(Math.random() * roles.length)],
      level: params.level || Math.floor(Math.random() * 10) + 1,
      description: `A ${params.disposition || "neutral"} NPC`,
      position: params.position,
      stats: this.generateNPCStats(params.level || 1),
    };
  }

  /**
   * Generate treasure
   */
  private generateTreasure(params: any): any {
    const treasureTypes = ["gold", "gems", "magic_item", "artifact"];

    return {
      type: "treasure",
      subtype: treasureTypes[Math.floor(Math.random() * treasureTypes.length)],
      value: params.value || Math.floor(Math.random() * 1000) + 100,
      description: `Valuable treasure worth exploring`,
      position: params.position,
      hidden: params.hidden || Math.random() > 0.5,
    };
  }

  /**
   * Generate a hazard
   */
  private generateHazard(params: any): any {
    const hazardTypes = ["trap", "environmental", "magical", "structural"];

    return {
      type: "hazard",
      subtype: hazardTypes[Math.floor(Math.random() * hazardTypes.length)],
      danger: params.danger || "medium",
      description: `A dangerous hazard blocks the way`,
      position: params.position,
      radius: params.radius || 5,
      damage: params.damage || "2d6",
    };
  }

  /**
   * Generate a room
   */
  private generateRoom(params: any): any {
    const roomTypes = ["chamber", "corridor", "vault", "shrine", "library"];

    return {
      type: "room",
      subtype: roomTypes[Math.floor(Math.random() * roomTypes.length)],
      dimensions: params.dimensions || { width: 20, height: 20 },
      description: `A ${params.theme || "stone"} room`,
      features: this.generateRoomFeatures(),
      position: params.position,
    };
  }

  /**
   * Generate creatures for encounters
   */
  private generateCreatures(partyLevel: number): any[] {
    const creatures = ["goblin", "orc", "skeleton", "wolf", "bear"];
    const count = Math.floor(Math.random() * 4) + 1;

    return Array.from({ length: count }, () => ({
      type: creatures[Math.floor(Math.random() * creatures.length)],
      level: Math.max(1, partyLevel + Math.floor(Math.random() * 3) - 1),
      hp: Math.floor(Math.random() * 20) + 10,
    }));
  }

  /**
   * Generate rewards for encounters
   */
  private generateRewards(partyLevel: number): any {
    return {
      experience: partyLevel * 100 + Math.floor(Math.random() * 100),
      gold: Math.floor(Math.random() * 100) + partyLevel * 10,
      items: Math.random() > 0.7 ? ["minor_potion"] : [],
    };
  }

  /**
   * Generate NPC stats
   */
  private generateNPCStats(level: number): any {
    const base = 10;
    return {
      level,
      hp: base + level * 5,
      ac: base + Math.floor(level / 2),
      str: base + Math.floor(Math.random() * 6),
      dex: base + Math.floor(Math.random() * 6),
      con: base + Math.floor(Math.random() * 6),
      int: base + Math.floor(Math.random() * 6),
      wis: base + Math.floor(Math.random() * 6),
      cha: base + Math.floor(Math.random() * 6),
    };
  }

  /**
   * Generate room features
   */
  private generateRoomFeatures(): string[] {
    const features = ["altar", "statue", "fountain", "chest", "bookshelf", "fireplace"];
    const count = Math.floor(Math.random() * 3);

    return features.sort(() => Math.random() - 0.5).slice(0, count);
  }

  /**
   * Inject generated content into the scene
   */
  private async injectContentIntoScene(
    sceneId: string,
    content: any,
    request: ContentInjectionRequest,
  ): Promise<string | null> {
    try {
      const contentId = `injected_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store injected content
      const injectedContent: InjectedContent = {
        id: contentId,
        sceneId,
        contentType: request.contentType,
        data: content,
        position: request.position || { x: 0, y: 0 },
        injectedAt: Date.now(),
        active: true,
      };

      this.injectedContent.set(contentId, injectedContent);

      // Add content to scene via MapService
      switch (request.contentType) {
        case "encounter":
          await this.mapService.addEncounter(sceneId, content);
          break;
        case "npc":
          await this.mapService.addNPC(sceneId, content);
          break;
        case "treasure":
          await this.mapService.addTreasure(sceneId, content);
          break;
        case "hazard":
          await this.mapService.addHazard(sceneId, content);
          break;
      }

      logger.info(`Content injected successfully: ${contentId}`);
      return contentId;
    } catch (error) {
      logger.error("Error injecting content into scene:", error as Error);
      return null;
    }
  }

  /**
   * Notify clients of content injection
   */
  private async notifyContentInjection(
    sceneId: string,
    contentId: string,
    content: any,
  ): Promise<void> {
    try {
      // Broadcast via WebSocket
      const message = {
        type: "content_injected" as any,
        data: {
          sceneId,
          contentId,
          contentType: content.type,
          content,
          timestamp: Date.now(),
        },
      };

      // Broadcast to all connected clients
      this.webSocketManager.broadcast(message);
    } catch (error) {
      logger.error("Error notifying content injection:", error as Error);
    }
  }

  /**
   * Remove injected content from scene
   */
  async removeInjectedContent(contentId: string): Promise<boolean> {
    const content = this.injectedContent.get(contentId);
    if (!content) {return false;}

    try {
      // Mark as inactive
      content.active = false;

      // Remove from scene and cleanup resources
      this.injectedContent.delete(contentId);

      // Notify clients
      const message = {
        type: "content_removed" as any,
        data: {
          sceneId: content.sceneId,
          contentId,
          timestamp: Date.now(),
        },
      };

      // Broadcast content removal
      this.webSocketManager.broadcast(message);

      return true;
    } catch (error) {
      logger.error("Error removing injected content:", error as Error);
      return false;
    }
  }

  /**
   * Get all injected content for a scene
   */
  getInjectedContentForScene(sceneId: string): InjectedContent[] {
    return Array.from(this.injectedContent.values()).filter(
      (content) => content.sceneId === sceneId && content.active,
    );
  }

  /**
   * Clean up expired content
   */
  private cleanupExpiredContent(): void {
    const now = Date.now();

    for (const [id, content] of this.injectedContent.entries()) {
      if (content.expiresAt && now > content.expiresAt) {
        this.removeInjectedContent(id);
      }
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalInjected: number;
    activeContent: number;
    queueSize: number;
    processing: boolean;
  } {
    return {
      totalInjected: this.injectedContent.size,
      activeContent: Array.from(this.injectedContent.values()).filter((c) => c.active).length,
      queueSize: this.contentGenerationQueue.length,
      processing: this.processing,
    };
  }
}
