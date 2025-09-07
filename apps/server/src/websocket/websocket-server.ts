/**
 * WebSocket Server - Real-time game communication
 */
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { PrismaClient } from '@prisma/client';
import { authManager } from '../routes/auth';

interface WebSocketClient {
  ws: WebSocket;
  userId?: string;
  sessionId?: string;
  isAuthenticated: boolean;
}

interface GameMessage {
  type: string;
  sessionId?: string;
  userId?: string;
  [key: string]: any;
}

export class VTTWebSocketServer {
  private wss: WebSocketServer;
  private clients = new Map<WebSocket, WebSocketClient>();
  private sessionClients = new Map<string, Set<WebSocket>>();
  private prisma: PrismaClient;

  constructor(server: any, prisma: PrismaClient) {
    this.prisma = prisma;
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });

    this.wss.on('connection', this.handleConnection.bind(this));
  }

  private async handleConnection(ws: WebSocket, request: IncomingMessage) {
    const client: WebSocketClient = {
      ws,
      isAuthenticated: false
    };
    
    this.clients.set(ws, client);
    console.log('WebSocket client connected');

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString()) as GameMessage;
        await this.handleMessage(ws, message);
      } catch (error) {
        console.error('WebSocket message error:', error);
        this.sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.handleDisconnection(ws);
    });

    // Send welcome message
    this.send(ws, { type: 'CONNECTED', message: 'WebSocket connected' });
  }

  private async handleMessage(ws: WebSocket, message: GameMessage) {
    const client = this.clients.get(ws);
    if (!client) {return;}

    switch (message.type) {
      case 'AUTHENTICATE':
        await this.handleAuthenticate(ws, message);
        break;
      case 'PING':
        this.send(ws, { type: 'PONG', timestamp: message.timestamp });
        break;
      case 'JOIN_SESSION':
        await this.handleJoinSession(ws, message);
        break;
      case 'LEAVE_SESSION':
        await this.handleLeaveSession(ws, message);
        break;
      case 'CREATE_SESSION':
        await this.handleCreateSession(ws, message);
        break;
      case 'GAME_MESSAGE':
        await this.handleGameMessage(ws, message);
        break;
      default:
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  private async handleAuthenticate(ws: WebSocket, message: GameMessage) {
    const client = this.clients.get(ws);
    if (!client) {return;}

    try {
      const { token } = message;
      if (!token) {
        this.sendError(ws, 'Authentication token required');
        return;
      }

      const user = await authManager.verifyAccessToken(token);
      if (!user) {
        this.sendError(ws, 'Invalid authentication token');
        return;
      }

      client.userId = user.id;
      client.isAuthenticated = true;

      this.send(ws, {
        type: 'AUTHENTICATED',
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName
        }
      });
    } catch (error) {
      console.error('Authentication error:', error);
      this.sendError(ws, 'Authentication failed');
    }
  }

  private async handleJoinSession(ws: WebSocket, message: GameMessage) {
    const client = this.clients.get(ws);
    if (!client || !client.isAuthenticated) {
      this.sendError(ws, 'Authentication required');
      return;
    }

    try {
      const { sessionId } = message;
      if (!sessionId) {
        this.sendError(ws, 'Session ID required');
        return;
      }

      // Find session in database
      const session = await this.prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: {
          tokens: {
            include: {
              gameSession: true
            }
          }
        }
      });

      if (!session) {
        this.sendError(ws, 'Session not found');
        return;
      }

      // Add client to session
      client.sessionId = sessionId;
      if (!this.sessionClients.has(sessionId)) {
        this.sessionClients.set(sessionId, new Set());
      }
      this.sessionClients.get(sessionId)!.add(ws);

      // Notify client of successful join
      this.send(ws, {
        type: 'SESSION_JOINED',
        session: {
          id: session.id,
          name: session.name,
          status: session.status,
          currentTurn: session.currentTurn,
          roundNumber: session.roundNumber
        }
      });

      // Notify other clients in session
      this.broadcastToSession(sessionId, {
        type: 'PLAYER_JOINED',
        userId: client.userId,
        sessionId
      }, ws);

    } catch (error) {
      console.error('Join session error:', error);
      this.sendError(ws, 'Failed to join session');
    }
  }

  private async handleLeaveSession(ws: WebSocket, message: GameMessage) {
    const client = this.clients.get(ws);
    if (!client || !client.sessionId) {return;}

    const sessionId = client.sessionId;
    
    // Remove from session
    this.sessionClients.get(sessionId)?.delete(ws);
    client.sessionId = undefined;

    // Notify other clients
    this.broadcastToSession(sessionId, {
      type: 'PLAYER_LEFT',
      userId: client.userId,
      sessionId
    });

    this.send(ws, { type: 'SESSION_LEFT', sessionId });
  }

  private async handleCreateSession(ws: WebSocket, message: GameMessage) {
    const client = this.clients.get(ws);
    if (!client || !client.isAuthenticated) {
      this.sendError(ws, 'Authentication required');
      return;
    }

    try {
      const { sessionData } = message;
      if (!sessionData?.name) {
        this.sendError(ws, 'Session name required');
        return;
      }

      // Validate or create campaign
      let actualCampaignId = sessionData.campaignId;
      if (sessionData.campaignId) {
        // Verify user has access to the campaign
        const campaign = await this.prisma.campaign.findFirst({
          where: {
            id: sessionData.campaignId,
            members: {
              some: {
                userId: client.userId,
                status: 'active',
                role: { in: ['gamemaster', 'co-gamemaster'] }
              }
            }
          }
        });

        if (!campaign) {
          this.sendError(ws, 'Campaign not found or insufficient permissions');
          return;
        }
      } else {
        // Create a new campaign for this session
        const newCampaign = await this.prisma.campaign.create({
          data: {
            name: `${sessionData.name} Campaign`,
            members: {
              create: {
                userId: client.userId!,
                role: 'gamemaster',
                status: 'active'
              }
            },
            settings: {
              create: {
                isPublic: !sessionData.isPrivate,
                allowSpectators: sessionData.allowSpectators !== false,
                maxPlayers: sessionData.maxPlayers || 4
              }
            }
          }
        });
        actualCampaignId = newCampaign.id;
      }

      // Create session in database
      const session = await this.prisma.gameSession.create({
        data: {
          name: sessionData.name,
          campaignId: actualCampaignId,
          status: 'WAITING',
          metadata: {
            maxPlayers: sessionData.maxPlayers || 4,
            isPrivate: sessionData.isPrivate || false,
            allowSpectators: sessionData.allowSpectators || true,
            gamemasterId: client.userId
          }
        }
      });

      this.send(ws, {
        type: 'SESSION_CREATED',
        session: {
          id: session.id,
          name: session.name,
          status: session.status
        }
      });

    } catch (error) {
      console.error('Create session error:', error);
      this.sendError(ws, 'Failed to create session');
    }
  }

  private async handleGameMessage(ws: WebSocket, message: GameMessage) {
    const client = this.clients.get(ws);
    if (!client || !client.sessionId) {
      this.sendError(ws, 'Must be in a session to send game messages');
      return;
    }

    // Broadcast game message to all clients in session
    this.broadcastToSession(client.sessionId, {
      type: 'GAME_EVENT',
      userId: client.userId,
      sessionId: client.sessionId,
      data: message.data
    });
  }

  private handleDisconnection(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (!client) {return;}

    // Remove from session if in one
    if (client.sessionId) {
      this.sessionClients.get(client.sessionId)?.delete(ws);
      
      // Notify other clients
      this.broadcastToSession(client.sessionId, {
        type: 'PLAYER_DISCONNECTED',
        userId: client.userId,
        sessionId: client.sessionId
      });
    }

    this.clients.delete(ws);
    console.log('WebSocket client disconnected');
  }

  private send(ws: WebSocket, message: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, error: string) {
    this.send(ws, { type: 'ERROR', error });
  }

  private broadcastToSession(sessionId: string, message: any, exclude?: WebSocket) {
    const clients = this.sessionClients.get(sessionId);
    if (!clients) {return;}

    clients.forEach(ws => {
      if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
        this.send(ws, message);
      }
    });
  }

  public getSessionClients(sessionId: string): number {
    return this.sessionClients.get(sessionId)?.size || 0;
  }

  public getTotalClients(): number {
    return this.clients.size;
  }
}
