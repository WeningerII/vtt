/**
 * Game Event Bridge - Connects all VTT systems for seamless automation
 * Bridges DeepRuleEngine, AI services, WebSocket, and Map services
 */

import { DeepRuleEngine, RuleContext } from "../../../packages/rules/src/DeepRuleEngine";
import { logger } from "@vtt/logging";
import { ContentGenerationWorkflowEngine } from "../../../packages/rules/src/ContentGenerationWorkflows";
// import { CrucibleService } from '../ai/combat'; // Temporarily disabled for e2e tests
import { WebSocketManager } from "../websocket/WebSocketManager";
import { MapService } from "../map/MapService";
import { PrismaClient } from "@prisma/client";
import { EventEmitter } from "events";

export interface GameEvent {
  type:
    | "token_move"
    | "token_add"
    | "token_remove"
    | "combat_start"
    | "combat_end"
    | "turn_start"
    | "turn_end"
    | "spell_cast"
    | "damage_dealt"
    | "condition_applied"
    | "scene_change"
    | "player_action";
  data: any;
  sceneId: string;
  userId: string;
  timestamp: number;
}

export class GameEventBridge extends EventEmitter {
  private ruleEngine: DeepRuleEngine;
  private contentEngine: ContentGenerationWorkflowEngine;
  private combatAI: CrucibleService;
  private wsManager: WebSocketManager;
  private mapService: MapService;
  private prisma: PrismaClient;

  // Context tracking
  private activeContexts: Map<string, RuleContext> = new Map();
  private automationEnabled: boolean = true;

  constructor(
    ruleEngine: DeepRuleEngine,
    contentEngine: ContentGenerationWorkflowEngine,
    combatAI: CrucibleService,
    wsManager: WebSocketManager,
    mapService: MapService,
    prisma: PrismaClient,
  ) {
    super();
    this.ruleEngine = ruleEngine;
    this.contentEngine = contentEngine;
    this.combatAI = combatAI;
    this.wsManager = wsManager;
    this.mapService = mapService;
    this.prisma = prisma;

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Listen for game events and trigger rule evaluations
    this.on("game_event", this.handleGameEvent.bind(this));

    // Set up WebSocket event forwarding
    this.setupWebSocketIntegration();
  }

  private setupWebSocketIntegration(): void {
    // Intercept WebSocket messages and convert to game events
    const originalBroadcast = this.wsManager.broadcastToSession.bind(this.wsManager);

    this.wsManager.broadcastToSession = (
      _sessionId: string,
      message: any,
      _excludeUserId?: string,
    ) => {
      // Convert WebSocket message to game event
      if (message.type && this.isGameEvent(message.type)) {
        this.processGameEvent({
          type: message.type,
          data: message.payload,
          sceneId: sessionId,
          userId: message.userId,
          timestamp: message.timestamp,
        });
      }

      // Continue with original broadcast
      return originalBroadcast(sessionId, message, excludeUserId);
    };
  }

  private isGameEvent(messageType: string): boolean {
    const gameEventTypes = [
      "token_move",
      "token_add",
      "token_remove",
      "combat_start",
      "combat_end",
      "turn_start",
      "turn_end",
      "spell_cast",
      "damage_dealt",
      "condition_applied",
    ];
    return gameEventTypes.includes(messageType);
  }

  /**
   * Process a game event through the rule system
   */
  async processGameEvent(event: GameEvent): Promise<void> {
    try {
      // Build rule context
      const context = await this.buildRuleContext(event);

      // Store active context
      this.activeContexts.set(event.sceneId, context);

      // Process through rule engine
      const ruleResults = await this.ruleEngine.processEvent(event.type, event.data, context);

      // Process through content generation engine
      await this.contentEngine.processEvent(event.type, event.data, context);

      // Handle AI tactical decisions if combat-related
      if (this.isCombatEvent(event.type)) {
        await this.handleCombatAI(event, context);
      }

      // Process rule results and apply effects
      await this.applyRuleResults(event, ruleResults, context);
    } catch (error) {
      logger.error("Error processing game event:", error);
    }
  }

  private async buildRuleContext(event: GameEvent): RuleContext {
    // Get scene information
    const scene = await this.mapService.getScene(event.sceneId);
    const combatStatus = await this.mapService.getCombatStatus(event.sceneId);

    return {
      gameSystem: "dnd5e",
      session: event.sceneId,
      scene: event.sceneId,
      participants: combatStatus?.initiative || [],
      environment: {
        lighting: scene?.lighting || "bright",
        terrain: scene?.terrain || [],
        weather: scene?.weather || "clear",
        hazards: scene?.hazards || [],
        cover: scene?.cover || {},
        visibility: scene?.visibility || 100,
      },
      timing: {
        initiative: combatStatus || {
          order: [],
          current: 0,
          delayed: [],
          surprised: [],
        },
        round: combatStatus?.round || 0,
        turn: combatStatus?.turn || 0,
        phase: "action",
        timeScale: "rounds",
      },
      metadata: {
        userId: event.userId,
        timestamp: event.timestamp,
        eventType: event.type,
      },
    };
  }

  private isCombatEvent(eventType: string): boolean {
    const combatEvents = [
      "combat_start",
      "turn_start",
      "spell_cast",
      "damage_dealt",
      "condition_applied",
    ];
    return combatEvents.includes(eventType);
  }

  private async handleCombatAI(event: GameEvent, context: RuleContext): Promise<void> {
    if (!this.automationEnabled) return;

    try {
      // Get current combatant
      const currentCombatant = this.getCurrentCombatant(context);
      if (!currentCombatant || currentCombatant.type === "player") return;

      // Build tactical context
      const tacticalContext = this.buildTacticalContext(currentCombatant, context);

      // Get AI decision
      const decision = await this.combatAI.makeTacticalDecision(tacticalContext);

      // Execute AI decision and broadcast
      await this.executeAIDecision(event.sceneId, currentCombatant, decision, context);
    } catch (error) {
      logger.error("Combat AI error:", error);
    }
  }

