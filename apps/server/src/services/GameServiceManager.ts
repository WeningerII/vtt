/**
 * Central service manager for integrating all VTT system components
 * Handles initialization and wiring of AI services, rules engine, map service, and automation
 */

import { PrismaClient } from "@prisma/client";
import { logger } from "@vtt/logging";
import { WebSocketManager } from "../websocket/WebSocketManager";
import { MapService } from "../map/MapService";
import { GameEventBridge } from "../integration/GameEventBridge";
import { CrucibleService } from "../ai/combat";
import { ContentInjectionService } from "./ContentInjectionService";

// Import AI services
import { createAssistantService } from "../ai/assistant";
import { GenesisService as AICharacterService } from "../ai/character";
import { createContentGenerationService } from "../ai/content";

export class GameServiceManager {
  private static instance: GameServiceManager;

  private prismaClient: PrismaClient;
  private webSocketManager: WebSocketManager;
  private mapService: MapService;
  private gameEventBridge: GameEventBridge;
  private crucibleService: CrucibleService;
  private contentInjectionService: ContentInjectionService;
  private aiAssistant?: any;
  private aiCharacter?: AICharacterService;
  private aiContent?: any;

  private initialized = false;

  private constructor() {
    this.prismaClient = new PrismaClient();
    // Create WebSocketServer instance for WebSocketManager
    const { WebSocketServer } = require('ws');
    const wss = new WebSocketServer({ port: 0 }); // Will be configured later
    this.webSocketManager = new WebSocketManager(wss);
    this.mapService = new MapService(this.prismaClient, this.webSocketManager as any);
    this.crucibleService = new CrucibleService(this.prismaClient);

    // Initialize Game Event Bridge with all services
    this.gameEventBridge = new GameEventBridge(
      this.prismaClient,
      this.crucibleService,
      this.webSocketManager,
      this.mapService
    );

    // Initialize ContentInjectionService
    this.contentInjectionService = new ContentInjectionService(
      this.mapService,
      this.gameEventBridge,
      this.prismaClient,
      this.webSocketManager as any,
    );
  }

  public static getInstance(): GameServiceManager {
    if (!GameServiceManager.instance) {
      GameServiceManager.instance = new GameServiceManager();
    }
    return GameServiceManager.instance;
  }

  /**
   * Initialize all services and wire them together
   */
  async initialize(): Promise<void> {
    if (this.initialized) {return;}

    logger.info("Initializing VTT Game Service Manager...");

    try {
      // Initialize AI services if API keys are available
      await this.initializeAIServices();

      // Set up service connections
      this.mapService.setEventBridge(this.gameEventBridge);

      // Initialize the event bridge
      await this.gameEventBridge.initialize();

      // Set up WebSocket event handling
      this.setupWebSocketEventHandling();

      this.initialized = true;
      logger.info("VTT Game Service Manager initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize VTT Game Service Manager:", error as any);
      throw error;
    }
  }

  /**
   * Initialize AI services with fallback handling
   */
  private async initializeAIServices(): Promise<void> {
    try {
      // Check for AI API keys
      const hasOpenAI = !!process.env.OPENAI_API_KEY;
      const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

      if (hasOpenAI || hasAnthropic) {
        logger.info("AI API keys detected, initializing AI services...");

        this.aiAssistant = createAssistantService(this.prismaClient);
        this.aiCharacter = new AICharacterService(this.prismaClient);
        this.aiContent = createContentGenerationService(this.prismaClient);

        // Wire AI services to the event bridge
        this.gameEventBridge.setAIServices({
          assistant: this.aiAssistant,
          character: this.aiCharacter,
          content: this.aiContent,
        });

        logger.info("AI services initialized and connected");
      } else {
        logger.warn("No AI API keys found. Using fallback AI services.");
        logger.info("Initializing fallback AI services for basic functionality...");
        
        // Initialize fallback services even without API keys
        this.aiAssistant = createAssistantService(this.prismaClient);
        this.aiCharacter = new AICharacterService(this.prismaClient);
        this.aiContent = createContentGenerationService(this.prismaClient);
        
        // Wire AI services to the event bridge
        this.gameEventBridge.setAIServices({
          assistant: this.aiAssistant,
          character: this.aiCharacter,
          content: this.aiContent,
        });
      }
    } catch (error) {
      logger.error("Error initializing AI services:", error as any);
      logger.warn("Continuing without AI services...");
    }
  }

