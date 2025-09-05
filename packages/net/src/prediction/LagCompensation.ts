import { EntityState, InputState, GameState } from "./ClientPrediction";

export interface LagCompensationConfig {
  maxCompensationTime: number; // Maximum time to compensate for (ms)
  historySize: number; // Number of historical states to keep
  validationThreshold: number; // Maximum difference to accept
  antiCheatEnabled: boolean;
  maxSpeedThreshold: number;
  maxAccelerationThreshold: number;
}

export interface HistoricalState {
  timestamp: number;
  entities: Map<string, EntityState>;
  authoritative: boolean;
}

export interface CompensationResult {
  compensated: boolean;
  originalState: EntityState;
  compensatedState: EntityState;
  timeDifference: number;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  suspiciousActivity: boolean;
  correctedState?: EntityState;
}

export class LagCompensation {
  private config: LagCompensationConfig;
  private stateHistory: HistoricalState[] = [];
  private playerLatencies = new Map<string, number>();
  private playerJitter = new Map<string, number>();

  // Anti-cheat tracking
  private suspiciousPlayers = new Map<string, number>();
  private playerVelocityHistory = new Map<string, Array<{ velocity: number; timestamp: number }>>();

  // Statistics
  private compensationCount = 0;
  private validationCount = 0;
  private rejectedInputs = 0;

  constructor(config?: Partial<LagCompensationConfig>) {
    this.config = {
      maxCompensationTime: 1000, // 1 second
      historySize: 300, // 5 seconds at 60fps
      validationThreshold: 10.0,
      antiCheatEnabled: true,
      maxSpeedThreshold: 500, // units per second
      maxAccelerationThreshold: 1000, // units per second squared
      ...config,
    };
  }

  public addHistoricalState(
    timestamp: number,
    gameState: GameState,
    authoritative: boolean = true,
  ): void {
    const historicalState: HistoricalState = {
      timestamp,
      entities: new Map(gameState.entities),
      authoritative,
    };

    this.stateHistory.push(historicalState);

    // Keep history within limits
    if (this.stateHistory.length > this.config.historySize) {
      this.stateHistory.shift();
    }

    // Sort by timestamp to maintain order
    this.stateHistory.sort((a, b) => a.timestamp - b.timestamp);
  }

  public compensateForLatency(
    playerId: string,
    input: InputState,
    currentTime: number,
  ): CompensationResult | null {
    const playerLatency = this.playerLatencies.get(playerId) || 0;
    const compensationTime = currentTime - input.timestamp - playerLatency / 2;

    // Check if compensation is within limits
    if (compensationTime > this.config.maxCompensationTime) {
      return null; // Too much compensation requested
    }

    // Find the historical state closest to the compensation time
    const targetTime = currentTime - compensationTime;
    const historicalState = this.findHistoricalState(targetTime);

    if (!historicalState) {
      return null; // No historical state available
    }

    // Get the entity at that time
    const entity = historicalState.entities.get(input.playerId);
    if (!entity) {
      return null; // Entity not found in historical state
    }

    // Get current entity state for comparison
    const currentState = this.getCurrentEntityState(input.playerId);
    if (!currentState) {
      return null;
    }

    this.compensationCount++;

    return {
      compensated: true,
      originalState: currentState,
      compensatedState: entity,
      timeDifference: compensationTime,
    };
  }

  public validateInput(
    playerId: string,
    input: InputState,
    previousState?: EntityState,
  ): ValidationResult {
    this.validationCount++;

    if (!this.config.antiCheatEnabled) {
      return { valid: true, suspiciousActivity: false };
    }

    // Basic timestamp validation
    const currentTime = Date.now();
    const inputAge = currentTime - input.timestamp;

    if (inputAge > this.config.maxCompensationTime * 2) {
      this.rejectedInputs++;
      return {
        valid: false,
        reason: "Input too old",
        suspiciousActivity: true,
      };
    }

    // Validate input sequence
    if (!this.validateInputSequence(playerId, input)) {
      this.rejectedInputs++;
      return {
        valid: false,
        reason: "Invalid input sequence",
        suspiciousActivity: true,
      };
    }

    // Validate movement if we have a previous state
    if (previousState) {
      const movementValidation = this.validateMovement(playerId, input, previousState);
      if (!movementValidation.valid) {
        this.rejectedInputs++;
        return movementValidation;
      }
    }

    return { valid: true, suspiciousActivity: false };
  }

  private validateInputSequence(playerId: string, input: InputState): boolean {
    // Check for duplicate or out-of-order inputs
    // This would require tracking last processed input sequence per player
    // For now, just basic validation

    if (input.sequence < 0 || input.sequence > 1000000) {
      return false; // Unreasonable sequence number
    }

    return true;
  }

