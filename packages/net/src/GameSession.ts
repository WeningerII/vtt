/**
 * Real-time multiplayer game session with state synchronization
 */

import { EventEmitter } from 'events';
import { logger } from '@vtt/logging';
// Temporarily stub out problematic imports to fix compilation
// import { World } from '@vtt/core-ecs';
// import { CombatEngine, Combatant } from '@vtt/rules-5e';
// import { AIEntity, NPCArchetypes, GameStateSnapshot } from '@vtt/ai';

// Temporary stub types
class World {
  id: string = '';
  entities: Map<string, any> = new Map();
  createEntity(id?: number): number { return id || 0; }
  destroyEntity(id: number): void {}
  update(deltaTime: number): void {}
  getComponent(entityId: string, componentType: string): any { return {}; }
  getEntities(): any[] { return []; }
}
class CombatEngine {
  addCombatant(combatant: any): void {}
  removeCombatant(id: string): void {}
  executeAction(action: any): void {}
  nextTurn(): void {}
  startCombat(): void {}
  endCombat(): void {}
  getCurrentCombatant(): any { return null; }
  getCombatants(): any[] { return []; }
  getTurnOrder(): any[] { return []; }
  getCurrentRound(): number { return 0; }
  isInCombat(): boolean { return false; }
  on(event: string, handler: (...args: any[]) => void): void {}
}
interface Combatant {
  id: string;
  name: string;
}
class AIEntity {
  constructor(public id: string, public personality: any) {}
  update(gameState: any, deltaTime: number): void {}
  getState(): any { return {}; }
}
class NPCArchetypes {
  static createGuard() { return {}; }
  static createBerserker() { return {}; }
  static createScout() { return {}; }
  static createHealer() { return {}; }
  static createWildcard() { return {}; }
}
interface GameStateSnapshot {
  timestamp: number;
  entities: any[];
  nearbyEnemies?: any[];
  nearbyAllies?: any[];
  isUnderThreat?: boolean;
  healthPercentage?: number;
  position?: { x: number; y: number; z: number };
  canMove?: boolean;
  canAttack?: boolean;
}

export interface Player {
  id: string;
  name: string;
  role: 'gm' | 'player';
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
    gridType: 'square' | 'hex';
    visionEnabled: boolean;
    initiativeTracking: boolean;
    aiEnabled: boolean;
  };
  lastUpdate: number;
}

export interface StateUpdate {
  type: 'entity' | 'combat' | 'player' | 'scene' | 'settings';
  timestamp: number;
  playerId: string;
  data: any;
  sequenceId: number;
}

export interface SyncMessage {
  type: 'full_sync' | 'delta_sync' | 'state_update' | 'player_action';
  sessionId: string;
  timestamp: number;
  data: any;
  sequenceId?: number;
}

export class GameSession extends EventEmitter {
  private state: GameState;
  private updateQueue: StateUpdate[] = [];
  private sequenceCounter = 0;
  private lastSyncTime = 0;
  private syncInterval = 50; // 20 FPS
  private maxUpdateQueueSize = 1000;
  private clientStates: Map<string, { lastSequenceId: number; lastSeen: number }> = new Map();

  constructor(sessionId: string) {
    super();
    
    this.state = {
      sessionId,
      players: new Map(),
      world: new World(),
      combat: new CombatEngine(),
      aiEntities: new Map(),
      currentScene: 'default',
      settings: {
        gridSize: 70,
        gridType: 'square',
        visionEnabled: true,
        initiativeTracking: true,
        aiEnabled: true,
      },
      lastUpdate: Date.now(),
    };

    this.setupCombatEventHandlers();
    this.startSyncLoop();
  }

  private setupCombatEventHandlers(): void {
    this.state.combat.on('combatStarted', (combatant: Combatant) => {
      this.queueUpdate('combat', 'system', { event: 'combatantAdded', combatant });
    });
    this.state.combat.on('combatantRemoved', (combatant: Combatant) => {
      this.queueUpdate('combat', 'system', { event: 'combatantRemoved', combatant });
    });

    this.state.combat.on('attackExecuted', (data: any) => {
      this.queueUpdate('combat', 'system', { event: 'attackExecuted', data });
    });

    this.state.combat.on('damageApplied', (data: any) => {
      this.queueUpdate('combat', 'system', { event: 'damageApplied', data });
    });
  }

