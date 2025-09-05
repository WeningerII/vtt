import { logger } from "@vtt/logging";

/**
 * Real-time State Management System
 * Handles state synchronization, conflict resolution, and operation tracking
 */

export type OperationType = "create" | "update" | "delete" | "move" | "transform";

export interface Operation {
  id: string;
  type: OperationType;
  entityType: "token" | "scene" | "layer" | "condition" | "effect";
  entityId: string;
  userId: string;
  timestamp: number;
  vectorClock: VectorClock;
  data: any;
  parentId?: string;
  dependencies?: string[];
}

export interface VectorClock {
  [userId: string]: number;
}

export interface StateSnapshot {
  id: string;
  timestamp: number;
  vectorClock: VectorClock;
  entities: Record<string, any>;
  operations: Operation[];
}

export interface ConflictResolution {
  strategy: "last-writer-wins" | "merge" | "manual" | "priority-based";
  resolver?: (operations: Operation[]) => Operation;
}

export class StateManager {
  private state: Map<string, any> = new Map();
  private operations: Operation[] = [];
  private vectorClock: VectorClock = {};
  private userId: string;
  private conflictResolution: ConflictResolution;
  private changeListeners: Array<(_change: StateChange) => void> = [];
  private operationQueue: Operation[] = [];
  private isProcessingQueue = false;

  constructor(
    userId: string,
    conflictResolution: ConflictResolution = { strategy: "last-writer-wins" },
  ) {
    this.userId = userId;
    this.conflictResolution = conflictResolution;
    this.vectorClock[userId] = 0;
  }

  /**
   * Apply a local operation
   */
  applyLocalOperation(
    operation: Omit<Operation, "id" | "userId" | "timestamp" | "vectorClock">,
  ): Operation {
    // Increment local vector clock
    const currentValue = this.vectorClock[this.userId];
    if (currentValue !== undefined) {
      this.vectorClock[this.userId] = currentValue + 1;
    } else {
      this.vectorClock[this.userId] = 1;
    }

    const fullOperation: Operation = {
      ...operation,
      id: this.generateOperationId(),
      userId: this.userId,
      timestamp: Date.now(),
      vectorClock: { ...this.vectorClock },
    };

    this.queueOperation(fullOperation);
    return fullOperation;
  }

  /**
   * Apply a remote operation
   */
  applyRemoteOperation(operation: Operation): void {
    // Update vector clock
    this.updateVectorClock(operation.vectorClock);
    this.queueOperation(operation);
  }

  private queueOperation(operation: Operation): void {
    this.operationQueue.push(operation);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) {return;}
    this.isProcessingQueue = true;

    while (this.operationQueue.length > 0) {
      // Sort operations by causal order using vector clocks
      this.operationQueue.sort((a, b) => this.compareVectorClocks(a.vectorClock, b.vectorClock));

      const operation = this.operationQueue.shift()!;
      await this.executeOperation(operation);
    }

