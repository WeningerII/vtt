/**
 * Campaign management service with database persistence and map integration
 */

import { Campaign } from '../character/types';
import { PrismaClient } from '@prisma/client';
import { MapService } from '../map/MapService';
import { v4 as _uuidv4 } from 'uuid';

export interface CreateCampaignRequest {
  name: string;
  description: string;
  gameSystem?: string;
  isActive?: boolean;
}

export interface UpdateCampaignRequest {
  name?: string;
  description?: string;
  gameSystem?: string;
  isActive?: boolean;
  players?: string[];
  characters?: string[];
}

export interface Scene {
  id: string;
  name: string;
  mapId: string | null;
  isActive: boolean;
}

export interface CampaignWithScenes extends Campaign {
  scenes: Scene[];
  activeSceneId?: string | undefined;
}

export interface GameSession {
  sessionId: string;
  campaignId: string;
  sceneId: string;
  gameMasterId: string;
  connectedUsers: string[];
  status: 'active' | 'paused' | 'ended';
  startedAt: Date;
  endedAt?: Date;
}

export class CampaignService {
  private campaigns = new Map<string, Campaign>();
  
  // Active scene tracking (TODO: move to database)
  private activeScenes: Map<string, string> = new Map();
  
  // Session management
  private activeSessions: Map<string, GameSession> = new Map();

  constructor(
    private prisma: PrismaClient,
    private mapService?: MapService
  ) {}

  /**
   * Create a new campaign with database persistence
   */
  async createCampaign(gameMasterId: string, request: CreateCampaignRequest): Promise<Campaign> {
    // Create campaign in database
    const dbCampaign = await this.prisma.campaign.create({
      data: {
        name: request.name,
        description: request.description || '',
        gameSystem: request.gameSystem || 'dnd5e',
        isActive: request.isActive !== false,
        members: {
          create: {
            userId: gameMasterId,
            role: 'GM'
          }
        }
      },
      include: {
        members: {
          include: {
            user: true
          }
        },
        scenes: true,
        activeScene: true
      }
    });
    
    const campaign: Campaign = {
      id: dbCampaign.id,
      name: dbCampaign.name,
      description: dbCampaign.description,
      gameSystem: dbCampaign.gameSystem,
      gameMasterId,
      players: [gameMasterId],
      characters: [],
      isActive: dbCampaign.isActive,
      createdAt: dbCampaign.createdAt,
      updatedAt: dbCampaign.updatedAt
    };

    this.campaigns.set(dbCampaign.id, campaign);
    return campaign;
  }

