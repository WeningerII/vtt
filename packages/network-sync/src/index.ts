/**
 * Network Synchronization Engine for VTT Entity States
 * Handles real-time synchronization of all entity states across clients
 */

import { EventEmitter } from "events";

export interface EntityState {
  id: string;
  type: "character" | "monster" | "npc" | "token";
  position: { x: number; y: number; z?: number };
  health: {
    current: number;
    max: number;
    temporary: number;
  };
  stats: {
    abilities: Record<string, number>;
    armorClass: number;
    speed: number;
    proficiencyBonus: number;
  };
  conditions: Array<{
    id: string;
    duration: number;
    source: string;
  }>;
  combat: {
    initiative: number;
    isActive: boolean;
    hasActed: boolean;
    actionPoints: number;
    reactions: Array<{ id: string; used: boolean }>;
  };
  equipment: Array<{
    id: string;
    equipped: boolean;
    attuned?: boolean;
  }>;
  spells: {
    slots: Record<number, { current: number; max: number }>;
    prepared: string[];
    concentrating?: {
      spellId: string;
      duration: number;
    };
  };
  social: {
    relationships: Record<
      string,
      {
        attitude: string;
        value: number;
      }
    >;
  };
  ai?: {
    personality: Record<string, number>;
    currentGoal: string;
    lastAction: string;
  };
  lastUpdate: number;
  version: number;
}

export interface SyncMessage {
  type: "full_sync" | "delta_sync" | "state_request" | "state_response" | "conflict_resolution";
  entityId: string;
  timestamp: number;
  clientId: string;
  data: any;
  version?: number;
}

export interface SyncConflict {
  entityId: string;
  field: string;
  clientAValue: any;
  clientBValue: any;
  timestampA: number;
  timestampB: number;
  resolution: "timestamp" | "server_authoritative" | "manual";
}

export class NetworkSyncEngine extends EventEmitter {
  private entityStates = new Map<string, EntityState>();
  private clientStates = new Map<string, Set<string>>(); // clientId -> entityIds they're tracking
  private syncHistory = new Map<
    string,
    Array<{ timestamp: number; state: Partial<EntityState> }>
  >();
  private conflictResolver = new ConflictResolver();
  private broadcastCallback?: (message: SyncMessage) => void;

  constructor() {
    super();
    this.setupCleanupInterval();
  }

  /**
   * Set the callback for broadcasting messages to clients
   */
  setBroadcastCallback(_callback: (message: SyncMessage) => void): void {
    this.broadcastCallback = callback;
  }

  /**
   * Register a client for entity synchronization
   */
  registerClient(clientId: string, trackedEntityIds: string[] = []): void {
    this.clientStates.set(clientId, new Set(trackedEntityIds));

    // Send initial state for tracked entities
    for (const entityId of trackedEntityIds) {
      const state = this.entityStates.get(entityId);
      if (state) {
        this.sendToClient(clientId, {
          type: "full_sync",
          entityId,
          timestamp: Date.now(),
          clientId: "server",
          data: state,
        });
      }
    }
  }

  /**
   * Unregister a client
   */
  unregisterClient(clientId: string): void {
    this.clientStates.delete(clientId);
  }

  /**
   * Update entity state and sync to relevant clients
   */
  updateEntityState(
    entityId: string,
    updates: Partial<EntityState>,
    sourceClientId: string = "server",
  ): void {
    const currentState = this.entityStates.get(entityId);
    const timestamp = Date.now();

    if (!currentState) {
      // New entity
      const newState: EntityState = {
        id: entityId,
        type: "character",
        position: { x: 0, y: 0 },
        health: { current: 100, max: 100, temporary: 0 },
        stats: { abilities: Record<string, any>, armorClass: 10, speed: 30, proficiencyBonus: 2 },
        conditions: [],
        combat: { initiative: 0, isActive: false, hasActed: false, actionPoints: 1, reactions: [] },
        equipment: [],
        spells: { slots: Record<string, any>, prepared: [] },
        social: { relationships: Record<string, unknown> },
        lastUpdate: timestamp,
        version: 1,
        ...updates,
      };

      this.entityStates.set(entityId, newState);
      this.broadcastFullSync(entityId, newState, sourceClientId);
    } else {
      // Check for conflicts
      const conflict = this.detectConflict(entityId, updates, sourceClientId, timestamp);
      if (conflict) {
        const resolution = this.conflictResolver.resolve(conflict);
        if (resolution.rejected) {
          this.sendConflictResolution(sourceClientId, entityId, resolution);
          return;
        }
        // Apply resolved updates
        updates = resolution.resolvedState;
      }

      // Apply updates
      const updatedState = {
        ...currentState,
        ...updates,
        lastUpdate: timestamp,
        version: currentState.version + 1,
      };

      this.entityStates.set(entityId, updatedState);
      this.addToSyncHistory(entityId, updates, timestamp);

      // Broadcast delta sync to other clients
      this.broadcastDeltaSync(entityId, updates, sourceClientId);
    }
  }

