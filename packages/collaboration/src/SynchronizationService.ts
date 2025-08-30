/**
 * Synchronization Service
 * Handles real-time synchronization between clients and server
 */

import { StateManager, Operation, StateSnapshot } from './StateManager';
import { logger } from '@vtt/logging';

export interface SyncConfig {
  syncInterval: number; // ms
  batchSize: number;
  retryAttempts: number;
  retryDelay: number;
  heartbeatInterval: number;
}

export interface ConnectionState {
  connected: boolean;
  lastSync: number;
  lastHeartbeat: number;
  reconnectAttempts: number;
  latency: number;
}

export interface SyncMessage {
  type: 'operations' | 'snapshot' | 'heartbeat' | 'ack';
  timestamp: number;
  userId: string;
  data: any;
  messageId?: string;
}

export class SynchronizationService {
  private stateManager: StateManager;
  private config: SyncConfig;
  private connectionState: ConnectionState;
  private sendQueue: SyncMessage[] = [];
  private ackQueue: Map<string, { resolve: (...args: any[]) => any; reject: (...args: any[]) => any; timeout: NodeJS.Timeout }> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private eventListeners: Array<(event: SyncEvent) => void> = [];

  // Abstract transport layer - implement with Socket.IO, WebSocket, etc.
  private transport: SyncTransport;

  constructor(
    stateManager: StateManager,
    transport: SyncTransport,
    config: Partial<SyncConfig> = {}
  ) {
    this.stateManager = stateManager;
    this.transport = transport;
    this.config = {
      syncInterval: 100,
      batchSize: 50,
      retryAttempts: 3,
      retryDelay: 1000,
      heartbeatInterval: 30000,
      ...config
    };

    this.connectionState = {
      connected: false,
      lastSync: 0,
      lastHeartbeat: 0,
      reconnectAttempts: 0,
      latency: 0
    };

    this.setupTransportListeners();
    this.setupStateManagerListeners();
  }

  private setupTransportListeners(): void {
    this.transport.onConnect(() => {
      this.connectionState.connected = true;
      this.connectionState.reconnectAttempts = 0;
      this.startSyncLoop();
      this.startHeartbeat();
      this.emit({ type: 'connected', data: {} });
    });

    this.transport.onDisconnect(() => {
      this.connectionState.connected = false;
      this.stopSyncLoop();
      this.stopHeartbeat();
      this.emit({ type: 'disconnected', data: {} });
      this.attemptReconnect();
    });

    this.transport.onMessage((message: SyncMessage) => {
      this.handleMessage(message);
    });

    this.transport.onError((error: Error) => {
      this.emit({ type: 'error', data: { error } });
    });
  }

  private setupStateManagerListeners(): void {
    this.stateManager.addChangeListener((change) => {
      if (change.type === 'operation-applied') {
        this.queueOperation(change.data.operation);
      }
    });
  }

  private queueOperation(operation: Operation): void {
    const message: SyncMessage = {
      type: 'operations',
      timestamp: Date.now(),
      userId: operation.userId,
      data: { operations: [operation] },
      messageId: this.generateMessageId()
    };

    this.sendQueue.push(message);
  }

  private startSyncLoop(): void {
    if (this.syncInterval) return;

    this.syncInterval = setInterval(() => {
      this.processSendQueue();
    }, this.config.syncInterval);
  }

  private stopSyncLoop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private async processSendQueue(): Promise<void> {
    if (!this.connectionState.connected || this.sendQueue.length === 0) {
      return;
    }

    // Batch operations
    const batch = this.sendQueue.splice(0, this.config.batchSize);
    
    if (batch.length === 1) {
      const message = batch[0];
      if (message) {
        await this.sendMessage(message);
      }
    } else if (batch.length > 1) {
      // Combine multiple operations into one message
      const operations = batch.flatMap(msg => msg.data.operations || []);
      const firstMessage = batch[0];
      if (!firstMessage) return;
      
      const combinedMessage: SyncMessage = {
        type: 'operations',
        timestamp: Date.now(),
        userId: firstMessage.userId,
        data: { operations },
        messageId: this.generateMessageId()
      };

      await this.sendMessage(combinedMessage);
    }
  }

  private async sendMessage(message: SyncMessage): Promise<void> {
    if (!this.connectionState.connected) {
      // Re-queue message for later
      this.sendQueue.unshift(message);
      return;
    }

    try {
      const startTime = Date.now();
      await this.transport.send(message);
      
      if (message.messageId) {
        // Wait for acknowledgment
        await this.waitForAck(message.messageId);
      }

      this.connectionState.latency = Date.now() - startTime;
      this.connectionState.lastSync = Date.now();
      
    } catch (error) {
      logger.error('Failed to send message:', error as Error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.emit({ type: 'send-error', data: { message, error: errorObj } });
      
      // Re-queue for retry
      this.sendQueue.unshift(message);
    }
  }

  private waitForAck(messageId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ackQueue.delete(messageId);
        reject(new Error(`Message ${messageId} acknowledgment timeout`));
      }, 5000);

