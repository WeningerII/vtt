import { Server as SocketIOServer } from 'socket.io';
import { logger } from '@vtt/logging';
import { Server as HTTPServer } from 'http';
import { PrismaClient } from '@prisma/client';

export interface VTTUser {
  id: string;
  displayName: string;
  campaignId?: string;
  sceneId?: string;
}

export interface TokenUpdate {
  id: string;
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
}

export interface SceneUpdate {
  id: string;
  name?: string;
  gridSettings?: any;
  lightingSettings?: any;
  fogSettings?: any;
}

export class VTTSocketManager {
  private io: SocketIOServer;
  private prisma: PrismaClient;
  private connectedUsers = new Map<string, VTTUser>();

  constructor(httpServer: HTTPServer, prisma: PrismaClient) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.prisma = prisma;
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);

      // User authentication and joining
      socket.on('authenticate', async (data: { userId: string, campaignId?: string }) => {
        try {
          const user = await this.prisma.user.findUnique({
            where: { id: data.userId },
            include: {
              memberships: {
                where: data.campaignId ? { campaignId: data.campaignId } : undefined
              }
            }
          });

          if (!user) {
            socket.emit('auth_error', { message: 'User not found' });
            return;
          }

          const vttUser: VTTUser = {
            id: data.userId,
            displayName: (data as any).displayName || 'Unknown',
            campaignId: data.campaignId || '',
          };

          this.connectedUsers.set(socket.id, vttUser);
          socket.emit('authenticated', { user: vttUser });

          if (data.campaignId) {
            socket.join(`campaign:${data.campaignId}`);
            this.broadcastToRoom(`campaign:${data.campaignId}`, 'user_joined', {
              user: vttUser,
              socketId: socket.id
            }, socket.id);
          }
        } catch (error) {
          logger.error('Authentication error:', error as Error);
          socket.emit('auth_error', { message: 'Authentication failed' });
        }
      });

      // Scene management
      socket.on('join_scene', async (data: { sceneId: string }) => {
        const user = this.connectedUsers.get(socket.id);
        if (!user || !user.campaignId) {
          socket.emit('error', { message: 'User not authenticated' });
          return;
        }

        try {
          const scene = await this.prisma.scene.findUnique({
            where: { id: data.sceneId },
            include: {
              tokens: {
                include: {
                  actor: true,
                  asset: true
                }
              }
            }
          });

          if (!scene || scene.campaignId !== user.campaignId) {
            socket.emit('error', { message: 'Scene not found or access denied' });
            return;
          }

          // Leave previous scene room if any
          if (user.sceneId) {
            socket.leave(`scene:${user.sceneId}`);
            this.broadcastToRoom(`scene:${user.sceneId}`, 'user_left_scene', {
              userId: user.id,
              sceneId: user.sceneId
            }, socket.id);
          }

          // Join new scene
          user.sceneId = data.sceneId;
          socket.join(`scene:${data.sceneId}`);
          
          socket.emit('scene_joined', { scene });
          this.broadcastToRoom(`scene:${data.sceneId}`, 'user_joined_scene', {
            user,
            sceneId: data.sceneId
          }, socket.id);

        } catch (error) {
          logger.error('Join scene error:', error as Error);
          socket.emit('error', { message: 'Failed to join scene' });
        }
      });

      // Token movement
      socket.on('move_token', async (data: TokenUpdate) => {
        const user = this.connectedUsers.get(socket.id);
        if (!user || !user.sceneId) {
          socket.emit('error', { message: 'User not in a scene' });
          return;
        }

        try {
          const token = await this.prisma.token.findUnique({
            where: { id: data.id },
            include: { actor: true }
          });

          if (!token || token.sceneId !== user.sceneId) {
            socket.emit('error', { message: 'Token not found or access denied' });
            return;
          }

          // Update token position in database
          const updatedToken = await this.prisma.token.update({
            where: { id: data.id },
            data: {
              x: data.x,
              y: data.y,
              rotation: data.rotation ?? token.rotation,
              scale: data.scale ?? token.scale,
              updatedAt: new Date()
            }
          });

          // Broadcast to all users in the scene
          this.broadcastToRoom(`scene:${user.sceneId}`, 'token_moved', {
            tokenId: data.id,
            x: data.x,
            y: data.y,
            rotation: updatedToken.rotation,
            scale: updatedToken.scale,
            movedBy: user.id
          });

        } catch (error) {
          logger.error('Move token error:', error as Error);
          socket.emit('error', { message: 'Failed to move token' });
        }
      });

      // Scene updates
      socket.on('update_scene', async (data: SceneUpdate) => {
        const user = this.connectedUsers.get(socket.id);
        if (!user || !user.campaignId) {
          socket.emit('error', { message: 'User not authenticated' });
          return;
        }

        try {
          const scene = await this.prisma.scene.findUnique({
            where: { id: data.id }
          });

          if (!scene || scene.campaignId !== user.campaignId) {
            socket.emit('error', { message: 'Scene not found or access denied' });
            return;
          }

          const updateData: any = { updatedAt: new Date() };
          if (data.name) updateData.name = data.name;
          if (data.gridSettings) updateData.gridSettings = data.gridSettings;
          if (data.lightingSettings) updateData.lightingSettings = data.lightingSettings;
          if (data.fogSettings) updateData.fogSettings = data.fogSettings;

          const updatedScene = await this.prisma.scene.update({
            where: { id: data.id },
            data: updateData
          });

          this.broadcastToRoom(`scene:${data.id}`, 'scene_updated', {
            scene: updatedScene,
            updatedBy: user.id
          });

        } catch (error) {
          logger.error('Update scene error:', error as Error);
          socket.emit('error', { message: 'Failed to update scene' });
        }
      });

      // Chat messages
      socket.on('send_message', async (data: { text: string, channel?: string }) => {
        const user = this.connectedUsers.get(socket.id);
        if (!user || !user.campaignId) {
          socket.emit('error', { message: 'User not authenticated' });
          return;
        }

        try {
          const message = await this.prisma.chatMessage.create({
            data: {
              authorId: user.id,
              campaignId: user.campaignId,
              channel: data.channel || 'general',
              text: data.text,
              timestamp: new Date()
            },
            include: {
              author: true
            }
          });

          // this.emit('channelMessage', message, data as Record<string, any>);

        } catch (error) {
          logger.error('Send message error:', error as Error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // Combat management
      socket.on('start_combat', async (data: { encounterId: string }) => {
        const user = this.connectedUsers.get(socket.id);
        if (!user || !user.campaignId) {
          socket.emit('error', { message: 'User not authenticated' });
          return;
        }

        try {
          const encounter = await this.prisma.encounter.update({
            where: { id: data.encounterId },
            data: { 
              isActive: true,
              currentRound: 1,
              currentTurn: 0
            },
            include: {
              participants: {
                include: { actor: true },
                orderBy: { initiative: 'desc' }
              }
            }
          });

          this.broadcastToRoom(`campaign:${user.campaignId}`, 'combat_started', encounter);

        } catch (error) {
          logger.error('Start combat error:', error as Error);
          socket.emit('error', { message: 'Failed to start combat' });
        }
      });

      // Disconnect handling
      socket.on('disconnect', () => {
        const user = this.connectedUsers.get(socket.id);
        if (user) {
          logger.info(`User disconnected: ${user.displayName} (${socket.id})`);
          
          if (user.campaignId) {
            this.broadcastToRoom(`campaign:${user.campaignId}`, 'user_left', {
              userId: user.id,
              socketId: socket.id
            }, socket.id);
          }

          if (user.sceneId) {
            this.broadcastToRoom(`scene:${user.sceneId}`, 'user_left_scene', {
              userId: user.id,
              sceneId: user.sceneId
            }, socket.id);
          }

          this.connectedUsers.delete(socket.id);
        }
      });

      // Error handling
      socket.on('error', (error) => {
        logger.error(`Socket error for ${socket.id}:`, error);
      });
    });
  }

  private broadcastToRoom(room: string, event: string, data: any, excludeSocketId?: string) {
    if (excludeSocketId) {
      this.io.to(room).except(excludeSocketId).emit(event, data);
    } else {
      this.io.to(room).emit(event, data);
    }
  }

  public getConnectedUsers(): VTTUser[] {
    return Array.from(this.connectedUsers.values());
  }

  public getUsersInCampaign(campaignId: string): VTTUser[] {
    return Array.from(this.connectedUsers.values())
      .filter(user => user.campaignId === campaignId);
  }

  public getUsersInScene(sceneId: string): VTTUser[] {
    return Array.from(this.connectedUsers.values())
      .filter(user => user.sceneId === sceneId);
  }
}