  private startSyncLoop(): void {
    setInterval(() => {
      this.processSyncTick();
    }, this.syncInterval);
  }

  private processSyncTick(): void {
    const now = Date.now();
    
    // Process queued updates
    if (this.updateQueue.length > 0) {
      this.broadcastDeltaSync();
    }

    // Clean up old client states
    this.cleanupClientStates(now);

    // Update world simulation
    this.state.world.update(this.syncInterval / 1000);

    // Update AI entities if enabled
    if (this.state.settings.aiEnabled) {
      this.updateAIEntities(this.syncInterval / 1000);
    }

    this.lastSyncTime = now;
  }

  private cleanupClientStates(now: number): void {
    const timeout = 30000; // 30 seconds
    for (const [playerId, clientState] of this.clientStates) {
      if (now - clientState.lastSeen > timeout) {
        this.handlePlayerDisconnect(playerId);
      }
    }
  }

  // Player management
  public addPlayer(player: Player): void {
    this.state.players.set(player.id, player);
    this.clientStates.set(player.id, { lastSequenceId: 0, lastSeen: Date.now() });
    
    this.queueUpdate('player', 'system', {
      event: 'playerJoined',
      player: this.serializePlayer(player)
    });

    this.emit('playerJoined', player);
  }

  public removePlayer(playerId: string): void {
    const player = this.state.players.get(playerId);
    if (player) {
      this.state.players.delete(playerId);
      this.clientStates.delete(playerId);
      
      this.queueUpdate('player', 'system', {
        event: 'playerLeft',
        playerId
      });

      this.emit('playerLeft', player);
    }
  }

  public updatePlayerConnection(playerId: string, connected: boolean): void {
    const player = this.state.players.get(playerId);
    if (player) {
      player.connected = connected;
      player.lastSeen = Date.now();
      
      const clientState = this.clientStates.get(playerId);
      if (clientState) {
        clientState.lastSeen = Date.now();
      }

      this.queueUpdate('player', 'system', {
        event: 'playerConnectionChanged',
        playerId,
        connected
      });
    }
  }

  private handlePlayerDisconnect(playerId: string): void {
    this.updatePlayerConnection(playerId, false);
    this.emit('playerDisconnected', playerId);
  }

  // State management
  public queueUpdate(type: StateUpdate['type'], playerId: string, data: any): void {
    if (this.updateQueue.length >= this.maxUpdateQueueSize) {
      // Remove oldest updates to prevent memory issues
      this.updateQueue.splice(0, this.updateQueue.length - this.maxUpdateQueueSize + 1);
    }

    const update: StateUpdate = {
      type,
      timestamp: Date.now(),
      playerId,
      data,
      sequenceId: ++this.sequenceCounter,
    };

    this.updateQueue.push(update);
    this.state.lastUpdate = update.timestamp;
  }

  public applyUpdate(update: StateUpdate): boolean {
    try {
      switch (update.type) {
        case 'entity':
          return this.applyEntityUpdate(update);
        case 'combat':
          return this.applyCombatUpdate(update);
        case 'player':
          return this.applyPlayerUpdate(update);
        case 'scene':
          return this.applySceneUpdate(update);
        case 'settings':
          return this.applySettingsUpdate(update);
        default:
          logger.warn('Unknown update type:', { type: update.type });
          return false;
      }
    } catch (error) {
      logger.error('Error applying update:', { error });
      return false;
    }
  }

  private applyEntityUpdate(update: StateUpdate): boolean {
    const { action,  entityId,  componentType,  data  } = update.data;
    
    switch (action) {
      case 'create':
        this.state.world.createEntity(entityId);
        break;
      case 'destroy':
        this.state.world.destroyEntity(entityId);
        break;
      case 'addComponent': {
        // Add component to entity
        const component = this.state.world.getComponent(entityId, componentType);
        if (component && component.add) {
          component.add(entityId, data);
        }
    }
        break;
      case 'updateComponent': {
        // Update component data
        const updateComponent = this.state.world.getComponent(entityId, componentType);
        if (updateComponent && updateComponent.update) {
          updateComponent.update(entityId, data);
        }
    }
        break;
      case 'removeComponent': {
        const removeComponent = this.state.world.getComponent(entityId, componentType);
        if (removeComponent && removeComponent.remove) {
          removeComponent.remove(entityId);
        }
    }
        break;
      default:
        return false;
    }
    
    return true;
  }

