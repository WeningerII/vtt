/**
 * Real-time game client with automatic synchronization
 */
import { EventEmitter } from "events";
export class GameClient extends EventEmitter {
  constructor(config) {
    super();
    this.ws = null;
    this.gameState = {};
    this.lastSequenceId = 0;
    this.messageQueue = [];
    this.pingInterval = null;
    this.reconnectTimeout = null;
    this.heartbeatInterval = 30000; // 30 seconds
    this.config = {
      ...config,
      reconnectAttempts: config.reconnectAttempts ?? 5,
      reconnectDelay: config.reconnectDelay ?? 2000,
    };
    this.connectionState = {
      connected: false,
      connecting: false,
      lastPing: 0,
      latency: 0,
      reconnectAttempts: 0,
    };
  }
  async connect() {
    if (this.connectionState.connected || this.connectionState.connecting) {
      return;
    }
    this.connectionState.connecting = true;
    this.emit("connecting");
    try {
      await this.establishConnection();
      this.setupHeartbeat();
      this.connectionState.connected = true;
      this.connectionState.connecting = false;
      this.connectionState.reconnectAttempts = 0;
      this.emit("connected");
      // Process any queued messages
      this.processMessageQueue();
    } catch (error) {
      this.connectionState.connecting = false;
      this.handleConnectionError(error);
    }
  }
  establishConnection() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.serverUrl);
        this.ws.onopen = () => {
          this.sendPlayerJoin();
          resolve();
        };
        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
        this.ws.onclose = (event) => {
          this.handleDisconnection(event);
        };
        this.ws.onerror = (error) => {
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }
  sendPlayerJoin() {
    const joinMessage = {
      type: "player_join",
      data: {
        playerId: this.config.playerId,
        playerName: this.config.playerName,
        role: this.config.role,
      },
    };
    this.sendMessage(joinMessage);
  }
  setupHeartbeat() {
    this.pingInterval = window.setInterval(() => {
      if (this.connectionState.connected) {
        this.sendPing();
      }
    }, this.heartbeatInterval);
  }
  sendPing() {
    const pingTime = Date.now();
    this.connectionState.lastPing = pingTime;
    this.sendMessage({
      type: "ping",
      timestamp: pingTime,
    });
  }
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      switch (message.type) {
        case "pong":
          this.handlePong(message);
          break;
        case "full_sync":
          this.handleFullSync(message);
          break;
        case "delta_sync":
          this.handleDeltaSync(message);
          break;
        case "player_joined":
          this.handlePlayerJoined(message);
          break;
        case "player_left":
          this.handlePlayerLeft(message);
          break;
        case "error":
          this.handleServerError(message);
          break;
        default:
          this.emit("message", message);
      }
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  }
  handlePong(message) {
    const now = Date.now();
    this.connectionState.latency = now - this.connectionState.lastPing;
    this.emit("latencyUpdate", this.connectionState.latency);
  }
  handleFullSync(message) {
    const { data } = message;
    // Update local game state
    this.gameState = {
      sessionId: data.sessionId || "",
      players: new Map(data.players?.map((p) => [p.id, p]) || []),
      currentScene: data.currentScene,
      settings: data.settings,
      lastUpdate: Date.now(),
    };
    this.lastSequenceId = data.sequenceId || 0;
    this.emit("fullSync", this.gameState);
    this.emit("stateUpdated", this.gameState);
  }
  handleDeltaSync(message) {
    const { data } = message;
    if (data.updates && Array.isArray(data.updates)) {
      for (const update of data.updates) {
        this.applyStateUpdate(update);
      }
    }
    if (data.sequenceId) {
      this.lastSequenceId = Math.max(this.lastSequenceId, data.sequenceId);
    }
    this.emit("deltaSync", data.updates);
    this.emit("stateUpdated", this.gameState);
  }
  applyStateUpdate(update) {
    try {
      switch (update.type) {
        case "player":
          this.applyPlayerUpdate(update);
          break;
        case "entity":
          this.applyEntityUpdate(update);
          break;
        case "combat":
          this.applyCombatUpdate(update);
          break;
        case "scene":
          this.applySceneUpdate(update);
          break;
        case "settings":
          this.applySettingsUpdate(update);
          break;
      }
      this.emit("updateApplied", update);
    } catch (error) {
      console.error("Error applying state update:", error, update);
    }
  }
  applyPlayerUpdate(update) {
    const { data } = update;
    switch (data.event) {
      case "playerJoined":
        if (this.gameState.players && data.player) {
          this.gameState.players.set(data.player.id, data.player);
          this.emit("playerJoined", data.player);
        }
        break;
      case "playerLeft":
        if (this.gameState.players && data.playerId) {
          const player = this.gameState.players.get(data.playerId);
          this.gameState.players.delete(data.playerId);
          this.emit("playerLeft", player);
        }
        break;
      case "playerConnectionChanged":
        if (this.gameState.players && data.playerId) {
          const player = this.gameState.players.get(data.playerId);
          if (player) {
            player.connected = data.connected;
            this.emit("playerConnectionChanged", player);
          }
        }
        break;
      case "chatMessage":
        this.emit("chatMessage", {
          playerId: data.playerId,
          message: data.message,
          timestamp: data.timestamp,
        });
        break;
    }
  }
  applyEntityUpdate(update) {
    this.emit("entityUpdate", update.data);
  }
  applyCombatUpdate(update) {
    const { data } = update;
    switch (data.event) {
      case "combatStarted":
        this.emit("combatStarted");
        break;
      case "turnStarted":
        this.emit("turnStarted", data.combatant);
        break;
      case "attackExecuted":
        this.emit("attackExecuted", data.data);
        break;
      case "damageApplied":
        this.emit("damageApplied", data.data);
        break;
    }
  }
  applySceneUpdate(update) {
    const { data } = update;
    if (data.action === "changeScene") {
      this.gameState.currentScene = data.sceneId;
      this.emit("sceneChanged", data.sceneId);
    }
  }
  applySettingsUpdate(update) {
    if (this.gameState.settings && update.data.settings) {
      this.gameState.settings = { ...this.gameState.settings, ...update.data.settings };
      this.emit("settingsChanged", this.gameState.settings);
    }
  }
  handlePlayerJoined(message) {
    this.emit("playerJoined", message.data);
  }
  handlePlayerLeft(message) {
    this.emit("playerLeft", message.data);
  }
  handleServerError(message) {
    console.error("Server error:", message.data);
    this.emit("serverError", message.data);
  }
  handleDisconnection(event) {
    this.connectionState.connected = false;
    this.cleanup();
    this.emit("disconnected", {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
    });
    // Attempt reconnection if not a clean disconnect
    if (!event.wasClean && this.connectionState.reconnectAttempts < this.config.reconnectAttempts) {
      this.attemptReconnection();
    }
  }
  handleConnectionError(error) {
    console.error("Connection error:", error);
    this.emit("connectionError", error);
    if (this.connectionState.reconnectAttempts < this.config.reconnectAttempts) {
      this.attemptReconnection();
    }
  }
  attemptReconnection() {
    this.connectionState.reconnectAttempts++;
    const delay =
      this.config.reconnectDelay * Math.pow(2, this.connectionState.reconnectAttempts - 1);
    this.emit("reconnecting", {
      attempt: this.connectionState.reconnectAttempts,
      maxAttempts: this.config.reconnectAttempts,
      delay,
    });
    this.reconnectTimeout = window.setTimeout(() => {
      this.connect();
    }, delay);
  }
  cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
  sendMessage(message) {
    if (!this.connectionState.connected || !this.ws) {
      this.messageQueue.push(message);
      return;
    }
    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error("Error sending message:", error);
      this.messageQueue.push(message);
    }
  }
  processMessageQueue() {
    while (this.messageQueue.length > 0 && this.connectionState.connected) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }
  // Public API
  disconnect() {
    this.cleanup();
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
    this.connectionState.connected = false;
    this.connectionState.connecting = false;
  }
  sendStateUpdate(type, data) {
    const message = {
      type: "state_update",
      sessionId: this.gameState.sessionId || "",
      timestamp: Date.now(),
      data: {
        type,
        ...data,
      },
    };
    this.sendMessage(message);
  }
  sendPlayerAction(actionType, actionData) {
    const message = {
      type: "player_action",
      sessionId: this.gameState.sessionId || "",
      timestamp: Date.now(),
      data: {
        type: actionType,
        data: actionData,
      },
    };
    this.sendMessage(message);
  }
  sendChatMessage(message) {
    this.sendPlayerAction("chat_message", { message });
  }
  moveToken(tokenId, x, y) {
    this.sendPlayerAction("move_token", { tokenId, x, y });
  }
  executeCombatAction(combatAction) {
    this.sendPlayerAction("combat_action", { combatAction });
  }
  requestFullSync() {
    this.sendMessage({
      type: "request_full_sync",
      sequenceId: this.lastSequenceId,
    });
  }
  // Getters
  isConnected() {
    return this.connectionState.connected;
  }
  isConnecting() {
    return this.connectionState.connecting;
  }
  getLatency() {
    return this.connectionState.latency;
  }
  getGameState() {
    return this.gameState;
  }
  getPlayers() {
    return this.gameState.players ? Array.from(this.gameState.players.values()) : [];
  }
  getPlayer(playerId) {
    return this.gameState.players?.get(playerId);
  }
  getCurrentPlayer() {
    return this.getPlayer(this.config.playerId);
  }
  getConnectionState() {
    return { ...this.connectionState };
  }
}
//# sourceMappingURL=GameClient.js.map
