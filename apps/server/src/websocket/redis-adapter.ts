import { createClient, RedisClientType } from 'redis';
import { EventEmitter } from 'events';
import { logger } from '@vtt/logging';

export interface RedisAdapterOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  requestsTimeout?: number;
}

export interface SessionInfo {
  serverId: string;
  clientId: string;
  userId?: string;
  gameId?: string;
  connectedAt: Date;
  lastActivity: Date;
}

export class RedisWebSocketAdapter extends EventEmitter {
  private pub: RedisClientType;
  private sub: RedisClientType;
  private client: RedisClientType;
  private serverId: string;
  private keyPrefix: string;
  private requestsTimeout: number;
  private heartbeatInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(options: RedisAdapterOptions = {}) {
    super();
    
    this.serverId = `server-${process.pid}-${Date.now()}`;
    this.keyPrefix = options.keyPrefix || 'vtt:ws:';
    this.requestsTimeout = options.requestsTimeout || 5000;

    const redisConfig: any = {
      socket: {
        host: options.host || process.env.REDIS_HOST || 'localhost',
        port: options.port || parseInt(process.env.REDIS_PORT || '6379'),
      },
      database: options.db || 0,
    };
    
    // Only add password if it exists (support both REDIS_PASSWORD and REDIS_AUTH_TOKEN)
    const pwd = options.password || process.env.REDIS_PASSWORD || process.env.REDIS_AUTH_TOKEN;
    if (pwd) {
      redisConfig.password = pwd;
    }

    // Create Redis clients
    this.pub = createClient(redisConfig);
    this.sub = createClient(redisConfig);
    this.client = createClient(redisConfig);
  }

