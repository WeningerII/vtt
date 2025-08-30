/**
 * WebSocket Manager for real-time VTT collaboration
 */
import { WebSocketServer, WebSocket } from "ws";
import { logger } from "@vtt/logging";
import type { Buffer } from "node:buffer";

import { IncomingMessage } from "http";
import { v4 as _uuidv4 } from "uuid";
import { EventEmitter } from "events";

export interface VTTWebSocketMessage {
  type:
    | "token_move"
    | "token_add"
    | "token_remove"
    | "scene_update"
    | "combat_update"
    | "spell_cast"
    | "spell_effect"
    | "physics_collision"
    | "projectile_launch"
    | "barrier_created"
    | "constraint_applied"
    | "force_applied"
    | "teleport_effect"
    | "concentration_check"
    | "effect_expired"
    | "user_join"
    | "user_leave"
    | "ping"
    | "pong";
  payload: any;
  sessionId: string;
  userId: string;
  timestamp: number;
}

export interface ConnectedUser {
  id: string;
  socket: WebSocket;
  sessionId: string;
  campaignId: string;
  isGM: boolean;
  lastPing: number;
}

export class WebSocketManager extends EventEmitter {
  private wss: WebSocketServer;
  private sessions: Map<string, Set<ConnectedUser>> = new Map();
  private userSockets: Map<string, ConnectedUser> = new Map();
  private pingInterval!: NodeJS.Timeout;

  constructor(wss: WebSocketServer) {
    super();
    this.wss = wss;
    this.setupWebSocketServer();
    this.startPingInterval();
  }

