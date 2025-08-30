/**
 * Real-time game client with automatic synchronization
 */

import { EventEmitter } from 'events';
import { logger } from '@vtt/logging';
import { SyncMessage, Player, GameState } from './GameSession';

export interface ClientConfig {
  serverUrl: string;
  playerId: string;
  playerName: string;
  role: 'gm' | 'player';
  reconnectAttempts: number;
  reconnectDelay: number;
}

export interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  lastPing: number;
  latency: number;
  reconnectAttempts: number;
}

export class GameClient extends EventEmitter {
  private config: ClientConfig;
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState;
  private gameState: Partial<GameState> = {};
  private lastSequenceId = 0;
  private messageQueue: SyncMessage[] = [];
  private pingInterval: number | null = null;
  private reconnectTimeout: number | null = null;
  private heartbeatInterval = 30000; // 30 seconds

  constructor(config: ClientConfig) {
    super();
    
    this.config = {
      ...config,
      reconnectAttempts: config.reconnectAttempts ?? 5,
      reconnectDelay: config.reconnectDelay ?? 2000
    };

    this.connectionState = {
      connected: false,
      connecting: false,
      lastPing: 0,
      latency: 0,
      reconnectAttempts: 0,
    };
  }

  public async connect(): Promise<void> {
    if (this.connectionState.connected || this.connectionState.connecting) {
      return;
    }

    this.connectionState.connecting = true;
    this.emit('connecting');

    try {
      await this.establishConnection();
      this.setupHeartbeat();
      this.connectionState.connected = true;
      this.connectionState.connecting = false;
      this.connectionState.reconnectAttempts = 0;
      this.emit('connected');
      
      // Process any queued messages
      this.processMessageQueue();
    } catch (error) {
      this.connectionState.connecting = false;
      this.handleConnectionError(error);
    }
  }

