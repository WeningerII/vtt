/**
 * Unified WebSocket Manager for VTT - Combines functionality from both managers
 */
import { WebSocket, WebSocketServer, RawData } from "ws";
import { logger } from "@vtt/logging";
import { IncomingMessage } from "http";
import { EventEmitter } from "events";
import { GameManager } from "../game/GameManager";
import { v4 as uuidv4 } from "uuid";

export interface VTTWebSocketMessage {
  type: string;
  payload?: any;
  sessionId?: string;
  userId?: string;
  timestamp?: number;
  requestId?: string;
}

export interface ConnectedClient {
  id: string;
  ws: WebSocket;
  userId?: string | null;
  sessionId?: string;
  campaignId?: string | null;
  gameId?: string;
  displayName?: string;
  isGM?: boolean;
  lastActivity: number;
  lastPing?: number;
}

export class UnifiedWebSocketManager extends EventEmitter {
  private wss: WebSocketServer;
  private clients = new Map<string, ConnectedClient>();
  private sessions = new Map<string, Set<string>>(); // sessionId -> clientIds
  private userSockets = new Map<string, Set<string>>(); // userId -> clientIds
  private gameManager: GameManager;
  private pingInterval?: NodeJS.Timeout;

  constructor(wss: WebSocketServer) {
    super();
    this.wss = wss;
    this.gameManager = new GameManager();
    this.setupConnectionHandler();
    this.startGameStateSyncing();
    this.startPingInterval();
  }