  private getCurrentCombatant(context: RuleContext): any {
    const initiative = context.timing.initiative;
    if (!initiative.order.length) return null;

    return initiative.order[initiative.current];
  }

  private buildTacticalContext(combatant: any, context: RuleContext): any {
    const allies = context.participants.filter(
      (p) => p.team === combatant.team && p.id !== combatant.id,
    );
    const enemies = context.participants.filter((p) => p.team !== combatant.team);

    return {
      character: combatant,
      allies,
      enemies,
      battlefield: {
        terrain: context.environment.terrain,
        hazards: context.environment.hazards,
        cover: Object.values(context.environment.cover),
        lighting: context.environment.lighting,
        weather: context.environment.weather,
      },
      resources: combatant.resources || {
        spellSlots: Record<string, any>,
        hitPoints: combatant.hitPoints || 100,
        actionEconomy: {
          action: true,
          bonusAction: true,
          reaction: true,
          movement: combatant.speed || 30,
        },
      },
      objectives: ["Defeat enemies", "Survive encounter"],
      threatLevel: this.assessThreatLevel(enemies, combatant),
    };
  }

  private assessThreatLevel(
    enemies: any[],
    combatant: any,
  ): "low" | "moderate" | "high" | "extreme" {
    const totalCR = enemies.reduce((_sum, _e) => sum + (e.challengeRating || 1), 0);
    const combatantLevel = combatant.level || 1;

    if (totalCR >= combatantLevel * 3) return "extreme";
    if (totalCR >= combatantLevel * 2) return "high";
    if (totalCR >= combatantLevel) return "moderate";
    return "low";
  }

  private async executeAIDecision(
    sceneId: string,
    combatant: any,
    decision: any,
    _context: RuleContext,
  ): Promise<void> {
    // Execute the AI decision through map service
    switch (decision.action) {
      case "attack":
        if (decision.target) {
          await this.mapService.executeAttack(
            sceneId,
            combatant.id,
            decision.target,
            decision.weapon,
          );
        }
        break;
      case "move":
        if (decision.position) {
          await this.mapService.moveToken(
            sceneId,
            combatant.tokenId,
            decision.position.x,
            decision.position.y,
          );
        }
        break;
      case "spell":
        if (decision.spell) {
          await this.mapService.castSpell(sceneId, combatant.id, decision.spell, decision.target);
        }
        break;
    }

    // Broadcast AI decision
    this.wsManager.broadcastToSession(sceneId, {
      type: "ai_decision",
      payload: {
        combatantId: combatant.id,
        decision,
        reasoning: decision.reasoning,
      },
      sessionId: sceneId,
      userId: "ai_system",
      timestamp: Date.now(),
    });
  }

  private async applyRuleResults(
    event: GameEvent,
    results: any[],
    context: RuleContext,
  ): Promise<void> {
    for (const result of results) {
      if (!result.success) continue;

      // Apply effects to game state
      for (const effect of result.effects) {
        await this.applyEffect(event.sceneId, effect, context);
      }

      // Send notifications
      for (const notification of result.notifications) {
        this.wsManager.broadcastToSession(event.sceneId, {
          type: "rule_notification",
          payload: { message: notification },
          sessionId: event.sceneId,
          userId: "rule_system",
          timestamp: Date.now(),
        });
      }
    }
  }

  private async applyEffect(sceneId: string, effect: any, _context: RuleContext): Promise<void> {
    switch (effect.type) {
      case "damage":
        await this.mapService.applyDamage(sceneId, effect.target, effect.value);
        break;
      case "heal":
        await this.mapService.applyHealing(sceneId, effect.target, effect.value);
        break;
      case "condition":
        await this.mapService.applyCondition(
          sceneId,
          effect.target,
          effect.condition,
          effect.duration,
        );
        break;
      case "movement":
        await this.mapService.moveToken(
          sceneId,
          effect.target,
          effect.position.x,
          effect.position.y,
        );
        break;
    }
  }

  /**
   * Handle game event with full automation pipeline
   */
  private async handleGameEvent(event: GameEvent): Promise<void> {
    await this.processGameEvent(event);
  }

  /**
   * Public API methods
   */
  public async triggerEvent(
    type: string,
    data: any,
    sceneId: string,
    userId: string,
  ): Promise<void> {
    const event: GameEvent = {
      type: type as any,
      data,
      sceneId,
      userId,
      timestamp: Date.now(),
    };

    this.emit("game_event", event);
  }

  public enableAutomation(): void {
    this.automationEnabled = true;
  }

  public disableAutomation(): void {
    this.automationEnabled = false;
  }

  public getActiveContext(sceneId: string): RuleContext | undefined {
    return this.activeContexts.get(sceneId);
  }

  public async injectProceduralContent(
    sceneId: string,
    contentType: string,
    context?: any,
  ): Promise<any> {
    try {
      // Generate content using the workflow engine
      const generatedContent = await this.contentEngine.generateContent(contentType, {
        sceneId,
        ...context,
      });

      // Inject into active scene
      switch (contentType) {
        case "encounter":
          return await this.mapService.addEncounter(sceneId, generatedContent);
        case "npc":
          return await this.mapService.addNPC(sceneId, generatedContent);
        case "treasure":
          return await this.mapService.addTreasure(sceneId, generatedContent);
        case "hazard":
          return await this.mapService.addHazard(sceneId, generatedContent);
      }

      return generatedContent;
    } catch (error) {
      logger.error("Error injecting procedural content:", error);
      return null;
    }
  }
}
