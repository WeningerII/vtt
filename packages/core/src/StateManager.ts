/**
 * Unified State Manager - Centralized state management across all VTT systems
 * Provides undo/redo, persistence, and real-time synchronization capabilities
 */

import { EventEmitter } from "./EventEmitter";
import { logger } from "@vtt/logging";
import {
  StateManager as IStateManager,
  StateEvents,
  StateListener,
  StateSnapshot,
  Disposable,
} from "./SharedInterfaces";

export interface StateManagerConfig {
  maxUndoSteps: number;
  autoSave: boolean;
  autoSaveInterval: number;
  enableCompression: boolean;
  enableEncryption: boolean;
  storageKey: string;
  syncEnabled: boolean;
}

export interface StateDiff {
  path: string[];
  operation: "add" | "remove" | "replace";
  oldValue?: any;
  newValue?: any;
}

export class UnifiedStateManager<TState = any>
  extends EventEmitter<StateEvents<TState>>
  implements IStateManager<TState>, Disposable
{
  private currentState: TState;
  private undoStack: StateSnapshot<TState>[] = [];
  private redoStack: StateSnapshot<TState>[] = [];
  private stateListeners = new Set<StateListener<TState>>();
  private config: StateManagerConfig;
  private autoSaveTimer?: NodeJS.Timeout;
  private snapshotCounter = 0;

  constructor(initialState: TState, config: Partial<StateManagerConfig> = {}) {
    super();

    this.currentState = this.deepClone(initialState);
    this.config = {
      maxUndoSteps: 50,
      autoSave: true,
      autoSaveInterval: 30000, // 30 seconds
      enableCompression: false,
      enableEncryption: false,
      storageKey: "vtt_state",
      syncEnabled: false,
      ...config,
    };

    if (this.config.autoSave) {
      this.startAutoSave();
    }
  }

  /**
   * Get the current state
   */
  getState(): TState {
    return this.deepClone(this.currentState);
  }

  /**
   * Set new state with automatic diffing and history
   */
  setState(newState: Partial<TState>): void {
    const previousState = this.deepClone(this.currentState);
    const mergedState = { ...this.currentState, ...newState };

    // Calculate diff
    const diff = this.calculateDiff(this.currentState, mergedState);

    if (diff.length === 0) {
      return; // No changes
    }

    // Create snapshot for undo
    this.pushUndoSnapshot(previousState);

    // Update state
    this.currentState = mergedState;

    // Clear redo stack since we're making a new change
    this.redoStack = [];

    // Notify listeners
    this.notifyListeners(previousState, this.currentState);

    // Emit event
    this.emit("stateChanged", { newState: this.currentState, previousState });
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateListener<TState>): () => void {
    this.stateListeners.add(listener);

    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Create a snapshot of the current state
   */
  snapshot(): StateSnapshot<TState> {
    return {
      id: `snapshot_${++this.snapshotCounter}`,
      timestamp: new Date(),
      state: this.deepClone(this.currentState),
      metadata: {
        undoStackSize: this.undoStack.length,
        redoStackSize: this.redoStack.length,
      },
    };
  }

  /**
   * Restore state from a snapshot
   */
  restore(snapshot: StateSnapshot<TState>): void {
    const previousState = this.deepClone(this.currentState);

    // Push current state to undo before restoring
    this.pushUndoSnapshot(this.currentState);

    this.currentState = this.deepClone(snapshot.state);

    // Clear redo stack
    this.redoStack = [];

    // Notify listeners
    this.notifyListeners(this.currentState, previousState);

    // Emit events
    this.emit("stateChanged", { newState: this.currentState, previousState });
    this.emit("stateLoaded", { timestamp: snapshot.timestamp });
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    const previousState = this.deepClone(this.currentState);

    // Clear history
    this.undoStack = [];
    this.redoStack = [];

    // Reset to initial state (would need to store initial state)
    // For now, we'll emit the reset event
    this.emit("stateReset", { state: this.currentState });

    this.notifyListeners(this.currentState, previousState);
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Undo the last change
   */
  undo(): boolean {
    if (!this.canUndo()) {
      return false;
    }

    const previousState = this.deepClone(this.currentState);
    const snapshot = this.undoStack.pop()!;

    // Push current state to redo stack
    this.redoStack.push({
      id: `redo_${++this.snapshotCounter}`,
      timestamp: new Date(),
      state: this.deepClone(this.currentState),
    });

    // Restore the undo state
    this.currentState = this.deepClone(snapshot.state);

    // Notify listeners
    this.notifyListeners(this.currentState, previousState);

    // Emit event
    this.emit("undoPerformed", { state: this.currentState });

    return true;
  }

  /**
   * Redo the last undone change
   */
  redo(): boolean {
    if (!this.canRedo()) {
      return false;
    }

    const previousState = this.deepClone(this.currentState);
    const snapshot = this.redoStack.pop()!;

    // Push current state back to undo stack
    this.undoStack.push({
      id: `undo_${++this.snapshotCounter}`,
      timestamp: new Date(),
      state: this.deepClone(this.currentState),
    });

    // Restore the redo state
    this.currentState = this.deepClone(snapshot.state);

    // Notify listeners
    this.notifyListeners(this.currentState, previousState);

    // Emit event
    this.emit("redoPerformed", { state: this.currentState });

    return true;
  }

  /**
   * Save state to persistent storage
   */
  async save(): Promise<void> {
    try {
      const stateData = this.config.enableCompression
        ? this.compressState(this.currentState)
        : JSON.stringify(this.currentState);

      const finalData = this.config.enableEncryption
        ? await this.encryptState(stateData)
        : stateData;

      if (typeof localStorage !== "undefined") {
        localStorage.setItem(this.config.storageKey, finalData);
      }

      this.emit("stateChanged", { newState: this.currentState, previousState: this.currentState });
    } catch (error) {
      logger.warn("Failed to execute undo:", error as Record<string, any>);
      throw error;
    }
  }

  /**
   * Load state from persistent storage
   */
  async load(): Promise<void> {
    try {
      if (typeof localStorage === "undefined") {
        throw new Error("localStorage not available");
      }

      const savedData = localStorage.getItem(this.config.storageKey);
      if (!savedData) {
        throw new Error("No saved state found");
      }

      const decryptedData = this.config.enableEncryption
        ? await this.decryptState(savedData)
        : savedData;

      const stateData = this.config.enableCompression
        ? this.decompressState(decryptedData)
        : JSON.parse(decryptedData);

      const previousState = this.deepClone(this.currentState);
      this.currentState = stateData;

      // Clear history since we're loading fresh state
      this.undoStack = [];
      this.redoStack = [];

      // Notify listeners
      this.notifyListeners(this.currentState, previousState);

      this.emit("stateChanged", { newState: this.currentState, previousState });
    } catch (error) {
      logger.error("Failed to load state:", error as Record<string, any>);
      throw error;
    }
  }

  /**
   * Batch multiple state updates
   */
  batch(_updates: () => void): void {
    const previousState = this.deepClone(this.currentState);

    // Temporarily disable notifications
    const originalListeners = new Set(this.stateListeners);
    this.stateListeners.clear();

    try {
      _updates();
    } finally {
      // Restore listeners
      this.stateListeners = originalListeners;
    }

    // Send single notification for all changes
    this.notifyListeners(this.currentState, previousState);

    this.emit("stateChanged", { newState: this.currentState, previousState });
  }

  /**
   * Get state history info
   */
  getHistoryInfo(): { undoSteps: number; redoSteps: number; totalMemory: number } {
    const undoMemory = this.undoStack.reduce(
      (total, snapshot) => total + JSON.stringify(snapshot.state).length,
      0,
    );
    const redoMemory = this.redoStack.reduce(
      (total, snapshot) => total + JSON.stringify(snapshot.state).length,
      0,
    );

    return {
      undoSteps: this.undoStack.length,
      redoSteps: this.redoStack.length,
      totalMemory: undoMemory + redoMemory,
    };
  }

  /**
   * Dispose of the state manager
   */
  dispose(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.stateListeners.clear();
    this.undoStack = [];
    this.redoStack = [];
    this.removeAllListeners();
  }

  clearSubscriptions(): void {
    this.stateListeners.clear();
  }

  // Private helper methods

  private pushUndoSnapshot(state: TState): void {
    this.undoStack.push({
      id: `undo_${++this.snapshotCounter}`,
      timestamp: new Date(),
      state: this.deepClone(state),
    });

    // Limit undo stack size
    while (this.undoStack.length > this.config.maxUndoSteps) {
      this.undoStack.shift();
    }
  }

  private notifyListeners(newState: TState, previousState: TState): void {
    for (const listener of this.stateListeners) {
      try {
        listener(newState, previousState);
      } catch (error) {
        logger.error("Error in state listener:", error as Record<string, any>);
      }
    }
  }

  private calculateDiff(oldState: any, newState: any, path: string[] = []): StateDiff[] {
    const diffs: StateDiff[] = [];

    // Simple diff calculation - could be more sophisticated
    const oldKeys = new Set(Object.keys(oldState || {}));
    const newKeys = new Set(Object.keys(newState || {}));

    // Check for additions and changes
    for (const key of newKeys) {
      const currentPath = [...path, key];

      if (!oldKeys.has(key)) {
        diffs.push({
          path: currentPath,
          operation: "add",
          newValue: newState[key],
        });
      } else if (oldState[key] !== newState[key]) {
        if (typeof oldState[key] === "object" && typeof newState[key] === "object") {
          diffs.push(...this.calculateDiff(oldState[key], newState[key], currentPath));
        } else {
          diffs.push({
            path: currentPath,
            operation: "replace",
            oldValue: oldState[key],
            newValue: newState[key],
          });
        }
      }
    }

    // Check for removals
    for (const key of oldKeys) {
      if (!newKeys.has(key)) {
        diffs.push({
          path: [...path, key],
          operation: "remove",
          oldValue: oldState[key],
        });
      }
    }

    return diffs;
  }

  private calculatePartialDiff(oldState: TState, newState: TState): Partial<TState> {
    const diff: any = {};

    for (const key in newState) {
      if (oldState[key] !== newState[key]) {
        diff[key] = newState[key];
      }
    }

    return diff;
  }

  private deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as any;
    }

    if (obj instanceof Array) {
      return obj.map((item) => this.deepClone(item)) as any;
    }

    const cloned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }

    return cloned;
  }

  private startAutoSave(): void {
    this.autoSaveTimer = setInterval(() => {
      this.save().catch((error) => {
        logger.error("Auto-save failed:", error);
      });
    }, this.config.autoSaveInterval);
  }

  private compressState(state: TState): string {
    // Simple compression using JSON - could use actual compression library
    return JSON.stringify(state);
  }

  private decompressState(data: string): TState {
    return JSON.parse(data);
  }

  private async encryptState(data: string): Promise<string> {
    // Placeholder encryption - would use actual crypto
    return btoa(data);
  }

  private async decryptState(data: string): Promise<string> {
    // Placeholder decryption - would use actual crypto
    return atob(data);
  }
}

// Factory function for creating typed state managers
export function createStateManager<TState>(
  initialState: TState,
  config?: Partial<StateManagerConfig>,
): IStateManager<TState> {
  return new UnifiedStateManager(initialState, config);
}