  private setupWebSocketServer() {
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const sessionId = url.searchParams.get("sessionId");
      const userId = url.searchParams.get("userId");
      const campaignId = url.searchParams.get("campaignId");
      const isGM = url.searchParams.get("isGM") === "true";

      if (!sessionId || !userId || !campaignId) {
        ws.close(1008, "Missing required parameters");
        return;
      }

      const user: ConnectedUser = {
        id: userId,
        socket: ws,
        sessionId,
        campaignId,
        isGM,
        lastPing: Date.now(),
      };

      this.addUserToSession(user);

      ws.on("message", (data: Buffer) => {
        try {
          const message: VTTWebSocketMessage = JSON.parse(data.toString());
          this.handleMessage(user, message);
        } catch (error) {
          logger.error("Invalid WebSocket message:", error as Error);
        }
      });

      ws.on("close", () => {
        this.removeUserFromSession(user);
      });

      ws.on("error", (error) => {
        logger.error("WebSocket error:", error as Error);
        this.removeUserFromSession(user);
      });

      // Send welcome message
      this.sendToUser(user, {
        type: "user_join",
        payload: { userId, sessionId, campaignId },
        sessionId,
        userId: "system",
        timestamp: Date.now(),
      });
    });
  }

  private addUserToSession(user: ConnectedUser) {
    // Add to session
    if (!this.sessions.has(user.sessionId)) {
      this.sessions.set(user.sessionId, new Set());
    }
    this.sessions.get(user.sessionId)!.add(user);

    // Add to user lookup
    this.userSockets.set(user.id, user);

    // Notify other users
    this.broadcastToSession(
      user.sessionId,
      {
        type: "user_join",
        payload: {
          userId: user.id,
          isGM: user.isGM,
          userCount: this.sessions.get(user.sessionId)!.size,
        },
        sessionId: user.sessionId,
        userId: "system",
        timestamp: Date.now(),
      },
      user.id,
    );

    logger.info(`User ${user.id} joined session ${user.sessionId}`);
  }

  private removeUserFromSession(user: ConnectedUser) {
    const session = this.sessions.get(user.sessionId);
    if (session) {
      session.delete(user);
      if (session.size === 0) {
        this.sessions.delete(user.sessionId);
      }
    }

    this.userSockets.delete(user.id);

    // Notify other users
    this.broadcastToSession(user.sessionId, {
      type: "user_leave",
      payload: {
        userId: user.id,
        userCount: session?.size || 0,
      },
      sessionId: user.sessionId,
      userId: "system",
      timestamp: Date.now(),
    });

    logger.info(`User ${user.id} left session ${user.sessionId}`);
  }

  private handleMessage(user: ConnectedUser, message: VTTWebSocketMessage) {
    // Update last ping
    user.lastPing = Date.now();

    switch (message.type) {
      case "ping":
        this.sendToUser(user, {
          type: "pong",
          payload: {},
          sessionId: user.sessionId,
          userId: "system",
          timestamp: Date.now(),
        });
        break;

      case "token_move":
        // Validate GM permissions for certain actions
        if (this.requiresGMPermission(message.type) && !user.isGM) {
          this.sendError(user, "Insufficient permissions");
          return;
        }
        this.broadcastToSession(user.sessionId, message, user.id);
        break;

      case "token_add":
      case "token_remove":
      case "scene_update":
        if (!user.isGM) {
          this.sendError(user, "GM permissions required");
          return;
        }
        this.broadcastToSession(user.sessionId, message, user.id);
        break;

      case "combat_update":
        if (!user.isGM) {
          this.sendError(user, "GM permissions required");
          return;
        }
        this.broadcastToSession(user.sessionId, message, user.id);
        break;

      case "spell_cast":
      case "spell_effect":
      case "physics_collision":
      case "projectile_launch":
      case "barrier_created":
      case "constraint_applied":
      case "force_applied":
      case "teleport_effect":
      case "concentration_check":
      case "effect_expired":
        this.broadcastToSession(user.sessionId, message, user.id);
        this.emit("gameEvent", message);
        break;

      default:
        this.broadcastToSession(user.sessionId, message, user.id);
    }
  }

  private requiresGMPermission(messageType: string): boolean {
    const gmOnlyActions = ["token_add", "token_remove", "scene_update", "combat_update"];
    return gmOnlyActions.includes(messageType);
  }

  private sendToUser(user: ConnectedUser, message: VTTWebSocketMessage) {
    if (user.socket.readyState === WebSocket.OPEN) {
      user.socket.send(JSON.stringify(message));
    }
  }

  private sendError(user: ConnectedUser, error: string) {
    this.sendToUser(user, {
      type: "error" as any,
      payload: { error },
      sessionId: user.sessionId,
      userId: "system",
      timestamp: Date.now(),
    });
  }

  private broadcastToSession(
    sessionId: string,
    message: VTTWebSocketMessage,
    excludeUserId?: string,
  ) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    for (const user of session) {
      if (excludeUserId && user.id === excludeUserId) continue;
      this.sendToUser(user, message);
    }
  }

  // Public broadcast method for external services
  public broadcast(type: string, payload: any) {
    const message: VTTWebSocketMessage = {
      type: type as any,
      payload,
      sessionId: "broadcast",
      userId: "system",
      timestamp: Date.now(),
    };

    // Broadcast to all connected users across all sessions
    for (const user of this.userSockets.values()) {
      this.sendToUser(user, message);
    }
  }

  private startPingInterval() {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      for (const user of this.userSockets.values()) {
        // Remove stale connections (no ping for 30 seconds)
        if (now - user.lastPing > 30000) {
          user.socket.terminate();
          this.removeUserFromSession(user);
        }
      }
    }, 10000); // Check every 10 seconds
  }

  // Public API methods
  public broadcastTokenMove(
    sessionId: string,
    tokenId: string,
    x: number,
    y: number,
    userId: string,
  ) {
    this.broadcastToSession(sessionId, {
      type: "token_move",
      payload: { tokenId, x, y },
      sessionId,
      userId,
      timestamp: Date.now(),
    });
  }

  public broadcastTokenAdd(sessionId: string, token: any, userId: string) {
    this.broadcastToSession(sessionId, {
      type: "token_add",
      payload: { token },
      sessionId,
      userId,
      timestamp: Date.now(),
    });
  }

  public broadcastTokenRemove(sessionId: string, tokenId: string, userId: string) {
    this.broadcastToSession(sessionId, {
      type: "token_remove",
      payload: { tokenId },
      sessionId,
      userId,
      timestamp: Date.now(),
    });
  }

  public broadcastSceneUpdate(sessionId: string, sceneData: any, userId: string) {
    this.broadcastToSession(sessionId, {
      type: "scene_update",
      payload: { sceneData },
      sessionId,
      userId,
      timestamp: Date.now(),
    });
  }

  public broadcastCombatUpdate(sessionId: string, combatData: any, userId: string) {
    this.broadcastToSession(sessionId, {
      type: "combat_update",
      payload: { combatData },
      sessionId,
      userId,
      timestamp: Date.now(),
    });
  }

  public getSessionUsers(sessionId: string): ConnectedUser[] {
    const session = this.sessions.get(sessionId);
    return session ? Array.from(session) : [];
  }

  public getSessionCount(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    return session ? session.size : 0;
  }

  public shutdown() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    // Close all connections
    for (const session of this.sessions.values()) {
      for (const user of session) {
        user.socket.close();
      }
    }
    this.sessions.clear();
    this.userSockets.clear();
    this.wss.close();
  }
}