  private validateMovement(
    playerId: string,
    input: InputState,
    previousState: EntityState,
  ): ValidationResult {
    // Calculate expected position based on input and previous state
    const deltaTime = input.deltaTime / 1000;
    const expectedState = this.calculateExpectedMovement(previousState, input, deltaTime);

    // Get current velocity for this player
    const currentVelocity = Math.sqrt(
      expectedState.velocity.x ** 2 + expectedState.velocity.y ** 2 + expectedState.velocity.z ** 2,
    );

    // Check speed limits
    if (currentVelocity > this.config.maxSpeedThreshold) {
      this.recordSuspiciousActivity(playerId);

      return {
        valid: false,
        reason: `Speed too high: ${currentVelocity.toFixed(2)}`,
        suspiciousActivity: true,
        correctedState: {
          ...expectedState,
          velocity: this.clampVelocity(expectedState.velocity, this.config.maxSpeedThreshold),
        },
      };
    }

    // Check acceleration limits
    const acceleration = this.calculateAcceleration(
      playerId,
      expectedState.velocity,
      input.timestamp,
    );
    if (acceleration > this.config.maxAccelerationThreshold) {
      this.recordSuspiciousActivity(playerId);

      return {
        valid: false,
        reason: `Acceleration too high: ${acceleration.toFixed(2)}`,
        suspiciousActivity: true,
      };
    }

    // Update velocity history for future acceleration checks
    this.updateVelocityHistory(playerId, currentVelocity, input.timestamp);

    return { valid: true, suspiciousActivity: false };
  }

  private calculateExpectedMovement(
    previousState: EntityState,
    input: InputState,
    deltaTime: number,
  ): EntityState {
    const speed = 100; // Base speed units per second
    const newState = { ...previousState };

    // Calculate velocity based on input
    newState.velocity = { x: 0, y: 0, z: 0 };

    if (input.keys["w"] || input.keys["ArrowUp"]) {
      newState.velocity.z -= speed;
    }
    if (input.keys["s"] || input.keys["ArrowDown"]) {
      newState.velocity.z += speed;
    }
    if (input.keys["a"] || input.keys["ArrowLeft"]) {
      newState.velocity.x -= speed;
    }
    if (input.keys["d"] || input.keys["ArrowRight"]) {
      newState.velocity.x += speed;
    }

    // Apply diagonal movement normalization
    const velocityMagnitude = Math.sqrt(newState.velocity.x ** 2 + newState.velocity.z ** 2);

    if (velocityMagnitude > speed) {
      const scale = speed / velocityMagnitude;
      newState.velocity.x *= scale;
      newState.velocity.z *= scale;
    }

    // Update position
    newState.position = {
      x: previousState.position.x + newState.velocity.x * deltaTime,
      y: previousState.position.y + newState.velocity.y * deltaTime,
      z: previousState.position.z + newState.velocity.z * deltaTime,
    };

    newState.lastUpdate = input.timestamp;

    return newState;
  }

  private calculateAcceleration(
    playerId: string,
    currentVelocity: { x: number; y: number; z: number },
    timestamp: number,
  ): number {
    const history = this.playerVelocityHistory.get(playerId);
    if (!history || history.length === 0) {
      return 0; // No history to compare against
    }

    const lastVelocityEntry = history[history.length - 1];
    if (!lastVelocityEntry) {
      return 0;
    }

    const timeDiff = (timestamp - lastVelocityEntry.timestamp) / 1000;

    if (timeDiff <= 0) {
      return 0;
    }

    const currentSpeed = Math.sqrt(
      currentVelocity.x ** 2 + currentVelocity.y ** 2 + currentVelocity.z ** 2,
    );
    const acceleration = Math.abs(currentSpeed - lastVelocityEntry.velocity) / timeDiff;

    return acceleration;
  }

  private updateVelocityHistory(playerId: string, velocity: number, timestamp: number): void {
    let history = this.playerVelocityHistory.get(playerId);
    if (!history) {
      history = [];
      this.playerVelocityHistory.set(playerId, history);
    }

    history.push({ velocity, timestamp });

    // Keep only recent history (last 1 second)
    const cutoffTime = timestamp - 1000;
    this.playerVelocityHistory.set(
      playerId,
      history.filter((entry) => entry.timestamp > cutoffTime),
    );
  }

  private clampVelocity(
    velocity: { x: number; y: number; z: number },
    maxSpeed: number,
  ): { x: number; y: number; z: number } {
    const magnitude = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);

    if (magnitude > maxSpeed) {
      const scale = maxSpeed / magnitude;
      return {
        x: velocity.x * scale,
        y: velocity.y * scale,
        z: velocity.z * scale,
      };
    }