  /**
   * Get current entity state
   */
  getEntityState(entityId: string): EntityState | null {
    return this.entityStates.get(entityId) || null;
  }

  /**
   * Handle incoming sync message from client
   */
  handleSyncMessage(message: SyncMessage): void {
    switch (message.type) {
      case "full_sync":
        this.handleFullSync(message);
        break;
      case "delta_sync":
        this.handleDeltaSync(message);
        break;
      case "state_request":
        this.handleStateRequest(message);
        break;
      case "conflict_resolution":
        this.handleConflictResolution(message);
        break;
    }
  }

  private handleFullSync(message: SyncMessage): void {
    const entityState = message.data as EntityState;
    this.updateEntityState(entityState.id, entityState, message.clientId);
  }

  private handleDeltaSync(message: SyncMessage): void {
    const updates = message.data as Partial<EntityState>;
    this.updateEntityState(message.entityId, updates, message.clientId);
  }

  private handleStateRequest(message: SyncMessage): void {
    const state = this.entityStates.get(message.entityId);
    if (state) {
      this.sendToClient(message.clientId, {
        type: "state_response",
        entityId: message.entityId,
        timestamp: Date.now(),
        clientId: "server",
        data: state,
      });
    }
  }

  private handleConflictResolution(message: SyncMessage): void {
    // Client accepted conflict resolution
    const updates = message.data as Partial<EntityState>;
    const currentState = this.entityStates.get(message.entityId);
    if (currentState) {
      this.entityStates.set(message.entityId, { ...currentState, ...updates });
    }
  }

  private detectConflict(
    entityId: string,
    updates: Partial<EntityState>,
    clientId: string,
    timestamp: number,
  ): SyncConflict | null {
    const currentState = this.entityStates.get(entityId);
    if (!currentState) return null;

    // Check if updates conflict with recent changes
    const timeDiff = timestamp - currentState.lastUpdate;
    if (timeDiff < 0) {
      // Client update is older than current state
      return {
        entityId,
        field: "timestamp",
        clientAValue: updates,
        clientBValue: currentState,
        timestampA: timestamp,
        timestampB: currentState.lastUpdate,
        resolution: "timestamp",
      };
    }

    // Check for concurrent modifications of critical fields
    const criticalFields = ["health", "position", "combat"];
    for (const field of criticalFields) {
      if (updates[field as keyof EntityState] && timeDiff < 1000) {
        // 1 second window
        return {
          entityId,
          field,
          clientAValue: updates[field as keyof EntityState],
          clientBValue: currentState[field as keyof EntityState],
          timestampA: timestamp,
          timestampB: currentState.lastUpdate,
          resolution: "server_authoritative",
        };
      }
    }

    return null;
  }

  private broadcastFullSync(entityId: string, state: EntityState, excludeClient?: string): void {
    const message: SyncMessage = {
      type: "full_sync",
      entityId,
      timestamp: Date.now(),
      clientId: "server",
      data: state,
      version: state.version,
    };

    this.broadcastToRelevantClients(entityId, message, excludeClient);
  }

  private broadcastDeltaSync(
    entityId: string,
    updates: Partial<EntityState>,
    excludeClient?: string,
  ): void {
    const message: SyncMessage = {
      type: "delta_sync",
      entityId,
      timestamp: Date.now(),
      clientId: "server",
      data: updates,
    };

    this.broadcastToRelevantClients(entityId, message, excludeClient);
  }

  private broadcastToRelevantClients(
    entityId: string,
    message: SyncMessage,
    excludeClient?: string,
  ): void {
    for (const [clientId, trackedEntities] of this.clientStates) {
      if (clientId !== excludeClient && trackedEntities.has(entityId)) {
        this.sendToClient(clientId, message);
      }
    }
  }

  private sendToClient(clientId: string, message: SyncMessage): void {
    if (this.broadcastCallback) {
      this.broadcastCallback({ ...message, clientId });
    }
  }

  private sendConflictResolution(clientId: string, entityId: string, resolution: any): void {
    this.sendToClient(clientId, {
      type: "conflict_resolution",
      entityId,
      timestamp: Date.now(),
      clientId: "server",
      data: resolution,
    });
  }

