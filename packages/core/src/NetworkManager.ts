/**
 * Unified Network Manager - Consolidates networking and state synchronization
 * Provides real-time communication, message routing, and state sync across all VTT systems
 */

import { EventEmitter, SystemEvents } from './EventEmitter';
import { logger } from '@vtt/logging';
import { 
  NetworkManager as INetworkManager,
  NetworkMessage,
  MessageHandler,
  ConnectionState,
  ConnectionOptions,
  Disposable 
} from './SharedInterfaces';

export interface NetworkConfig {
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  messageTimeout: number;
  bufferSize: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}

export interface MessageRoute {
  pattern: string | RegExp;
  handler: MessageHandler;
  priority: number;
  once?: boolean;
}

export interface NetworkStats {
  totalMessages: number;
  messagesPerSecond: number;
  bytesTransmitted: number;
  bytesReceived: number;
  averageLatency: number;
  connectionUptime: number;
  reconnectCount: number;
  errorCount: number;
}

export interface QueuedMessage {
  message: NetworkMessage;
  timestamp: number;
  attempts: number;
  priority: number;
}

export class UnifiedNetworkManager extends EventEmitter<SystemEvents> implements INetworkManager {
  private config: NetworkConfig;
  private ws: WebSocket | undefined;
  private connectionState: ConnectionState = 'disconnected';
  private messageRoutes = new Map<string, MessageRoute[]>();
  private messageQueue: QueuedMessage[] = [];
  private pendingMessages = new Map<string, { resolve: (_...args: any[]) => any; reject: (_...args: any[]) => any; timeout: NodeJS.Timeout }>();
  
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private heartbeatTimer: NodeJS.Timeout | undefined;
  private lastHeartbeat = 0;
  private latencyMeasurements: number[] = [];
  private connectionStartTime = 0;
  
  private stats: NetworkStats = {
    totalMessages: 0,
    messagesPerSecond: 0,
    bytesTransmitted: 0,
    bytesReceived: 0,
    averageLatency: 0,
    connectionUptime: 0,
    reconnectCount: 0,
    errorCount: 0
  };

