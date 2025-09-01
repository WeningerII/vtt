import { EventEmitter } from 'events';
import { SessionManager, SessionAction, UserPresence } from './SessionManager';
import { ConflictResolver, OperationalTransform } from './ConflictResolver';
import { logger } from '@vtt/logging';

export interface SyncMessage {
  id: string;
  type: 'action' | 'presence' | 'heartbeat' | 'sync_request' | 'sync_response';
  sessionId: string;
  userId: string;
  data: any;
  timestamp: Date;
  version?: number;
}

export interface ConnectionState {
  userId: string;
  sessionId: string;
  connectionId: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  lastHeartbeat: Date;
  latency: number;
  version: number;
}

export interface SyncState {
  sessionId: string;
  version: number;
  checksum: string;
  lastSyncTime: Date;
  pendingActions: SessionAction[];
  conflictedActions: SessionAction[];
}

export class RealtimeSync extends EventEmitter {
  private sessionManager: SessionManager;
  private conflictResolver: ConflictResolver;
  private connections: Map<string, ConnectionState> = new Map();
  private syncStates: Map<string, SyncState> = new Map();
  private messageQueue: Map<string, SyncMessage[]> = new Map();
  private heartbeatInterval: NodeJS.Timeout;
  private syncInterval: NodeJS.Timeout;

  constructor(sessionManager: SessionManager, conflictResolver: ConflictResolver) {
    super();
    this.sessionManager = sessionManager;
    this.conflictResolver = conflictResolver;
    this.setMaxListeners(100);

    // Start heartbeat and sync intervals
    this.heartbeatInterval = setInterval(() => this.processHeartbeats(), 5000);
    this.syncInterval = setInterval(() => this.processSyncStates(), 1000);

    this.setupEventListeners();
  }

  /**
   * Register a new connection
   */
  registerConnection(userId: string, sessionId: string, connectionId: string): boolean {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      return false;
    }

    const connection: ConnectionState = {
      userId,
      sessionId,
      connectionId,
      status: 'connecting',
      lastHeartbeat: new Date(),
      latency: 0,
      version: 0,
    };

    this.connections.set(connectionId, connection);
    
    // Initialize sync state for session if not exists
    if (!this.syncStates.has(sessionId)) {
      this.syncStates.set(sessionId, {
        sessionId,
        version: 0,
        checksum: '',
        lastSyncTime: new Date(),
        pendingActions: [],
        conflictedActions: [],
      });
    }

    this.emit('connectionRegistered', connection);
    logger.info(`Connection registered: ${connectionId} for user ${userId} in session ${sessionId}`);
    