  private addToSyncHistory(
    entityId: string,
    updates: Partial<EntityState>,
    timestamp: number,
  ): void {
    if (!this.syncHistory.has(entityId)) {
      this.syncHistory.set(entityId, []);
    }

    const history = this.syncHistory.get(entityId)!;
    history.push({ timestamp, state: updates });

    // Keep only last 100 updates
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  private setupCleanupInterval(): void {
    // Clean up old sync history every 5 minutes
    setInterval(
      () => {
        const cutoff = Date.now() - 5 * 60 * 1000; // 5 minutes ago

        for (const [entityId, history] of this.syncHistory) {
          const filteredHistory = history.filter((entry) => entry.timestamp > cutoff);
          if (filteredHistory.length === 0) {
            this.syncHistory.delete(entityId);
          } else {
            this.syncHistory.set(entityId, filteredHistory);
          }
        }
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Get synchronization statistics
   */
  getSyncStats(): {
    totalEntities: number;
    activeClients: number;
    avgUpdatesPerMinute: number;
    conflictsResolved: number;
  } {
    return {
      totalEntities: this.entityStates.size,
      activeClients: this.clientStates.size,
      avgUpdatesPerMinute: this.calculateUpdateRate(),
      conflictsResolved: this.conflictResolver.getResolvedCount(),
    };
  }

  private calculateUpdateRate(): number {
    let totalUpdates = 0;
    const oneMinuteAgo = Date.now() - 60000;

    for (const history of this.syncHistory.values()) {
      totalUpdates += history.filter((entry) => entry.timestamp > oneMinuteAgo).length;
    }

    return totalUpdates;
  }
}

class ConflictResolver {
  private resolvedCount = 0;

  resolve(conflict: SyncConflict): { rejected: boolean; resolvedState?: any } {
    this.resolvedCount++;

    switch (conflict.resolution) {
      case "timestamp":
        // Newer timestamp wins
        if (conflict.timestampA > conflict.timestampB) {
          return { rejected: false, resolvedState: conflict.clientAValue };
        } else {
          return { rejected: true };
        }

      case "server_authoritative":
        // Server state wins
        return { rejected: true };

      case "manual":
        // Requires manual intervention - for now, server wins
        return { rejected: true };

      default:
        return { rejected: true };
    }
  }

  getResolvedCount(): number {
    return this.resolvedCount;
  }
}

// Specialized sync managers for different entity types
export class CombatSyncManager {
  private syncEngine: NetworkSyncEngine;

  constructor(syncEngine: NetworkSyncEngine) {
    this.syncEngine = syncEngine;
  }

  syncInitiativeOrder(combatants: Array<{ id: string; initiative: number }>): void {
    for (const combatant of combatants) {
      this.syncEngine.updateEntityState(combatant.id, {
        combat: {
          initiative: combatant.initiative,
          isActive: false,
          hasActed: false,
          actionPoints: 1,
          reactions: [],
        },
      });
    }
  }

  syncTurnChange(activeEntityId: string): void {
    // Deactivate all entities first
    const _allStates = new Map();

    // Then activate the current entity
    this.syncEngine.updateEntityState(activeEntityId, {
      combat: {
        initiative: 0, // Will be filled from current state
        isActive: true,
        hasActed: false,
        actionPoints: 1,
        reactions: [],
      },
    });
  }

  syncActionUsed(entityId: string, _actionType: string): void {
    const currentState = this.syncEngine.getEntityState(entityId);
    if (currentState) {
      this.syncEngine.updateEntityState(entityId, {
        combat: {
          ...currentState.combat,
          hasActed: true,
          actionPoints: Math.max(0, currentState.combat.actionPoints - 1),
        },
      });
    }
  }
}

export class HealthSyncManager {
  private syncEngine: NetworkSyncEngine;

  constructor(syncEngine: NetworkSyncEngine) {
    this.syncEngine = syncEngine;
  }

  syncDamage(entityId: string, damage: number): void {
    const currentState = this.syncEngine.getEntityState(entityId);
    if (currentState) {
      let newHP = currentState.health.current - damage;

      // Apply temporary HP first
      if (currentState.health.temporary > 0) {
        const tempReduction = Math.min(currentState.health.temporary, damage);
        newHP = currentState.health.current - (damage - tempReduction);

        this.syncEngine.updateEntityState(entityId, {
          health: {
            current: Math.max(0, newHP),
            max: currentState.health.max,
            temporary: currentState.health.temporary - tempReduction,
          },
        });
      } else {
        this.syncEngine.updateEntityState(entityId, {
          health: {
            ...currentState.health,
            current: Math.max(0, newHP),
          },
        });
      }
    }
  }

  syncHealing(entityId: string, healing: number): void {
    const currentState = this.syncEngine.getEntityState(entityId);
    if (currentState) {
      this.syncEngine.updateEntityState(entityId, {
        health: {
          ...currentState.health,
          current: Math.min(currentState.health.max, currentState.health.current + healing),
        },
      });
    }
  }

  syncTemporaryHP(entityId: string, tempHP: number): void {
    const currentState = this.syncEngine.getEntityState(entityId);
    if (currentState) {
      this.syncEngine.updateEntityState(entityId, {
        health: {
          ...currentState.health,
          temporary: Math.max(currentState.health.temporary, tempHP), // Temp HP doesn't stack
        },
      });
    }
  }
}

// Export singleton instance
export const networkSyncEngine = new NetworkSyncEngine();
export const _combatSyncManager = new CombatSyncManager(networkSyncEngine);
export const _healthSyncManager = new HealthSyncManager(networkSyncEngine);
