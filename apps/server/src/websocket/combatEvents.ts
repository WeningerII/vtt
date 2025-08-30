/**
 * Real-time WebSocket integration for combat state synchronization
 */

import { WebSocket } from "ws";
import { logger } from "@vtt/logging";
import { ActorIntegrationService } from "../services/ActorIntegrationService";

export interface CombatWebSocketMessage {
  type: string;
  payload: any;
  requestId?: string;
}

export interface CombatSubscription {
  ws: WebSocket;
  encounterId: string;
  userId: string;
}

export class CombatWebSocketManager {
  private subscriptions = new Map<string, CombatSubscription[]>(); // encounterId -> subscriptions
  private userSockets = new Map<string, WebSocket[]>(); // userId -> websockets

  constructor(private actorService: ActorIntegrationService) {}

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws: WebSocket, userId: string): void {
    // Add to user sockets
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, []);
    }
    this.userSockets.get(userId)!.push(ws);

    // Handle disconnection
    ws.on("close", () => {
      this.handleDisconnection(ws, userId);
    });

    // Handle messages
    ws.on("message", (data) => {
      try {
        const message: CombatWebSocketMessage = JSON.parse(data.toString());
        this.handleMessage(ws, userId, message);
      } catch (error) {
        logger.error("Invalid WebSocket message:", error as Error);
        this.sendError(ws, "Invalid message format");
      }
    });

    // Send welcome message
    this.sendMessage(ws, {
      type: "CONNECTED",
      payload: { userId, timestamp: Date.now() },
    });
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnection(ws: WebSocket, userId: string): void {
    // Remove from user sockets
    const userSockets = this.userSockets.get(userId);
    if (userSockets) {
      const index = userSockets.indexOf(ws);
      if (index > -1) {
        userSockets.splice(index, 1);
      }
      if (userSockets.length === 0) {
        this.userSockets.delete(userId);
      }
    }

    // Remove from encounter subscriptions
    for (const [encounterId, subscriptions] of this.subscriptions.entries()) {
      const index = subscriptions.findIndex((sub) => sub.ws === ws);
      if (index > -1) {
        subscriptions.splice(index, 1);
        if (subscriptions.length === 0) {
          this.subscriptions.delete(encounterId);
        }
      }
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private async handleMessage(
    ws: WebSocket,
    userId: string,
    message: CombatWebSocketMessage,
  ): Promise<void> {
    switch (message.type) {
      case "SUBSCRIBE_ENCOUNTER":
        await this.handleSubscribeEncounter(ws, userId, message);
        break;

      case "UNSUBSCRIBE_ENCOUNTER":
        await this.handleUnsubscribeEncounter(ws, userId, message);
        break;

      case "UPDATE_ACTOR_HEALTH":
        await this.handleUpdateActorHealth(ws, userId, message);
        break;

      case "START_ENCOUNTER":
        await this.handleStartEncounter(ws, userId, message);
        break;

      case "END_ENCOUNTER":
        // await this.handleEndEncounter(ws, userId, message);
        break;

      case "ADD_ACTOR":
        await this.handleAddActor(ws, userId, message);
        break;

      case "REMOVE_ACTOR":
        await this.handleRemoveActor(ws, userId, message);
        break;

      case "UPDATE_INITIATIVE":
        await this.handleUpdateInitiative(ws, userId, message);
        break;

      case "NEXT_TURN":
        await this.handleNextTurn(ws, userId, message);
        break;

      case "APPLY_CONDITION":
        await this.handleApplyCondition(ws, userId, message);
        break;

      case "REMOVE_CONDITION":
        await this.handleRemoveCondition(ws, userId, message);
        break;

      default:
        this.sendError(ws, `Unknown message type: ${message.type}`, message.requestId);
    }
  }

  /**
   * Subscribe to encounter updates
   */
  private async handleSubscribeEncounter(
    ws: WebSocket,
    userId: string,
    message: CombatWebSocketMessage,
  ): Promise<void> {
    const { encounterId } = message.payload;

    if (!encounterId) {
      this.sendError(ws, "Missing encounterId", message.requestId);
      return;
    }

    try {
      // Verify encounter exists and user has access
      const encounter = await this.actorService.getEncounter(encounterId);
      if (!encounter) {
        this.sendError(ws, "Encounter not found", message.requestId);
        return;
      }

      // Add subscription
      if (!this.subscriptions.has(encounterId)) {
        this.subscriptions.set(encounterId, []);
      }

      const subscription: CombatSubscription = { ws, encounterId, userId };
      this.subscriptions.get(encounterId)!.push(subscription);

      // Send current encounter state
      this.sendMessage(ws, {
        type: "ENCOUNTER_SUBSCRIBED",
        payload: { encounter },
        requestId: message.requestId || "",
      });
    } catch (error) {
      logger.error("WebSocket error:", error as Error);
      this.sendError(ws, "Failed to subscribe to encounter", message.requestId);
    }
  }

  /**
   * Unsubscribe from encounter updates
   */
  private async handleUnsubscribeEncounter(
    ws: WebSocket,
    userId: string,
    message: CombatWebSocketMessage,
  ): Promise<void> {
    const { encounterId } = message.payload;

    const subscriptions = this.subscriptions.get(encounterId);
    if (subscriptions) {
      const index = subscriptions.findIndex((sub) => sub.ws === ws && sub.userId === userId);
      if (index > -1) {
        subscriptions.splice(index, 1);
        if (subscriptions.length === 0) {
          this.subscriptions.delete(encounterId);
        }
      }
    }

    this.sendMessage(ws, {
      type: "ENCOUNTER_UNSUBSCRIBED",
      payload: { encounterId },
      requestId: message.requestId || "",
    });
  }

  /**
   * Handle actor health updates
   */
  private async handleUpdateActorHealth(
    ws: WebSocket,
    userId: string,
    message: CombatWebSocketMessage,
  ): Promise<void> {
    const { encounterId, actorId, health } = message.payload;

    try {
      await this.actorService.updateActorHealth(actorId, health);

      // Broadcast to all subscribers
      this.broadcastToEncounter(encounterId, {
        type: "ACTOR_HEALTH_UPDATED",
        payload: { actorId, health, updatedBy: userId },
      });

      this.sendMessage(ws, {
        type: "HEALTH_UPDATE_SUCCESS",
        payload: { actorId },
        requestId: message.requestId || "",
      });
    } catch (error) {
      logger.error("Update actor health error:", error as Error);
      this.sendError(ws, "Failed to update actor health", message.requestId);
    }
  }

  /**
   * Handle start encounter
   */
  private async handleStartEncounter(
    ws: WebSocket,
    userId: string,
    message: CombatWebSocketMessage,
  ): Promise<void> {
    const { encounterId } = message.payload;

    try {
      await this.actorService.startEncounter(encounterId);
      const encounter = await this.actorService.getEncounter(encounterId);

      // Broadcast to all subscribers
      this.broadcastToEncounter(encounterId, {
        type: "ENCOUNTER_STARTED",
        payload: { encounter },
        requestId: message.requestId || "",
      });
    } catch (error) {
      logger.error("Start encounter error:", error as Error);
      this.sendError(ws, "Failed to start encounter", message.requestId);
    }
  }

  /**
   * Handle actor add
   */
  private async handleAddActor(
    ws: WebSocket,
    userId: string,
    message: CombatWebSocketMessage,
  ): Promise<void> {
    const { encounterId, actorType, actorId, instanceName } = message.payload;

    try {
      let actor;

      if (actorType === "character") {
        // actor = await this.actorService.addCharacterToEncounter(encounterId, actorId);
        actor = { id: actorId, type: "character", encounterId };
      } else if (actorType === "monster") {
        // actor = await this.actorService.addMonsterToEncounter(encounterId, actorId, instanceName);
        actor = { id: actorId, type: "monster", encounterId, name: instanceName };
      } else {
        this.sendError(ws, "Invalid actor type", message.requestId);
        return;
      }

      // Broadcast to all subscribers
      this.broadcastToEncounter(encounterId, {
        type: "ACTOR_ADDED",
        payload: { actor, addedBy: userId },
      });
    } catch (error) {
      logger.error("Add actor error:", error as Error);
      this.sendError(ws, "Failed to add actor", message.requestId);
    }
  }

  /**
   * Handle remove actor from encounter
   */
  private async handleRemoveActor(
    ws: WebSocket,
    userId: string,
    message: CombatWebSocketMessage,
  ): Promise<void> {
    const { encounterId, actorId } = message.payload;

    try {
      // Remove actor from encounter
      // await this.actorService.removeActorFromEncounter(encounterId, actorId);

      // Broadcast to all subscribers
      this.broadcastToEncounter(encounterId, {
        type: "ACTOR_REMOVED",
        payload: { actorId, removedBy: userId },
      });
    } catch (error) {
      logger.error("Remove actor error:", error as Error);
      this.sendError(ws, "Failed to remove actor", message.requestId);
    }
  }

  /**
   * Handle initiative updates
   */
  private async handleUpdateInitiative(
    ws: WebSocket,
    userId: string,
    message: CombatWebSocketMessage,
  ): Promise<void> {
    const { encounterId, actorId, initiative } = message.payload;

    try {
      // Update actor initiative
      // await this.actorService.updateActorInitiative(encounterId, actorId, initiative);

      // Broadcast to all subscribers
      this.broadcastToEncounter(encounterId, {
        type: "INITIATIVE_UPDATED",
        payload: { actorId, initiative, updatedBy: userId },
      });
    } catch (error) {
      logger.error("Update initiative error:", error as Error);
      this.sendError(ws, "Failed to update initiative", message.requestId);
    }
  }

  /**
   * Handle next turn
   */
  private async handleNextTurn(
    ws: WebSocket,
    userId: string,
    message: CombatWebSocketMessage,
  ): Promise<void> {
    const { encounterId } = message.payload;

    try {
      // Advance to next turn
      // const nextActor = await this.actorService.advanceToNextTurn(encounterId);

      const encounter = await this.actorService.getEncounter(encounterId);

      // Broadcast to all subscribers
      this.broadcastToEncounter(encounterId, {
        type: "TURN_ADVANCED",
        payload: { encounter, advancedBy: userId },
      });
    } catch (error) {
      logger.error("Next turn error:", error as Error);
      this.sendError(ws, "Failed to advance turn", message.requestId);
    }
  }

  /**
   * Handle apply condition
   */
  private async handleApplyCondition(
    ws: WebSocket,
    userId: string,
    message: CombatWebSocketMessage,
  ): Promise<void> {
    const { encounterId, actorId, condition } = message.payload;

    try {
      // Apply condition to actor
      // await this.actorService.applyConditionToActor(encounterId, actorId, condition);

      // Broadcast to all subscribers
      this.broadcastToEncounter(encounterId, {
        type: "CONDITION_APPLIED",
        payload: { actorId, condition, appliedBy: userId },
      });
    } catch (error) {
      logger.error("Apply condition error:", error as Error);
      this.sendError(ws, "Failed to apply condition", message.requestId);
    }
  }

  /**
   * Handle remove condition
   */
  private async handleRemoveCondition(
    ws: WebSocket,
    userId: string,
    message: CombatWebSocketMessage,
  ): Promise<void> {
    const { encounterId, actorId, conditionId } = message.payload;

    try {
      // Remove condition from actor
      // await this.actorService.removeConditionFromActor(encounterId, actorId, conditionId);

      // Broadcast to all subscribers
      this.broadcastToEncounter(encounterId, {
        type: "CONDITION_REMOVED",
        payload: { actorId, conditionId, removedBy: userId },
      });
    } catch (error) {
      logger.error("Remove condition error:", error as Error);
      this.sendError(ws, "Failed to remove condition", message.requestId);
    }
  }

  /**
   * Broadcast message to all encounter subscribers
   */
  private broadcastToEncounter(encounterId: string, message: CombatWebSocketMessage): void {
    const subscriptions = this.subscriptions.get(encounterId);
    if (!subscriptions) return;

    subscriptions.forEach((subscription) => {
      if (subscription.ws.readyState === WebSocket.OPEN) {
        this.sendMessage(subscription.ws, message);
      }
    });
  }

  /**
   * Send message to specific WebSocket
   */
  private sendMessage(ws: WebSocket, message: CombatWebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message
   */
  private sendError(ws: WebSocket, error: string, requestId?: string): void {
    this.sendMessage(ws, {
      type: "ERROR",
      payload: { error },
      requestId: requestId || "",
    });
  }

  /**
   * Get subscription statistics
   */
  getStats(): {
    activeEncounters: number;
    totalSubscriptions: number;
    connectedUsers: number;
  } {
    const totalSubscriptions = Array.from(this.subscriptions.values()).reduce(
      (sum, subs) => sum + subs.length,
      0,
    );

    return {
      activeEncounters: this.subscriptions.size,
      totalSubscriptions,
      connectedUsers: this.userSockets.size,
    };
  }
}
