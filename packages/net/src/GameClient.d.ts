/**
 * Real-time game client with automatic synchronization
 */
import { EventEmitter } from "events";
import { Player, GameState } from "./GameSession";
export interface ClientConfig {
  serverUrl: string;
  playerId: string;
  playerName: string;
  role: "gm" | "player";
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
export declare class GameClient extends EventEmitter {
  private config;
  private ws;
  private connectionState;
  private gameState;
  private lastSequenceId;
  private messageQueue;
  private pingInterval;
  private reconnectTimeout;
  private heartbeatInterval;
  constructor(config: ClientConfig);
  connect(): Promise<void>;
  private establishConnection;
  private sendPlayerJoin;
  private setupHeartbeat;
  private sendPing;
  private handleMessage;
  private handlePong;
  private handleFullSync;
  private handleDeltaSync;
  private applyStateUpdate;
  private applyPlayerUpdate;
  private applyEntityUpdate;
  private applyCombatUpdate;
  private applySceneUpdate;
  private applySettingsUpdate;
  private handlePlayerJoined;
  private handlePlayerLeft;
  private handleServerError;
  private handleDisconnection;
  private handleConnectionError;
  private attemptReconnection;
  private cleanup;
  private sendMessage;
  private processMessageQueue;
  disconnect(): void;
  sendStateUpdate(type: string, data: any): void;
  sendPlayerAction(actionType: string, actionData: any): void;
  sendChatMessage(message: string): void;
  moveToken(tokenId: string, x: number, y: number): void;
  executeCombatAction(combatAction: any): void;
  requestFullSync(): void;
  isConnected(): boolean;
  isConnecting(): boolean;
  getLatency(): number;
  getGameState(): Partial<GameState>;
  getPlayers(): Player[];
  getPlayer(playerId: string): Player | undefined;
  getCurrentPlayer(): Player | undefined;
  getConnectionState(): ConnectionState;
}
//# sourceMappingURL=GameClient.d.ts.map