  private establishConnection(): Promise<void> {
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

  private sendPlayerJoin(): void {
    const joinMessage = {
      type: 'player_join',
      data: {
        playerId: this.config.playerId,
        playerName: this.config.playerName,
        role: this.config.role,
      }
    };
    
    this.sendMessage(joinMessage);
  }

  private setupHeartbeat(): void {
    this.pingInterval = window.setInterval(() => {
      if (this.connectionState.connected) {
        this.sendPing();
      }
    }, this.heartbeatInterval);
  }

  private sendPing(): void {
    const pingTime = Date.now();
    this.connectionState.lastPing = pingTime;
    
    this.sendMessage({
      type: 'ping',
      timestamp: pingTime,
    });
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'pong':
          this.handlePong(message);
          break;
        case 'full_sync':
          this.handleFullSync(message);
          break;
        case 'delta_sync':
          this.handleDeltaSync(message);
          break;
        case 'player_joined':
          this.handlePlayerJoined(message);
          break;
        case 'player_left':
          this.handlePlayerLeft(message);
          break;
        case 'error':
          this.handleServerError(message);
          break;
        default:
          this.emit('message', message);
      }
    } catch (error) {
      logger.error('Error parsing message:', { error });
    }
  }

  private handlePong(_message: any): void {
    const now = Date.now();
    this.connectionState.latency = now - this.connectionState.lastPing;
    this.emit('latencyUpdate', this.connectionState.latency);
  }

  private handleFullSync(message: SyncMessage): void {
    const { data  } = message;
    
    // Update local game state
    this.gameState = {
      sessionId: data.sessionId || '',
      players: new Map(data.players?.map((p: Player) => [p.id, p]) || []),
      currentScene: data.currentScene,
      settings: data.settings,
      lastUpdate: Date.now(),
    } as GameState;

    this.lastSequenceId = data.sequenceId || 0;
    
    this.emit('fullSync', this.gameState);
    this.emit('stateUpdated', this.gameState);
  }

  private handleDeltaSync(message: SyncMessage): void {
    const { data  } = message;
    
    if (data.updates && Array.isArray(data.updates)) {
      for (const update of data.updates) {
        this.applyStateUpdate(update);
      }
    }

    if (data.sequenceId) {
      this.lastSequenceId = Math.max(this.lastSequenceId, data.sequenceId);
    }

    this.emit('deltaSync', data.updates);
    this.emit('stateUpdated', this.gameState);
  }

  private applyStateUpdate(update: any): void {
    try {
      switch (update.type) {
        case 'player':
          this.applyPlayerUpdate(update);
          break;
        case 'entity':
          this.applyEntityUpdate(update);
          break;
        case 'combat':
          this.applyCombatUpdate(update);
          break;
        case 'scene':
          this.applySceneUpdate(update);
          break;
        case 'settings':
          this.applySettingsUpdate(update);
          break;
      }
      
      this.emit('updateApplied', update);
    } catch (error) {
      logger.error('Error applying state update:', { error, update });
    }
  }

  private applyPlayerUpdate(update: any): void {
    const { data  } = update;
    
    switch (data.event) {
      case 'playerJoined':
        if (this.gameState.players && data.player) {
          this.gameState.players.set(data.player.id, data.player);
          this.emit('playerJoined', data.player);
        }
        break;
      case 'playerLeft':
        if (this.gameState.players && data.playerId) {
          const player = this.gameState.players.get(data.playerId);
          this.gameState.players.delete(data.playerId);
          this.emit('playerLeft', player);
        }
        break;
      case 'playerConnectionChanged':
        if (this.gameState.players && data.playerId) {
          const player = this.gameState.players.get(data.playerId);
          if (player) {
            player.connected = data.connected;
            this.emit('playerConnectionChanged', player);
          }
        }
        break;
      case 'chatMessage':
        this.emit('chatMessage', {
          playerId: data.playerId,
          message: data.message,
          timestamp: data.timestamp,
        });
        break;
    }
  }

  private applyEntityUpdate(update: any): void {
    this.emit('entityUpdate', update.data);
  }

  private applyCombatUpdate(update: any): void {
    const { data  } = update;
    
    switch (data.event) {
      case 'combatStarted':
        this.emit('combatStarted');
        break;
      case 'turnStarted':
        this.emit('turnStarted', data.combatant);
        break;
      case 'attackExecuted':
        this.emit('attackExecuted', data.data);
        break;
      case 'damageApplied':
        this.emit('damageApplied', data.data);
        break;
    }
  }

  private applySceneUpdate(update: any): void {
    const { data  } = update;
    
    if (data.action === 'changeScene') {
      this.gameState.currentScene = data.sceneId;
      this.emit('sceneChanged', data.sceneId);
    }
  }

  private applySettingsUpdate(update: any): void {
    if (this.gameState.settings && update.data.settings) {
      this.gameState.settings = { ...this.gameState.settings, ...update.data.settings };
      this.emit('settingsChanged', this.gameState.settings);
    }
  }

  private handlePlayerJoined(message: any): void {
    this.emit('playerJoined', message.data);
  }

  private handlePlayerLeft(message: any): void {
    this.emit('playerLeft', message.data);
  }

  private handleServerError(message: any): void {
    logger.error('Server error:', { data: message.data });
    this.emit('serverError', message.data);
  }

  private handleDisconnection(event: CloseEvent): void {
    this.connectionState.connected = false;
    this.cleanup();
    
    this.emit('disconnected', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
    });

    // Attempt reconnection if not a clean disconnect
    if (!event.wasClean && this.connectionState.reconnectAttempts < this.config.reconnectAttempts) {
      this.attemptReconnection();
    }
  }

  private handleConnectionError(error: any): void {
    logger.error('Connection error:', { error });
    this.emit('connectionError', error);
    
    if (this.connectionState.reconnectAttempts < this.config.reconnectAttempts) {
      this.attemptReconnection();
    }
  }

  private attemptReconnection(): void {
    this.connectionState.reconnectAttempts++;
    
    const delay = this.config.reconnectDelay * Math.pow(2, this.connectionState.reconnectAttempts - 1);
    
    this.emit('reconnecting', {
      attempt: this.connectionState.reconnectAttempts,
      maxAttempts: this.config.reconnectAttempts,
      delay,
    });

    this.reconnectTimeout = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private sendMessage(message: any): void {
    if (!this.connectionState.connected || !this.ws) {
      this.messageQueue.push(message);
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error('Error sending message:', { error });
      this.messageQueue.push(message);
    }
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.connectionState.connected) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }

  // Public API
  public disconnect(): void {
    this.cleanup();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.connectionState.connected = false;
    this.connectionState.connecting = false;
  }

  public sendStateUpdate(type: string, data: any): void {
    const message: SyncMessage = {
      type: 'state_update',
      sessionId: this.gameState.sessionId || '',
      timestamp: Date.now(),
      data: {
        type,
        ...data,
      },
    };
    
    this.sendMessage(message);
  }

  public sendPlayerAction(actionType: string, actionData: any): void {
    const message: SyncMessage = {
      type: 'player_action',
      sessionId: this.gameState.sessionId || '',
      timestamp: Date.now(),
      data: {
        type: actionType,
        data: actionData,
      },
    };
    
    this.sendMessage(message);
  }

  public sendChatMessage(message: string): void {
    this.sendPlayerAction('chat_message', { message });
  }

  public moveToken(tokenId: string, x: number, y: number): void {
    this.sendPlayerAction('move_token', { tokenId, x, y });
  }

  public executeCombatAction(combatAction: any): void {
    this.sendPlayerAction('combat_action', { combatAction });
  }

  public requestFullSync(): void {
    this.sendMessage({
      type: 'request_full_sync',
      sequenceId: this.lastSequenceId,
    });
  }

  // Getters
  public isConnected(): boolean {
    return this.connectionState.connected;
  }

  public isConnecting(): boolean {
    return this.connectionState.connecting;
  }

  public getLatency(): number {
    return this.connectionState.latency;
  }

  public getGameState(): Partial<GameState> {
    return this.gameState;
  }

  public getPlayers(): Player[] {
    return this.gameState.players ? Array.from(this.gameState.players.values()) : [];
  }

  public getPlayer(playerId: string): Player | undefined {
    return this.gameState.players?.get(playerId);
  }

  public getCurrentPlayer(): Player | undefined {
    return this.getPlayer(this.config.playerId);
  }

  public getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }
}
