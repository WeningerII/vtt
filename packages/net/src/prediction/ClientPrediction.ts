export interface GameState {
  timestamp: number;
  frame: number;
  entities: Map<string, EntityState>;
  inputs: InputState[];
}

export interface EntityState {
  id: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  rotation: number;
  health: number;
  lastUpdate: number;
  ownerId?: string;
}

export interface InputState {
  playerId: string;
  sequence: number;
  timestamp: number;
  deltaTime: number;
  keys: { [key: string]: boolean };
  mouse: { x: number; y: number; buttons: number };
  acknowledged: boolean;
}

export interface ServerSnapshot {
  timestamp: number;
  frame: number;
  entities: EntityState[];
  acknowledgedInputs: number[]; // Sequence numbers of acknowledged inputs
}

export interface PredictionConfig {
  maxHistorySize: number;
  interpolationDelay: number; // ms
  extrapolationLimit: number; // ms
  reconciliationThreshold: number; // Distance threshold for corrections
  rollbackFrames: number;
  inputBufferSize: number;
  lagCompensationWindow: number; // ms
}

export class ClientPrediction {
  private gameStates: GameState[] = [];
  private inputBuffer: InputState[] = [];
  private serverSnapshots: ServerSnapshot[] = [];
  private config: PredictionConfig;

  // Timing
  private clientTime = 0;
  private serverTime = 0;
  private latency = 0;
  private jitter = 0;
  private timeOffset = 0;

  // State tracking
  private currentFrame = 0;
  private lastAcknowledgedInput = 0;
  private inputSequence = 0;
  private localPlayerId: string;

  // Prediction state
  private predictedEntities = new Map<string, EntityState>();
  private interpolatedEntities = new Map<string, EntityState>();

  // Statistics
  private corrections = 0;
  private predictions = 0;
  private rollbacks = 0;

  constructor(localPlayerId: string, config?: Partial<PredictionConfig>) {
    this.localPlayerId = localPlayerId;
    this.config = {
      maxHistorySize: 120, // 2 seconds at 60fps
      interpolationDelay: 100, // ms
      extrapolationLimit: 200, // ms
      reconciliationThreshold: 5.0, // units
      rollbackFrames: 10,
      inputBufferSize: 60,
      lagCompensationWindow: 1000, // ms
      ...config,
    };
  }

  public update(deltaTime: number): void {
    this.clientTime += deltaTime * 1000;
    this.currentFrame++;

    // Update timing estimates
    this.updateTiming();

    // Process server snapshots
    this.processServerSnapshots();

    // Perform client-side prediction
    this.performPrediction(deltaTime);

    // Interpolate non-player entities
    this.performInterpolation();

    // Clean up old data
    this.cleanup();
  }

  private updateTiming(): void {
    // Update server time estimate
    this.serverTime = this.clientTime - this.timeOffset - this.latency / 2;
  }

  private processServerSnapshots(): void {
    for (const snapshot of this.serverSnapshots) {
      if (snapshot.timestamp > this.serverTime) {
        continue; // Future snapshot, skip for now
      }

      // Update acknowledged inputs
      for (const sequence of snapshot.acknowledgedInputs) {
        this.lastAcknowledgedInput = Math.max(this.lastAcknowledgedInput, sequence);

        // Mark input as acknowledged
        const input = this.inputBuffer.find((i) => i.sequence === sequence);
        if (input) {
          input.acknowledged = true;
        }
      }

      // Perform reconciliation for player entity
      this.performReconciliation(snapshot);

      // Update interpolation targets for other entities
      // this.updateInterpolationTargets(snapshot); // Method not implemented
    }

    // Remove processed snapshots
    this.serverSnapshots = this.serverSnapshots.filter(
      (s) => s.timestamp > this.serverTime - this.config.lagCompensationWindow,
    );
  }

