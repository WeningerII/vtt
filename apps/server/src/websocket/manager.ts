import { WebSocket, WebSocketServer, RawData } from "ws";
import { logger } from '@vtt/logging';
import { IncomingMessage } from "http";
import { World, MovementSystem } from "@vtt/core-ecs";
import { GameManager } from "../game/GameManager";
import { GameSession } from "../game/GameSession";

interface Client {
  id: string;
  ws: WebSocket;
  ip: string;
  userId?: string | null;
  displayName?: string;
  gameId?: string;
  campaignId?: string | null;
  lastActivity: number;
}

export class WebSocketManager {
  private clients = new Map<string, Client>();
  private wss: WebSocketServer;
  private gameManager: GameManager;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.gameManager = new GameManager();
    this.setupConnectionHandler();
    this.startGameStateSyncing();
  }

  private setupConnectionHandler(): void {
    this.wss.on("connection", (_ws: WebSocket, req: IncomingMessage) => {
      const id = crypto.randomUUID();
      const ip = req.socket.remoteAddress || "unknown";

      const client: Client = {
        id,
        ip,
        userId: null,
        campaignId: null,
        ws: _ws,
        lastActivity: Date.now(),
      };
      this.clients.set(id, client);

      _ws.on("message", (_data: RawData) => this.handleMessage(id, _data));
      _ws.on("close", () => this.handleDisconnection(id));
      _ws.on("error", (_err: Error) => this.handleError(id, _err));
    });
  }

  private startGameStateSyncing(): void {
    // Broadcast network deltas from all active games every 50ms (20hz)
    setInterval(() => {
      this.broadcastGameStateDeltas();
    }, 50);
  }

  private broadcastGameStateDeltas(): void {
    const activeGames = this.gameManager.getGames();
    
    for (const game of activeGames) {
      const delta = game.getNetworkDelta();
      if (!delta || (!delta.created.length && !delta.updated.length && !delta.removed.length)) {
        continue;
      }
      
      // Broadcast delta to all clients in this game
      this.broadcastToGame(game.gameId, {
        type: "DELTA",
        seq: delta.seq,
        baseSeq: delta.baseSeq,
        created: delta.created,
        updated: delta.updated,
        removed: delta.removed,
      });
    }
  }

  private handleMessage(clientId: string, data: RawData): void {
    const raw = typeof data === "string" ? data : data.toString("utf-8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (_err) {
      logger.warn(`[ws] non-json from ${clientId}`);
      this.sendToClient(clientId, {
        type: "ERROR",
        code: "INVALID_JSON",
        message: "Payload must be JSON",
      });
      return;
    }

    const msg = JSON.parse(data.toString());
    logger.info(`[ws] message from ${clientId}:`, msg.type);
    
    try {
      switch (msg.type) {
        case "PING":
          this.sendToClient(clientId, { type: "PONG", t: msg.t });
          break;
          
        case "ECHO":
          this.sendToClient(clientId, { type: "ECHO", payload: msg.payload });
          break;
          
        case "JOIN_GAME":
          this.handleJoinGame(clientId, msg);
          break;
          
        case "LEAVE_GAME":
          this.handleLeaveGame(clientId, msg);
          break;
          
        case "MOVE_TOKEN":
          this.handleMoveToken(clientId, msg);
          break;
          
        case "ROLL_DICE": {
          const rollDiceParams: { dice: string; label?: string; private: boolean } = {
            dice: msg.dice,
            private: msg.private
          };
          if (msg.label !== undefined) {
            rollDiceParams.label = msg.label;
          }
          this.handleRollDice(clientId, rollDiceParams);
    }
          break;
          
        case "CHAT_MESSAGE":
          this.handleChatMessage(clientId, msg);
          break;
          
        case "SET_ACTIVE_SCENE":
          this.handleSetActiveScene(clientId, msg);
          break;
          
        case "UPDATE_SCENE_SETTINGS":
          this.handleUpdateSceneSettings(clientId, msg);
          break;
          
        case "SYNC_MAP_VIEW":
          this.handleSyncMapView(clientId, msg);
          break;
          
        default: {
          // Handle combat messages or other unknown types
          const msgType = (msg as any).type;
          if (msgType === "COMBAT_SUBSCRIBE" || msgType === "COMBAT_UNSUBSCRIBE" || msgType === "REQUEST_TACTICAL_DECISION") {
            this.handleCombatMessage(clientId, msg);
          } else {
            this.sendToClient(clientId, {
              type: "ERROR",
              code: "UNHANDLED_TYPE",
              message: `Unhandled type ${msgType}`,
            });
          }
    }
          break;
      }
    } catch (error) {
      logger.error(`[ws] Error handling message from ${clientId}:`, error as Error);
      this.sendToClient(clientId, {
        type: "ERROR",
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      });
    }
  }

  // Game message handlers
  private handleJoinGame(clientId: string, msg: { gameId: string; userId: string; displayName: string }): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Update client info
    client.userId = msg.userId;
    client.displayName = msg.displayName;
    client.gameId = msg.gameId;

    // Get or create game
    const game = this.gameManager.findOrCreateGame(msg.gameId);
    
    // Add player to game
    const success = game.addPlayer(msg.userId, msg.displayName);
    if (success) {
      logger.info(`[ws] Player ${msg.displayName} joined game ${msg.gameId}`);
      
      // Send game state to client
      this.sendToClient(clientId, {
        type: "GAME_STATE",
        ...game.getGameState(),
      });

      // Send snapshot if game has entities
      const snapshot = game.getSnapshot();
      if (snapshot.entities.length > 0) {
        this.sendToClient(clientId, {
          type: "SNAPSHOT",
          seq: snapshot.seq,
          entities: snapshot.entities,
        });
      }

      // Broadcast player joined to other clients in the game
      this.broadcastToGame(msg.gameId, {
        type: "PLAYER_JOINED",
        userId: msg.userId,
        displayName: msg.displayName,
        gameId: msg.gameId,
      }, clientId);
    } else {
      this.sendToClient(clientId, {
        type: "ERROR",
        code: "JOIN_FAILED",
        message: "Failed to join game",
      });
    }
  }

  private handleLeaveGame(clientId: string, msg: { gameId: string }): void {
    const client = this.clients.get(clientId);
    if (!client || !client.userId) return;

    const game = this.gameManager.getGame(msg.gameId);
    if (game) {
      game.removePlayer(client.userId);
      
      this.broadcastToGame(msg.gameId, {
        type: "PLAYER_LEFT",
        userId: client.userId,
        gameId: msg.gameId,
      });

      logger.info(`[ws] Player ${client.displayName} left game ${msg.gameId}`);
    }

    // Clear client game info
    delete client.gameId;
  }

  private handleMoveToken(clientId: string, msg: { entityId: number; x: number; y: number; animate: boolean }): void {
    const client = this.clients.get(clientId);
    if (!client || !client.gameId) return;

    const game = this.gameManager.getGame(client.gameId);
    if (!game) return;

    // Add authorization check - only allow moving own tokens or if GM
    // const token = game.getToken(msg.entityId);
    const isGM = false; // game.isGameMaster(client.userId);
    const isOwner = false; // token && token.ownerId === client.userId;
    
    if (!isGM && !isOwner) {
      this.sendToClient(client.id, {
        type: 'error',
        error: 'Unauthorized: You can only move your own tokens'
      });
      return;
    }
    
    const success = game.moveToken(msg.entityId, msg.x, msg.y, msg.animate);
    
    if (!success) {
      this.sendToClient(clientId, {
        type: "ERROR",
        code: "MOVE_FAILED",
        message: "Failed to move token",
      });
    }
    // Movement will be broadcast automatically via game's network sync
  }

  private handleRollDice(clientId: string, msg: { dice: string; label?: string; private: boolean }): void {
    const client = this.clients.get(clientId);
    if (!client || !client.gameId || !client.userId || !client.displayName) return;

    const game = this.gameManager.getGame(client.gameId);
    if (!game) return;

    const result = game.rollDice(msg.dice, client.userId, msg.label);
    if (!result) {
      this.sendToClient(clientId, {
        type: "ERROR",
        code: "INVALID_DICE",
        message: "Invalid dice notation",
      });
      return;
    }

    const rollMessage = {
      type: "DICE_ROLL_RESULT" as const,
      rollId: result.rollId,
      userId: client.userId,
      displayName: client.displayName,
      dice: result.dice,
      label: result.label,
      total: result.total,
      rolls: result.rolls,
      modifier: result.modifier,
      timestamp: result.timestamp,
      private: msg.private,
    };

    if (msg.private) {
      // Send only to the rolling player
      this.sendToClient(clientId, rollMessage);
    } else {
      // Broadcast to all players in the game
      this.broadcastToGame(client.gameId, rollMessage);
    }
  }

  private handleChatMessage(clientId: string, msg: { message: string; channel: string }): void {
    const client = this.clients.get(clientId);
    if (!client || !client.gameId || !client.userId || !client.displayName) return;

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    this.broadcastToGame(client.gameId, {
      type: "CHAT_BROADCAST",
      messageId,
      userId: client.userId,
      displayName: client.displayName,
      message: msg.message,
      channel: msg.channel,
      timestamp: Date.now(),
    });
  }

  private async handleCombatMessage(clientId: string, msg: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.userId) return;

    try {
      // Import combat WebSocket handler
      // const { handleCombatWebSocket  } = await import("../routes/combat");
      
      // Create a mock WebSocket object with send method for the handler
      const mockWs = {
        send: (data: string) => {
          try {
            const response = JSON.parse(data);
            this.sendToClient(clientId, response);
          } catch (error) {
            logger.error('Error sending combat response:', error as Error);
          }
        }
      };
      
      // Handle the combat message
      // handleCombatWebSocket(mockWs, msg, client.userId);
    } catch (error) {
      logger.error(`[ws] Error handling combat message from ${clientId}:`, error as Error);
      this.sendToClient(clientId, {
        type: "ERROR",
        code: "COMBAT_ERROR",
        message: "Failed to process combat message",
      });
    }
  }

  // Map synchronization handlers
  private async handleSetActiveScene(clientId: string, msg: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.userId || !client.gameId) return;

    try {
      const { CampaignService  } = await import("../campaign/CampaignService");
      const campaignService = new CampaignService({} as any);
      
      // Set active scene (assuming gameId corresponds to campaignId)
      const success = await campaignService.setActiveScene(client.gameId, msg.sceneId, client.userId);
      
      if (success) {
        // Broadcast scene change to all clients in the campaign
        this.broadcastToGame(client.gameId, {
          type: "ACTIVE_SCENE_CHANGED",
          campaignId: client.gameId,
          sceneId: msg.sceneId,
          timestamp: Date.now(),
        });
      } else {
        this.sendToClient(clientId, {
          type: "ERROR",
          code: "SET_SCENE_FAILED",
          message: "Failed to set active scene",
        });
      }
    } catch (error) {
      logger.error(`[ws] Error setting active scene from ${clientId}:`, error as Error);
      this.sendToClient(clientId, {
        type: "ERROR",
        code: "SET_SCENE_ERROR",
        message: "Error setting active scene",
      });
    }
  }

  private async handleUpdateSceneSettings(clientId: string, msg: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.userId || !client.gameId) return;

    try {
      // Broadcast scene settings update to all clients in the campaign
      this.broadcastToGame(client.gameId, {
        type: "SCENE_SETTINGS_UPDATED",
        campaignId: client.gameId,
        sceneId: msg.sceneId,
        settings: {
          gridSettings: msg.gridSettings,
          lightingSettings: msg.lightingSettings,
          fogSettings: msg.fogSettings,
        },
        updatedBy: client.userId,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error(`[ws] Error updating scene settings from ${clientId}:`, error as Error);
      this.sendToClient(clientId, {
        type: "ERROR",
        code: "UPDATE_SETTINGS_ERROR",
        message: "Error updating scene settings",
      });
    }
  }

  private handleSyncMapView(clientId: string, msg: any): void {
    const client = this.clients.get(clientId);
    if (!client || !client.userId || !client.gameId) return;

    try {
      // Broadcast map view synchronization to other clients in the campaign
      this.broadcastToGame(client.gameId, {
        type: "MAP_VIEW_SYNCED",
        campaignId: client.gameId,
        sceneId: msg.sceneId,
        viewState: {
          zoom: msg.zoom,
          centerX: msg.centerX,
          centerY: msg.centerY,
          viewport: msg.viewport,
        },
        syncedBy: client.userId,
        timestamp: Date.now(),
      }, clientId); // Exclude the sender
    } catch (error) {
      logger.error(`[ws] Error syncing map view from ${clientId}:`, error as Error);
      this.sendToClient(clientId, {
        type: "ERROR",
        code: "SYNC_VIEW_ERROR",
        message: "Error syncing map view",
      });
    }
  }

  private handleDisconnection(clientId: string): void {
    const client = this.clients.get(clientId);
    
    // Clean up game state if client was in a game
    if (client?.gameId && client.userId) {
      const game = this.gameManager.getGame(client.gameId);
      if (game) {
        game.setPlayerConnected(client.userId, false);
        
        this.broadcastToGame(client.gameId, {
          type: "PLAYER_LEFT",
          userId: client.userId,
          gameId: client.gameId,
        });
      }
    }

    this.clients.delete(clientId);
    logger.info(`[ws] client ${clientId} disconnected`);
  }

  private handleError(clientId: string, error: Error): void {
    logger.error(`[ws] client ${clientId} error:`, error);
    this.clients.delete(clientId);
  }

  private sendToClient(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  broadcast(message: any, excludeClientId?: string): void {
    const payload = JSON.stringify(message);
    for (const [id, client] of this.clients) {
      if (id !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  private broadcastToGame(gameId: string, message: any, excludeClientId?: string): void {
    const payload = JSON.stringify(message);
    for (const [id, client] of this.clients) {
      if (client.gameId === gameId && id !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  private generateClientId(): string {
    return Math.random().toString(36).slice(2, 8);
  }

  async shutdown(): Promise<void> {
    // Shutdown game manager
    await this.gameManager.shutdown();
    // close client connections
    for (const [, client] of this.clients) {
      try {
        client.ws.close(1001, "Server shutting down");
      } catch {}
    }
    this.clients.clear();
    // close the server
    await new Promise<void>((resolve) => {
      try {
        this.wss.close(() => resolve());
      } catch {
        resolve();
      }
    });
  }
}
