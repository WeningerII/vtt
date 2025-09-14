/**
 * Campaign management service with database persistence and map integration
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { PrismaClient, GameSessionStatus } from "@prisma/client";
import { MapScene } from "../map/types";
import { MapService } from "../map/MapService";
import { v4 as _uuidv4 } from "uuid";
import { logger } from "@vtt/logging";

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
  async createCampaign(userId: string, request: CreateCampaignRequest): Promise<Campaign> {
    // Create campaign in database
    const dbCampaign = await this.prisma.campaign.create({
      data: {
        name: request.name,
        members: {
          create: {
            userId,
            role: "GM",
          },
        },
        settings: {
          create: {
            description: request.description || "",
            gameSystem: request.gameSystem || "dnd5e",
            isActive: request.isActive !== undefined ? request.isActive : true,
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
        settings: true,
      },
    });

    // Convert to service model and cache
    const campaign = this.mapDbCampaignToCampaign(dbCampaign);
    this.campaigns.set(campaign.id, campaign);
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
        settings: true,
      },
    });

    if (!dbCampaign) {return null;}

    const gameMaster = dbCampaign.members?.find((m) => m.role === "GM");
    const players = dbCampaign.members?.map((m) => m.userId) || [];

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

    // Resolve active scene from in-memory cache, falling back to database if needed
    const dbActive = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { activeSceneId: true },
    });
    const resolvedActiveId: string | undefined =
      (this.activeScenes.get(campaignId) ?? dbActive?.activeSceneId) ?? undefined;

    return {
      ...campaign,
      scenes: scenes.map((scene) => ({
        id: scene.id,
        name: scene.name,
        mapId: scene.mapId,
        isActive: resolvedActiveId === scene.id
      })),
      activeSceneId: resolvedActiveId
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
            userId
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
            userId,
            role: { in: ["GM", "gm"] }
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
        role: { in: ["GM", "gm"] }
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
        role: { in: ["GM", "gm"] }
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
      logger.error('Error deleting campaign:', error);
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

    // Update in database via CampaignSettings
    await this.prisma.campaignSettings.upsert({
      where: { campaignId },
      update: { isActive: false, updatedAt: new Date() },
      create: {
        campaignId,
        isActive: false,
        description: campaign.description || "",
        gameSystem: campaign.gameSystem || "dnd5e",
      },
    });

    // Update in-memory state
    campaign.isActive = false;
    campaign.updatedAt = new Date();

    return true;
  }

  /**
   * Reactivate campaign
   */
  async reactivateCampaign(campaignId: string, userId: string): Promise<boolean> {
    const campaign = await this.getCampaign(campaignId);
    if (!campaign || campaign.gameMasterId !== userId) {
      return false; // Only GM can reactivate campaign
    }

    // Update in database via CampaignSettings
    await this.prisma.campaignSettings.upsert({
      where: { campaignId },
      update: { isActive: true, updatedAt: new Date() },
      create: {
        campaignId,
        isActive: true,
        description: campaign.description || "",
        gameSystem: campaign.gameSystem || "dnd5e",
      },
    });

    // Update in-memory state
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

    // End any existing ACTIVE session for this campaign in the database
    const existingActive = await this.prisma.gameSession.findFirst({
      where: { campaignId, status: GameSessionStatus.ACTIVE },
    });
    if (existingActive) {
      await this.prisma.gameSession.update({
        where: { id: existingActive.id },
        data: { status: GameSessionStatus.COMPLETED, endedAt: new Date() },
      });
      // Also clear from in-memory overlay if present
      this.activeSessions.delete(existingActive.id);
    }

    // Create new session in database
    const dbSession = await this.prisma.gameSession.create({
      data: {
        name: `Session ${new Date().toISOString()}`,
        campaignId,
        status: GameSessionStatus.ACTIVE,
        currentSceneId: sceneId,
        startedAt: new Date(),
      },
    });

    // Build in-memory session overlay (for connected users tracking)
    const session: GameSession = {
      sessionId: dbSession.id,
      campaignId,
      sceneId,
      gameMasterId,
      connectedUsers: [gameMasterId],
      status: "active",
      startedAt: dbSession.startedAt || new Date(),
    };

    this.activeSessions.set(dbSession.id, session);
    // Persist active scene association
    await this.setActiveSceneInternal(campaignId, sceneId);

    return session;
  }

  /**
   * End a game session
   */
  async endSession(sessionId: string, userId: string): Promise<boolean> {
    // Load session from DB to validate authority and update persistence
    const dbSession = await this.prisma.gameSession.findUnique({ where: { id: sessionId } });
    if (!dbSession) {return false;}

    // Verify user is GM for the campaign
    const gmMembership = await this.prisma.campaignMember.findFirst({
      where: { campaignId: dbSession.campaignId, userId, role: "GM" },
    });
    if (!gmMembership) {
      throw new Error("Unauthorized: Only campaign GM can end sessions");
    }

    await this.prisma.gameSession.update({
      where: { id: sessionId },
      data: { status: GameSessionStatus.COMPLETED, endedAt: new Date() },
    });

    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = "ended";
      session.endedAt = new Date();
      this.activeSessions.delete(sessionId);
    }

    return true;
  }

  /**
   * Join a game session
   */
  async joinSession(sessionId: string, userId: string): Promise<boolean> {
    let session = this.activeSessions.get(sessionId);
    if (!session) {
      // Try to hydrate from DB
      const dbSession = await this.prisma.gameSession.findUnique({ where: { id: sessionId } });
      if (!dbSession || dbSession.status !== GameSessionStatus.ACTIVE) {return false;}

      const campaign = await this.getCampaign(dbSession.campaignId);
      if (!campaign) {return false;}

      session = {
        sessionId: dbSession.id,
        campaignId: dbSession.campaignId,
        sceneId: dbSession.currentSceneId || "",
        gameMasterId: campaign.gameMasterId,
        connectedUsers: [],
        status: "active",
        startedAt: dbSession.startedAt || new Date(),
      };
      this.activeSessions.set(sessionId, session);
    }

    if (session.status !== "active") {return false;}

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

    // If GM leaves, pause the session (persist to DB too)
    if (userId === session.gameMasterId) {
      session.status = "paused";
      try {
        await this.prisma.gameSession.update({
          where: { id: sessionId },
          data: { status: GameSessionStatus.PAUSED },
        });
      } catch (error) {
        logger.warn("Failed to persist paused status for session", error as Error);
      }
    }

    return true;
  }

  /**
   * Get active session for campaign
   */
  getActiveSession(campaignId: string): GameSession | null {
    // Prefer in-memory active session if present
    const mem = Array.from(this.activeSessions.values()).find(
      (session) => session.campaignId === campaignId && session.status === "active",
    );
    if (mem) {return mem;}

    // Fallback to database lookup
    // Note: This is a synchronous signature; callers should use an async variant if needed.
    // For now, return null if not cached to avoid blocking.
    return null;
  }

  /**
   * Get active session for campaign (async, with DB fallback)
   */
  async getActiveSessionAsync(campaignId: string): Promise<GameSession | null> {
    const mem = this.getActiveSession(campaignId);
    if (mem) {return mem;}

    const dbSession = await this.prisma.gameSession.findFirst({
      where: { campaignId, status: GameSessionStatus.ACTIVE },
    });
    if (!dbSession) {return null;}

    const campaign = await this.getCampaign(campaignId);
    if (!campaign) {return null;}

    const hydrated: GameSession = {
      sessionId: dbSession.id,
      campaignId: dbSession.campaignId,
      sceneId: dbSession.currentSceneId || "",
      gameMasterId: campaign.gameMasterId,
      connectedUsers: [],
      status: "active",
      startedAt: dbSession.startedAt || new Date(),
      endedAt: dbSession.endedAt || undefined,
    };

    this.activeSessions.set(dbSession.id, hydrated);
    return hydrated;
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

    return members.map(member => {
      const roleLower = (member.role || '').toLowerCase();
      const statusLower = (member.status || '').toLowerCase();
      const normalizedRole: 'player' | 'gm' | 'spectator' =
        roleLower === 'gm' ? 'gm' : (roleLower === 'player' ? 'player' : 'spectator');
      const normalizedStatus: 'active' | 'invited' | 'kicked' | 'banned' =
        (['active','invited','kicked','banned'].includes(statusLower) ? statusLower : 'active') as any;
      return {
        id: member.id,
        userId: member.userId,
        email: member.user.email,
        displayName: member.user.displayName,
        role: normalizedRole,
        status: normalizedStatus,
        joinedAt: member.joinedAt,
        invitedAt: member.invitedAt || undefined,
        invitedBy: member.invitedBy || undefined,
      };
    });
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
  async addCharacterToCampaign(campaignId: string, userId: string, characterId: string, role: string = 'player'): Promise<boolean> {
    // Verify user is GM or player in campaign
    const campaign = await this.getCampaign(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const isMember = campaign.gameMasterId === userId || campaign.players.includes(userId);
    if (!isMember) {
      throw new Error('Unauthorized: Only campaign members can add characters');
    }

    // Check if character exists
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      throw new Error('Character not found');
    }

    // Check if character is already in campaign
    const existingAssignment = await this.prisma.campaignCharacter.findUnique({
      where: {
        campaignId_characterId: {
          campaignId,
          characterId,
        },
      },
    });

    if (existingAssignment) {
      throw new Error('Character is already in this campaign');
    }

    // Add character to campaign via join table
    await this.prisma.campaignCharacter.create({
      data: {
        campaignId,
        characterId,
        addedBy: userId,
        role,
      },
    });

    // Update in-memory cache
    if (campaign.characters && !campaign.characters.includes(characterId)) {
      campaign.characters.push(characterId);
      campaign.updatedAt = new Date();
    }

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

    const isGM = campaign.gameMasterId === userId;

    if (!isGM) {
      throw new Error('Unauthorized: Only GM can remove characters');
    }

    // Remove character from campaign via join table
    const assignment = await this.prisma.campaignCharacter.deleteMany({
      where: {
        campaignId,
        characterId,
      },
    });

    if (assignment.count === 0) {
      return false; // Character wasn't in campaign
    }

    // Update in-memory cache
    if (campaign.characters) {
      const characterIndex = campaign.characters.indexOf(characterId);
      if (characterIndex !== -1) {
        campaign.characters.splice(characterIndex, 1);
        campaign.updatedAt = new Date();
      }
    }

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
  private mapDbCampaignToCampaign(dbCampaign: unknown): Campaign {
    const gameMaster = dbCampaign.members?.find((m: unknown) => (m.role || "").toLowerCase() === "gm");
    const players = dbCampaign.members?.map((m: unknown) => m.userId) || [];
    const characters = dbCampaign.characters?.map((cc: unknown) => cc.characterId) || [];

    return {
      id: dbCampaign.id,
      name: dbCampaign.name,
      description: dbCampaign.settings?.description || "",
      gameSystem: dbCampaign.settings?.gameSystem || "dnd5e",
      gameMasterId: gameMaster?.userId || "",
      players,
      characters,
      isActive: dbCampaign.settings?.isActive ?? true,
      sessions: 0, // Computed field
      totalHours: 0, // Computed field
      createdAt: dbCampaign.createdAt,
      updatedAt: dbCampaign.updatedAt || dbCampaign.createdAt,
    };
  }
}