  private performReconciliation(snapshot: ServerSnapshot): void {
    const playerEntity = snapshot.entities.find((e) => e.ownerId === this.localPlayerId);
    if (!playerEntity) return;

    // Find the game state that corresponds to this server snapshot
    const correspondingState = this.findStateByTimestamp(snapshot.timestamp);
    if (!correspondingState) return;

    const predictedEntity = correspondingState.entities.get(playerEntity.id);
    if (!predictedEntity) return;

    // Check if correction is needed
    const distance = this.calculateDistance(predictedEntity.position, playerEntity.position);

    if (distance > this.config.reconciliationThreshold) {
      this.corrections++;

      // Perform rollback and replay
      this.rollbackAndReplay(snapshot, correspondingState);
    }
  }

  private rollbackAndReplay(snapshot: ServerSnapshot, targetState: GameState): void {
    this.rollbacks++;

    const playerEntity = snapshot.entities.find((e) => e.ownerId === this.localPlayerId)!;

    // Create corrected state
    const correctedState: GameState = {
      timestamp: snapshot.timestamp,
      frame: targetState.frame,
      entities: new Map(targetState.entities),
      inputs: [...targetState.inputs],
    };

    // Apply server correction
    correctedState.entities.set(playerEntity.id, { ...playerEntity });

    // Find all inputs that need to be replayed
    const unacknowledgedInputs = this.inputBuffer.filter(
      (input) =>
        input.sequence > this.lastAcknowledgedInput && input.timestamp >= snapshot.timestamp,
    );

    // Replay inputs
    let replayState = correctedState;
    for (const input of unacknowledgedInputs) {
      replayState = this.applyInput(replayState, input);
    }

    // Update current prediction
    this.predictedEntities.set(playerEntity.id, replayState.entities.get(playerEntity.id)!);

    // Update game state history
    const stateIndex = this.gameStates.findIndex((s) => s.timestamp === targetState.timestamp);
    if (stateIndex >= 0) {
      this.gameStates[stateIndex] = correctedState;

      // Remove states after the corrected one and re-predict
      this.gameStates = this.gameStates.slice(0, stateIndex + 1);

      // Re-predict from corrected state
      this.replayFromState(correctedState);
    }
  }

  private replayFromState(state: GameState): void {
    const remainingInputs = this.inputBuffer.filter(
      (input) => input.timestamp > state.timestamp && !input.acknowledged,
    );

    let currentState = state;
    for (const input of remainingInputs) {
      currentState = this.applyInput(currentState, input);
      this.gameStates.push({ ...currentState });
    }
  }

  private performPrediction(_deltaTime: number): void {
    // Get the latest confirmed state
    let baseState = this.getLatestConfirmedState();

    if (!baseState) {
      // No confirmed state yet, create initial state
      baseState = this.createInitialState();
    }

    // Apply all unacknowledged inputs
    const unacknowledgedInputs = this.inputBuffer.filter(
      (input) => input.sequence > this.lastAcknowledgedInput,
    );

    let predictedState = baseState;
    for (const input of unacknowledgedInputs) {
      predictedState = this.applyInput(predictedState, input);
    }

    this.predictions++;

    // Store predicted state
    this.gameStates.push({
      timestamp: this.clientTime,
      frame: this.currentFrame,
      entities: new Map(predictedState.entities),
      inputs: [...predictedState.inputs],
    });

    // Update predicted entities
    for (const [id, entity] of predictedState.entities) {
      if (entity.ownerId === this.localPlayerId) {
        this.predictedEntities.set(id, { ...entity });
      }
    }
  }

