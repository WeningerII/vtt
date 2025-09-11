/**
 * WebSocket Server - Real-time game communication
 */
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { PrismaClient } from '@prisma/client';
import { getAuthManager } from '../auth/auth-manager';
import { CombatWebSocketManager, CombatWebSocketMessage } from './combatEvents';
import { ActorIntegrationService } from '../services/ActorIntegrationService';
import { TokenService } from '../services/TokenService';
import { CampaignService } from '../campaign/CampaignService';
import { AnyClientMessageSchema, AnyServerMessageSchema } from '@vtt/core-schemas';

interface WebSocketClient {
  ws: WebSocket;
  userId?: string;
  sessionId?: string;
  isAuthenticated: boolean;
}

type GameMessage = {
  type: string;
  payload?: any;
  sessionId?: string;
  userId?: string;
  [key: string]: any;
};

export class VTTWebSocketServer {
  private wss: WebSocketServer;
  private clients = new Map<WebSocket, WebSocketClient>();
  private sessionClients = new Map<string, Set<WebSocket>>();
  private prisma: PrismaClient;
  private combatManager: CombatWebSocketManager;
  private tokenService: TokenService;
  private campaignService: CampaignService;

  constructor(server: any, prisma: PrismaClient) {
    this.prisma = prisma;
    this.tokenService = new TokenService(prisma);
    this.campaignService = new CampaignService(prisma);
    // Don't pass server - we'll handle upgrade manually to avoid double handling
    this.wss = new WebSocketServer({ 
      noServer: true,
      path: '/ws'
    });

    // Initialize combat manager with services
    const actorService = new ActorIntegrationService();
    this.combatManager = new CombatWebSocketManager(actorService);

    this.wss.on('connection', this.handleConnection.bind(this));
  }

  // Token movement with authorization checks
  private async handleMoveToken(ws: WebSocket, message: GameMessage) {
    const client = this.clients.get(ws);
    if (!client || !client.isAuthenticated) {
      this.sendError(ws, 'Authentication required');
      return;
    }

    const payload = (message as any).payload ?? message;
    const tokenId: string | undefined = payload.tokenId || payload.id;
    const x: number | undefined = payload.x ?? payload.position?.x;
    const y: number | undefined = payload.y ?? payload.position?.y;
    const rotation: number | undefined = payload.rotation;

    if (!tokenId || typeof x !== 'number' || typeof y !== 'number') {
      this.sendError(ws, 'Invalid MOVE_TOKEN payload');
      return;
    }

    try {
      const token = await this.tokenService.getToken(tokenId);
      if (!token) {
        this.sendError(ws, 'Token not found');
        return;
      }

      // Must be in the same session
      if (client.sessionId && token.gameSessionId !== client.sessionId) {
        this.sendError(ws, 'Token does not belong to your session');
        return;
      }

      // Determine GM status
      const isGM = await this.isUserGMForSession(client.userId!, token.gameSessionId);

      // Determine ownership from token metadata if present
      let isOwner = false;
      const meta = (token.metadata as any) || {};
      if (meta.ownerUserId && typeof meta.ownerUserId === 'string') {
        isOwner = meta.ownerUserId === client.userId;
      }

      // Only GM or owner can move the token
      if (!isGM && !isOwner) {
        this.sendError(ws, 'Unauthorized to move this token');
        return;
      }

      const updated = await this.tokenService.moveToken(tokenId, x, y, rotation);
      if (!updated) {
        this.sendError(ws, 'Failed to update token position');
        return;
      }

      // Broadcast movement to session participants
      const sessionId = client.sessionId || token.gameSessionId;
      this.broadcastToSession(sessionId, {
        type: 'TOKEN_MOVED',
        tokenId,
        x: updated.x,
        y: updated.y,
        rotation: updated.rotation,
        movedBy: client.userId,
      }, ws);
    } catch (error) {
      console.error('Move token error:', error);
      this.sendError(ws, 'Failed to move token');
    }
  }

