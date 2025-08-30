export type EntityId = number;

export interface CombatData {
  initiative: number;
  turnOrder: number;
  isActive: boolean;
  hasActed: boolean;
  hasMovedThisTurn: boolean;
  actionPoints: number;
  maxActionPoints: number;
  reactionUsed: boolean;
  concentrating: boolean;
  concentrationTarget?: EntityId | undefined;
  legendaryActions?: number | undefined;
  maxLegendaryActions?: number | undefined;
  usedLegendaryActions?: number | undefined;
}

export class CombatStore {
  private data: Map<EntityId, CombatData> = new Map();
  private capacity: number;

  // Object pooling for performance optimization
  private static readonly POOL_SIZE = 1000;
  private dataPool: CombatData[] = [];
  private recycledEntities: Set<EntityId> = new Set();
  private poolIndex = 0;

  // Initiative order caching
  private initiativeOrderCache: EntityId[] = [];
  private initiativeCacheValid = false;
  private lastInitiativeUpdate = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.initializePool();
  }

  private initializePool(): void {
    for (let i = 0; i < CombatStore.POOL_SIZE; i++) {
      this.dataPool.push({
        initiative: 0,
        turnOrder: 0,
        isActive: false,
        hasActed: false,
        hasMovedThisTurn: false,
        actionPoints: 1,
        maxActionPoints: 1,
        reactionUsed: false,
        concentrating: false,
        concentrationTarget: undefined,
        legendaryActions: undefined,
        maxLegendaryActions: undefined,
        usedLegendaryActions: 0
      });
    }
  }

  private getPooledData(): CombatData {
    // Use pool if available
    if (this.poolIndex < this.dataPool.length) {
      const pooledData = this.dataPool[this.poolIndex++];
      if (pooledData) {
        return pooledData;
      }
    }

    // Fallback to new object if pool exhausted
    return {
      initiative: 0,
      turnOrder: 0,
      isActive: false,
      hasActed: false,
      hasMovedThisTurn: false,
      actionPoints: 1,
      maxActionPoints: 1,
      reactionUsed: false,
      concentrating: false,
      concentrationTarget: undefined,
      legendaryActions: undefined,
      maxLegendaryActions: undefined,
      usedLegendaryActions: 0
    };
  }

  private invalidateInitiativeCache(): void {
    this.initiativeCacheValid = false;
    this.lastInitiativeUpdate = performance.now();
  }

  add(id: EntityId, data: Partial<CombatData> = {}): void {
    const pooledData = this.getPooledData();
    
    // Assign values to pooled object
    pooledData.initiative = data.initiative ?? 0;
    pooledData.turnOrder = data.turnOrder ?? 0;
    pooledData.isActive = data.isActive ?? false;
    pooledData.hasActed = data.hasActed ?? false;
    pooledData.hasMovedThisTurn = data.hasMovedThisTurn ?? false;
    pooledData.actionPoints = data.actionPoints ?? 1;
    pooledData.maxActionPoints = data.maxActionPoints ?? 1;
    pooledData.reactionUsed = data.reactionUsed ?? false;
    pooledData.concentrating = data.concentrating ?? false;
    pooledData.concentrationTarget = data.concentrationTarget;
    pooledData.legendaryActions = data.legendaryActions;
    pooledData.maxLegendaryActions = data.maxLegendaryActions;
    pooledData.usedLegendaryActions = data.usedLegendaryActions ?? 0;
    
    this.data.set(id, pooledData);
    this.invalidateInitiativeCache();
  }

  get(id: EntityId): CombatData | undefined {
    return this.data.get(id);
  }

  has(id: EntityId): boolean {
    return this.data.has(id);
  }

  remove(id: EntityId): void {
    const data = this.data.get(id);
    if (data) {
      // Return to pool for reuse
      this.recycledEntities.add(id);
      this.invalidateInitiativeCache();
    }
    this.data.delete(id);
  }

  setInitiative(id: EntityId, initiative: number): void {
    const combat = this.data.get(id);
    if (combat) {
      combat.initiative = initiative;
      this.invalidateInitiativeCache();
    }
  }

  setTurnOrder(id: EntityId, order: number): void {
    const combat = this.data.get(id);
    if (combat) {
      combat.turnOrder = order;
    }
  }

  setActive(id: EntityId, active: boolean): void {
    const combat = this.data.get(id);
    if (combat) {
      combat.isActive = active;
    }
  }

  startTurn(id: EntityId): void {
    const combat = this.data.get(id);
    if (combat) {
      combat.hasActed = false;
      combat.hasMovedThisTurn = false;
      combat.actionPoints = combat.maxActionPoints;
      combat.reactionUsed = false;
    }
  }

  endTurn(id: EntityId): void {
    const combat = this.data.get(id);
    if (combat) {
      combat.hasActed = true;
      combat.actionPoints = 0;
    }
  }

  useAction(id: EntityId, cost: number = 1): boolean {
    const combat = this.data.get(id);
    if (combat && combat.actionPoints >= cost) {
      combat.actionPoints -= cost;
      combat.hasActed = true;
      return true;
    }
    return false;
  }

  useReaction(id: EntityId): boolean {
    const combat = this.data.get(id);
    if (combat && !combat.reactionUsed) {
      combat.reactionUsed = true;
      return true;
    }
    return false;
  }

  setConcentration(id: EntityId, target?: EntityId): void {
    const combat = this.data.get(id);
    if (combat) {
      combat.concentrating = target !== undefined;
      combat.concentrationTarget = target;
    }
  }

  breakConcentration(id: EntityId): void {
    const combat = this.data.get(id);
    if (combat) {
      combat.concentrating = false;
      combat.concentrationTarget = undefined;
    }
  }

  useLegendaryAction(id: EntityId, cost: number = 1): boolean {
    const combat = this.data.get(id);
    if (combat && combat.legendaryActions && combat.usedLegendaryActions !== undefined) {
      const remaining = combat.legendaryActions - combat.usedLegendaryActions;
      if (remaining >= cost) {
        combat.usedLegendaryActions += cost;
        return true;
      }
    }
    return false;
  }

  resetLegendaryActions(id: EntityId): void {
    const combat = this.data.get(id);
    if (combat) {
      combat.usedLegendaryActions = 0;
    }
  }

  hasLegendaryActions(id: EntityId): boolean {
    const combat = this.data.get(id);
    return combat?.legendaryActions !== undefined && combat.legendaryActions > 0;
  }

  getLegendaryActionsRemaining(id: EntityId): number {
    const combat = this.data.get(id);
    if (combat && combat.legendaryActions && combat.usedLegendaryActions !== undefined) {
      return combat.legendaryActions - combat.usedLegendaryActions;
    }
    return 0;
  }

  getAllInCombat(): EntityId[] {
    return Array.from(this.data.keys());
  }

  getInitiativeOrder(): EntityId[] {
    // Return cached result if valid
    if (this.initiativeCacheValid && this.initiativeOrderCache.length > 0) {
      return [...this.initiativeOrderCache];
    }

    // Rebuild cache
    this.initiativeOrderCache = Array.from(this.data.entries())
      .sort(([, a], [, b]) => b.initiative - a.initiative || a.turnOrder - b.turnOrder)
      .map(([id]) => id);
    
    this.initiativeCacheValid = true;
    return [...this.initiativeOrderCache];
  }

  // Performance monitoring methods
  getPerformanceStats() {
    return {
      poolUtilization: this.poolIndex / CombatStore.POOL_SIZE,
      recycledEntities: this.recycledEntities.size,
      totalEntities: this.data.size,
      lastInitiativeUpdate: this.lastInitiativeUpdate,
      cacheValid: this.initiativeCacheValid
    };
  }

  // Reset pool for testing/cleanup
  resetPool(): void {
    this.poolIndex = 0;
    this.recycledEntities.clear();
    this.invalidateInitiativeCache();
  }
}