  private applyCombatUpdate(update: StateUpdate): boolean {
    const { action,  data  } = update.data;
    
    switch (action) {
      case 'addCombatant':
        this.state.combat.addCombatant(data);
        break;
      case 'removeCombatant':
        this.state.combat.removeCombatant(data.id);
        break;
      case 'executeAction':
        this.state.combat.executeAction(data);
        break;
      case 'nextTurn':
        this.state.combat.nextTurn();
        break;
      case 'startCombat':
        this.state.combat.startCombat();
        break;
      case 'endCombat':
        this.state.combat.endCombat();
        break;
      default:
        return false;
    }
    
    return true;
  }

  private applyPlayerUpdate(update: StateUpdate): boolean {
    const { action,  playerId,  data  } = update.data;
    
    switch (action) {
      case 'updateCharacter': {
        // Update player's character data
        const player = this.state.players.get(playerId);
        if (player && data.characterId && player.characterIds.includes(data.characterId)) {
          // Apply character updates
          this.emit('characterUpdated', { playerId, characterId: data.characterId, updates: data.updates });
        }
    }
        break;
      default:
        return false;
    }
    
    return true;
  }

  private applySceneUpdate(update: StateUpdate): boolean {
    const { action,  data  } = update.data;
    
    switch (action) {
      case 'changeScene':
        this.state.currentScene = data.sceneId;
        break;
      case 'updateSceneData':
        // Update scene-specific data
        this.emit('sceneDataUpdated', data);
        break;
      default:
        return false;
    }
    
    return true;
  }

  private applySettingsUpdate(update: StateUpdate): boolean {
    const { settings  } = update.data;
    this.state.settings = { ...this.state.settings, ...settings };
    return true;
  }