  // Helper: GM authorization for a game session
  private async isUserGMForSession(userId: string, gameSessionId: string): Promise<boolean> {
    try {
      const session = await this.prisma.gameSession.findUnique({ where: { id: gameSessionId } });
      if (!session) { return false; }
      const campaign = await this.campaignService.getCampaign(session.campaignId);
      if (!campaign) { return false; }
      return campaign.gameMasterId === userId;
    } catch {
      return false;
    }
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
        const rawMessage = JSON.parse(data.toString());
        // Use raw message directly since schemas have permissive fallback
        await this.handleMessage(ws, rawMessage as GameMessage);
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
    });

    // Send initial connection message
    this.send(ws, { type: 'CONNECTED', message: 'WebSocket connected successfully' });
  }

  private async handleMessage(ws: WebSocket, message: GameMessage) {
    const client = this.clients.get(ws);
    if (!client) {return;}

    switch (message.type) {
      case 'AUTHENTICATE':
        await this.handleAuthenticate(ws, message);
        break;
      case 'PING': {
        const t = (message as any).t ?? (message as any).timestamp ?? Date.now();
        this.send(ws, { type: 'PONG', t });
        break;
      }
      case 'JOIN_SESSION':
        await this.handleJoinSession(ws, message);
        break;
      case 'LEAVE_SESSION':
        await this.handleLeaveSession(ws, message);
        break;
      case 'CREATE_SESSION':
        await this.handleCreateSession(ws, message);
        break;
      case 'MOVE_TOKEN':
        await this.handleMoveToken(ws, message);
        break;
      case 'GAME_MESSAGE':
        await this.handleGameMessage(ws, message);
        break;
      default:
        // Attempt to route combat-related messages
        if (this.isCombatMessageType(message.type)) {
          await this.routeCombatMessage(ws, client, message);
        } else {
          this.sendError(ws, `Unknown message type: ${message.type}`);
        }
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

      const user = await getAuthManager().verifyAccessToken(token);
      if (!user) {
        this.sendError(ws, 'Invalid authentication token');
        return;
      }

      client.userId = user.id;
      client.isAuthenticated = true;

      // Register this authenticated connection with the combat manager
      try {
        this.combatManager.registerConnection(ws, user.id);
      } catch (e) {
        // Non-fatal: continue without blocking auth
      }

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
        const campaign = await this.campaignService.getCampaign(sessionData.campaignId);
        const isGM = campaign && campaign.gameMasterId === client.userId;

        if (!campaign || !isGM) {
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

  // Determine if a message is combat-related (supports legacy aliases)
  private isCombatMessageType(type: string): boolean {
    const combatTypes = new Set<string>([
      'SUBSCRIBE_ENCOUNTER',
      'UNSUBSCRIBE_ENCOUNTER',
      'UPDATE_ACTOR_HEALTH',
      'START_ENCOUNTER',
      'END_ENCOUNTER',
      'ADD_ACTOR',
      'REMOVE_ACTOR',
      'UPDATE_INITIATIVE',
      'NEXT_TURN',
      'APPLY_CONDITION',
      'REMOVE_CONDITION',
      'REQUEST_TACTICAL_DECISION',
      // Legacy aliases
      'COMBAT_SUBSCRIBE',
      'COMBAT_UNSUBSCRIBE',
    ]);
    return combatTypes.has(type);
  }

  // Forward normalized combat messages to CombatWebSocketManager
  private async routeCombatMessage(ws: WebSocket, client: WebSocketClient, message: GameMessage) {
    if (!client.isAuthenticated || !client.userId) {
      this.sendError(ws, 'Authentication required for combat actions');
      return;
    }

    const combatMessage: CombatWebSocketMessage = {
      type: message.type,
      payload: (message as any).payload ?? message,
      requestId: (message as any).requestId,
    };

    await this.combatManager.processMessage(ws, client.userId, combatMessage);
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

  // Expose WebSocketServer's handleUpgrade for manual upgrade handling
  public handleUpgrade(request: any, socket: any, head: any) {
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.wss.emit('connection', ws, request);
    });
  }
}