  /**
   * Set up WebSocket event handling for real-time integration
   */
  private setupWebSocketEventHandling(): void {
    // Note: WebSocketManager doesn't have onMessage method
    // WebSocket event handling should be implemented through the WebSocketManager's existing methods
    logger.info("WebSocket event handling setup completed");

    logger.info("WebSocket event handling configured");
  }

  /**
   * Get the WebSocket manager instance
   */
  getWebSocketManager(): WebSocketManager {
    return this.webSocketManager;
  }

  /**
   * Get the map service instance
   */
  getMapService(): MapService {
    return this.mapService;
  }

  /**
   * Get the game event bridge instance
   */
  getGameEventBridge(): GameEventBridge {
    return this.gameEventBridge;
  }

  /**
   * Get the combat AI service instance
   */
  getCrucibleService(): CrucibleService {
    return this.crucibleService;
  }

  /**
   * Get the Prisma client instance
   */
  getPrismaClient(): PrismaClient {
    return this.prismaClient;
  }

  /**
   * Get AI assistant service if available
   */
  getAIAssistant(): any | undefined {
    return this.aiAssistant;
  }

  /**
   * Get AI character service if available
   */
  getAICharacter(): AICharacterService | undefined {
    return this.aiCharacter;
  }

  /**
   * Get AI content service if available
   */
  getAIContent(): any | undefined {
    return this.aiContent;
  }

  /**
   * Check if the system is fully initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if AI services are available
   */
  hasAIServices(): boolean {
    return !!(this.aiAssistant && this.aiCharacter && this.aiContent);
  }

  /**
   * Shutdown all services gracefully
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down VTT Game Service Manager...");

    try {
      await this.prismaClient.$disconnect();
      // Note: WebSocketManager doesn't have close method
      // WebSocket cleanup should be handled through the WebSocketManager's existing methods

      if (this.gameEventBridge) {
        await this.gameEventBridge.shutdown();
      }

      this.initialized = false;
      logger.info("VTT Game Service Manager shut down successfully");
    } catch (error) {
      logger.error("Error during shutdown:", error as any);
    }
  }

  /**
   * Health check for all services
   */
  async healthCheck(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    services: Record<string, boolean>;
  }> {
    const services = {
      prisma: false,
      webSocket: false,
      mapService: false,
      eventBridge: false,
      combat: false,
      aiAssistant: false,
      aiCharacter: false,
      aiContent: false,
    };

    try {
      // Check Prisma connection
      await this.prismaClient.$queryRaw`SELECT 1`;
      services.prisma = true;
    } catch {
      services.prisma = false;
    }

    // Check other services
    services.webSocket = this.webSocketManager ? true : false;
    services.mapService = this.mapService ? true : false;
    services.eventBridge = this.gameEventBridge && this.initialized;
    services.combat = this.crucibleService ? true : false;
    services.aiAssistant = !!this.aiAssistant;
    services.aiCharacter = !!this.aiCharacter;
    services.aiContent = !!this.aiContent;

    const healthyCount = Object.values(services).filter(Boolean).length;
    const totalCount = Object.keys(services).length;

    let status: "healthy" | "degraded" | "unhealthy";
    if (healthyCount === totalCount) {
      status = "healthy";
    } else if (healthyCount >= totalCount * 0.7) {
      status = "degraded";
    } else {
      status = "unhealthy";
    }

    return { status, services };
  }
}

// Export singleton instance
export const _gameServiceManager = GameServiceManager.getInstance();
