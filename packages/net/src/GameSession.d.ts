/**
 * Real-time multiplayer game session with state synchronization
 */
import { EventEmitter } from "events";
import { World } from "@vtt/core-ecs";
import { CombatEngine } from "@vtt/rules-5e";
import { AIEntity } from "@vtt/ai";
export interface Player {
  id: string;
  name: string;
  role: "gm" | "player";
  characterIds: string[];
  connected: boolean;
  lastSeen: number;
}
export interface GameState {
  sessionId: string;
  players: Map<string, Player>;
  world: World;
  combat: CombatEngine;
  aiEntities: Map<string, AIEntity>;
  currentScene: string;
  settings: {
    gridSize: number;
    gridType: "square" | "hex";
    visionEnabled: boolean;
    initiativeTracking: boolean;
    aiEnabled: boolean;
  };
  lastUpdate: number;
}
export interface StateUpdate {
  type: "entity" | "combat" | "player" | "scene" | "settings";
  timestamp: number;
  playerId: string;
  data: any;
  sequenceId: number;
}
export interface SyncMessage {
  type: "full_sync" | "delta_sync" | "state_update" | "player_action";
  sessionId: string;
  timestamp: number;
  data: any;
  sequenceId?: number;
}
export declare class GameSession extends EventEmitter {
  private state;
  private updateQueue;
  private sequenceCounter;
  private lastSyncTime;
  private syncInterval;
  private maxUpdateQueueSize;
  private clientStates;
  constructor(sessionId: string);
  private setupCombatEventHandlers;
  private startSyncLoop;
  private processSyncTick;
  private cleanupClientStates;
  addPlayer(player: Player): void;
  removePlayer(playerId: string): void;
  updatePlayerConnection(playerId: string, connected: boolean): void;
  private handlePlayerDisconnect;
  queueUpdate(type: StateUpdate["type"], playerId: string, data: any): void;
  applyUpdate(update: StateUpdate): boolean;
  private applyEntityUpdate;
  private applyCombatUpdate;
  private applyPlayerUpdate;
  private applySceneUpdate;
  private applySettingsUpdate;
  getFullSync(playerId: string): SyncMessage;
  getDeltaSync(playerId: string, lastSequenceId: number): SyncMessage;
  private isUpdateRelevantToPlayer;
  private broadcastDeltaSync;
  handleClientMessage(playerId: string, message: SyncMessage): void;
  private handleStateUpdate;
  private handlePlayerAction;
  private handleMoveToken;
  private handleCombatAction;
  private handleChatMessage;
  private validatePlayerPermission;
  private playerOwnsEntity;
  private playerOwnsToken;
  private serializePlayer;
  private serializeWorldState;
  private serializeCombatState;
  getSessionId(): string;
  getPlayers(): Player[];
  getPlayer(playerId: string): Player | undefined;
  getWorld(): World;
  getCombatEngine(): CombatEngine;
  getSettings(): GameState["settings"];
  updateSettings(settings: Partial<GameState["settings"]>): void;
  addAIEntity(
    id: string,
    archetype?: "guard" | "berserker" | "scout" | "healer" | "wildcard",
  ): void;
  removeAIEntity(id: string): void;
  private updateAIEntities;
  private createGameStateSnapshot;
  private handleAIAction;
  getAIEntities(): AIEntity[];
  getAIEntity(id: string): AIEntity | undefined;
  destroy(): void;
}
//# sourceMappingURL=GameSession.d.ts.map