    this.isProcessingQueue = false;
  }

  private async executeOperation(operation: Operation): Promise<void> {
    // Check for conflicts
    const conflicts = this.detectConflicts(operation);

    if (conflicts.length > 0) {
      const resolvedOperation = await this.resolveConflicts(operation, conflicts);
      if (resolvedOperation) {
        await this.applyOperation(resolvedOperation);
      }
    } else {
      await this.applyOperation(operation);
    }
  }

  private detectConflicts(operation: Operation): Operation[] {
    return this.operations.filter((existingOp) => {
      // Same entity, overlapping time, different users
      return (
        existingOp.entityId === operation.entityId &&
        existingOp.userId !== operation.userId &&
        this.operationsConflict(existingOp, operation)
      );
    });
  }

  private operationsConflict(op1: Operation, op2: Operation): boolean {
    // Operations conflict if they happened concurrently (neither causally depends on the other)
    return (
      !this.happensBefore(op1.vectorClock, op2.vectorClock) &&
      !this.happensBefore(op2.vectorClock, op1.vectorClock)
    );
  }

  private happensBefore(clock1: VectorClock, clock2: VectorClock): boolean {
    let foundSmaller = false;

    for (const userId in clock1) {
      const time1 = clock1[userId] || 0;
      const time2 = clock2[userId] || 0;

      if (time1 > time2) {
        return false;
      } else if (time1 < time2) {
        foundSmaller = true;
      }
    }

    for (const userId in clock2) {
      const clock2Value = clock2[userId];
      if (!(userId in clock1) && clock2Value !== undefined && clock2Value > 0) {
        foundSmaller = true;
      }
    }

    return foundSmaller;
  }

  private async resolveConflicts(
    operation: Operation,
    conflicts: Operation[],
  ): Promise<Operation | null> {
    switch (this.conflictResolution.strategy) {
      case "last-writer-wins":
        return this.resolveLastWriterWins(operation, conflicts);

      case "merge":
        return this.resolveMerge(operation, conflicts);

      case "priority-based":
        return this.resolvePriorityBased(operation, conflicts);

      case "manual":
        return this.resolveManual(operation, conflicts);

      default:
        return operation;
    }
  }

  private resolveLastWriterWins(operation: Operation, conflicts: Operation[]): Operation {
    // Find the operation with the latest timestamp
    const allOperations = [operation, ...conflicts];
    return allOperations.reduce((latest, current) =>
      current.timestamp > latest.timestamp ? current : latest,
    );
  }

  private resolveMerge(operation: Operation, conflicts: Operation[]): Operation {
    // Merge conflicting operations based on operation type
    let mergedData = { ...operation.data };

    for (const conflict of conflicts) {
      if (operation.type === "update" && conflict.type === "update") {
        // Merge update operations by combining non-conflicting fields
        mergedData = this.mergeObjects(mergedData, conflict.data);
      }
    }

    return {
      ...operation,
      data: mergedData,
      id: this.generateOperationId(),
    };
  }

  private resolvePriorityBased(operation: Operation, conflicts: Operation[]): Operation {
    // Resolve based on user priority or role
    const userPriorities: Record<string, number> = {
      gm: 1000,
      player: 100,
      spectator: 1,
    };

    const allOperations = [operation, ...conflicts];
    return allOperations.reduce((highest, current) => {
      const currentPriority = userPriorities[current.userId] || 50;
      const highestPriority = userPriorities[highest.userId] || 50;
      return currentPriority > highestPriority ? current : highest;
    });
  }

  private async resolveManual(
    operation: Operation,
    conflicts: Operation[],
  ): Promise<Operation | null> {
    // Emit conflict event for manual resolution
    const conflictEvent: ConflictEvent = {
      type: "conflict-detected",
      operation,
      conflicts,
      resolve: (_resolvedOp: Operation | null) => {
        return Promise.resolve(operation);
      },
    };

    this.emitChange({ type: "conflict", data: conflictEvent });

    // Return null to pause processing until manual resolution
    return null;
  }

  private mergeObjects(obj1: any, obj2: any): any {
    const result = { ...obj1 };

    for (const key in obj2) {
      if (Object.prototype.hasOwnProperty.call(obj2, key)) {
        if (typeof obj2[key] === "object" && typeof obj1[key] === "object") {
          result[key] = this.mergeObjects(obj1[key], obj2[key]);
        } else {
          // For primitive conflicts, use last-writer-wins
          result[key] = obj2[key];
        }
      }
    }

    return result;
  }

  private async applyOperation(operation: Operation): Promise<void> {
    // Apply the operation to local state
    switch (operation.type) {
      case "create":
        this.state.set(operation.entityId, operation.data);
        break;

      case "update":
        {
          const existing = this.state.get(operation.entityId);
          if (existing) {
            this.state.set(operation.entityId, { ...existing, ...operation.data });
          }
        }
        break;

      case "delete":
        this.state.delete(operation.entityId);
        break;

      case "move":
        {
          const entity = this.state.get(operation.entityId);
          if (entity) {
            this.state.set(operation.entityId, {
              ...entity,
              x: operation.data.x,
              y: operation.data.y,
            });
          }
        }
        break;

      case "transform":
        {
          const transformEntity = this.state.get(operation.entityId);
          if (transformEntity) {
            this.state.set(operation.entityId, {
              ...transformEntity,
              ...operation.data,
            });
          }
        }
        break;
    }

    // Add to operation log
    this.operations.push(operation);

    // Emit change event
    this.emitChange({
      type: "operation-applied",
      data: { operation, state: this.getState() },
    });
  }

  private updateVectorClock(remoteClock: VectorClock): void {
    for (const userId in remoteClock) {
      const remoteTime = remoteClock[userId];
      if (remoteTime !== undefined) {
        this.vectorClock[userId] = Math.max(this.vectorClock[userId] || 0, remoteTime);
      }
    }
  }

  private compareVectorClocks(clock1: VectorClock, clock2: VectorClock): number {
    // Sort by total ordering when possible, otherwise by timestamp
    const sum1 = Object.values(clock1).reduce((a, b) => a + b, 0);
    const sum2 = Object.values(clock2).reduce((a, b) => a + b, 0);
    return sum1 - sum2;
  }

  private generateOperationId(): string {
    return `op-${this.userId}-${this.vectorClock[this.userId]}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current state
   */
  getState(): Record<string, any> {
    const stateObject: Record<string, any> = {};
    for (const [key, value] of this.state.entries()) {
      stateObject[key] = value;
    }
    return stateObject;
  }

  /**
   * Get entity by ID
   */
  getEntity(entityId: string): any {
    return this.state.get(entityId);
  }

  /**
   * Create state snapshot
   */
  createSnapshot(): StateSnapshot {
    return {
      id: `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      vectorClock: { ...this.vectorClock },
      entities: this.getState(),
      operations: [...this.operations],
    };
  }

  /**
   * Load state from snapshot
   */
  loadSnapshot(snapshot: StateSnapshot): void {
    this.state.clear();

    for (const [entityId, entity] of Object.entries(snapshot.entities)) {
      this.state.set(entityId, entity);
    }

    this.operations = [...snapshot.operations];
    this.vectorClock = { ...snapshot.vectorClock };

    this.emitChange({ type: "snapshot-loaded", data: snapshot });
  }

  /**
   * Get operation history
   */
  getOperationHistory(entityId?: string): Operation[] {
    if (entityId) {
      return this.operations.filter((op) => op.entityId === entityId);
    }
    return [...this.operations];
  }

  /**
   * Undo last operation by this user
   */
  undoLastOperation(): Operation | null {
    const lastUserOp = this.operations.filter((op) => op.userId === this.userId).pop();

    if (!lastUserOp) {return null;}

    // Create inverse operation
    const undoOp = this.createInverseOperation(lastUserOp);
    const fullUndoOp = this.applyLocalOperation(undoOp);

    return fullUndoOp;
  }

  private createInverseOperation(
    operation: Operation,
  ): Omit<Operation, "id" | "userId" | "timestamp" | "vectorClock"> {
    switch (operation.type) {
      case "create":
        return {
          type: "delete",
          entityType: operation.entityType,
          entityId: operation.entityId,
          data: {} as Record<string, any>,
        };

      case "delete":
        return {
          type: "create",
          entityType: operation.entityType,
          entityId: operation.entityId,
          data: operation.data,
        };

      case "update":
        // Would need to store previous state for proper undo
        // For now, emit event for manual handling
        return {
          type: "update",
          entityType: operation.entityType,
          entityId: operation.entityId,
          data: {}, // Would need previous state
        };

      default:
        return operation;
    }
  }

  /**
   * Synchronize with remote state
   */
  synchronize(remoteOperations: Operation[]): void {
    for (const operation of remoteOperations) {
      this.applyRemoteOperation(operation);
    }
  }

  /**
   * Get operations since timestamp
   */
  getOperationsSince(timestamp: number): Operation[] {
    return this.operations.filter((op) => op.timestamp > timestamp);
  }

  /**
   * Clean old operations
   */
  cleanOldOperations(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge;
    this.operations = this.operations.filter((op) => op.timestamp > cutoff);
  }

  // Event System
  addChangeListener(listener: (change: StateChange) => void): void {
    this.changeListeners.push(listener);
  }

  removeChangeListener(listener: (change: StateChange) => void): void {
    const index = this.changeListeners.indexOf(listener);
    if (index > -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  private emitChange(change: StateChange): void {
    this.changeListeners.forEach((listener) => {
      try {
        listener(change);
      } catch (error) {
        logger.error("State change listener error:", error as Error);
      }
    });
  }
}

// Event Types
export interface ConflictEvent {
  type: "conflict-detected";
  operation: Operation;
  conflicts: Operation[];
  resolve: (operation: Operation | null) => Promise<Operation | null>;
}

export type StateChange =
  | { type: "operation-applied"; data: { operation: Operation; state: Record<string, any> } }
  | { type: "conflict"; data: ConflictEvent }
  | { type: "snapshot-loaded"; data: StateSnapshot };