    return velocity;
  }

  private recordSuspiciousActivity(playerId: string): void {
    const current = this.suspiciousPlayers.get(playerId) || 0;
    this.suspiciousPlayers.set(playerId, current + 1);
  }

  private findHistoricalState(timestamp: number): HistoricalState | null {
    if (this.stateHistory.length === 0) {
      return null;
    }

    // Find closest historical state
    let closest: HistoricalState | null = null;
    let closestDistance = Infinity;

    for (const state of this.stateHistory) {
      const distance = Math.abs(state.timestamp - timestamp);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = state;
      }
    }

    // Only return if within reasonable time threshold
    if (closest && closestDistance < 100) {
      // 100ms threshold
      return closest;
    }

    return null;
  }

  private getCurrentEntityState(entityId: string): EntityState | null {
    if (this.stateHistory.length === 0) {
      return null;
    }

    const latestState = this.stateHistory[this.stateHistory.length - 1];
    return latestState?.entities.get(entityId) || null;
  }

  // Player management
  public updatePlayerLatency(playerId: string, latency: number): void {
    this.playerLatencies.set(playerId, latency);

    // Calculate jitter
    const previousLatency = this.playerLatencies.get(playerId) || latency;
    const jitter = Math.abs(latency - previousLatency);
    const currentJitter = this.playerJitter.get(playerId) || 0;

    // Exponential moving average for jitter
    this.playerJitter.set(playerId, currentJitter * 0.9 + jitter * 0.1);
  }

  public getPlayerLatency(playerId: string): number {
    return this.playerLatencies.get(playerId) || 0;
  }

  public getPlayerJitter(playerId: string): number {
    return this.playerJitter.get(playerId) || 0;
  }

  public removePlayer(playerId: string): void {
    this.playerLatencies.delete(playerId);
    this.playerJitter.delete(playerId);
    this.suspiciousPlayers.delete(playerId);
    this.playerVelocityHistory.delete(playerId);
  }

  // Interpolation helpers for smooth lag compensation
  public interpolateEntityState(state1: EntityState, state2: EntityState, t: number): EntityState {
    const clampedT = Math.max(0, Math.min(1, t));

    return {
      ...state1,
      position: {
        x: this.lerp(state1.position.x, state2.position.x, clampedT),
        y: this.lerp(state1.position.y, state2.position.y, clampedT),
        z: this.lerp(state1.position.z, state2.position.z, clampedT),
      },
      velocity: {
        x: this.lerp(state1.velocity.x, state2.velocity.x, clampedT),
        y: this.lerp(state1.velocity.y, state2.velocity.y, clampedT),
        z: this.lerp(state1.velocity.z, state2.velocity.z, clampedT),
      },
      rotation: this.lerpAngle(state1.rotation, state2.rotation, clampedT),
      health: this.lerp(state1.health, state2.health, clampedT),
    };
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private lerpAngle(a: number, b: number, t: number): number {
    let delta = b - a;
    if (delta > Math.PI) {delta -= 2 * Math.PI;}
    if (delta < -Math.PI) {delta += 2 * Math.PI;}
    return a + delta * t;
  }

  // Statistics and monitoring
  public getStats() {
    return {
      compensationCount: this.compensationCount,
      validationCount: this.validationCount,
      rejectedInputs: this.rejectedInputs,
      rejectionRate: this.validationCount > 0 ? this.rejectedInputs / this.validationCount : 0,
      historySize: this.stateHistory.length,
      trackedPlayers: this.playerLatencies.size,
      suspiciousPlayers: this.suspiciousPlayers.size,
      averageLatency: this.calculateAverageLatency(),
      averageJitter: this.calculateAverageJitter(),
    };
  }

  private calculateAverageLatency(): number {
    if (this.playerLatencies.size === 0) {return 0;}

    const sum = Array.from(this.playerLatencies.values()).reduce((a, b) => a + b, 0);
    return sum / this.playerLatencies.size;
  }

  private calculateAverageJitter(): number {
    if (this.playerJitter.size === 0) {return 0;}

    const sum = Array.from(this.playerJitter.values()).reduce((a, b) => a + b, 0);
    return sum / this.playerJitter.size;
  }

  public getSuspiciousPlayers(): Array<{ playerId: string; violations: number }> {
    return Array.from(this.suspiciousPlayers.entries())
      .map(([playerId, violations]) => ({ playerId, violations }))
      .sort((a, b) => b.violations - a.violations);
  }

  public getPlayerStats(playerId: string) {
    return {
      latency: this.getPlayerLatency(playerId),
      jitter: this.getPlayerJitter(playerId),
      suspiciousActivity: this.suspiciousPlayers.get(playerId) || 0,
      velocityHistorySize: this.playerVelocityHistory.get(playerId)?.length || 0,
    };
  }

  // Configuration
  public getConfig(): LagCompensationConfig {
    return { ...this.config };
  }

  public setConfig(config: Partial<LagCompensationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Cleanup
  public cleanup(): void {
    const cutoffTime = Date.now() - this.config.maxCompensationTime * 2;

    // Clean old historical states
    this.stateHistory = this.stateHistory.filter((state) => state.timestamp > cutoffTime);

    // Clean old velocity histories
    for (const [playerId, history] of this.playerVelocityHistory) {
      const filteredHistory = history.filter((entry) => entry.timestamp > cutoffTime);
      if (filteredHistory.length === 0) {
        this.playerVelocityHistory.delete(playerId);
      } else {
        this.playerVelocityHistory.set(playerId, filteredHistory);
      }
    }
  }

  public dispose(): void {
    this.stateHistory = [];
    this.playerLatencies.clear();
    this.playerJitter.clear();
    this.suspiciousPlayers.clear();
    this.playerVelocityHistory.clear();
  }
}
