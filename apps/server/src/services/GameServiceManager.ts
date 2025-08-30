/**
 * Central service manager for integrating all VTT system components
 * Handles initialization and wiring of AI services, rules engine, map service, and automation
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '@vtt/logging';
import { WebSocketManager } from '../websocket/WebSocketManager';
import { MapService } from '../map/MapService';
import { GameEventBridge } from '../integration/GameEventBridge';
// import { CrucibleService } from '../ai/combat'; // Temporarily disabled for e2e tests
import { ContentInjectionService } from './ContentInjectionService';

// Import AI services
import { AIAssistantService } from '../ai/assistant';
import { AICharacterService } from '../ai/character';
import { AIContentService } from '../ai/content';

export class GameServiceManager {
  private static instance: GameServiceManager;
  
  private prismaClient: PrismaClient;
  private webSocketManager: WebSocketManager;
  private mapService: MapService;
  private gameEventBridge: GameEventBridge;
  private crucibleService: CrucibleService;
  private contentInjectionService: ContentInjectionService;
  private aiAssistant?: any;
  private aiCharacter?: any;
  private aiContent?: any;
  
  private initialized = false;

  private constructor() {
    this.prismaClient = new PrismaClient();
    this.webSocketManager = new WebSocketManager();
    this.mapService = new MapService(this.prismaClient, this.webSocketManager);
    this.crucibleService = new CrucibleService();
    
    // Initialize the GameEventBridge with core services
    this.gameEventBridge = new GameEventBridge(
      this.mapService,
      this.crucibleService,
      this.webSocketManager,
      this.prismaClient
    );

    // Initialize ContentInjectionService
    this.contentInjectionService = new ContentInjectionService(
      this.mapService,
      this.gameEventBridge,
      this.prismaClient,
      this.webSocketManager
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
    if (this.initialized) return;

    logger.info('Initializing VTT Game Service Manager...');

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
      logger.info('VTT Game Service Manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize VTT Game Service Manager:', error);
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
        logger.info('AI API keys detected, initializing AI services...');
        
        this.aiAssistant = new AIAssistantService();
        this.aiCharacter = new AICharacterService();
        this.aiContent = new AIContentService();

        // Wire AI services to the event bridge
        this.gameEventBridge.setAIServices({
          assistant: this.aiAssistant,
          character: this.aiCharacter,
          content: this.aiContent
        });

        logger.info('AI services initialized and connected');
      } else {
        logger.warn('No AI API keys found. AI features will be disabled.');
        logger.warn('Set OPENAI_API_KEY or ANTHROPIC_API_KEY to enable AI automation');
      }
    } catch (error) {
      logger.error('Error initializing AI services:', error);
      logger.warn('Continuing without AI services...');
    }
  }

  /**
   * Set up WebSocket event handling for real-time integration
   */
  private setupWebSocketEventHandling(): void {
    // Listen to WebSocket messages and forward to event bridge
    this.webSocketManager.onMessage((_userId, __sessionId, __message) => {
      this.gameEventBridge.handleWebSocketMessage(userId, sessionId, message);
    });

    logger.info('WebSocket event handling configured');
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
  getAIAssistant(): AIAssistantService | undefined {
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
  getAIContent(): AIContentService | undefined {
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
    logger.info('Shutting down VTT Game Service Manager...');
    
    try {
      await this.prismaClient.$disconnect();
      this.webSocketManager.close();
      
      if (this.gameEventBridge) {
        await this.gameEventBridge.shutdown();
      }

      this.initialized = false;
      logger.info('VTT Game Service Manager shut down successfully');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }

  /**
   * Health check for all services
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
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
      aiContent: false
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
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalCount) {
      status = 'healthy';
    } else if (healthyCount >= totalCount * 0.7) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return { status, services };
  }
}

// Export singleton instance
export const _gameServiceManager = GameServiceManager.getInstance();
