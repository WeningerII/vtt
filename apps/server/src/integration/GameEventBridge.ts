/**
 * Game Event Bridge - Clean implementation with proper interfaces
 */

import { CrucibleService } from '../ai/combat';
import { logger } from '@vtt/logging';
// WebSocketManager removed - using VTTWebSocketServer directly
import { MapService } from "../map/MapService";
import { PrismaClient } from "@prisma/client";
import { EventEmitter } from "events";

interface RuleContext {
  sessionId: string;
  userId: string;
  gameId: string;
  timestamp: number;
  metadata: Record<string, any>;
}

interface RuleExecutionResult {
  success: boolean;
  effects: unknown[];
}

class DeepRuleEngine {
  async initialize(): Promise<void> {
    logger.info('DeepRuleEngine initialized');
  }
  
  async processEvent(type: string, data: Record<string, any>, context?: RuleContext): Promise<RuleExecutionResult[]> {
    return [{ success: true, effects: [] }];
  }
}

class ContentGenerationWorkflowEngine {
  constructor(ruleEngine: any, prisma: any, aiServices: unknown) {}
  
  async initialize(): Promise<void> {
    logger.info('ContentGenerationWorkflowEngine initialized');
  }
  
  setAIServices(services: unknown): void {}
  
  async processEvent(type: string, data: Record<string, any>, context?: RuleContext): Promise<void> {}
  
  generateContent(type: string, context: unknown): any {
    return { generated: true, type, context };
  }
}

export interface GameEvent {
  type: string;
  data: Record<string, any>;
  sceneId: string;
  userId: string;
  timestamp: number;
}

export class GameEventBridge extends EventEmitter {
  private ruleEngine: DeepRuleEngine;
  private contentEngine: ContentGenerationWorkflowEngine;
  private aiServices: any = {};

  constructor(
    private prisma: PrismaClient,
    private combatAI: CrucibleService,
    private wsManager: any, // Legacy stub - to be refactored
    private mapService: MapService,
  ) {
    super();
    this.ruleEngine = new DeepRuleEngine();
    this.contentEngine = new ContentGenerationWorkflowEngine(
      this.ruleEngine,
      this.prisma,
      {}
    );
  }

  async initialize(): Promise<void> {
    try {
      await this.ruleEngine.initialize();
      await this.contentEngine.initialize();
      logger.info("GameEventBridge initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize GameEventBridge:", error as any);
      throw error;
    }
  }

  setAIServices(services: unknown): void {
    this.aiServices = services;
    this.contentEngine.setAIServices(services);
  }

  async processGameEvent(event: GameEvent): Promise<void> {
    try {
      const context = await this.buildRuleContext(event);
      
      await this.ruleEngine.processEvent(event.type, event.data, context);
      await this.contentEngine.processEvent(event.type, event.data, context);
      
      if (event.type === "combat_update" && this.combatAI) {
        await this.handleCombatAI(event, context);
      }
      
      this.emit("event_processed", { event, context });
    } catch (error) {
      logger.error(`Error processing game event ${event.type}:`, error as any);
      this.emit("event_error", { event, error });
    }
  }

  private async buildRuleContext(event: GameEvent): Promise<RuleContext> {
    return {
      sessionId: event.sceneId,
      userId: event.userId,
      gameId: event.sceneId,
      timestamp: event.timestamp,
      metadata: {
        eventType: event.type,
        eventData: event.data,
      },
    };
  }

  private async handleCombatAI(event: GameEvent, context: RuleContext): Promise<void> {
    try {
      const participants = event.data.participants || [];
      const activeParticipants = participants.filter((p: unknown) => p.active);
      
      for (const participant of activeParticipants) {
        if (participant.type === "npc" || participant.type === "monster") {
          const decision = await this.combatAI.makeTacticalDecision({
            character: participant,
            allies: activeParticipants.filter((p: unknown) => p.faction === participant.faction),
            enemies: activeParticipants.filter((p: unknown) => p.faction !== participant.faction),
            battlefield: {
              terrain: [],
              hazards: [],
              cover: [],
              lighting: "bright",
              weather: "clear",
            },
            resources: {
              spellSlots: {},
              hitPoints: participant.hitPoints || 100,
              actionEconomy: {
                action: true,
                bonusAction: true,
                reaction: true,
                movement: participant.speed || 30,
              },
            },
            objectives: ["Defeat enemies"],
            threatLevel: "moderate",
          });
          
          this.wsManager.broadcastToSessionPublic(
            event.sceneId,
            "combat_update",
            {
              participantId: participant.id,
              decision,
            }
          );
        }
      }
    } catch (error) {
      logger.error("Error in combat AI processing:", error as any);
    }
  }

  async handleWebSocketMessage(sessionId: string, message: Record<string, unknown>, userId: string): Promise<void> {
    try {
      const gameEventTypes = ["token_move", "token_add", "combat_update", "spell_cast"];
      
      if (gameEventTypes.includes(message.type)) {
        await this.processGameEvent({
          type: message.type,
          data: (message.payload || {}) as Record<string, any>,
          sceneId: sessionId,
          userId,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      logger.error("Error handling WebSocket message:", error as any);
    }
  }

  async shutdown(): Promise<void> {
    try {
      this.removeAllListeners();
      logger.info("GameEventBridge shutdown completed");
    } catch (error) {
      logger.error("Error during GameEventBridge shutdown:", error as any);
    }
  }
}
