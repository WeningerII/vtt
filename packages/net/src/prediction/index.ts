// Client Prediction exports
export {
  ClientPrediction,
  type GameState,
  type EntityState,
  type InputState,
  type ServerSnapshot,
  type PredictionConfig,
} from "./ClientPrediction";

// Lag Compensation exports
export {
  LagCompensation,
  type LagCompensationConfig,
  type HistoricalState,
  type CompensationResult,
  type ValidationResult,
} from "./LagCompensation";

// Import classes and types for usage in this file
import {
  ClientPrediction,
  type GameState,
  type EntityState,
  type InputState,
  type ServerSnapshot,
  type PredictionConfig,
} from "./ClientPrediction";
import {
  LagCompensation,
  type LagCompensationConfig,
  type HistoricalState,
  type CompensationResult,
  type ValidationResult,
} from "./LagCompensation";

// Network Prediction Manager
export class NetworkPredictionManager {
  private clientPrediction: ClientPrediction;
  private lagCompensation: LagCompensation;
  private isServer: boolean;

  constructor(
    localPlayerId: string,
    isServer: boolean = false,
    config?: {
      prediction?: Partial<PredictionConfig>;
      lagCompensation?: Partial<LagCompensationConfig>;
    },
  ) {
    this.isServer = isServer;
    this.clientPrediction = new ClientPrediction(localPlayerId, config?.prediction);
    this.lagCompensation = new LagCompensation(config?.lagCompensation);
  }

  // Client-side methods
  public updateClient(deltaTime: number): void {
    if (!this.isServer) {
      this.clientPrediction.update(deltaTime);
    }
  }

  public addInput(input: Omit<InputState, "sequence" | "acknowledged">): void {
    if (!this.isServer) {
      this.clientPrediction.addInput(input);
    }
  }

  public addServerSnapshot(snapshot: ServerSnapshot): void {
    if (!this.isServer) {
      this.clientPrediction.addServerSnapshot(snapshot);
    }
  }

  public getPredictedEntity(entityId: string): EntityState | null {
    return this.clientPrediction.getPredictedEntity(entityId);
  }

  public getInterpolatedEntity(entityId: string): EntityState | null {
    return this.clientPrediction.getInterpolatedEntity(entityId);
  }

  // Server-side methods
  public addHistoricalState(timestamp: number, gameState: GameState): void {
    if (this.isServer) {
      this.lagCompensation.addHistoricalState(timestamp, gameState);
    }
  }

  public validateInput(
    playerId: string,
    input: InputState,
    previousState?: EntityState,
  ): ValidationResult {
    return this.lagCompensation.validateInput(playerId, input, previousState);
  }

  public compensateForLatency(
    playerId: string,
    input: InputState,
    currentTime: number,
  ): CompensationResult | null {
    return this.lagCompensation.compensateForLatency(playerId, input, currentTime);
  }

  public updatePlayerLatency(playerId: string, latency: number): void {
    this.lagCompensation.updatePlayerLatency(playerId, latency);
  }

  // Common methods
  public getStats() {
    return {
      client: this.clientPrediction.getStats(),
      server: this.lagCompensation.getStats(),
      isServer: this.isServer,
    };
  }

  public cleanup(): void {
    this.clientPrediction.dispose();
    this.lagCompensation.dispose();
  }
}

// Utility functions for network prediction
export function createInputState(
  playerId: string,
  keys: { [key: string]: boolean },
  mouse: { x: number; y: number; buttons: number },
  deltaTime: number = 16.67,
): Omit<InputState, "sequence" | "acknowledged"> {
  return {
    playerId,
    timestamp: Date.now(),
    deltaTime,
    keys: { ...keys },
    mouse: { ...mouse },
  };
}

export function createEntityState(
  id: string,
  position: { x: number; y: number; z: number },
  velocity: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
  rotation: number = 0,
  health: number = 100,
  ownerId?: string,
): EntityState {
  const baseEntity = {
    id,
    position: { ...position },
    velocity: { ...velocity },
    rotation,
    health,
    lastUpdate: Date.now(),
  };

  return ownerId !== undefined ? { ...baseEntity, ownerId } : baseEntity;
}

export function createServerSnapshot(
  entities: EntityState[],
  acknowledgedInputs: number[] = [],
  frame: number = 0,
): ServerSnapshot {
  return {
    timestamp: Date.now(),
    frame,
    entities: [...entities],
    acknowledgedInputs: [...acknowledgedInputs],
  };
}
