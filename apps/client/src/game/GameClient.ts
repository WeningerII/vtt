import { WSClient } from '../net/ws';
import { logger } from '@vtt/logging';
import type { AnyServerMessage, AnyClientMessage } from '@vtt/core-schemas';

export interface GameState {
  gameId: string;
  mapId?: string;
  players: Array<{
    userId: string;
    displayName: string;
    connected: boolean;
  }>;
  turnOrder?: string[];
  currentTurn?: string;
  phase: 'exploration' | 'combat' | 'downtime';
}

export interface Entity {
  id: number;
  x: number;
  y: number;
  rot: number;
  sx: number;
  sy: number;
  zIndex: number;
  sprite?: number;
  tintR?: number;
  tintG?: number;
  tintB?: number;
  alpha?: number;
  frame?: number;
}

export interface DiceRollResult {
  rollId: string;
  userId: string;
  displayName: string;
  dice: string;
  label?: string;
  total: number;
  rolls: number[];
  modifier: number;
  timestamp: number;
  private: boolean;
}

export interface ChatMessage {
  messageId: string;
  userId: string;
  displayName: string;
  message: string;
  channel: string;
  timestamp: number;
}

type GameClientEventHandlers = {
  onConnectionChange: (_connected: boolean) => void;
  onGameStateUpdate: (_state: GameState) => void;
  onEntitiesSnapshot: (entities: Entity[]) => void;
  onEntitiesDelta: (_created: Entity[], _updated: Entity[], _removed: number[]) => void;
  onDiceRoll: (_result: DiceRollResult) => void;
  onChatMessage: (message: ChatMessage) => void;
  onPlayerJoined: (_userId: string, _displayName: string) => void;
  onPlayerLeft: (_userId: string) => void;
  onError: (_code: string, message: string) => void;
};

export class GameClient {
  private wsClient: WSClient;
  private handlers: Partial<GameClientEventHandlers> = {};
  private gameState: GameState | null = null;
  private entities = new Map<number, Entity>();
  private connected = false;

  constructor(wsUrl: string) {
    this.wsClient = new WSClient(wsUrl);
    this.setupWebSocketHandlers();
  }

  private setupWebSocketHandlers(): void {
    this.wsClient.onState((_state) => {
      const isConnected = state === 'open';
      if (this.connected !== isConnected) {
        this.connected = isConnected;
        this.handlers.onConnectionChange?.(isConnected);
      }
    });

    this.wsClient.onMessage((message: AnyServerMessage) => {
      this.handleServerMessage(message);
    });
  }

  private handleServerMessage(message: AnyServerMessage): void {
    switch (message.type) {
      case 'GAME_STATE':
        this.gameState = message as GameState;
        this.handlers.onGameStateUpdate?.(this.gameState);
        break;

      case 'SNAPSHOT':
        this.entities.clear();
        for (const entity of message.entities) {
          this.entities.set(entity.id, entity);
        }
        this.handlers.onEntitiesSnapshot?.(message.entities);
        break;

      case 'DELTA':
        // Apply created entities
        for (const entity of message.created) {
          this.entities.set(entity.id, entity);
        }
        // Apply updated entities
        for (const entity of message.updated) {
          this.entities.set(entity.id, entity);
        }
        // Remove deleted entities
        for (const id of message.removed) {
          this.entities.delete(id);
        }
        this.handlers.onEntitiesDelta?.(message.created, message.updated, message.removed);
        break;

      case 'DICE_ROLL_RESULT':
        this.handlers.onDiceRoll?.(message as DiceRollResult);
        break;

      case 'CHAT_BROADCAST':
        this.handlers.onChatMessage?.(message as ChatMessage);
        break;

      case 'PLAYER_JOINED':
        this.handlers.onPlayerJoined?.(message.userId, message.displayName);
        break;

      case 'PLAYER_LEFT':
        this.handlers.onPlayerLeft?.(message.userId);
        break;

      case 'ERROR':
        this.handlers.onError?.(message.code, message.message);
        break;

      case 'HELLO':
      case 'PONG':
      case 'ECHO':
        // Ignore these for now
        break;

      default:
        logger.warn('Unhandled server message:', message);
    }
  }

  // Event handler registration
  on<K extends keyof GameClientEventHandlers>(
    event: K,
    handler: GameClientEventHandlers[K]
  ): void {
    this.handlers[event] = handler;
  }

  // Connection management
  connect(): void {
    this.wsClient.connect();
  }

  disconnect(): void {
    this.wsClient.close();
  }

  isConnected(): boolean {
    return this.connected;
  }

  // Game actions
  joinGame(gameId: string, userId: string, displayName: string): void {
    this.sendMessage({
      type: 'JOIN_GAME',
      gameId,
      userId,
      displayName,
    });
  }

  leaveGame(gameId: string): void {
    this.sendMessage({
      type: 'LEAVE_GAME',
      gameId,
    });
  }

  moveToken(entityId: number, x: number, y: number, animate = true): void {
    this.sendMessage({
      type: 'MOVE_TOKEN',
      entityId,
      x,
      y,
      animate,
    });
  }

  rollDice(dice: string, label?: string, isPrivate = false): void {
    this.sendMessage({
      type: 'ROLL_DICE',
      dice,
      label,
      private: isPrivate,
    });
  }

  sendChatMessage(message: string, channel = 'general'): void {
    this.sendMessage({
      type: 'CHAT_MESSAGE',
      message,
      channel,
    });
  }

  private sendMessage(message: AnyClientMessage): void {
    if (!this.connected) {
      logger.warn('Cannot send message: not connected');
      return;
    }
    this.wsClient.send(message);
  }

  // State getters
  getGameState(): GameState | null {
    return this.gameState;
  }

  getEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  getEntity(id: number): Entity | undefined {
    return this.entities.get(id);
  }
}