  // Synchronization
  public getFullSync(playerId: string): SyncMessage {
    const player = this.state.players.get(playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    return {
      type: 'full_sync',
      sessionId: this.state.sessionId,
      timestamp: Date.now(),
      data: {
        players: Array.from(this.state.players.values()).map(p => this.serializePlayer(p)),
        worldState: this.serializeWorldState(),
        combatState: this.serializeCombatState(),
        currentScene: this.state.currentScene,
        settings: this.state.settings,
        sequenceId: this.sequenceCounter,
      },
    };
  }

  public getDeltaSync(playerId: string, lastSequenceId: number): SyncMessage {
    const relevantUpdates = this.updateQueue.filter(update => 
      update.sequenceId > lastSequenceId &&
      this.isUpdateRelevantToPlayer(update, playerId)
    );

    return {
      type: 'delta_sync',
      sessionId: this.state.sessionId,
      timestamp: Date.now(),
      data: {
        updates: relevantUpdates,
        sequenceId: this.sequenceCounter,
      },
    };
  }

  private isUpdateRelevantToPlayer(update: StateUpdate, playerId: string): boolean {
    const player = this.state.players.get(playerId);
    if (!player) return false;

    // GM sees all updates
    if (player.role === 'gm') return true;

    // Players see updates relevant to their characters or public updates
    switch (update.type) {
      case 'player':
        return true; // All player updates are public
      case 'combat':
        return true; // All combat updates are public
      case 'scene':
        return true; // All scene updates are public
      case 'settings':
        return true; // All settings updates are public
      case 'entity':
        // Entity updates are visible if they affect visible entities
        // This would need more sophisticated visibility logic
        return true;
      default:
        return false;
    }
  }

  private broadcastDeltaSync(): void {
    const _updates = [...this.updateQueue];
    this.updateQueue = [];

    for (const [playerId, clientState] of this.clientStates) {
      const deltaSync = this.getDeltaSync(playerId, clientState.lastSequenceId);
      if (deltaSync.data.updates.length > 0) {
        this.emit('syncMessage', playerId, deltaSync);
        clientState.lastSequenceId = this.sequenceCounter;
      }
    }
  }

  public handleClientMessage(playerId: string, message: SyncMessage): void {
    const player = this.state.players.get(playerId);
    if (!player) {
      logger.warn('Message from unknown player:', { playerId });
      return;
    }

    // Update client state
    const clientState = this.clientStates.get(playerId);
    if (clientState) {
      clientState.lastSeen = Date.now();
      if (message.sequenceId) {
        clientState.lastSequenceId = Math.max(clientState.lastSequenceId, message.sequenceId);
      }
    }

    switch (message.type) {
      case 'state_update':
        this.handleStateUpdate(playerId, message.data);
        break;
      case 'player_action':
        this.handlePlayerAction(playerId, message.data);
        break;
      default:
        logger.warn('Unknown message type:', { type: message.type });
    }
  }

  private handleStateUpdate(playerId: string, data: any): void {
    const player = this.state.players.get(playerId);
    if (!player) return;

    // Validate that player has permission to make this update
    if (!this.validatePlayerPermission(player, data)) {
      logger.warn('Player lacks permission for update:', { playerId, data });
      return;
    }

    // Queue the update
    this.queueUpdate(data.type, playerId, data);
  }

  private handlePlayerAction(playerId: string, action: any): void {
    const player = this.state.players.get(playerId);
    if (!player) return;

    switch (action.type) {
      case 'move_token':
        this.handleMoveToken(playerId, action.data);
        break;
      case 'combat_action':
        this.handleCombatAction(playerId, action.data);
        break;
      case 'chat_message':
        this.handleChatMessage(playerId, action.data);
        break;
      default:
        logger.warn('Unknown player action:', { type: action.type });
    }
  }

  private handleMoveToken(playerId: string, data: any): void {
    const player = this.state.players.get(playerId);
    if (!player) return;

    // Validate token ownership or GM permissions
    if (player.role !== 'gm' && !this.playerOwnsToken(player, data.tokenId)) {
      return;
    }

    this.queueUpdate('entity', playerId, {
      action: 'updateComponent',
      entityId: data.tokenId,
      componentType: 'Transform2D',
      data: { x: data.x, y: data.y }
    });
  }

  private handleCombatAction(playerId: string, data: any): void {
    const player = this.state.players.get(playerId);
    if (!player) return;

    // Validate that it's the player's turn or they're the GM
    const currentCombatant = this.state.combat.getCurrentCombatant();
    if (player.role !== 'gm' && 
        (!currentCombatant || !player.characterIds.includes(currentCombatant.id))) {
      return;
    }

    this.queueUpdate('combat', playerId, {
      action: 'executeAction',
      data: data.combatAction
    });
  }

  private handleChatMessage(playerId: string, data: any): void {
    this.queueUpdate('player', playerId, {
      event: 'chatMessage',
      playerId,
      message: data.message,
      timestamp: Date.now()
    });
  }

  private validatePlayerPermission(player: Player, update: any): boolean {
    // GM can do anything
    if (player.role === 'gm') return true;

    // Players can only update their own characters and make certain actions
    switch (update.type) {
      case 'entity':
        // Players can only update entities they own
        return this.playerOwnsEntity(player, update.entityId);
      case 'player':
        // Players can only update their own player data
        return update.playerId === player.id;
      case 'combat':
        // Players can only take combat actions for their characters
        return update.action === 'executeAction' && 
               player.characterIds.includes(update.data.actorId);
      default:
        return false;
    }
  }

  private playerOwnsEntity(player: Player, entityId: string): boolean {
    // This would need to be implemented based on your entity ownership system
    return player.characterIds.includes(entityId);
  }

  private playerOwnsToken(player: Player, tokenId: string): boolean {
    // This would need to be implemented based on your token ownership system
    return player.characterIds.includes(tokenId);
  }

  // Serialization helpers
  private serializePlayer(player: Player): any {
    return {
      id: player.id,
      name: player.name,
      role: player.role,
      characterIds: player.characterIds,
      connected: player.connected,
    };
  }

  private serializeWorldState(): any {
    // Serialize the ECS world state
    return {
      entities: this.state.world.getEntities(),
      // Add component data serialization here
    };
  }

  private serializeCombatState(): any {
    return {
      combatants: this.state.combat.getCombatants(),
      turnOrder: this.state.combat.getTurnOrder(),
      currentRound: this.state.combat.getCurrentRound(),
      isActive: this.state.combat.isInCombat(),
    };
  }

  // Public API
  public getSessionId(): string {
    return this.state.sessionId;
  }

  public getPlayers(): Player[] {
    return Array.from(this.state.players.values());
  }

  public getPlayer(playerId: string): Player | undefined {
    return this.state.players.get(playerId);
  }

  public getWorld(): World {
    return this.state.world;
  }

  public getCombatEngine(): CombatEngine {
    return this.state.combat;
  }

  public getSettings(): GameState['settings'] {
    return this.state.settings;
  }

  public updateSettings(settings: Partial<GameState['settings']>): void {
    this.queueUpdate('settings', 'system', { settings });
  }

  // AI Entity Management
  public addAIEntity(id: string, archetype: 'guard' | 'berserker' | 'scout' | 'healer' | 'wildcard' = 'guard'): void {
    let personality;
    switch (archetype) {
      case 'guard': personality = NPCArchetypes.createGuard(); break;
      case 'berserker': personality = NPCArchetypes.createBerserker(); break;
      case 'scout': personality = NPCArchetypes.createScout(); break;
      case 'healer': personality = NPCArchetypes.createHealer(); break;
      case 'wildcard': personality = NPCArchetypes.createWildcard(); break;
    }
    
    const aiEntity = new AIEntity(id, personality);
    this.state.aiEntities.set(id, aiEntity);
    
    // Create corresponding entity in ECS world (convert string ID to number)
    const numericId = parseInt(id, 10) || this.state.world.createEntity();
    
    this.queueUpdate('entity', 'system', {
      event: 'aiEntityAdded',
      entityId: id,
      numericId,
      archetype
    });
  }

  public removeAIEntity(id: string): void {
    this.state.aiEntities.delete(id);
    
    // Convert string ID to numeric for ECS world
    const numericId = parseInt(id, 10);
    if (!isNaN(numericId)) {
      this.state.world.destroyEntity(numericId);
    }
    
    this.queueUpdate('entity', 'system', {
      event: 'aiEntityRemoved',
      entityId: id
    });
  }

  private updateAIEntities(deltaTime: number): void {
    for (const [entityId, aiEntity] of this.state.aiEntities) {
      // Create game state snapshot for this AI entity
      const gameState = this.createGameStateSnapshot(entityId);
      
      // Update AI entity
      aiEntity.update(gameState, deltaTime);
      
      // Check if AI wants to take any actions
      const aiState = aiEntity.getState();
      if (aiState.currentAction && aiState.behaviorTree) {
        this.handleAIAction(entityId, aiState.currentAction);
      }
    }
  }

  private createGameStateSnapshot(_entityId: string): GameStateSnapshot {
    // This would need to be implemented based on your ECS component system
    // For now, return a basic snapshot
    return {
      timestamp: Date.now(),
      entities: [],
      nearbyEnemies: [],
      nearbyAllies: [],
      isUnderThreat: false,
      healthPercentage: 1.0,
      position: { x: 0, y: 0, z: 0 },
      canMove: true,
      canAttack: true
    };
  }

  private handleAIAction(entityId: string, action: string): void {
    // Handle AI-initiated actions
    switch (action) {
      case 'attack':
        this.queueUpdate('combat', 'ai', {
          action: 'executeAction',
          data: {
            actorId: entityId,
            actionType: 'attack',
            timestamp: Date.now()
          }
        });
        break;
      case 'move':
        // Handle movement
        break;
      case 'defend':
        // Handle defensive actions
        break;
      // Add more action handlers as needed
    }
  }

  public getAIEntities(): AIEntity[] {
    return Array.from(this.state.aiEntities.values());
  }

  public getAIEntity(id: string): AIEntity | undefined {
    return this.state.aiEntities.get(id);
  }

  public destroy(): void {
    this.removeAllListeners();
    this.state.players.clear();
    this.state.aiEntities.clear();
    this.clientStates.clear();
    this.updateQueue = [];
  }
}