    return true;
  }

  /**
   * Handle incoming sync message
   */
  handleMessage(connectionId: string, message: SyncMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      logger.warn(`Message received from unregistered connection: ${connectionId}`);
      return;
    }

    connection.lastHeartbeat = new Date();

    switch (message.type) {
      case 'action':
        this.handleActionMessage(connection, message);
        break;
      case 'presence':
        this.handlePresenceMessage(connection, message);
        break;
      case 'heartbeat':
        this.handleHeartbeatMessage(connection, message);
        break;
      case 'sync_request':
        this.handleSyncRequest(connection, message);
        break;
      case 'sync_response':
        this.handleSyncResponse(connection, message);
        break;
    }
  }

  /**
   * Broadcast message to all connections in a session
   */
  broadcastToSession(sessionId: string, message: SyncMessage, excludeConnectionId?: string): void {
    const sessionConnections = Array.from(this.connections.values())
      .filter(conn => conn.sessionId === sessionId && conn.connectionId !== excludeConnectionId);

    for (const connection of sessionConnections) {
      this.sendMessage(connection.connectionId, message);
    }
  }

  /**
   * Send message to specific connection
   */
  sendMessage(connectionId: string, message: SyncMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    // Queue message if connection is not ready
    if (connection.status !== 'connected') {
      this.queueMessage(connectionId, message);
      return;
    }

    this.emit('sendMessage', connectionId, message);
  }

  /**
   * Disconnect a connection
   */
  disconnect(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    connection.status = 'disconnected';
    
    // Update user presence
    this.sessionManager.updateUserPresence(
      connection.userId,
      connection.sessionId,
      'disconnected'
    );

    // Clean up queued messages
    this.messageQueue.delete(connectionId);

    this.connections.delete(connectionId);
    this.emit('connectionDisconnected', connection);
    logger.info(`Connection disconnected: ${connectionId}`);
  }

  /**
   * Get connection state
   */
  getConnection(connectionId: string): ConnectionState | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections for a session
   */
  getSessionConnections(sessionId: string): ConnectionState[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.sessionId === sessionId);
  }

  /**
   * Force sync for a session
   */
  forceSync(sessionId: string): void {
    const syncState = this.syncStates.get(sessionId);
    if (!syncState) {
      return;
    }

    const syncMessage: SyncMessage = {
      id: this.generateMessageId(),
      type: 'sync_request',
      sessionId,
      userId: 'system',
      data: {
        version: syncState.version,
        checksum: syncState.checksum,
      },
      timestamp: new Date(),
    };

    this.broadcastToSession(sessionId, syncMessage);
  }

  private setupEventListeners(): void {
    // Listen to session manager events
    this.sessionManager.on('actionApplied', (action, sessionId) => {
      this.handleActionApplied(action, sessionId);
    });

    this.sessionManager.on('presenceUpdated', (presence) => {
      this.handlePresenceUpdated(presence);
    });

    // Listen to conflict resolver events
    this.conflictResolver.on('lockAcquired', (resourceId, userId) => {
      this.broadcastLockEvent('acquired', resourceId, userId);
    });

    this.conflictResolver.on('lockReleased', (resourceId, userId) => {
      this.broadcastLockEvent('released', resourceId, userId);
    });
  }

  private handleActionMessage(connection: ConnectionState, message: SyncMessage): void {
    const action: SessionAction = {
      id: message.id,
      type: message.data.type,
      userId: connection.userId,
      sessionId: connection.sessionId,
      data: message.data.payload,
      timestamp: message.timestamp,
      version: message.version || 0,
    };

    // Submit action through session manager
    const resolution = this.sessionManager.submitAction(action);
    
    if (resolution) {
      if (resolution.resolution === 'reject') {
        // Send rejection back to sender
        const rejectionMessage: SyncMessage = {
          id: this.generateMessageId(),
          type: 'action',
          sessionId: connection.sessionId,
          userId: 'system',
          data: {
            type: 'action_rejected',
            originalActionId: action.id,
            reason: resolution.reason,
          },
          timestamp: new Date(),
        };
        this.sendMessage(connection.connectionId, rejectionMessage);
      } else {
        // Broadcast successful action to other connections
        this.broadcastToSession(connection.sessionId, message, connection.connectionId);
      }
    }
  }

  private handlePresenceMessage(connection: ConnectionState, message: SyncMessage): void {
    this.sessionManager.updateUserPresence(
      connection.userId,
      connection.sessionId,
      'active',
      message.data
    );

    // Broadcast presence update to other connections
    this.broadcastToSession(connection.sessionId, message, connection.connectionId);
  }

  private handleHeartbeatMessage(connection: ConnectionState, message: SyncMessage): void {
    const now = Date.now();
    const messageTime = message.timestamp.getTime();
    connection.latency = now - messageTime;
    connection.status = 'connected';

    // Send heartbeat response
    const response: SyncMessage = {
      id: this.generateMessageId(),
      type: 'heartbeat',
      sessionId: connection.sessionId,
      userId: 'system',
      data: {
        serverTime: now,
        latency: connection.latency,
      },
      timestamp: new Date(),
    };

    this.sendMessage(connection.connectionId, response);
  }

  private handleSyncRequest(connection: ConnectionState, message: SyncMessage): void {
    const syncState = this.syncStates.get(connection.sessionId);
    if (!syncState) {
      return;
    }

    const clientVersion = message.data.version || 0;
    const versionDiff = syncState.version - clientVersion;

    if (versionDiff > 0) {
      // Client is behind, send missing actions
      const missingActions = syncState.pendingActions.slice(-versionDiff);
      
      const response: SyncMessage = {
        id: this.generateMessageId(),
        type: 'sync_response',
        sessionId: connection.sessionId,
        userId: 'system',
        data: {
          version: syncState.version,
          checksum: syncState.checksum,
          actions: missingActions,
        },
        timestamp: new Date(),
      };

      this.sendMessage(connection.connectionId, response);
    }
  }

  private handleSyncResponse(connection: ConnectionState, message: SyncMessage): void {
    const { version, actions } = message.data;
    
    // Apply received actions
    for (const action of actions) {
      this.sessionManager.submitAction(action);
    }

    connection.version = version;
  }

  private handleActionApplied(action: SessionAction, sessionId: string): void {
    const syncState = this.syncStates.get(sessionId);
    if (!syncState) {
      return;
    }

    // Update sync state
    syncState.version++;
    syncState.pendingActions.push(action);
    syncState.lastSyncTime = new Date();
    
    // Keep only last 100 actions for sync
    if (syncState.pendingActions.length > 100) {
      syncState.pendingActions = syncState.pendingActions.slice(-100);
    }

    // Update checksum (simplified)
    syncState.checksum = this.calculateChecksum(syncState.pendingActions);
  }

  private handlePresenceUpdated(presence: UserPresence): void {
    const presenceMessage: SyncMessage = {
      id: this.generateMessageId(),
      type: 'presence',
      sessionId: presence.sessionId,
      userId: presence.userId,
      data: presence,
      timestamp: new Date(),
    };

    this.broadcastToSession(presence.sessionId, presenceMessage);
  }

  private broadcastLockEvent(event: 'acquired' | 'released', resourceId: string, userId: string): void {
    // Find session for this resource (simplified - would need proper resource-to-session mapping)
    for (const [sessionId, syncState] of this.syncStates.entries()) {
      const lockMessage: SyncMessage = {
        id: this.generateMessageId(),
        type: 'action',
        sessionId,
        userId: 'system',
        data: {
          type: `lock_${event}`,
          resourceId,
          userId,
        },
        timestamp: new Date(),
      };

      this.broadcastToSession(sessionId, lockMessage);
    }
  }

  private queueMessage(connectionId: string, message: SyncMessage): void {
    if (!this.messageQueue.has(connectionId)) {
      this.messageQueue.set(connectionId, []);
    }
    
    const queue = this.messageQueue.get(connectionId)!;
    queue.push(message);
    
    // Limit queue size
    if (queue.length > 50) {
      queue.shift();
    }
  }

  private processHeartbeats(): void {
    const now = Date.now();
    const timeout = 30000; // 30 seconds

    for (const [connectionId, connection] of this.connections.entries()) {
      const timeSinceHeartbeat = now - connection.lastHeartbeat.getTime();
      
      if (timeSinceHeartbeat > timeout) {
        logger.warn(`Connection timeout: ${connectionId}`);
        this.disconnect(connectionId);
      }
    }
  }

  private processSyncStates(): void {
    for (const [sessionId, syncState] of this.syncStates.entries()) {
      const timeSinceSync = Date.now() - syncState.lastSyncTime.getTime();
      
      // Force sync if no activity for 10 seconds
      if (timeSinceSync > 10000 && syncState.pendingActions.length > 0) {
        this.forceSync(sessionId);
      }
    }
  }

  private calculateChecksum(actions: SessionAction[]): string {
    // Simplified checksum calculation
    const data = actions.map(a => `${a.id}:${a.version}`).join('|');
    return Buffer.from(data).toString('base64').slice(0, 16);
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    // Disconnect all connections
    for (const connectionId of this.connections.keys()) {
      this.disconnect(connectionId);
    }
  }
}
