/**
 * Campaign management service with database persistence and map integration
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { PrismaClient } from "@prisma/client";
import { MapScene } from "../map/types.js";
import { MapService } from "../map/MapService";
import { v4 as _uuidv4 } from "uuid";

// Custom Campaign interface that extends database model with computed fields
export interface Campaign {
  id: string;
  name: string;
  description: string;
  gameSystem: string;
  gameMasterId: string;
  players: string[];
  characters: string[];
  sessions: number;
  totalHours: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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
  status: "active" | "paused" | "ended";
  startedAt: Date;
  endedAt?: Date;
}

export interface Player {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  role: 'player' | 'gm' | 'spectator';
  status: 'active' | 'invited' | 'kicked' | 'banned';
  joinedAt: Date;
  invitedAt?: Date;
  invitedBy?: string;
}

export interface CampaignSettings {
  id: string;
  campaignId: string;
  isPublic: boolean;
  allowSpectators: boolean;
  maxPlayers: number;
  autoAcceptInvites: boolean;
  requireApproval: boolean;
  sessionTimeout: number;
  createdAt: Date;
  updatedAt: Date;
}

export class CampaignService {
  private campaigns = new Map<string, Campaign>();

  // Active scene tracking - maps campaignId to activeSceneId
  private activeScenes: Map<string, string> = new Map();

  // Session management
  private activeSessions: Map<string, GameSession> = new Map();

  constructor(
    private prisma: PrismaClient,
    private mapService?: MapService,
  ) {}

  /**
   * Create a new campaign with database persistence
   */
  async createCampaign(gameMasterId: string, request: CreateCampaignRequest): Promise<Campaign> {
    // Create campaign in database
    const dbCampaign = await this.prisma.campaign.create({
      data: {
        name: request.name,
        members: {
          create: {
            userId: gameMasterId,
            role: "GM",
          },
        },
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        scenes: true,
      },
    });

    const campaign = this.mapDbCampaignToCampaign({
      ...dbCampaign,
      members: dbCampaign.members || [],
      scenes: dbCampaign.scenes || []
    });

    // Apply request data
    campaign.description = request.description || "";
    campaign.gameSystem = request.gameSystem || "dnd5e";
    campaign.isActive = request.isActive !== false;

    this.campaigns.set(dbCampaign.id, campaign);
    return campaign;
  }

  /**
   * Get campaign by ID with database lookup
   */
  async getCampaign(campaignId: string): Promise<Campaign | null> {
    // Check cache first
    const cached = this.campaigns.get(campaignId);
    if (cached) {return cached;}

    // Load from database
    const dbCampaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        scenes: true,
      },
    });

    if (!dbCampaign) {return null;}

    const gameMaster = dbCampaign.members.find((m) => m.role === "GM");
    const players = dbCampaign.members.map((m) => m.userId);

    const campaign = this.mapDbCampaignToCampaign({
      ...dbCampaign,
      members: dbCampaign.members || [],
      scenes: dbCampaign.scenes || []
    });

    this.campaigns.set(campaignId, campaign);
    return campaign;
  }

  /**
   * Get campaign with scenes and map data
   */
  async getCampaignWithScenes(campaignId: string): Promise<CampaignWithScenes | null> {
    const campaign = await this.getCampaign(campaignId);
    if (!campaign) {return null;}

    const scenes = await this.prisma.scene.findMany({
      where: { campaignId },
      include: {
        map: true,
      },
    });

    return {
      ...campaign,
      scenes: scenes.map((scene) => ({
        id: scene.id,
        name: scene.name,
        mapId: scene.mapId,
        isActive: this.activeScenes.get(campaignId) === scene.id
      })),
      activeSceneId: this.activeScenes.get(campaignId)
    };
  }

  /**
   * Create a scene for a campaign
   */
  async createSceneForCampaign(
    campaignId: string,
    userId: string,
    sceneName: string,
    mapId?: string,
  ): Promise<MapScene> {
    const campaign = await this.getCampaign(campaignId);
    if (!campaign || campaign.gameMasterId !== userId) {
      throw new Error("Unauthorized or campaign not found");
    }

    if (this.mapService) {
      return await this.mapService.createScene(
        sceneName,
        1920, // Default width
        1080, // Default height
        campaignId,
        mapId,
      );
    }

    throw new Error("MapService not available");
  }

  /**
   * Set active scene for campaign with authorization
   */
  async setActiveScene(campaignId: string, sceneId: string, userId: string): Promise<boolean> {
    const campaign = await this.getCampaign(campaignId);
    if (!campaign || campaign.gameMasterId !== userId) {
      return false;
    }

    // Verify scene belongs to campaign
    const scene = await this.prisma.scene.findFirst({
      where: { id: sceneId, campaignId },
    });

    if (!scene) {return false;}

    // Use internal method for consistent database persistence
    await this.setActiveSceneInternal(campaignId, sceneId);

    return true;
  }

  /**
   * Get campaigns where user is GM or player
   */
  async getCampaignsForUser(userId: string): Promise<Campaign[]> {
    // Load from database
    const dbCampaigns = await this.prisma.campaign.findMany({
      where: {
        members: {
          some: {
            userId: userId
          }
        }
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        scenes: true,
      },
    });

    // Convert to service interface
    return dbCampaigns.map(dbCampaign => this.mapDbCampaignToCampaign(dbCampaign));
  }

  /**
   * Get campaigns where user is the game master
   */
  async getCampaignsAsMaster(userId: string): Promise<Campaign[]> {
    // Load from database
    const dbCampaigns = await this.prisma.campaign.findMany({
      where: {
        members: {
          some: {
            userId: userId,
            role: "GM"
          }
        }
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        scenes: true,
      },
    });

    // Convert to service interface
    return dbCampaigns.map(dbCampaign => this.mapDbCampaignToCampaign(dbCampaign));
  }

  /**
   * Update campaign
   */
  async updateCampaign(
    campaignId: string,
    userId: string,
    update: UpdateCampaignRequest,
  ): Promise<Campaign | null> {
    // Verify user is GM
    const isGM = await this.prisma.campaignMember.findFirst({
      where: {
        campaignId,
        userId,
        role: "GM"
      }
    });

    if (!isGM) {
      return null; // Only GM can update campaign
    }

    // Update in database
    if (update.name) {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { name: update.name },
      });
    }

    // Get updated campaign
    const updatedCampaign = await this.getCampaign(campaignId);
    if (updatedCampaign) {
      // Update in-memory fields that don't exist in DB
      if (update.description !== undefined) {updatedCampaign.description = update.description;}
      if (update.gameSystem) {updatedCampaign.gameSystem = update.gameSystem;}
      if (update.isActive !== undefined) {updatedCampaign.isActive = update.isActive;}
      if (update.players) {updatedCampaign.players = update.players;}
      if (update.characters) {updatedCampaign.characters = update.characters;}
      updatedCampaign.updatedAt = new Date();
      
      // Update cache
      this.campaigns.set(campaignId, updatedCampaign);
    }
    
    return updatedCampaign;
  }

  /**
   * Delete campaign
   */
  async deleteCampaign(campaignId: string, userId: string): Promise<boolean> {
    // Verify user is GM
    const isGM = await this.prisma.campaignMember.findFirst({
      where: {
        campaignId,
        userId,
        role: "GM"
      }
    });

    if (!isGM) {
      return false; // Only GM can delete campaign
    }

    try {
      // Delete from database (cascade will handle related records)
      await this.prisma.campaign.delete({
        where: { id: campaignId }
      });
      
      // Remove from cache
      this.campaigns.delete(campaignId);
      this.activeScenes.delete(campaignId);
      
      return true;
    } catch (error) {
      console.error('Error deleting campaign:', error);
      return false;
    }
  }

  async addPlayerToCampaign(campaignId: string, playerId: string): Promise<void> {
    const campaign = await this.getCampaign(campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Check if player is already in campaign
    if (campaign.players?.includes(playerId)) {
      throw new Error("Player already in campaign");
    }

    // Add player using CampaignMember table (since Campaign has no players field)
    await this.prisma.campaignMember.create({
      data: {
        userId: playerId,
        campaignId,
        role: "player",
        status: "active",
      },
    });

    // Update in-memory campaign
    campaign.players.push(playerId);
    campaign.updatedAt = new Date();
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(campaignId: string): Promise<any> {
    const campaign = await this.getCampaign(campaignId);

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
      updatedAt: campaign.updatedAt,
    };
  }

  async archiveCampaign(campaignId: string, userId: string): Promise<boolean> {
    const campaign = await this.getCampaign(campaignId);
    if (!campaign || campaign.gameMasterId !== userId) {
      return false;
    }

    // Mark campaign as archived in memory (schema doesn't have status field)
    campaign.isActive = false;

    return true;
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
  async startSession(
    campaignId: string,
    sceneId: string,
    gameMasterId: string,
  ): Promise<GameSession> {
    // Verify user is GM
    const campaign = await this.getCampaign(campaignId);
    if (!campaign || campaign.gameMasterId !== gameMasterId) {
      throw new Error("Unauthorized: Only campaign GM can start sessions");
    }

    // Verify scene exists and belongs to campaign
    const scene = await this.prisma.scene.findFirst({
      where: { id: sceneId, campaignId },
    });
    if (!scene) {
      throw new Error("Scene not found or does not belong to campaign");
    }

    // End any existing session for this campaign
    const existingSessionId = Array.from(this.activeSessions.entries()).find(
      ([_, session]) => session.campaignId === campaignId,
    )?.[0];
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
      status: "active",
      startedAt: new Date(),
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
    if (!session) {return false;}

    // Only GM can end session
    if (session.gameMasterId !== userId) {
      throw new Error("Unauthorized: Only session GM can end sessions");
    }

    session.status = "ended";
    session.endedAt = new Date();
    this.activeSessions.delete(sessionId);

    return true;
  }

  /**
   * Join a game session
   */
  async joinSession(sessionId: string, userId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== "active") {return false;}

    // Verify user is member of campaign
    const campaign = await this.getCampaign(session.campaignId);
    if (!campaign) {return false;}

    const isMember = campaign.gameMasterId === userId || campaign.players.includes(userId);
    if (!isMember) {return false;}

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
    if (!session) {return false;}

    // Remove user from connected users
    session.connectedUsers = session.connectedUsers.filter((id) => id !== userId);

    // If GM leaves, pause the session
    if (userId === session.gameMasterId) {
      session.status = "paused";
    }

    return true;
  }

  /**
   * Get active session for campaign
   */
  getActiveSession(campaignId: string): GameSession | null {
    return (
      Array.from(this.activeSessions.values()).find(
        (session) => session.campaignId === campaignId && session.status === "active",
      ) || null
    );
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
    return Array.from(this.activeSessions.values()).filter(
      (session) => session.status === "active",
    );
  }

  /**
   * Set active scene for a campaign (overloaded method)
   * This version is for internal use when user authorization is already verified
   */
  async setActiveSceneInternal(campaignId: string, sceneId: string): Promise<void> {
    // Update in-memory cache
    this.activeScenes.set(campaignId, sceneId);
    
    // Persist to database
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { activeSceneId: sceneId } as any,
    });
  }

  /**
   * Get active scene for a campaign
   */
  getActiveScene(campaignId: string): string | undefined {
    return this.activeScenes.get(campaignId);
  }

  /**
   * Clear active scene for a campaign
   */
  clearActiveScene(campaignId: string): void {
    this.activeScenes.delete(campaignId);
  }

  /**
   * Get campaign players with detailed information
   */
  async getCampaignPlayers(campaignId: string): Promise<Player[]> {
    const members = await this.prisma.campaignMember.findMany({
      where: { campaignId },
      include: {
        user: true,
      },
    });

    return members.map(member => ({
      id: member.id,
      userId: member.userId,
      email: member.user.email,
      displayName: member.user.displayName,
      role: member.role as 'player' | 'gm' | 'spectator',
      status: member.status as 'active' | 'invited' | 'kicked' | 'banned',
      joinedAt: member.joinedAt,
      invitedAt: member.invitedAt || undefined,
      invitedBy: member.invitedBy || undefined,
    }));
  }

  /**
   * Invite player by email to campaign
   */
  async invitePlayerByEmail(campaignId: string, userId: string, email: string, role: string): Promise<Player> {
    // Verify user is GM
    const campaign = await this.getCampaign(campaignId);
    if (!campaign || campaign.gameMasterId !== userId) {
      throw new Error('Unauthorized: Only campaign GM can invite players');
    }

    // Find or create user by email
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Create invited user
      user = await this.prisma.user.create({
        data: {
          email,
          username: `${email.split('@')[0]  }_${  Math.random().toString(36).substr(2, 4)}`,
          displayName: email.split('@')[0],
          passwordHash: '', // Will be set when they accept invitation
          role: 'player',
        },
      });
    }

    // Check if already a member
    const existingMember = await this.prisma.campaignMember.findUnique({
      where: {
        userId_campaignId: {
          userId: user.id,
          campaignId,
        },
      },
    });

    if (existingMember) {
      throw new Error('User is already a member of this campaign');
    }

    // Create campaign membership
    const member = await this.prisma.campaignMember.create({
      data: {
        userId: user.id,
        campaignId,
        role,
        status: 'invited',
        invitedAt: new Date(),
        invitedBy: userId,
      },
      include: {
        user: true,
      },
    });

    return {
      id: member.id,
      userId: member.userId,
      email: member.user.email,
      displayName: member.user.displayName,
      role: member.role as 'player' | 'gm' | 'spectator',
      status: member.status as 'active' | 'invited' | 'kicked' | 'banned',
      joinedAt: member.joinedAt,
      invitedAt: member.invitedAt || undefined,
      invitedBy: member.invitedBy || undefined,
    };
  }

  /**
   * Update player role or status
   */
  async updatePlayer(campaignId: string, userId: string, playerId: string, updates: { role?: string; status?: string }): Promise<boolean> {
    // Verify user is GM
    const campaign = await this.getCampaign(campaignId);
    if (!campaign || campaign.gameMasterId !== userId) {
      throw new Error('Unauthorized: Only campaign GM can update players');
    }

    // Update player
    const result = await this.prisma.campaignMember.updateMany({
      where: {
        id: playerId,
        campaignId,
      },
      data: updates,
    });

    return result.count > 0;
  }

  /**
   * Add player to campaign (for existing users)
   */
  async addPlayer(campaignId: string, userId: string, playerId: string): Promise<boolean> {
    // Verify user is GM
    const campaign = await this.getCampaign(campaignId);
    if (!campaign || campaign.gameMasterId !== userId) {
      throw new Error('Unauthorized: Only campaign GM can add players');
    }

    // Check if player exists
    const player = await this.prisma.user.findUnique({ where: { id: playerId } });
    if (!player) {
      throw new Error('Player not found');
    }

    // Check if already a member
    const existingMember = await this.prisma.campaignMember.findUnique({
      where: {
        userId_campaignId: {
          userId: playerId,
          campaignId,
        },
      },
    });

    if (existingMember) {
      throw new Error('Player is already a member of this campaign');
    }

    // Add player
    await this.prisma.campaignMember.create({
      data: {
        userId: playerId,
        campaignId,
        role: 'player',
        status: 'active',
      },
    });

    return true;
  }

  /**
   * Remove player from campaign
   */
  async removePlayer(campaignId: string, userId: string, playerId: string): Promise<boolean> {
    // Verify user is GM
    const campaign = await this.getCampaign(campaignId);
    if (!campaign || campaign.gameMasterId !== userId) {
      throw new Error('Unauthorized: Only campaign GM can remove players');
    }

    // Cannot remove GM
    const member = await this.prisma.campaignMember.findUnique({
      where: {
        userId_campaignId: {
          userId: playerId,
          campaignId,
        },
      },
    });

    if (member?.role === 'GM') {
      throw new Error('Cannot remove campaign GM');
    }

    // Remove player
    const result = await this.prisma.campaignMember.deleteMany({
      where: {
        userId: playerId,
        campaignId,
      },
    });

    return result.count > 0;
  }

  /**
   * Get campaign settings
   */
  async getCampaignSettings(campaignId: string): Promise<CampaignSettings | null> {
    const settings = await this.prisma.campaignSettings.findUnique({
      where: { campaignId },
    });

    if (!settings) {
      // Create default settings
      return await this.createDefaultSettings(campaignId);
    }

    return {
      id: settings.id,
      campaignId: settings.campaignId,
      isPublic: settings.isPublic,
      allowSpectators: settings.allowSpectators,
      maxPlayers: settings.maxPlayers,
      autoAcceptInvites: settings.autoAcceptInvites,
      requireApproval: settings.requireApproval,
      sessionTimeout: settings.sessionTimeout,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }

  /**
   * Update campaign settings
   */
  async updateCampaignSettings(campaignId: string, userId: string, settings: Partial<CampaignSettings>): Promise<boolean> {
    // Verify user is GM
    const campaign = await this.getCampaign(campaignId);
    if (!campaign || campaign.gameMasterId !== userId) {
      throw new Error('Unauthorized: Only campaign GM can update settings');
    }

    // Update settings
    const result = await this.prisma.campaignSettings.upsert({
      where: { campaignId },
      update: {
        ...settings,
        updatedAt: new Date(),
      },
      create: {
        campaignId,
        isPublic: settings.isPublic ?? false,
        allowSpectators: settings.allowSpectators ?? true,
        maxPlayers: settings.maxPlayers ?? 6,
        autoAcceptInvites: settings.autoAcceptInvites ?? false,
        requireApproval: settings.requireApproval ?? true,
        sessionTimeout: settings.sessionTimeout ?? 240,
      },
    });

    return !!result;
  }

  /**
   * Create default settings for campaign
   */
  async createDefaultSettings(campaignId: string): Promise<CampaignSettings> {
    const settings = await this.prisma.campaignSettings.create({
      data: {
        campaignId,
        isPublic: false,
        allowSpectators: true,
        maxPlayers: 6,
        autoAcceptInvites: false,
        requireApproval: true,
        sessionTimeout: 240,
      },
    });

    return {
      id: settings.id,
      campaignId: settings.campaignId,
      isPublic: settings.isPublic,
      allowSpectators: settings.allowSpectators,
      maxPlayers: settings.maxPlayers,
      autoAcceptInvites: settings.autoAcceptInvites,
      requireApproval: settings.requireApproval,
      sessionTimeout: settings.sessionTimeout,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }

  /**
   * Add character to campaign
   */
  async addCharacterToCampaign(campaignId: string, userId: string, characterId: string): Promise<boolean> {
    // Verify user is GM or player in campaign
    const campaign = await this.getCampaign(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const isMember = campaign.gameMasterId === userId || campaign.players.includes(userId);
    if (!isMember) {
      throw new Error('Unauthorized: Only campaign members can add characters');
    }

    // Check if character exists (Character model doesn't have userId field)
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      throw new Error('Character not found');
    }

    // Since campaignCharacter table doesn't exist, manage in-memory
    if (campaign.characters.includes(characterId)) {
      throw new Error('Character is already in this campaign');
    }

    // Add character to campaign in-memory
    campaign.characters.push(characterId);
    campaign.updatedAt = new Date();

    return true;
  }

  /**
   * Remove character from campaign
   */
  async removeCharacterFromCampaign(campaignId: string, userId: string, characterId: string): Promise<boolean> {
    // Verify user is GM or owns the character
    const campaign = await this.getCampaign(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Check if character exists
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
    });

    const isGM = campaign.gameMasterId === userId;

    if (!isGM) {
      throw new Error('Unauthorized: Only GM can remove characters');
    }

    // Remove character from campaign in-memory
    const characterIndex = campaign.characters.indexOf(characterId);
    if (characterIndex === -1) {
      return false;
    }
    
    campaign.characters.splice(characterIndex, 1);
    campaign.updatedAt = new Date();
    return true;
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email: string): Promise<any | null> {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Helper method to map database campaign to service interface
   */
  private mapDbCampaignToCampaign(dbCampaign: any): Campaign {
    const gameMaster = dbCampaign.members?.find((m: any) => m.role === "GM");
    const players = dbCampaign.members?.map((m: any) => m.userId) || [];

    return {
      id: dbCampaign.id,
      name: dbCampaign.name,
      description: "", // Default empty description (not stored in DB)
      gameSystem: "dnd5e", // Default game system (not stored in DB)
      gameMasterId: gameMaster?.userId || "",
      players,
      characters: [], // Not stored in DB, managed in-memory
      sessions: 0, // Not stored in DB, managed in-memory
      totalHours: 0, // Not stored in DB, managed in-memory
      isActive: true, // Default active (not stored in DB)
      createdAt: dbCampaign.createdAt,
      updatedAt: new Date(),
    };
  }
}
