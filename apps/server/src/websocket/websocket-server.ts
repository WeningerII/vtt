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
import { getAuthorizationService } from '../services/AuthorizationService';
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
    
    // Start periodic session validation
    this.startSessionValidation();
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
      // Use unified authorization service for consistent permission checking
      const authService = getAuthorizationService(this.prisma);
      const authResult = await authService.canManipulateToken(client.userId!, tokenId, 'move');

      if (!authResult.authorized) {
        this.sendError(ws, authResult.reason || 'Unauthorized to move this token');
        console.warn(`Unauthorized token move attempt: User ${client.userId} tried to move token ${tokenId} - ${authResult.reason}`);
        return;
      }

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

    // Normalize message types to handle both old and new formats
    const messageType = message.type.toUpperCase().replace(/-/g, '_');

    switch (messageType) {
      case 'AUTHENTICATE':
        await this.handleAuthenticate(ws, message);
        break;
      case 'PING': {
        const t = (message as any).t ?? (message as any).timestamp ?? Date.now();
        this.send(ws, { type: 'PONG', t });
        break;
      }
      case 'JOIN_SESSION':
      case 'JOIN_GAME':
        await this.handleJoinSession(ws, message);
        break;
      case 'LEAVE_SESSION':
      case 'LEAVE_GAME':
        await this.handleLeaveSession(ws, message);
        break;
      case 'CREATE_SESSION':
        await this.handleCreateSession(ws, message);
        break;
      case 'MOVE_TOKEN':
      case 'TOKEN_MOVE':
        await this.handleMoveToken(ws, message);
        break;
      case 'TOKEN_ADD':
        await this.handleTokenAdd(ws, message);
        break;
      case 'TOKEN_REMOVE':
        await this.handleTokenRemove(ws, message);
        break;
      case 'SCENE_UPDATE':
        await this.handleSceneUpdate(ws, message);
        break;
      case 'GAME_MESSAGE':
      case 'CHAT_MESSAGE':
      case 'CHAT_BROADCAST':
        await this.handleGameMessage(ws, message);
        break;
      case 'DICE_ROLL':
      case 'DICE_ROLL_REQUEST':
        await this.handleDiceRoll(ws, message);
        break;
      default:
        // Attempt to route combat-related messages
        if (this.isCombatMessageType(messageType)) {
          await this.routeCombatMessage(ws, client, message);
        } else {
          console.warn(`Unknown message type: ${message.type}`);
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

      // Check session status
      if (session.status !== 'WAITING' && session.status !== 'ACTIVE') {
        this.sendError(ws, 'Cannot join this session');
        return;
      }

      // Use unified authorization service for consistent permission checking
      const authService = getAuthorizationService(this.prisma);
      const authResult = await authService.canJoinSession(client.userId!, sessionId);

      // Log authorization attempt
      authService.logAuthorizationEvent({
        userId: client.userId!,
        sessionId,
        campaignId: session.campaignId,
        action: 'join_session',
        resource: 'game_session',
        resourceId: sessionId
      }, authResult);

      if (!authResult.authorized) {
        this.sendError(ws, authResult.reason || 'Access denied');
        return;
      }

      // Check session capacity for non-GM users
      const metadata = session.metadata as any || {};
      const maxPlayers = metadata.maxPlayers || 4;
      const currentPlayerCount = this.sessionClients.get(sessionId)?.size || 0;
      const isGM = ['gamemaster', 'co-gamemaster', 'admin'].includes(authResult.member?.role?.toLowerCase() || '');

      if (currentPlayerCount >= maxPlayers && !isGM) {
        this.sendError(ws, 'Session is full');
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

      // Use unified authorization service for session creation
      const authService = getAuthorizationService(this.prisma);
      const authResult = await authService.canCreateSession(client.userId!, sessionData.campaignId);

      if (!authResult.authorized) {
        this.sendError(ws, authResult.reason || 'Cannot create session');
        console.warn(`Unauthorized session creation attempt: User ${client.userId} tried to create session in campaign ${sessionData.campaignId} - ${authResult.reason}`);
        return;
      }

      // Validate or create campaign
      let actualCampaignId = sessionData.campaignId;
      if (sessionData.campaignId) {
        // Authorization service already validated access
        actualCampaignId = sessionData.campaignId;
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

  private async handleTokenAdd(ws: WebSocket, message: GameMessage) {
    const client = this.clients.get(ws);
    if (!client || !client.isAuthenticated || !client.sessionId) {
      this.sendError(ws, 'Authentication and session required');
      return;
    }

    const payload = (message as any).payload ?? message;
    const token = payload.token;
    const sceneId = payload.sceneId;

    if (!token || !sceneId) {
      this.sendError(ws, 'Invalid TOKEN_ADD payload');
      return;
    }

    try {
      // Check if user has permission to add tokens to this session
      const session = await this.prisma.gameSession.findUnique({
        where: { id: client.sessionId }
      });

      if (!session) {
        this.sendError(ws, 'Session not found');
        return;
      }

      const authService = getAuthorizationService(this.prisma);
      const userRole = await authService.getUserCampaignRole(client.userId!, session.campaignId);

      // Only GMs and Co-GMs can add tokens
      if (!['gamemaster', 'co-gamemaster', 'admin'].includes(userRole?.toLowerCase() || '')) {
        this.sendError(ws, 'Insufficient permissions to add tokens');
        console.warn(`Unauthorized token add attempt: User ${client.userId} tried to add token in session ${client.sessionId}`);
        return;
      }

      // Broadcast to all clients in session
      this.broadcastToSession(client.sessionId, {
        type: 'token_add',
        payload: {
          token,
          sceneId,
          userId: client.userId
        }
      });
    } catch (error) {
      console.error('Token add error:', error);
      this.sendError(ws, 'Failed to add token');
    }
  }

  private async handleTokenRemove(ws: WebSocket, message: GameMessage) {
    const client = this.clients.get(ws);
    if (!client || !client.isAuthenticated || !client.sessionId) {
      this.sendError(ws, 'Authentication and session required');
      return;
    }

    const payload = (message as any).payload ?? message;
    const tokenId = payload.tokenId;
    const sceneId = payload.sceneId;

    if (!tokenId || !sceneId) {
      this.sendError(ws, 'Invalid TOKEN_REMOVE payload');
      return;
    }

    try {
      // Use unified authorization service for token deletion
      const authService = getAuthorizationService(this.prisma);
      const authResult = await authService.canManipulateToken(client.userId!, tokenId, 'delete');

      if (!authResult.authorized) {
        this.sendError(ws, authResult.reason || 'Unauthorized to remove this token');
        console.warn(`Unauthorized token remove attempt: User ${client.userId} tried to remove token ${tokenId} - ${authResult.reason}`);
        return;
      }

      // Broadcast to all clients in session
      this.broadcastToSession(client.sessionId, {
        type: 'token_remove',
        payload: {
          tokenId,
          sceneId,
          userId: client.userId
        }
      });
    } catch (error) {
      console.error('Token remove error:', error);
      this.sendError(ws, 'Failed to remove token');
    }
  }

  private async handleSceneUpdate(ws: WebSocket, message: GameMessage) {
    const client = this.clients.get(ws);
    if (!client || !client.isAuthenticated || !client.sessionId) {
      this.sendError(ws, 'Authentication and session required');
      return;
    }

    const payload = (message as any).payload ?? message;
    const updates = payload.updates;
    const sceneId = payload.sceneId;

    if (!updates || !sceneId) {
      this.sendError(ws, 'Invalid SCENE_UPDATE payload');
      return;
    }

    // Broadcast to all clients in session
    this.broadcastToSession(client.sessionId, {
      type: 'scene_update',
      payload: {
        updates,
        sceneId,
        userId: client.userId
      }
    });
  }

  private async handleDiceRoll(ws: WebSocket, message: GameMessage) {
    const client = this.clients.get(ws);
    if (!client || !client.isAuthenticated || !client.sessionId) {
      this.sendError(ws, 'Authentication and session required');
      return;
    }

    const payload = (message as any).payload ?? message;
    const dice = payload.dice || payload.diceString || 'd20';
    const label = payload.label || payload.reason || 'Roll';
    const modifier = payload.modifier || 0;

    // Parse dice string (e.g., "2d6+3")
    const diceRegex = /(\d+)?d(\d+)([+-]\d+)?/i;
    const match = dice.match(diceRegex);
    
    if (!match) {
      this.sendError(ws, 'Invalid dice format');
      return;
    }

    const count = parseInt(match[1] || '1');
    const sides = parseInt(match[2]);
    const mod = parseInt(match[3] || '0') + modifier;

    // Roll the dice
    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }
    const total = rolls.reduce((sum, roll) => sum + roll, 0) + mod;

    // Broadcast result to all clients in session
    this.broadcastToSession(client.sessionId, {
      type: 'DICE_ROLL_RESULT',
      rollId: `roll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: client.userId,
      displayName: client.userId, // TODO: Get actual display name
      dice,
      label,
      rolls,
      modifier: mod,
      total,
      timestamp: Date.now()
    });
  }

  private async handleGameMessage(ws: WebSocket, message: GameMessage) {
    const client = this.clients.get(ws);
    if (!client || !client.sessionId) {
      this.sendError(ws, 'Must be in a session to send game messages');
      return;
    }

    // Handle chat messages
    if (message.type.toUpperCase().includes('CHAT')) {
      const payload = (message as any).payload ?? message;
      const content = payload.content || payload.message || payload.text;
      const channel = payload.channel || 'general';
      
      if (!content) {
        this.sendError(ws, 'Chat message content required');
        return;
      }

      this.broadcastToSession(client.sessionId, {
        type: 'CHAT_BROADCAST',
        userId: client.userId,
        displayName: client.userId, // TODO: Get actual display name
        content,
        channel,
        timestamp: Date.now()
      });
    } else {
      // Generic game message broadcast
      this.broadcastToSession(client.sessionId, {
        type: 'GAME_EVENT',
        userId: client.userId,
        sessionId: client.sessionId,
        data: message.data || (message as any).payload
      });
    }
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
      
      // Validate session state after disconnection
      this.validateSessionState(client.sessionId);
      
      // Notify other clients
      this.broadcastToSession(client.sessionId, {
        type: 'PLAYER_DISCONNECTED',
        userId: client.userId,
        sessionId: client.sessionId
      });
    }

    this.clients.delete(ws);
    console.log(`WebSocket client disconnected: User ${client.userId || 'unknown'}`);
  }

  /**
   * Validate session state and clean up orphaned sessions
   */
  private async validateSessionState(sessionId: string): Promise<void> {
    try {
      const sessionClients = this.sessionClients.get(sessionId);
      
      // If no clients remain, mark session as inactive after a grace period
      if (!sessionClients || sessionClients.size === 0) {
        setTimeout(async () => {
          const stillEmpty = !this.sessionClients.get(sessionId) || this.sessionClients.get(sessionId)!.size === 0;
          
          if (stillEmpty) {
            // Update session status to paused if all players disconnected
            await this.prisma.gameSession.update({
              where: { id: sessionId },
              data: { 
                status: 'PAUSED',
                updatedAt: new Date()
              }
            }).catch(error => {
              console.error(`Failed to update session ${sessionId} status:`, error);
            });
            
            // Clean up session tracking
            this.sessionClients.delete(sessionId);
            console.log(`Session ${sessionId} marked as paused due to no active connections`);
          }
        }, 30000); // 30 second grace period
      }
    } catch (error) {
      console.error('Error validating session state:', error);
    }
  }

  /**
   * Periodic validation of all active sessions
   */
  private startSessionValidation(): void {
    setInterval(async () => {
      try {
        for (const [sessionId, clients] of this.sessionClients.entries()) {
          // Remove dead connections
          const activeClients = new Set<WebSocket>();
          
          for (const ws of clients) {
            if (ws.readyState === WebSocket.OPEN) {
              activeClients.add(ws);
            }
          }
          
          if (activeClients.size !== clients.size) {
            this.sessionClients.set(sessionId, activeClients);
            console.log(`Cleaned up ${clients.size - activeClients.size} dead connections from session ${sessionId}`);
          }
          
          // Validate against database state
          const session = await this.prisma.gameSession.findUnique({
            where: { id: sessionId },
            select: { status: true, campaignId: true }
          });
          
          if (!session || session.status === 'COMPLETED' || session.status === 'ABANDONED') {
            // Session ended, disconnect all clients
            for (const ws of activeClients) {
              this.sendError(ws, 'Session has ended');
              ws.close();
            }
            this.sessionClients.delete(sessionId);
            console.log(`Cleaned up ended session ${sessionId}`);
          }
        }
      } catch (error) {
        console.error('Error during session validation:', error);
      }
    }, 60000); // Run every minute
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