  private performInterpolation(): void {
    const interpolationTime = this.serverTime - this.config.interpolationDelay;

    // Find two snapshots to interpolate between
    const snapshots = this.serverSnapshots
      .filter((s) => s.timestamp <= interpolationTime + 50) // 50ms tolerance
      .sort((a, b) => a.timestamp - b.timestamp);

    if (snapshots.length < 2) {
      // Not enough data for interpolation, use extrapolation or latest
      if (snapshots.length === 1 && snapshots[0]) {
        this.extrapolateFromSnapshot(snapshots[0], interpolationTime);
      }
      return;
    }

    const prevSnapshot = snapshots[snapshots.length - 2];
    const nextSnapshot = snapshots[snapshots.length - 1];

    if (!prevSnapshot || !nextSnapshot) return;

    // Calculate interpolation factor
    const timeDiff = nextSnapshot.timestamp - prevSnapshot.timestamp;
    const t = timeDiff > 0 ? (interpolationTime - prevSnapshot.timestamp) / timeDiff : 0;
    const clampedT = Math.max(0, Math.min(1, t));

    for (const entity of nextSnapshot.entities) {
      const _entityId = entity.id;
      const prevEntity = prevSnapshot.entities.find((e) => e.id === entity.id);
      if (!prevEntity) {
        // New entity, just use current state
        this.interpolatedEntities.set(entity.id, { ...entity });
        continue;
      }

      // Interpolate position and rotation
      const interpolatedEntity: EntityState = {
        ...entity,
        position: {
          x: this.lerp(prevEntity.position.x, entity.position.x, clampedT),
          y: this.lerp(prevEntity.position.y, entity.position.y, clampedT),
          z: this.lerp(prevEntity.position.z, entity.position.z, clampedT),
        },
        rotation: this.lerpAngle(prevEntity.rotation, entity.rotation, clampedT),
      };

      this.interpolatedEntities.set(entity.id, interpolatedEntity);
    }
  }

  private extrapolateFromSnapshot(snapshot: ServerSnapshot, targetTime: number): void {
    const deltaTime = (targetTime - snapshot.timestamp) / 1000;

    if (deltaTime > this.config.extrapolationLimit / 1000) {
      // Too much extrapolation, just use snapshot data
      for (const entity of snapshot.entities) {
        if (entity.ownerId !== this.localPlayerId) {
          this.interpolatedEntities.set(entity.id, { ...entity });
        }
      }
      return;
    }

    // Extrapolate based on velocity
    for (const entity of snapshot.entities) {
      if (entity.ownerId === this.localPlayerId) {
        continue;
      }

      const extrapolatedEntity: EntityState = {
        ...entity,
        position: {
          x: entity.position.x + entity.velocity.x * deltaTime,
          y: entity.position.y + entity.velocity.y * deltaTime,
          z: entity.position.z + entity.velocity.z * deltaTime,
        },
      };

      this.interpolatedEntities.set(entity.id, extrapolatedEntity);
    }
  }

  private applyInput(state: GameState, input: InputState): GameState {
    const newState: GameState = {
      timestamp: input.timestamp,
      frame: state.frame + 1,
      entities: new Map(state.entities),
      inputs: [...state.inputs, input],
    };

    // Apply input to player entity
    for (const [id, entity] of newState.entities) {
      if (entity.ownerId === input.playerId) {
        const updatedEntity = this.updateEntityWithInput(entity, input);
        newState.entities.set(id, updatedEntity);
      }
    }

    return newState;
  }

  private updateEntityWithInput(entity: EntityState, input: InputState): EntityState {
    const newEntity = { ...entity };
    const deltaTime = input.deltaTime / 1000;
    const speed = 100; // units per second

    // Update velocity based on input
    newEntity.velocity = { x: 0, y: 0, z: 0 };

    if (input.keys["w"] || input.keys["ArrowUp"]) {
      newEntity.velocity.z -= speed;
    }
    if (input.keys["s"] || input.keys["ArrowDown"]) {
      newEntity.velocity.z += speed;
    }
    if (input.keys["a"] || input.keys["ArrowLeft"]) {
      newEntity.velocity.x -= speed;
    }
    if (input.keys["d"] || input.keys["ArrowRight"]) {
      newEntity.velocity.x += speed;
    }

    // Update position
    newEntity.position.x += newEntity.velocity.x * deltaTime;
    newEntity.position.y += newEntity.velocity.y * deltaTime;
    newEntity.position.z += newEntity.velocity.z * deltaTime;

    newEntity.lastUpdate = input.timestamp;

    return newEntity;
  }

  public addInput(input: Omit<InputState, "sequence" | "acknowledged">): void {
    const fullInput: InputState = {
      ...input,
      sequence: ++this.inputSequence,
      acknowledged: false,
    };

    this.inputBuffer.push(fullInput);

    // Limit buffer size
    if (this.inputBuffer.length > this.config.inputBufferSize) {
      this.inputBuffer.shift();
    }
  }

