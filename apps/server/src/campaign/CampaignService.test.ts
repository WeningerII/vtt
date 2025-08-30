import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { CampaignService, CreateCampaignRequest, UpdateCampaignRequest, GameSession } from './CampaignService';
import { Campaign } from '../character/types';
import { PrismaClient } from '@prisma/client';
import { MapService } from '../map/MapService';

// Mock Prisma Client
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    campaign: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    scene: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn()
    }
  }))
}));

// Mock MapService
vi.mock('../map/MapService', () => ({
  MapService: vi.fn().mockImplementation(() => ({
    createScene: vi.fn()
  }))
}));

describe('CampaignService', () => {
  let service: CampaignService;
  let mockPrisma: any;
  let mockMapService: any;

  const mockUserId = 'user-123';
  const mockCampaignId = 'campaign-456';
  const mockSceneId = 'scene-789';

  const mockCampaign: Campaign = {
    id: mockCampaignId,
    name: 'Test Campaign',
    description: 'A test campaign',
    gameSystem: 'dnd5e',
    gameMasterId: mockUserId,
    players: [mockUserId],
    characters: [],
    isActive: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01')
  };

  const mockDbCampaign = {
    id: mockCampaignId,
    name: 'Test Campaign',
    description: 'A test campaign',
    gameSystem: 'dnd5e',
    isActive: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    members: [
      {
        userId: mockUserId,
        role: 'GM',
        user: { id: mockUserId, name: 'Test User' }
      }
    ],
    scenes: [],
    activeScene: null
  };

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    mockMapService = new MapService();
    service = new CampaignService(mockPrisma, mockMapService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createCampaign', () => {
    it('should create a new campaign successfully', async () => {
      const request: CreateCampaignRequest = {
        name: 'New Campaign',
        description: 'Campaign description',
        gameSystem: 'dnd5e',
        isActive: true
      };

      mockPrisma.campaign.create.mockResolvedValue(mockDbCampaign);

      const result = await service.createCampaign(mockUserId, request);

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Campaign');
      expect(result.gameMasterId).toBe(mockUserId);
      expect(result.players).toContain(mockUserId);
      expect(mockPrisma.campaign.create).toHaveBeenCalledWith({
        data: {
          name: request.name,
          description: request.description,
          gameSystem: request.gameSystem,
          isActive: request.isActive,
          members: {
            create: {
              userId: mockUserId,
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
    });

    it('should use default values when optional fields are not provided', async () => {
      const request: CreateCampaignRequest = {
        name: 'Minimal Campaign',
        description: 'Basic description'
      };

      mockPrisma.campaign.create.mockResolvedValue({
        ...mockDbCampaign,
        gameSystem: 'dnd5e',
        isActive: true
      });

      const result = await service.createCampaign(mockUserId, request);

      expect(result.gameSystem).toBe('dnd5e');
      expect(result.isActive).toBe(true);
    });
  });

  describe('getCampaign', () => {
    it('should return cached campaign if available', async () => {
      // Pre-populate cache
      (service as any).campaigns.set(mockCampaignId, mockCampaign);

      const result = await service.getCampaign(mockCampaignId);

      expect(result).toEqual(mockCampaign);
      expect(mockPrisma.campaign.findUnique).not.toHaveBeenCalled();
    });

    it('should fetch campaign from database if not cached', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(mockDbCampaign);

      const result = await service.getCampaign(mockCampaignId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(mockCampaignId);
      expect(result?.gameMasterId).toBe(mockUserId);
      expect(mockPrisma.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: mockCampaignId },
        include: {
          members: {
            include: {
              user: true
            }
          },
          scenes: true
        }
      });
    });

    it('should return null for non-existent campaign', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      const result = await service.getCampaign('non-existent');

      expect(result).toBeNull();
    });

    it('should handle campaign without GM gracefully', async () => {
      const campaignWithoutGM = {
        ...mockDbCampaign,
        members: []
      };
      mockPrisma.campaign.findUnique.mockResolvedValue(campaignWithoutGM);

      const result = await service.getCampaign(mockCampaignId);

      expect(result).toBeDefined();
      expect(result?.gameMasterId).toBe('');
    });
  });

  describe('getCampaignWithScenes', () => {
    it('should return campaign with scenes', async () => {
      (service as any).campaigns.set(mockCampaignId, mockCampaign);
      
      const mockScenes = [
        {
          id: 'scene-1',
          name: 'Scene 1',
          mapId: 'map-1',
          campaignId: mockCampaignId,
          map: { id: 'map-1', name: 'Map 1' }
        },
        {
          id: 'scene-2',
          name: 'Scene 2',
          mapId: null,
          campaignId: mockCampaignId,
          map: null
        }
      ];
      
      mockPrisma.scene.findMany.mockResolvedValue(mockScenes);

      const result = await service.getCampaignWithScenes(mockCampaignId);

      expect(result).toBeDefined();
      expect(result?.scenes).toHaveLength(2);
      expect(result?.scenes[0].id).toBe('scene-1');
      expect(result?.scenes[0].mapId).toBe('map-1');
      expect(result?.scenes[1].mapId).toBeNull();
    });

    it('should return null for non-existent campaign', async () => {
      const result = await service.getCampaignWithScenes('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('createSceneForCampaign', () => {
    it('should create scene for authorized GM', async () => {
      (service as any).campaigns.set(mockCampaignId, mockCampaign);
      
      const mockScene = { id: 'new-scene', name: 'New Scene' };
      mockMapService.createScene.mockResolvedValue(mockScene);

      const result = await service.createSceneForCampaign(
        mockCampaignId,
        mockUserId,
        'New Scene',
        'map-123'
      );

      expect(result).toEqual(mockScene);
      expect(mockMapService.createScene).toHaveBeenCalledWith(
        'New Scene',
        1920,
        1080,
        mockCampaignId,
        'map-123'
      );
    });

    it('should throw error for unauthorized user', async () => {
      (service as any).campaigns.set(mockCampaignId, mockCampaign);

      await expect(
        service.createSceneForCampaign(mockCampaignId, 'other-user', 'Scene', 'map-123')
      ).rejects.toThrow('Unauthorized or campaign not found');
    });

    it('should throw error when MapService is not available', async () => {
      const serviceNoMap = new CampaignService(mockPrisma);
      (serviceNoMap as any).campaigns.set(mockCampaignId, mockCampaign);

      await expect(
        serviceNoMap.createSceneForCampaign(mockCampaignId, mockUserId, 'Scene')
      ).rejects.toThrow('MapService not available');
    });
  });

  describe('setActiveScene', () => {
    it('should set active scene for authorized GM', async () => {
      (service as any).campaigns.set(mockCampaignId, mockCampaign);
      
      mockPrisma.scene.findFirst.mockResolvedValue({
        id: mockSceneId,
        campaignId: mockCampaignId
      });
      mockPrisma.campaign.update.mockResolvedValue({});

      const result = await service.setActiveScene(mockCampaignId, mockSceneId, mockUserId);

      expect(result).toBe(true);
      expect(mockPrisma.campaign.update).toHaveBeenCalledWith({
        where: { id: mockCampaignId },
        data: { activeSceneId: mockSceneId }
      });
    });

    it('should return false for unauthorized user', async () => {
      (service as any).campaigns.set(mockCampaignId, mockCampaign);

      const result = await service.setActiveScene(mockCampaignId, mockSceneId, 'other-user');

      expect(result).toBe(false);
      expect(mockPrisma.scene.findFirst).not.toHaveBeenCalled();
    });

    it('should return false for non-existent scene', async () => {
      (service as any).campaigns.set(mockCampaignId, mockCampaign);
      mockPrisma.scene.findFirst.mockResolvedValue(null);

      const result = await service.setActiveScene(mockCampaignId, 'non-existent', mockUserId);

      expect(result).toBe(false);
    });
  });

  describe('updateCampaign', () => {
    it('should update campaign for authorized GM', async () => {
      (service as any).campaigns.set(mockCampaignId, mockCampaign);

      const update: UpdateCampaignRequest = {
        name: 'Updated Campaign',
        description: 'Updated description',
        gameSystem: 'pathfinder',
        isActive: false
      };

      const result = await service.updateCampaign(mockCampaignId, mockUserId, update);

      expect(result).toBeDefined();
      expect(result?.name).toBe('Updated Campaign');
      expect(result?.description).toBe('Updated description');
      expect(result?.gameSystem).toBe('pathfinder');
      expect(result?.isActive).toBe(false);
    });

    it('should return null for unauthorized user', async () => {
      (service as any).campaigns.set(mockCampaignId, mockCampaign);

      const result = await service.updateCampaign(mockCampaignId, 'other-user', { name: 'Hacked' });

      expect(result).toBeNull();
    });

    it('should handle partial updates', async () => {
      (service as any).campaigns.set(mockCampaignId, { ...mockCampaign });

      const update: UpdateCampaignRequest = {
        name: 'Only Name Updated'
      };

      const result = await service.updateCampaign(mockCampaignId, mockUserId, update);

      expect(result?.name).toBe('Only Name Updated');
      expect(result?.description).toBe(mockCampaign.description);
      expect(result?.gameSystem).toBe(mockCampaign.gameSystem);
    });
  });

  describe('deleteCampaign', () => {
    it('should delete campaign for authorized GM', async () => {
      (service as any).campaigns.set(mockCampaignId, mockCampaign);

      const result = await service.deleteCampaign(mockCampaignId, mockUserId);

      expect(result).toBe(true);
      expect((service as any).campaigns.has(mockCampaignId)).toBe(false);
    });

    it('should return false for unauthorized user', async () => {
      (service as any).campaigns.set(mockCampaignId, mockCampaign);

      const result = await service.deleteCampaign(mockCampaignId, 'other-user');

      expect(result).toBe(false);
      expect((service as any).campaigns.has(mockCampaignId)).toBe(true);
    });
  });

  describe('addPlayerToCampaign', () => {
    it('should add player to campaign', async () => {
      (service as any).campaigns.set(mockCampaignId, mockCampaign);
      mockPrisma.campaign.update.mockResolvedValue({});

      await service.addPlayerToCampaign(mockCampaignId, 'new-player');

      expect(mockPrisma.campaign.update).toHaveBeenCalledWith({
        where: { id: mockCampaignId },
        data: {
          players: {
            push: 'new-player'
          }
        }
      });
    });

    it('should throw error if player already in campaign', async () => {
      (service as any).campaigns.set(mockCampaignId, mockCampaign);

      await expect(
        service.addPlayerToCampaign(mockCampaignId, mockUserId)
      ).rejects.toThrow('Player already in campaign');
    });

    it('should throw error for non-existent campaign', async () => {
      await expect(
        service.addPlayerToCampaign('non-existent', 'player')
      ).rejects.toThrow('Campaign not found');
    });
  });

  describe('Session Management', () => {
    describe('startSession', () => {
      it('should start new session for authorized GM', async () => {
        (service as any).campaigns.set(mockCampaignId, mockCampaign);
        mockPrisma.scene.findFirst.mockResolvedValue({
          id: mockSceneId,
          campaignId: mockCampaignId
        });

        const result = await service.startSession(mockCampaignId, mockSceneId, mockUserId);

        expect(result).toBeDefined();
        expect(result.campaignId).toBe(mockCampaignId);
        expect(result.sceneId).toBe(mockSceneId);
        expect(result.gameMasterId).toBe(mockUserId);
        expect(result.status).toBe('active');
        expect(result.connectedUsers).toContain(mockUserId);
      });

      it('should end existing session before starting new one', async () => {
        (service as any).campaigns.set(mockCampaignId, mockCampaign);
        mockPrisma.scene.findFirst.mockResolvedValue({
          id: mockSceneId,
          campaignId: mockCampaignId
        });

        // Start first session
        const session1 = await service.startSession(mockCampaignId, mockSceneId, mockUserId);
        
        // Start second session
        const session2 = await service.startSession(mockCampaignId, mockSceneId, mockUserId);

        expect(session2.sessionId).not.toBe(session1.sessionId);
        expect((service as any).activeSessions.has(session1.sessionId)).toBe(false);
        expect((service as any).activeSessions.has(session2.sessionId)).toBe(true);
      });

      it('should throw error for unauthorized user', async () => {
        (service as any).campaigns.set(mockCampaignId, mockCampaign);

        await expect(
          service.startSession(mockCampaignId, mockSceneId, 'other-user')
        ).rejects.toThrow('Unauthorized: Only campaign GM can start sessions');
      });

      it('should throw error for non-existent scene', async () => {
        (service as any).campaigns.set(mockCampaignId, mockCampaign);
        mockPrisma.scene.findFirst.mockResolvedValue(null);

        await expect(
          service.startSession(mockCampaignId, 'non-existent', mockUserId)
        ).rejects.toThrow('Scene not found or does not belong to campaign');
      });
    });

    describe('joinSession', () => {
      it('should allow campaign member to join session', async () => {
        const session: GameSession = {
          sessionId: 'session-123',
          campaignId: mockCampaignId,
          sceneId: mockSceneId,
          gameMasterId: mockUserId,
          connectedUsers: [mockUserId],
          status: 'active',
          startedAt: new Date()
        };
        (service as any).activeSessions.set(session.sessionId, session);
        (service as any).campaigns.set(mockCampaignId, {
          ...mockCampaign,
          players: [mockUserId, 'player-2']
        });

        const result = await service.joinSession(session.sessionId, 'player-2');

        expect(result).toBe(true);
        expect(session.connectedUsers).toContain('player-2');
      });

      it('should not duplicate user in connected users', async () => {
        const session: GameSession = {
          sessionId: 'session-123',
          campaignId: mockCampaignId,
          sceneId: mockSceneId,
          gameMasterId: mockUserId,
          connectedUsers: [mockUserId],
          status: 'active',
          startedAt: new Date()
        };
        (service as any).activeSessions.set(session.sessionId, session);
        (service as any).campaigns.set(mockCampaignId, mockCampaign);

        await service.joinSession(session.sessionId, mockUserId);

        expect(session.connectedUsers).toHaveLength(1);
      });

      it('should return false for non-member', async () => {
        const session: GameSession = {
          sessionId: 'session-123',
          campaignId: mockCampaignId,
          sceneId: mockSceneId,
          gameMasterId: mockUserId,
          connectedUsers: [mockUserId],
          status: 'active',
          startedAt: new Date()
        };
        (service as any).activeSessions.set(session.sessionId, session);
        (service as any).campaigns.set(mockCampaignId, mockCampaign);

        const result = await service.joinSession(session.sessionId, 'non-member');

        expect(result).toBe(false);
      });
    });

    describe('leaveSession', () => {
      it('should remove user from session', async () => {
        const session: GameSession = {
          sessionId: 'session-123',
          campaignId: mockCampaignId,
          sceneId: mockSceneId,
          gameMasterId: mockUserId,
          connectedUsers: [mockUserId, 'player-2'],
          status: 'active',
          startedAt: new Date()
        };
        (service as any).activeSessions.set(session.sessionId, session);

        const result = await service.leaveSession(session.sessionId, 'player-2');

        expect(result).toBe(true);
        expect(session.connectedUsers).not.toContain('player-2');
      });

      it('should pause session when GM leaves', async () => {
        const session: GameSession = {
          sessionId: 'session-123',
          campaignId: mockCampaignId,
          sceneId: mockSceneId,
          gameMasterId: mockUserId,
          connectedUsers: [mockUserId, 'player-2'],
          status: 'active',
          startedAt: new Date()
        };
        (service as any).activeSessions.set(session.sessionId, session);

        await service.leaveSession(session.sessionId, mockUserId);

        expect(session.status).toBe('paused');
        expect(session.connectedUsers).not.toContain(mockUserId);
      });
    });

    describe('getActiveSession', () => {
      it('should return active session for campaign', () => {
        const session: GameSession = {
          sessionId: 'session-123',
          campaignId: mockCampaignId,
          sceneId: mockSceneId,
          gameMasterId: mockUserId,
          connectedUsers: [mockUserId],
          status: 'active',
          startedAt: new Date()
        };
        (service as any).activeSessions.set(session.sessionId, session);

        const result = service.getActiveSession(mockCampaignId);

        expect(result).toEqual(session);
      });

      it('should not return paused session', () => {
        const session: GameSession = {
          sessionId: 'session-123',
          campaignId: mockCampaignId,
          sceneId: mockSceneId,
          gameMasterId: mockUserId,
          connectedUsers: [],
          status: 'paused',
          startedAt: new Date()
        };
        (service as any).activeSessions.set(session.sessionId, session);

        const result = service.getActiveSession(mockCampaignId);

        expect(result).toBeNull();
      });
    });
  });

  describe('Campaign Statistics and Management', () => {
    describe('getCampaignStats', () => {
      it('should return campaign statistics', async () => {
        const campaignWithStats = {
          ...mockCampaign,
          players: ['player1', 'player2', 'player3'],
          characters: ['char1', 'char2']
        };
        (service as any).campaigns.set(mockCampaignId, campaignWithStats);

        const stats = await service.getCampaignStats(mockCampaignId);

        expect(stats).toBeDefined();
        expect(stats.playerCount).toBe(3);
        expect(stats.characterCount).toBe(2);
        expect(stats.name).toBe('Test Campaign');
      });

      it('should return null for non-existent campaign', async () => {
        const stats = await service.getCampaignStats('non-existent');
        expect(stats).toBeNull();
      });
    });

    describe('archiveCampaign', () => {
      it('should archive campaign', async () => {
        (service as any).campaigns.set(mockCampaignId, mockCampaign);
        mockPrisma.campaign.update.mockResolvedValue({});

        await service.archiveCampaign(mockCampaignId);

        expect(mockPrisma.campaign.update).toHaveBeenCalledWith({
          where: { id: mockCampaignId },
          data: {
            status: 'archived',
            archivedAt: expect.any(Date),
            updatedAt: expect.any(Date)
          }
        });
      });

      it('should throw error for non-existent campaign', async () => {
        await expect(
          service.archiveCampaign('non-existent')
        ).rejects.toThrow('Campaign not found');
      });
    });

    describe('reactivateCampaign', () => {
      it('should reactivate campaign for authorized GM', async () => {
        const inactiveCampaign = { ...mockCampaign, isActive: false };
        (service as any).campaigns.set(mockCampaignId, inactiveCampaign);

        const result = await service.reactivateCampaign(mockCampaignId, mockUserId);

        expect(result).toBe(true);
        expect(inactiveCampaign.isActive).toBe(true);
        expect(inactiveCampaign.updatedAt).toBeInstanceOf(Date);
      });

      it('should return false for unauthorized user', async () => {
        (service as any).campaigns.set(mockCampaignId, mockCampaign);

        const result = await service.reactivateCampaign(mockCampaignId, 'other-user');

        expect(result).toBe(false);
      });
    });
  });

  describe('Query Methods', () => {
    describe('getCampaignsForUser', () => {
      it('should return campaigns where user is GM or player', async () => {
        const campaign1 = { ...mockCampaign, id: 'c1', gameMasterId: mockUserId };
        const campaign2 = { ...mockCampaign, id: 'c2', gameMasterId: 'other', players: [mockUserId] };
        const campaign3 = { ...mockCampaign, id: 'c3', gameMasterId: 'other', players: ['other'] };
        
        (service as any).campaigns.set('c1', campaign1);
        (service as any).campaigns.set('c2', campaign2);
        (service as any).campaigns.set('c3', campaign3);

        const result = await service.getCampaignsForUser(mockUserId);

        expect(result).toHaveLength(2);
        expect(result.map(c => c.id)).toContain('c1');
        expect(result.map(c => c.id)).toContain('c2');
      });
    });

    describe('getCampaignsAsMaster', () => {
      it('should return only campaigns where user is GM', async () => {
        const campaign1 = { ...mockCampaign, id: 'c1', gameMasterId: mockUserId };
        const campaign2 = { ...mockCampaign, id: 'c2', gameMasterId: 'other', players: [mockUserId] };
        
        (service as any).campaigns.set('c1', campaign1);
        (service as any).campaigns.set('c2', campaign2);

        const result = await service.getCampaignsAsMaster(mockUserId);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('c1');
      });
    });

    describe('getActiveSessions', () => {
      it('should return only active sessions', () => {
        const activeSession: GameSession = {
          sessionId: 's1',
          campaignId: 'c1',
          sceneId: 'scene1',
          gameMasterId: mockUserId,
          connectedUsers: [],
          status: 'active',
          startedAt: new Date()
        };
        
        const pausedSession: GameSession = {
          sessionId: 's2',
          campaignId: 'c2',
          sceneId: 'scene2',
          gameMasterId: mockUserId,
          connectedUsers: [],
          status: 'paused',
          startedAt: new Date()
        };

        (service as any).activeSessions.set('s1', activeSession);
        (service as any).activeSessions.set('s2', pausedSession);

        const result = service.getActiveSessions();

        expect(result).toHaveLength(1);
        expect(result[0].sessionId).toBe('s1');
      });
    });
  });
});
