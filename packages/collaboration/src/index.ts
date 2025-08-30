/**
 * Collaboration Package Entry Point
 * Exports all collaboration-related components
 */

export * from "./StateManager";
export * from "./SynchronizationService";
export * from "./SocketIOTransport";
export * from "./PresenceManager";

// Re-export commonly used types for convenience
export type { Operation, VectorClock, StateSnapshot, ConflictResolution } from "./StateManager";

export type {
  SyncConfig,
  ConnectionState,
  SyncMessage,
  SyncTransport,
  SyncEvent,
} from "./SynchronizationService";

export type { UserPresence, PresenceUpdate, PresenceEvent } from "./PresenceManager";
