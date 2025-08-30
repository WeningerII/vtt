import { World, EntityId, NetworkSyncSystem, MovementSystem } from "@vtt/core-ecs";
import { logger } from '@vtt/logging';
import { createDiceRollResult, DiceRollResult } from "./DiceRoller";

export interface Player {
  userId: string;
  displayName: string;
  connected: boolean;
  characterId?: EntityId;
}

export interface GameConfig {
  gameId: string;
  mapId?: string;
  maxPlayers: number;
  tickRate: number;
}

export type GamePhase = "exploration" | "combat" | "downtime";

export class GameSession {
  public readonly gameId: string;
  public readonly world: World;
  public readonly netSync: NetworkSyncSystem;
  
  private players = new Map<string, Player>();
  private phase: GamePhase = "exploration";
  private turnOrder: EntityId[] = [];
  private currentTurn: EntityId | undefined;
  private mapId: string | undefined;
  
  private lastTick = Date.now();
  private tickHandle: ReturnType<typeof setInterval> | undefined;
  
  constructor(config: GameConfig) {
    this.gameId = config.gameId;
    this.mapId = config.mapId;
    
    // Initialize ECS world with reasonable capacity
    this.world = new World(1000);
    this.netSync = new NetworkSyncSystem();
    
    // Start game simulation loop
    this.startTick(config.tickRate);
  }

  // Player Management
  addPlayer(userId: string, displayName: string): boolean {
    if (this.players.has(userId)) {
      return false; // Player already exists
    }

    const player: Player = {
      userId,
      displayName,
      connected: true,
    };

    this.players.set(userId, player);
    return true;
  }

  removePlayer(userId: string): void {
    this.players.delete(userId);
  }

  setPlayerConnected(userId: string, connected: boolean): boolean {
    const player = this.players.get(userId);
    if (!player) return false;
    
    player.connected = connected;
    return true;
  }

  getPlayer(userId: string): Player | undefined {
    return this.players.get(userId);
  }

  getPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  getConnectedPlayers(): Player[] {
    return this.getPlayers().filter(p => p.connected);
  }

  // Entity Management
  createToken(x: number, y: number, ownerId?: string): EntityId {
    const entity = this.world.create();
    
    // Set transform
    this.world.transforms.add(entity, { x, y, rot: 0, sx: 1, sy: 1, zIndex: 1 });
    
    // Set appearance with default values
    this.world.appearance.add(entity, {
      sprite: 0,
      tintR: 1,
      tintG: 1, 
      tintB: 1,
      alpha: 1,
      frame: 0,
    });

    // Add movement capability
    this.world.movement.add(entity, { vx: 0, vy: 0, maxSpeed: 100 });

    return entity;
  }

  moveToken(entityId: EntityId, x: number, y: number, animate: boolean = true): boolean {
    if (!this.world.isAlive(entityId) || !this.world.transforms.has(entityId)) {
      return false;
    }

    if (animate && this.world.movement.has(entityId)) {
      // Calculate velocity for smooth movement
      const currentX = this.world.transforms.x[entityId] ?? 0;
      const currentY = this.world.transforms.y[entityId] ?? 0;
      
      const deltaX = x - currentX;
      const deltaY = y - currentY;
      const distance = Math.hypot(deltaX, deltaY);
      
      if (distance > 0) {
        const speed = 200; // pixels per second
        const duration = Math.min(distance / speed, 2); // Max 2 seconds
        
        this.world.movement.vx[entityId] = deltaX / duration;
        this.world.movement.vy[entityId] = deltaY / duration;
        
        // Stop movement after duration
        const timeoutId = setTimeout(() => {
          if (this.world.movement.has(entityId)) {
            this.world.movement.vx[entityId] = 0;
            this.world.movement.vy[entityId] = 0;
            this.world.transforms.x[entityId] = x;
            this.world.transforms.y[entityId] = y;
          }
        }, duration * 1000);
        
        // Store timeout for potential cleanup
        (timeoutId as any).__entityId = entityId;
      }
    } else {
      // Instant movement
      this.world.transforms.x[entityId] = x;
      this.world.transforms.y[entityId] = y;
    }

    return true;
  }

  // Dice Rolling
  rollDice(dice: string, userId: string, label?: string): DiceRollResult | null {
    const player = this.players.get(userId);
    if (!player) return null;

    return createDiceRollResult(dice, label);
  }

  // Combat Management
  setPhase(phase: GamePhase): void {
    this.phase = phase;
  }

  getPhase(): GamePhase {
    return this.phase;
  }

  initiateCombat(entityIds: EntityId[]): void {
    this.phase = "combat";
    this.turnOrder = [...entityIds];
    this.currentTurn = entityIds.length > 0 ? entityIds[0] : undefined;
  }

  nextTurn(): EntityId | undefined {
    if (this.turnOrder.length === 0) return undefined;
    
    const currentIndex = this.currentTurn ? this.turnOrder.indexOf(this.currentTurn) : -1;
    const nextIndex = (currentIndex + 1) % this.turnOrder.length;
    
    this.currentTurn = this.turnOrder[nextIndex] ?? undefined;
    return this.currentTurn;
  }

  endCombat(): void {
    this.phase = "exploration";
    this.turnOrder = [];
    this.currentTurn = undefined;
  }

  // Game State
  getGameState() {
    return {
      gameId: this.gameId,
      mapId: this.mapId,
      players: this.getPlayers(),
      turnOrder: this.turnOrder.map(id => id.toString()),
      currentTurn: this.currentTurn?.toString(),
      phase: this.phase,
    };
  }

  // Simulation Loop
  private startTick(tickRate: number): void {
    const interval = Math.max(1, Math.floor(1000 / tickRate));
    
    this.tickHandle = setInterval(() => {
      try {
        this.tick();
      } catch (error) {
        logger.error(`[GameSession:${this.gameId}] Tick error:`, error);
      }
    }, interval);
  }

  private tick(): void {
    const now = Date.now();
    const dt = (now - this.lastTick) / 1000;
    this.lastTick = now;

    // Update movement system
    MovementSystem(this.world, dt);
    
    // Update world simulation
    this.world.update(dt);
  }

  // Network Sync
  getNetworkDelta() {
    return this.netSync.update(this.world);
  }

  getSnapshot() {
    return this.netSync.getSnapshot();
  }

  // Cleanup
  destroy(): void {
    if (this.tickHandle !== undefined) {
      clearInterval(this.tickHandle);
      this.tickHandle = undefined;
    }
    
    this.players.clear();
    
    // Clear all entities
    for (const entityId of this.world.getEntities()) {
      this.world.destroyEntity(entityId);
    }
  }

  // Utility
  getPlayerCount(): number {
    return this.players.size;
  }

  getConnectedPlayerCount(): number {
    return this.getConnectedPlayers().length;
  }

  isEmpty(): boolean {
    return this.getConnectedPlayerCount() === 0;
  }
}