      this.ackQueue.set(messageId, { resolve, reject, timeout });
    });
  }

  private sendHeartbeat(): void {
    const heartbeatMessage: SyncMessage = {
      type: 'heartbeat',
      timestamp: Date.now(),
      userId: this.stateManager['userId'], // Access private field
      data: {
        latency: this.connectionState.latency,
        lastSync: this.connectionState.lastSync
      }
    };

    this.transport.send(heartbeatMessage).catch(error => {
      logger.error('Heartbeat failed:', error);
    });
  }

  private async handleMessage(message: SyncMessage): Promise<void> {
    switch (message.type) {
      case 'operations':
        await this.handleOperationsMessage(message);
        break;
      
      case 'snapshot':
        await this.handleSnapshotMessage(message);
        break;
      
      case 'heartbeat':
        await this.handleHeartbeatMessage(message);
        break;
      
      case 'ack':
        this.handleAckMessage(message);
        break;
    }

    // Send acknowledgment for messages that request it
    if (message.messageId && message.type !== 'ack') {
      const ackMessage: SyncMessage = {
        type: 'ack',
        timestamp: Date.now(),
        userId: this.stateManager['userId'],
        data: { messageId: message.messageId }
      };

      await this.transport.send(ackMessage);
    }
  }

  private async handleOperationsMessage(message: SyncMessage): Promise<void> {
    const operations: Operation[] = message.data.operations || [];
    
    for (const operation of operations) {
      this.stateManager.applyRemoteOperation(operation);
    }

    this.emit({ 
      type: 'operations-received', 
      data: { operations, fromUser: message.userId } 
    });
  }

  private async handleSnapshotMessage(message: SyncMessage): Promise<void> {
    const snapshot: StateSnapshot = message.data.snapshot;
    this.stateManager.loadSnapshot(snapshot);
    
    this.emit({ 
      type: 'snapshot-received', 
      data: { snapshot, fromUser: message.userId } 
    });
  }

  private async handleHeartbeatMessage(message: SyncMessage): Promise<void> {
    this.connectionState.lastHeartbeat = message.timestamp;
    
    // Respond with our own heartbeat
    const responseMessage: SyncMessage = {
      type: 'heartbeat',
      timestamp: Date.now(),
      userId: this.stateManager['userId'],
      data: {
        latency: this.connectionState.latency,
        lastSync: this.connectionState.lastSync,
        responseToHeartbeat: message.timestamp
      }
    };

    await this.transport.send(responseMessage);
  }

  private handleAckMessage(message: SyncMessage): void {
    const messageId = message.data.messageId;
    const ackEntry = this.ackQueue.get(messageId);
    
    if (ackEntry) {
      clearTimeout(ackEntry.timeout);
      ackEntry.resolve();
      this.ackQueue.delete(messageId);
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (this.connectionState.reconnectAttempts >= this.config.retryAttempts) {
      this.emit({ type: 'max-reconnect-attempts', data: {} });
      return;
    }

    this.connectionState.reconnectAttempts++;
    
    await new Promise(resolve => 
      setTimeout(resolve, this.config.retryDelay * this.connectionState.reconnectAttempts)
    );

    try {
      await this.transport.connect();
    } catch (error) {
      logger.error('Reconnection failed:', error as Error);
      this.attemptReconnect();
    }
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Connect to remote sync service
   */
  async connect(): Promise<void> {
    await this.transport.connect();
  }

  /**
   * Disconnect from remote sync service
   */
  async disconnect(): Promise<void> {
    this.stopSyncLoop();
    this.stopHeartbeat();
    await this.transport.disconnect();
  }

  /**
   * Force synchronization
   */
  async forceSyncAll(): Promise<void> {
    // Send current state snapshot
    const snapshot = this.stateManager.createSnapshot();
    const message: SyncMessage = {
      type: 'snapshot',
      timestamp: Date.now(),
      userId: this.stateManager['userId'],
      data: { snapshot }
    };

    await this.sendMessage(message);
  }

  /**
   * Request full state from server
   */
  async requestFullSync(): Promise<void> {
    const message: SyncMessage = {
      type: 'operations',
      timestamp: Date.now(),
      userId: this.stateManager['userId'],
      data: { requestFullSync: true },
      messageId: this.generateMessageId()
    };

    await this.sendMessage(message);
  }

  /**
   * Get connection status
   */
  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Get sync statistics
   */
  getSyncStats(): {
    queueSize: number;
    pendingAcks: number;
    averageLatency: number;
    syncRate: number;
  } {
    return {
      queueSize: this.sendQueue.length,
      pendingAcks: this.ackQueue.size,
      averageLatency: this.connectionState.latency,
      syncRate: 1000 / this.config.syncInterval
    };
  }

  // Event System
  addEventListener(listener: (event: SyncEvent) => void): void {
    this.eventListeners.push(listener);
  }

  removeEventListener(listener: (event: SyncEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private emit(event: SyncEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        logger.error('Sync event listener error:', error as Error);
      }
    });
  }
}

// Transport Interface (implement with Socket.IO, WebSocket, etc.)
export interface SyncTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(message: SyncMessage): Promise<void>;
  onConnect(callback: () => void): void;
  onDisconnect(callback: () => void): void;
  onMessage(callback: (message: SyncMessage) => void): void;
  onError(callback: (error: Error) => void): void;
}

// Event Types
export type SyncEvent =
  | { type: 'connected'; data: Record<string, unknown>}
  | { type: 'disconnected'; data: Record<string, unknown>}
  | { type: 'operations-received'; data: { operations: Operation[]; fromUser: string } }
  | { type: 'snapshot-received'; data: { snapshot: StateSnapshot; fromUser: string } }
  | { type: 'send-error'; data: { message: SyncMessage; error: Error } }
  | { type: 'error'; data: { error: Error } }
  | { type: 'max-reconnect-attempts'; data: Record<string, unknown>};