  /**
   * Get campaign by ID with database lookup
   */
  async getCampaign(campaignId: string): Promise<Campaign | null> {
    // Check cache first
    const cached = this.campaigns.get(campaignId);
    if (cached) return cached;

    // Load from database
    const dbCampaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        members: {
          include: {
            user: true
          }
        },
        scenes: true
      }
    });

    if (!dbCampaign) return null;

    const gameMaster = dbCampaign.members.find(m => m.role === 'GM');
    const players = dbCampaign.members.map(m => m.userId);

    const campaign: Campaign = {
      id: dbCampaign.id,
      name: dbCampaign.name,
      description: (dbCampaign as any).description || '',
      gameSystem: (dbCampaign as any).gameSystem || 'dnd5e',
      gameMasterId: gameMaster?.userId || '',
      players,
      characters: [],
      isActive: (dbCampaign as any).isActive !== false,
      createdAt: dbCampaign.createdAt,
      updatedAt: (dbCampaign as any).updatedAt || new Date()
    };

    this.campaigns.set(campaignId, campaign);
    return campaign;
  }

  /**
   * Get campaign with scenes and map data
   */
  async getCampaignWithScenes(campaignId: string): Promise<CampaignWithScenes | null> {
    const campaign = await this.getCampaign(campaignId);
    if (!campaign) return null;

    const scenes = await this.prisma.scene.findMany({
      where: { campaignId },
      include: {
        map: true
      }
    });

    return {
      ...campaign,
      scenes: scenes.map(scene => ({
        id: scene.id,
        name: scene.name,
        mapId: scene.mapId,
        isActive: false // TODO: Track active scene
      })),
      activeSceneId: undefined // TODO: Implement active scene tracking
    };
  }

  /**
   * Create a scene for a campaign
   */
  async createSceneForCampaign(
    campaignId: string, 
    userId: string, 
    sceneName: string,
    mapId?: string
  ): Promise<any> {
    const campaign = await this.getCampaign(campaignId);
    if (!campaign || campaign.gameMasterId !== userId) {
      throw new Error('Unauthorized or campaign not found');
    }

    if (this.mapService) {
      return await this.mapService.createScene(
        sceneName,
        1920, // Default width
        1080, // Default height
        campaignId,
        mapId
      );
    }
    
    throw new Error('MapService not available');
  }

  /**
   * Set active scene for campaign
   */
  async setActiveScene(campaignId: string, sceneId: string, userId: string): Promise<boolean> {
    const campaign = await this.getCampaign(campaignId);
    if (!campaign || campaign.gameMasterId !== userId) {
      return false;
    }

    // Verify scene belongs to campaign
    const scene = await this.prisma.scene.findFirst({
      where: { id: sceneId, campaignId }
    });

    if (!scene) return false;

    // Update active scene in database
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { activeSceneId: sceneId } as any
    });

    // Update in-memory cache
    this.activeScenes.set(campaignId, sceneId);

    return true;
  }

  /**
   * Get campaigns where user is GM or player
   */
  async getCampaignsForUser(userId: string): Promise<Campaign[]> {
    return Array.from(this.campaigns.values()).filter(campaign => 
      campaign.gameMasterId === userId || campaign.players.includes(userId)
    );
  }

  /**
   * Get campaigns where user is the game master
   */
  async getCampaignsAsMaster(userId: string): Promise<Campaign[]> {
    return Array.from(this.campaigns.values()).filter(campaign => 
      campaign.gameMasterId === userId
    );
  }

  /**
   * Update campaign
   */
  async updateCampaign(campaignId: string, userId: string, update: UpdateCampaignRequest): Promise<Campaign | null> {
    const campaign = this.campaigns.get(campaignId);
    
    if (!campaign || campaign.gameMasterId !== userId) {
      return null; // Only GM can update campaign
    }

    // Apply updates
    if (update.name) campaign.name = update.name;
    if (update.description !== undefined) campaign.description = update.description;
    if (update.gameSystem) campaign.gameSystem = update.gameSystem;
    if (update.isActive !== undefined) campaign.isActive = update.isActive;
    if (update.players) campaign.players = update.players;
    if (update.characters) campaign.characters = update.characters;

    campaign.updatedAt = new Date();
    return campaign;
  }

  /**
   * Delete campaign
   */
  async deleteCampaign(campaignId: string, userId: string): Promise<boolean> {
    const campaign = this.campaigns.get(campaignId);
    
    if (!campaign || campaign.gameMasterId !== userId) {
      return false; // Only GM can delete campaign
    }

    return this.campaigns.delete(campaignId);
  }

  async addPlayerToCampaign(campaignId: string, playerId: string): Promise<void> {
    const campaign = await this.getCampaign(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    
    // Check if player is already in campaign
    if (campaign.players?.includes(playerId)) {
      throw new Error('Player already in campaign');
    }
    
    // Add player to campaign
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        players: {
          push: playerId
        }
      }
    });
    
    // logger.info(`Added player ${playerId} to campaign ${campaignId}`);
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(campaignId: string): Promise<any> {
    const campaign = this.campaigns.get(campaignId);
    
    if (!campaign) {
      return null;
    }

    return {
      id: campaign.id,
      name: campaign.name,
      playerCount: campaign.players.length,
      characterCount: campaign.characters.length,
      isActive: campaign.isActive,
      gameSystem: campaign.gameSystem,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt
    };
  }

  async archiveCampaign(campaignId: string): Promise<void> {
    const campaign = await this.getCampaign(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    
    // Archive the campaign
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'archived',
        archivedAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    // logger.info(`Archived campaign ${campaignId}`);
  }

  /**
   * Reactivate campaign
   */
  async reactivateCampaign(campaignId: string, userId: string): Promise<boolean> {
    const campaign = this.campaigns.get(campaignId);
    
    if (!campaign || campaign.gameMasterId !== userId) {
      return false;
    }

    campaign.isActive = true;
    campaign.updatedAt = new Date();
    return true;
  }

  /**
   * Start a game session for a campaign
   */
  async startSession(campaignId: string, sceneId: string, gameMasterId: string): Promise<GameSession> {
    // Verify user is GM
    const campaign = await this.getCampaign(campaignId);
    if (!campaign || campaign.gameMasterId !== gameMasterId) {
      throw new Error('Unauthorized: Only campaign GM can start sessions');
    }

    // Verify scene exists and belongs to campaign
    const scene = await this.prisma.scene.findFirst({
      where: { id: sceneId, campaignId }
    });
    if (!scene) {
      throw new Error('Scene not found or does not belong to campaign');
    }

    // End any existing session for this campaign
    const existingSessionId = Array.from(this.activeSessions.entries())
      .find(([_, session]) => session.campaignId === campaignId)?.[0];
    if (existingSessionId) {
      await this.endSession(existingSessionId, gameMasterId);
    }

    // Create new session
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session: GameSession = {
      sessionId,
      campaignId,
      sceneId,
      gameMasterId,
      connectedUsers: [gameMasterId],
      status: 'active',
      startedAt: new Date()
    };

    this.activeSessions.set(sessionId, session);
    this.activeScenes.set(campaignId, sceneId);

    return session;
  }

  /**
   * End a game session
   */
  async endSession(sessionId: string, userId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    // Only GM can end session
    if (session.gameMasterId !== userId) {
      throw new Error('Unauthorized: Only session GM can end sessions');
    }

    session.status = 'ended';
    session.endedAt = new Date();
    this.activeSessions.delete(sessionId);

    return true;
  }

  /**
   * Join a game session
   */
  async joinSession(sessionId: string, userId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'active') return false;

    // Verify user is member of campaign
    const campaign = await this.getCampaign(session.campaignId);
    if (!campaign) return false;

    const isMember = campaign.gameMasterId === userId || 
                    campaign.players.includes(userId);
    if (!isMember) return false;

    // Add user to session if not already connected
    if (!session.connectedUsers.includes(userId)) {
      session.connectedUsers.push(userId);
    }

    return true;
  }

  /**
   * Leave a game session
   */
  async leaveSession(sessionId: string, userId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    // Remove user from connected users
    session.connectedUsers = session.connectedUsers.filter(id => id !== userId);

    // If GM leaves, pause the session
    if (userId === session.gameMasterId) {
      session.status = 'paused';
    }

    return true;
  }

  /**
   * Get active session for campaign
   */
  getActiveSession(campaignId: string): GameSession | null {
    return Array.from(this.activeSessions.values())
      .find(session => session.campaignId === campaignId && session.status === 'active') || null;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): GameSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): GameSession[] {
    return Array.from(this.activeSessions.values())
      .filter(session => session.status === 'active');
  }
}