  constructor(config: Partial<NetworkConfig> = {}) {
    super();
    
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      messageTimeout: 10000,
      bufferSize: 64 * 1024, // 64KB
      compressionEnabled: false,
      encryptionEnabled: false,
      ...config
    };
  }

  /**
   * Connect to the server
   */
  async connect(url: string, options: ConnectionOptions = {}): Promise<void> {
    if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
      return;
    }

    this.setConnectionState('connecting');
    this.connectionStartTime = Date.now();

    try {
      await this.establishConnection(url, options);
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.processMessageQueue();
    } catch (error) {
      this.handleConnectionError(error as Error, options);
    }
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    this.clearTimers();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = undefined as WebSocket | undefined;
    }
    
    this.setConnectionState('disconnected');
    this.messageQueue = [];
    this.pendingMessages.clear();
  }

  /**
   * Send a message
   */
  send(message: NetworkMessage): void {
    if (!message.id) {
      message.id = this.generateMessageId();
    }
    
    if (!message.timestamp) {
      message.timestamp = Date.now();
    }

    if (this.connectionState !== 'connected') {
      this.queueMessage(message);
      return;
    }

    this.sendMessage(message);
  }

  /**
   * Send message and wait for response
   */
  async sendAndWait<T = any>(message: NetworkMessage, timeout?: number): Promise<T> {
    return new Promise((_resolve, __reject) => {
      if (!message.id) {
        message.id = this.generateMessageId();
      }

      const timeoutMs = timeout || this.config.messageTimeout;
      const timeoutHandle = setTimeout(() => {
        this.pendingMessages.delete(message.id!);
        reject(new Error(`Message timeout: ${message.id}`));
      }, timeoutMs);

      this.pendingMessages.set(message.id, { resolve, reject, timeout: timeoutHandle });
      this.send(message);
    });
  }

  /**
   * Subscribe to message type
   */
  subscribe(type: string, handler: MessageHandler): () => void {
    if (!this.messageRoutes.has(type)) {
      this.messageRoutes.set(type, []);
    }

    const route: MessageRoute = {
      pattern: type,
      handler,
      priority: 0
    };

    const routes = this.messageRoutes.get(type)!;
    routes.push(route);
    routes.sort((_a, _b) => b.priority - a.priority);

    return () => {
      const index = routes.indexOf(route);
      if (index >= 0) {
        routes.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe once to message type
   */
  subscribeOnce(type: string, handler: MessageHandler): () => void {
    const unsubscribe = this.subscribe(_type, (message) => {
      handler(message);
      unsubscribe();
    });
    return unsubscribe;
  }

  /**
   * Register message route with pattern
   */
  registerRoute(pattern: string | RegExp, handler: MessageHandler, priority: number = 0): () => void {
    const routeKey = pattern.toString();
    
    if (!this.messageRoutes.has(routeKey)) {
      this.messageRoutes.set(routeKey, []);
    }

    const route: MessageRoute = {
      pattern,
      handler,
      priority
    };

    const routes = this.messageRoutes.get(routeKey)!;
    routes.push(route);
    routes.sort((_a, _b) => b.priority - a.priority);

    return () => {
      const index = routes.indexOf(route);
      if (index >= 0) {
        routes.splice(index, 1);
      }
    };
  }

  /**
   * Broadcast message to all subscribers
   */
  broadcast(message: NetworkMessage): void {
    this.routeMessage(message);
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get current latency
   */
  getLatency(): number {
    return this.latencyMeasurements.length > 0 
      ? this.latencyMeasurements.reduce((_a, _b) => a + b) / this.latencyMeasurements.length 
      : 0;
  }

  /**
   * Get network statistics
   */
  getStats(): NetworkStats {
    const now = Date.now();
    this.stats.connectionUptime = this.connectionStartTime > 0 ? now - this.connectionStartTime : 0;
    this.stats.averageLatency = this.getLatency();
    return { ...this.stats };
  }

  /**
   * Enable message compression
   */
  setCompression(enabled: boolean): void {
    this.config.compressionEnabled = enabled;
  }

  /**
   * Enable message encryption
   */
  setEncryption(enabled: boolean): void {
    this.config.encryptionEnabled = enabled;
  }

  /**
   * Get queued messages count
   */
  getQueueSize(): number {
    return this.messageQueue.length;
  }

  /**
   * Clear message queue
   */
  clearQueue(): void {
    this.messageQueue = [];
  }

  /**
   * Dispose of the network manager
   */
  dispose(): void {
    this.disconnect();
    this.messageRoutes.clear();
    this.removeAllListeners();
  }

  // Private helper methods

  private async establishConnection(url: string, options: ConnectionOptions): Promise<void> {
    return new Promise((_resolve, __reject) => {
      try {
        this.ws = new WebSocket(url);
        
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, options.timeout || 10000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.setConnectionState('connected');
          resolve();
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          this.handleDisconnection(event);
        };

        this.ws.onerror = (_error) => {
          clearTimeout(timeout);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          this.handleIncomingMessage(event);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  private handleConnectionError(error: Error, options: ConnectionOptions): void {
    this.stats.errorCount++;
    logger.error('Connection error:', error);
    
    if (options.reconnect !== false && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      this.setConnectionState('error');
    }
  }

  private handleDisconnection(event: CloseEvent): void {
    if (event.wasClean) {
      this.setConnectionState('disconnected');
    } else {
      this.setConnectionState('error');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    this.reconnectAttempts++;
    this.stats.reconnectCount++;
    this.setConnectionState('reconnecting');
    
    const delay = this.config.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined as NodeJS.Timeout | undefined;
      // Would reconnect with stored URL and options
    }, delay);
  }

  private handleIncomingMessage(event: MessageEvent): void {
    try {
      let data = event.data;
      
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }

      const message: NetworkMessage = data;
      this.stats.totalMessages++;
      this.stats.bytesReceived += event.data.length;

      // Handle response to pending request
      if (message.id && this.pendingMessages.has(message.id)) {
        const pending = this.pendingMessages.get(message.id)!;
        clearTimeout(pending.timeout);
        this.pendingMessages.delete(message.id);
        pending.resolve(message.data);
        return;
      }

      // Handle heartbeat response
      if (message.type === 'heartbeat_response') {
        this.handleHeartbeatResponse(message);
        return;
      }

      // Route message to handlers
      this.routeMessage(message);

    } catch (error) {
      logger.error('Failed to parse incoming message:', error);
      this.stats.errorCount++;
    }
  }

  private routeMessage(message: NetworkMessage): void {
    let handled = false;

    // Check exact type matches first
    const exactRoutes = this.messageRoutes.get(message.type);
    if (exactRoutes) {
      for (const route of exactRoutes) {
        try {
          route.handler(message);
          handled = true;
          
          if (route.once) {
            const routes = this.messageRoutes.get(message.type)!;
            const index = routes.indexOf(route);
            if (index >= 0) {
              routes.splice(index, 1);
            }
          }
        } catch (error) {
          logger.error(`Error in message handler for ${message.type}:`, error);
        }
      }
    }

    // Check pattern matches
    for (const [key, routes] of this.messageRoutes) {
      if (key === message.type) continue; // Already handled above
      
      for (const route of routes) {
        if (route.pattern instanceof RegExp && route.pattern.test(message.type)) {
          try {
            route.handler(message);
            handled = true;
          } catch (error) {
            logger.error(`Error in pattern handler ${route.pattern}:`, error);
          }
        }
      }
    }

    if (!handled) {
      logger.warn(`Unhandled message type: ${message.type}`);
    }
  }

  private sendMessage(message: NetworkMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.queueMessage(message);
      return;
    }

    try {
      let data = JSON.stringify(message);
      
      if (this.config.compressionEnabled) {
        data = this.compressData(data);
      }
      
      if (this.config.encryptionEnabled) {
        data = this.encryptData(data);
      }

      this.ws.send(data);
      this.stats.bytesTransmitted += data.length;
      
    } catch (error) {
      logger.error('Failed to send message:', error);
      this.queueMessage(message);
      this.stats.errorCount++;
    }
  }

  private queueMessage(message: NetworkMessage, priority: number = 0): void {
    const queuedMessage: QueuedMessage = {
      message,
      timestamp: Date.now(),
      attempts: 0,
      priority
    };

    this.messageQueue.push(queuedMessage);
    this.messageQueue.sort((_a, _b) => b.priority - a.priority);

    // Limit queue size
    if (this.messageQueue.length > 1000) {
      this.messageQueue = this.messageQueue.slice(0, 1000);
    }
  }

  private processMessageQueue(): void {
    if (this.connectionState !== 'connected' || this.messageQueue.length === 0) {
      return;
    }

    const messagesToSend = this.messageQueue.splice(0, 10); // Send up to 10 at once
    
    for (const queuedMessage of messagesToSend) {
      queuedMessage.attempts++;
      this.sendMessage(queuedMessage.message);
    }

    // Schedule next batch if queue not empty
    if (this.messageQueue.length > 0) {
      setTimeout(() => this.processMessageQueue(), 100);
    }
  }

  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      const _previousState = this.connectionState;
      this.connectionState = state;
      this.emit('ready', undefined); // Generic event for connection state changes
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.connectionState === 'connected') {
        this.sendHeartbeat();
      }
    }, this.config.heartbeatInterval);
  }

  private sendHeartbeat(): void {
    const heartbeat: NetworkMessage = {
      type: 'heartbeat',
      data: { timestamp: Date.now() },
      timestamp: Date.now()
    };
    
    this.lastHeartbeat = Date.now();
    this.send(heartbeat);
  }

  private handleHeartbeatResponse(message: NetworkMessage): void {
    if (message.data?.timestamp) {
      const latency = Date.now() - message.data.timestamp;
      this.latencyMeasurements.push(latency);
      
      // Keep only last 10 measurements
      if (this.latencyMeasurements.length > 10) {
        this.latencyMeasurements.shift();
      }
    }
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined as NodeJS.Timeout | undefined;
    }
  }

  private compressData(data: string): string {
    // Placeholder for compression - would use actual compression library
    return data;
  }

  private encryptData(data: string): string {
    // Placeholder for encryption - would use actual encryption
    return btoa(data);
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const _networkManager = new UnifiedNetworkManager();