  async connect(): Promise<void> {
    try {
      await Promise.all([
        this.pub.connect(),
        this.sub.connect(),
        this.client.connect()
      ]);

      // Subscribe to broadcast channel
      await this.sub.subscribe(`${this.keyPrefix}broadcast`, (message) => {
        this.handleBroadcast(message);
      });

      // Subscribe to server-specific channel
      await this.sub.subscribe(`${this.keyPrefix}server:${this.serverId}`, (message) => {
        this.handleDirectMessage(message);
      });

      // Start heartbeat
      this.startHeartbeat();
      
      // Start cleanup interval
      this.startCleanup();

      logger.info(`Redis WebSocket adapter connected (serverId: ${this.serverId})`);
    } catch (error) {
      logger.error('Failed to connect Redis WebSocket adapter:', error as Error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    await Promise.all([
      this.pub.quit(),
      this.sub.quit(),
      this.client.quit()
    ]);

    logger.info('Redis WebSocket adapter disconnected');
  }

  // Session Management
  async registerSession(clientId: string, info: Partial<SessionInfo>): Promise<void> {
    const sessionKey = `${this.keyPrefix}session:${clientId}`;
    const sessionData: SessionInfo = {
      serverId: this.serverId,
      clientId,
      connectedAt: new Date(),
      lastActivity: new Date()
    } as SessionInfo;
    
    if (info.userId) {sessionData.userId = info.userId;}
    if (info.gameId) {sessionData.gameId = info.gameId;}

    await this.client.set(sessionKey, JSON.stringify(sessionData), {
      EX: 300 // Expire after 5 minutes of inactivity
    });

    // Add to server's session set
    await this.client.sAdd(`${this.keyPrefix}server:${this.serverId}:sessions`, clientId);

    // Add to game room if applicable
    if (info.gameId) {
      await this.client.sAdd(`${this.keyPrefix}game:${info.gameId}:sessions`, clientId);
    }

    // Add to user's session set if applicable
    if (info.userId) {
      await this.client.sAdd(`${this.keyPrefix}user:${info.userId}:sessions`, clientId);
    }
  }

  async unregisterSession(clientId: string): Promise<void> {
    const sessionKey = `${this.keyPrefix}session:${clientId}`;
    
    // Get session info before deletion
    const sessionData = await this.client.get(sessionKey);
    if (sessionData) {
      const session: SessionInfo = JSON.parse(sessionData);
      
      // Remove from game room
      if (session.gameId) {
        await this.client.sRem(`${this.keyPrefix}game:${session.gameId}:sessions`, clientId);
      }
      
      // Remove from user's session set
      if (session.userId) {
        await this.client.sRem(`${this.keyPrefix}user:${session.userId}:sessions`, clientId);
      }
    }

    // Remove from server's session set
    await this.client.sRem(`${this.keyPrefix}server:${this.serverId}:sessions`, clientId);
    
    // Delete session
    await this.client.del(sessionKey);
  }

  async updateSessionActivity(clientId: string): Promise<void> {
    const sessionKey = `${this.keyPrefix}session:${clientId}`;
    const sessionData = await this.client.get(sessionKey);
    
    if (sessionData) {
      const session: SessionInfo = JSON.parse(sessionData);
      session.lastActivity = new Date();
      
      await this.client.set(sessionKey, JSON.stringify(session), {
        EX: 300 // Reset expiration
      });
    }
  }

  async getSession(clientId: string): Promise<SessionInfo | null> {
    const sessionKey = `${this.keyPrefix}session:${clientId}`;
    const sessionData = await this.client.get(sessionKey);
    
    if (sessionData) {
      return JSON.parse(sessionData);
    }
    
    return null;
  }

  async getGameSessions(gameId: string): Promise<string[]> {
    return this.client.sMembers(`${this.keyPrefix}game:${gameId}:sessions`);
  }

  async getUserSessions(userId: string): Promise<string[]> {
    return this.client.sMembers(`${this.keyPrefix}user:${userId}:sessions`);
  }

  // Message Broadcasting
  async broadcastToGame(gameId: string, message: any, excludeClientId?: string): Promise<void> {
    const payload = {
      type: 'game_broadcast',
      gameId,
      message,
      excludeClientId,
      fromServer: this.serverId
    };

    await this.pub.publish(`${this.keyPrefix}broadcast`, JSON.stringify(payload));
  }

  async broadcastToUser(userId: string, message: any): Promise<void> {
    const payload = {
      type: 'user_broadcast',
      userId,
      message,
      fromServer: this.serverId
    };

    await this.pub.publish(`${this.keyPrefix}broadcast`, JSON.stringify(payload));
  }

  async sendToClient(clientId: string, message: any): Promise<void> {
    const session = await this.getSession(clientId);
    
    if (session) {
      const payload = {
        type: 'direct_message',
        clientId,
        message,
        fromServer: this.serverId
      };

      if (session.serverId === this.serverId) {
        // Local delivery
        this.emit('message', clientId, message);
      } else {
        // Remote delivery
        await this.pub.publish(`${this.keyPrefix}server:${session.serverId}`, JSON.stringify(payload));
      }
    }
  }

  // Sticky Session Support
  async getClientServer(clientId: string): Promise<string | null> {
    const session = await this.getSession(clientId);
    return session ? session.serverId : null;
  }

  async isLocalClient(clientId: string): Promise<boolean> {
    const serverId = await this.getClientServer(clientId);
    return serverId === this.serverId;
  }

  // Server Health & Discovery
  private startHeartbeat(): void {
    const heartbeatKey = `${this.keyPrefix}heartbeat:${this.serverId}`;
    
    const beat = async () => {
      const serverInfo = {
        serverId: this.serverId,
        pid: process.pid,
        timestamp: Date.now(),
        sessions: await this.client.sCard(`${this.keyPrefix}server:${this.serverId}:sessions`)
      };
      
      await this.client.set(heartbeatKey, JSON.stringify(serverInfo), {
        EX: 30 // Expire after 30 seconds
      });
    };

    // Initial heartbeat
    beat();
    
    // Regular heartbeat every 10 seconds
    this.heartbeatInterval = setInterval(beat, 10000);
  }

  private startCleanup(): void {
    const cleanup = async () => {
      try {
        // Get all heartbeat keys
        const pattern = `${this.keyPrefix}heartbeat:*`;
        const keys = await this.client.keys(pattern);
        
        for (const key of keys) {
          const data = await this.client.get(key);
          if (!data) {continue;}
          
          const serverInfo = JSON.parse(data);
          const age = Date.now() - serverInfo.timestamp;
          
          // If server hasn't sent heartbeat in 60 seconds, consider it dead
          if (age > 60000) {
            const deadServerId = serverInfo.serverId;
            logger.warn(`Cleaning up dead server: ${deadServerId}`);
            
            // Clean up sessions from dead server
            const sessionsKey = `${this.keyPrefix}server:${deadServerId}:sessions`;
            const sessions = await this.client.sMembers(sessionsKey);
            
            for (const sessionId of sessions) {
              await this.unregisterSession(sessionId);
            }
            
            // Remove server's session set
            await this.client.del(sessionsKey);
            
            // Remove heartbeat
            await this.client.del(key);
          }
        }
      } catch (error) {
        logger.error('Cleanup error:', error as Error);
      }
    };

    // Run cleanup every 30 seconds
    this.cleanupInterval = setInterval(cleanup, 30000);
  }

  private handleBroadcast(message: string): void {
    try {
      const payload = JSON.parse(message);
      
      // Ignore messages from self
      if (payload.fromServer === this.serverId) {
        return;
      }

      switch (payload.type) {
        case 'game_broadcast':
          this.emit('game_broadcast', payload.gameId, payload.message, payload.excludeClientId);
          break;
        
        case 'user_broadcast':
          this.emit('user_broadcast', payload.userId, payload.message);
          break;
      }
    } catch (error) {
      logger.error('Failed to handle broadcast:', error as Error);
    }
  }

  private handleDirectMessage(message: string): void {
    try {
      const payload = JSON.parse(message);
      
      if (payload.type === 'direct_message') {
        this.emit('message', payload.clientId, payload.message);
      }
    } catch (error) {
      logger.error('Failed to handle direct message:', error as Error);
    }
  }

  // Statistics
  async getStats(): Promise<{
    serverId: string;
    localSessions: number;
    totalSessions: number;
    activeGames: number;
    activeUsers: number;
    servers: number;
  }> {
    const [localSessions, gameKeys, userKeys, serverKeys] = await Promise.all([
      this.client.sCard(`${this.keyPrefix}server:${this.serverId}:sessions`),
      this.client.keys(`${this.keyPrefix}game:*:sessions`),
      this.client.keys(`${this.keyPrefix}user:*:sessions`),
      this.client.keys(`${this.keyPrefix}heartbeat:*`)
    ]);

    let totalSessions = 0;
    const sessionKeys = await this.client.keys(`${this.keyPrefix}session:*`);
    totalSessions = sessionKeys.length;

    return {
      serverId: this.serverId,
      localSessions,
      totalSessions,
      activeGames: gameKeys.length,
      activeUsers: userKeys.length,
      servers: serverKeys.length
    };
  }
}

// Singleton instance
let adapter: RedisWebSocketAdapter | null = null;

export function getRedisAdapter(options?: RedisAdapterOptions): RedisWebSocketAdapter {
  if (!adapter) {
    adapter = new RedisWebSocketAdapter(options);
  }
  return adapter;
}