  public addServerSnapshot(snapshot: ServerSnapshot): void {
    // Update timing estimates
    const now = Date.now();
    this.latency = now - snapshot.timestamp;

    // Add jitter calculation
    const expectedLatency = this.latency;
    this.jitter = Math.abs(expectedLatency - this.latency) * 0.1 + this.jitter * 0.9;

    this.serverSnapshots.push(snapshot);

    // Limit snapshot history
    if (this.serverSnapshots.length > this.config.maxHistorySize) {
      this.serverSnapshots.shift();
    }
  }

  // Utility methods
  private findStateByTimestamp(timestamp: number): GameState | null {
    return (
      this.gameStates.find(
        (state) => Math.abs(state.timestamp - timestamp) < 16, // Within one frame
      ) || null
    );
  }

  private getLatestConfirmedState(): GameState | null {
    // Find the latest state that was confirmed by server
    const confirmedStates = this.gameStates.filter((state) =>
      state.inputs.every((input) => input.acknowledged),
    );

    return confirmedStates.length > 0 ? confirmedStates[confirmedStates.length - 1] || null : null;
  }

  private createInitialState(): GameState {
    return {
      timestamp: this.clientTime,
      frame: 0,
      entities: new Map(),
      inputs: [],
    };
  }

  private calculateDistance(
    pos1: { x: number; y: number; z: number },
    pos2: { x: number; y: number; z: number },
  ): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private lerpAngle(a: number, b: number, t: number): number {
    // Handle angle wrapping
    let delta = b - a;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    return a + delta * t;
  }

  private cleanup(): void {
    const cutoffTime = this.clientTime - this.config.lagCompensationWindow;

    // Clean up old game states
    this.gameStates = this.gameStates.filter((state) => state.timestamp > cutoffTime);

    // Clean up acknowledged inputs
    this.inputBuffer = this.inputBuffer.filter(
      (input) => !input.acknowledged || input.timestamp > cutoffTime,
    );

    // Clean up old server snapshots
    this.serverSnapshots = this.serverSnapshots.filter(
      (snapshot) => snapshot.timestamp > cutoffTime,
    );
  }

  // Getters
  public getPredictedEntity(entityId: string): EntityState | null {
    return this.predictedEntities.get(entityId) || null;
  }

  public getInterpolatedEntity(entityId: string): EntityState | null {
    return this.interpolatedEntities.get(entityId) || null;
  }

  public getLatency(): number {
    return this.latency;
  }

  public getJitter(): number {
    return this.jitter;
  }

  public getStats() {
    return {
      corrections: this.corrections,
      predictions: this.predictions,
      rollbacks: this.rollbacks,
      latency: this.latency,
      jitter: this.jitter,
      gameStates: this.gameStates.length,
      inputBuffer: this.inputBuffer.length,
      snapshots: this.serverSnapshots.length,
      acknowledgedInputs: this.inputBuffer.filter((i) => i.acknowledged).length,
      pendingInputs: this.inputBuffer.filter((i) => !i.acknowledged).length,
    };
  }

  public getConfig(): PredictionConfig {
    return { ...this.config };
  }

  public setConfig(config: Partial<PredictionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Debug methods
  public getDebugInfo(): any {
    return {
      clientTime: this.clientTime,
      serverTime: this.serverTime,
      timeOffset: this.timeOffset,
      currentFrame: this.currentFrame,
      lastAcknowledgedInput: this.lastAcknowledgedInput,
      inputSequence: this.inputSequence,
      stats: this.getStats(),
      recentStates: this.gameStates.slice(-5),
      recentInputs: this.inputBuffer.slice(-10),
      predictedEntities: Array.from(this.predictedEntities.entries()),
      interpolatedEntities: Array.from(this.interpolatedEntities.entries()),
    };
  }

  public dispose(): void {
    this.gameStates = [];
    this.inputBuffer = [];
    this.serverSnapshots = [];
    this.predictedEntities.clear();
    this.interpolatedEntities.clear();
  }
}