  private setupConnectionHandler(): void {
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const clientId = uuidv4();
      const url = new URL(req.url || "", `http://${req.headers.host}`);

      // Extract connection parameters
      const sessionId = url.searchParams.get("sessionId");
      const userId = url.searchParams.get("userId");
      const campaignId = url.searchParams.get("campaignId");
      const gameId = url.searchParams.get("gameId");
      const isGM = url.searchParams.get("isGM") === "true";

      const client: ConnectedClient = {
        id: clientId,
        ws,
        userId,
        sessionId,
        campaignId,
        gameId,
        isGM,
        lastActivity: Date.now(),
        lastPing: Date.now(),
      };

      this.clients.set(clientId, client);

      // Add to session tracking
      if (sessionId) {
        if (!this.sessions.has(sessionId)) {
          this.sessions.set(sessionId, new Set());
        }
        this.sessions.get(sessionId)!.add(clientId);
      }

      // Add to user tracking
      if (userId) {
        if (!this.userSockets.has(userId)) {
          this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId)!.add(clientId);
      }

      // Setup event handlers
      ws.on("message", (data: RawData) => this.handleMessage(clientId, data));
      ws.on("close", () => this.handleDisconnection(clientId));
      ws.on("error", (error: Error) => this.handleError(clientId, error));
      ws.on("pong", () => this.handlePong(clientId));

      // Send welcome message
      this.sendToClient(clientId, {
        type: "CONNECTION_ESTABLISHED",
        payload: { clientId, sessionId, userId, campaignId, gameId },
      });

      // Emit connection event
      this.emit("client:connected", client);
    });
  }

  private handleMessage(clientId: string, data: RawData): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActivity = Date.now();

    let message: VTTWebSocketMessage;
    try {
      const raw = typeof data === "string" ? data : data.toString("utf-8");
      message = JSON.parse(raw);
    } catch (error) {
      logger.error(`Invalid WebSocket message from ${clientId}:`, error);
      this.sendError(clientId, "INVALID_JSON", "Message must be valid JSON");
      return;
    }

    logger.debug(`[ws] Message from ${clientId}: ${message.type}`);

    try {
      switch (message.type) {
        case "PING":
          this.sendToClient(clientId, { type: "PONG", timestamp: Date.now() });
          break;

        case "JOIN_GAME":
          this.handleJoinGame(clientId, message);
          break;

        case "LEAVE_GAME":
          this.handleLeaveGame(clientId);
          break;

        case "TOKEN_MOVE":
        case "MOVE_TOKEN":
          this.handleTokenMove(clientId, message);
          break;

        case "TOKEN_ADD":
          this.handleTokenAdd(clientId, message);
          break;

        case "TOKEN_REMOVE":
          this.handleTokenRemove(clientId, message);
          break;

        case "SCENE_UPDATE":
          this.handleSceneUpdate(clientId, message);
          break;

        case "COMBAT_UPDATE":
        case "COMBAT_SUBSCRIBE":
        case "REQUEST_TACTICAL_DECISION":
          this.handleCombatMessage(clientId, message);
          break;

        case "ROLL_DICE":
          this.handleDiceRoll(clientId, message);
          break;

        case "CHAT_MESSAGE":
          this.handleChatMessage(clientId, message);
          break;

        default:
          // Emit custom event for unhandled message types
          this.emit(`message:${message.type}`, client, message);
          break;
      }
    } catch (error) {
      logger.error(`Error handling message ${message.type} from ${clientId}:`, error);
      this.sendError(clientId, "INTERNAL_ERROR", "Failed to process message");
    }
  }

  private handleJoinGame(clientId: string, message: VTTWebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { gameId, userId, displayName } = message.payload || {};
    if (!gameId) {
      this.sendError(clientId, "MISSING_GAME_ID", "Game ID is required");
      return;
    }

    // Update client info
    client.gameId = gameId;
    if (userId) client.userId = userId;
    if (displayName) client.displayName = displayName;

    // Get or create game
    const game = this.gameManager.findOrCreateGame(gameId);

    // Add player to game
    if (userId && displayName) {
      const success = game.addPlayer(userId, displayName);
      if (success) {
        logger.info(`Player ${displayName} joined game ${gameId}`);

        // Send game state
        this.sendToClient(clientId, {
          type: "GAME_STATE",
          payload: game.getGameState(),
        });

        // Broadcast join event to other players
        this.broadcastToGame(
          gameId,
          {
            type: "PLAYER_JOINED",
            payload: { userId, displayName },
          },
          clientId,
        );
      }
    }

    this.emit("game:joined", client, gameId);
  }

  private handleLeaveGame(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client || !client.gameId || !client.userId) return;

    const game = this.gameManager.getGame(client.gameId);
    if (game) {
      game.removePlayer(client.userId);

      // Broadcast leave event
      this.broadcastToGame(
        client.gameId,
        {
          type: "PLAYER_LEFT",
          payload: { userId: client.userId, displayName: client.displayName },
        },
        clientId,
      );
    }

    client.gameId = undefined;
    this.emit("game:left", client);
  }

  private handleTokenMove(clientId: string, message: VTTWebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client || !client.gameId) return;

    // Broadcast to all clients in the same game
    this.broadcastToGame(
      client.gameId,
      {
        type: "TOKEN_MOVED",
        payload: message.payload,
        userId: client.userId,
      },
      clientId,
    );

    this.emit("token:moved", client, message.payload);
  }

  private handleTokenAdd(clientId: string, message: VTTWebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client || !client.gameId) return;

    this.broadcastToGame(
      client.gameId,
      {
        type: "TOKEN_ADDED",
        payload: message.payload,
        userId: client.userId,
      },
      clientId,
    );

    this.emit("token:added", client, message.payload);
  }

  private handleTokenRemove(clientId: string, message: VTTWebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client || !client.gameId) return;

    this.broadcastToGame(
      client.gameId,
      {
        type: "TOKEN_REMOVED",
        payload: message.payload,
        userId: client.userId,
      },
      clientId,
    );

    this.emit("token:removed", client, message.payload);
  }

  private handleSceneUpdate(clientId: string, message: VTTWebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId) return;

    this.broadcastToSession(
      client.sessionId,
      {
        type: "SCENE_UPDATED",
        payload: message.payload,
        userId: client.userId,
      },
      clientId,
    );

    this.emit("scene:updated", client, message.payload);
  }

  private handleCombatMessage(clientId: string, message: VTTWebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Emit combat event for specialized handling
    this.emit("combat:message", client, message);

    // Broadcast combat updates to session
    if (client.sessionId && message.type === "COMBAT_UPDATE") {
      this.broadcastToSession(client.sessionId, message, clientId);
    }
  }

  private handleDiceRoll(clientId: string, message: VTTWebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client || !client.gameId) return;

    const rollResult = {
      type: "DICE_ROLLED",
      payload: {
        ...message.payload,
        roller: client.displayName || client.userId,
        timestamp: Date.now(),
      },
    };

    // Broadcast to game unless it's a private roll
    if (!message.payload?.private) {
      this.broadcastToGame(client.gameId, rollResult);
    } else {
      this.sendToClient(clientId, rollResult);
    }

    this.emit("dice:rolled", client, message.payload);
  }

  private handleChatMessage(clientId: string, message: VTTWebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client || !client.gameId) return;

    const chatMessage = {
      type: "CHAT_MESSAGE",
      payload: {
        ...message.payload,
        sender: client.displayName || client.userId,
        timestamp: Date.now(),
      },
    };

    this.broadcastToGame(client.gameId, chatMessage);
    this.emit("chat:message", client, message.payload);
  }

  private handleDisconnection(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    logger.info(`Client ${clientId} disconnected`);

    // Remove from game if in one
    if (client.gameId && client.userId) {
      const game = this.gameManager.getGame(client.gameId);
      if (game) {
        game.removePlayer(client.userId);
      }
    }

    // Remove from session tracking
    if (client.sessionId) {
      const sessionClients = this.sessions.get(client.sessionId);
      if (sessionClients) {
        sessionClients.delete(clientId);
        if (sessionClients.size === 0) {
          this.sessions.delete(client.sessionId);
        }
      }
    }

    // Remove from user tracking
    if (client.userId) {
      const userClients = this.userSockets.get(client.userId);
      if (userClients) {
        userClients.delete(clientId);
        if (userClients.size === 0) {
          this.userSockets.delete(client.userId);
        }
      }
    }

    // Clean up client
    this.clients.delete(clientId);
    this.emit("client:disconnected", client);
  }

  private handleError(clientId: string, error: Error): void {
    logger.error(`WebSocket error for client ${clientId}:`, error);
    this.handleDisconnection(clientId);
  }

  private handlePong(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastPing = Date.now();
    }
  }

  private startGameStateSyncing(): void {
    // Broadcast game state deltas every 50ms (20Hz)
    setInterval(() => {
      const activeGames = this.gameManager.getGames();

      for (const game of activeGames) {
        const delta = game.getNetworkDelta();
        if (!delta || (!delta.created.length && !delta.updated.length && !delta.removed.length)) {
          continue;
        }

        this.broadcastToGame(game.gameId, {
          type: "STATE_DELTA",
          payload: delta,
        });
      }
    }, 50);
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 30000; // 30 seconds

      for (const [clientId, client] of this.clients) {
        // Check for stale connections
        if (now - client.lastActivity > timeout * 2) {
          logger.warn(`Removing stale client ${clientId}`);
          client.ws.terminate();
          this.handleDisconnection(clientId);
          continue;
        }

        // Send ping
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      }
    }, 10000); // Every 10 seconds
  }

  // Utility methods for sending messages
  public sendToClient(clientId: string, message: VTTWebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error(`Failed to send message to client ${clientId}:`, error);
    }
  }

  public sendToUser(userId: string, message: VTTWebSocketMessage): void {
    const clientIds = this.userSockets.get(userId);
    if (!clientIds) return;

    for (const clientId of clientIds) {
      this.sendToClient(clientId, message);
    }
  }

  public broadcastToSession(
    sessionId: string,
    message: VTTWebSocketMessage,
    excludeClientId?: string,
  ): void {
    const clientIds = this.sessions.get(sessionId);
    if (!clientIds) return;

    for (const clientId of clientIds) {
      if (clientId !== excludeClientId) {
        this.sendToClient(clientId, message);
      }
    }
  }

  public broadcastToGame(
    gameId: string,
    message: VTTWebSocketMessage,
    excludeClientId?: string,
  ): void {
    for (const [clientId, client] of this.clients) {
      if (client.gameId === gameId && clientId !== excludeClientId) {
        this.sendToClient(clientId, message);
      }
    }
  }

  public broadcast(message: VTTWebSocketMessage, excludeClientId?: string): void {
    for (const [clientId] of this.clients) {
      if (clientId !== excludeClientId) {
        this.sendToClient(clientId, message);
      }
    }
  }

  private sendError(clientId: string, code: string, message: string): void {
    this.sendToClient(clientId, {
      type: "ERROR",
      payload: { code, message },
    });
  }

  // Public getters for external use
  public getClient(clientId: string): ConnectedClient | undefined {
    return this.clients.get(clientId);
  }

  public getClientsInSession(sessionId: string): ConnectedClient[] {
    const clientIds = this.sessions.get(sessionId);
    if (!clientIds) return [];

    const clients: ConnectedClient[] = [];
    for (const clientId of clientIds) {
      const client = this.clients.get(clientId);
      if (client) clients.push(client);
    }
    return clients;
  }

  public getClientsForUser(userId: string): ConnectedClient[] {
    const clientIds = this.userSockets.get(userId);
    if (!clientIds) return [];

    const clients: ConnectedClient[] = [];
    for (const clientId of clientIds) {
      const client = this.clients.get(clientId);
      if (client) clients.push(client);
    }
    return clients;
  }

  // Cleanup
  public shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    for (const [clientId, client] of this.clients) {
      client.ws.close(1000, "Server shutting down");
    }

    this.clients.clear();
    this.sessions.clear();
    this.userSockets.clear();
  }
}

// Export a singleton instance factory
export function createUnifiedWebSocketManager(wss: WebSocketServer): UnifiedWebSocketManager {
  return new UnifiedWebSocketManager(wss);
}
