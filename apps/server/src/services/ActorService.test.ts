import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ActorService,
  CreateActorRequest,
  UpdateActorRequest,
  ActorSearchOptions,
} from "./ActorService";
import { PrismaClient } from "@prisma/client";

// Mock dependencies
vi.mock("@prisma/client");

describe("ActorService", () => {
  let service: ActorService;
  // TODO: Type mockPrisma as PrismaClient mock instead of any
  let mockPrisma: any;

  const mockCampaignId = "campaign-123";
  const mockUserId = "user-456";
  const mockActorId = "actor-789";
  const mockMonsterId = "monster-111";
  const mockCharacterId = "character-222";

  beforeEach(() => {
    // Setup mock Prisma client
    mockPrisma = {
      actor: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      monster: {
        findUnique: vi.fn(),
      },
      character: {
        findUnique: vi.fn(),
      },
    };

    service = new ActorService(mockPrisma);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("searchActors", () => {
    it("should search actors with default pagination", async () => {
      const mockActors = [
        {
          id: "actor-1",
          name: "Goblin",
          kind: "MONSTER",
          campaignId: mockCampaignId,
          isActive: true,
          monster: { id: "monster-1", name: "Goblin" },
          character: null,
          tokens: [],
          appliedConditions: [],
        },
        {
          id: "actor-2",
          name: "Hero",
          kind: "PC",
          campaignId: mockCampaignId,
          isActive: true,
          monster: null,
          character: { id: "char-1", name: "Hero" },
          tokens: [],
          appliedConditions: [],
        },
      ];

      mockPrisma.actor.findMany.mockResolvedValue(mockActors);
      mockPrisma.actor.count.mockResolvedValue(2);

      const options: ActorSearchOptions = {
        campaignId: mockCampaignId,
      };

      const result = await service.searchActors(options);

      expect(result.items).toEqual(mockActors);
      expect(result.total).toBe(2);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);

      expect(mockPrisma.actor.findMany).toHaveBeenCalledWith({
        where: { campaignId: mockCampaignId },
        skip: 0,
        take: 50,
        orderBy: { name: "asc" },
        include: {
          monster: true,
          character: true,
          tokens: true,
          appliedConditions: {
            include: {
              condition: true,
            },
          },
        },
      });
    });

    it("should filter actors by kind", async () => {
      mockPrisma.actor.findMany.mockResolvedValue([]);
      mockPrisma.actor.count.mockResolvedValue(0);

      const options: ActorSearchOptions = {
        campaignId: mockCampaignId,
        kind: "MONSTER",
      };

      await service.searchActors(options);

      expect(mockPrisma.actor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaignId: mockCampaignId,
            kind: "MONSTER",
          },
        }),
      );
    });

    it("should filter actors by active status", async () => {
      mockPrisma.actor.findMany.mockResolvedValue([]);
      mockPrisma.actor.count.mockResolvedValue(0);

      const options: ActorSearchOptions = {
        campaignId: mockCampaignId,
        isActive: false,
      };

      await service.searchActors(options);

      expect(mockPrisma.actor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaignId: mockCampaignId,
            isActive: false,
          },
        }),
      );
    });

    it("should respect custom pagination", async () => {
      mockPrisma.actor.findMany.mockResolvedValue([]);
      mockPrisma.actor.count.mockResolvedValue(100);

      const options: ActorSearchOptions = {
        campaignId: mockCampaignId,
        limit: 25,
        offset: 50,
      };

      const result = await service.searchActors(options);

      expect(mockPrisma.actor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 50,
          take: 25,
        }),
      );
      expect(result.limit).toBe(25);
      expect(result.offset).toBe(50);
    });

    it("should cap limit at 200", async () => {
      mockPrisma.actor.findMany.mockResolvedValue([]);
      mockPrisma.actor.count.mockResolvedValue(500);

      const options: ActorSearchOptions = {
        campaignId: mockCampaignId,
        limit: 300,
      };

      await service.searchActors(options);

      expect(mockPrisma.actor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 200,
        }),
      );
    });
  });

  describe("getActor", () => {
    it("should get actor with all relations", async () => {
      const mockActor = {
        id: mockActorId,
        name: "Test Actor",
        kind: "NPC",
        monster: null,
        character: null,
        tokens: [],
        appliedConditions: [],
        encounterParticipants: [],
      };

      mockPrisma.actor.findUnique.mockResolvedValue(mockActor);

      const result = await service.getActor(mockActorId);

      expect(result).toEqual(mockActor);
      expect(mockPrisma.actor.findUnique).toHaveBeenCalledWith({
        where: { id: mockActorId },
        include: {
          monster: true,
          character: true,
          tokens: true,
          appliedConditions: {
            include: {
              condition: true,
            },
          },
          encounterParticipants: {
            include: {
              encounter: true,
            },
          },
        },
      });
    });

    it("should return null for non-existent actor", async () => {
      mockPrisma.actor.findUnique.mockResolvedValue(null);

      const result = await service.getActor("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("createActor", () => {
    it("should create PC actor with character reference", async () => {
      const mockCharacter = {
        id: mockCharacterId,
        name: "Hero Character",
      };

      mockPrisma.character.findUnique.mockResolvedValue(mockCharacter);
      mockPrisma.actor.create.mockResolvedValue({
        id: mockActorId,
        name: "Hero",
        kind: "PC",
        characterId: mockCharacterId,
        character: mockCharacter,
      });

      const request: CreateActorRequest = {
        name: "Hero",
        kind: "PC",
        campaignId: mockCampaignId,
        userId: mockUserId,
        characterId: mockCharacterId,
        currentHp: 50,
        maxHp: 50,
        ac: 16,
      };

      const result = await service.createActor(request);

      expect(result.name).toBe("Hero");
      expect(result.kind).toBe("PC");
      expect(mockPrisma.actor.create).toHaveBeenCalledWith({
        data: {
          name: "Hero",
          kind: "PC",
          campaignId: mockCampaignId,
          userId: mockUserId,
          characterId: mockCharacterId,
          monsterId: undefined,
          currentHp: 50,
          maxHp: 50,
          tempHp: 0,
          ac: 16,
          initiative: 0,
          isActive: true,
        },
        include: {
          monster: true,
          character: true,
        },
      });
    });

    it("should create MONSTER actor with monster reference", async () => {
      const mockMonster = {
        id: mockMonsterId,
        name: "Goblin",
      };

      mockPrisma.monster.findUnique.mockResolvedValue(mockMonster);
      mockPrisma.actor.create.mockResolvedValue({
        id: mockActorId,
        name: "Goblin Scout",
        kind: "MONSTER",
        monsterId: mockMonsterId,
        monster: mockMonster,
      });

      const request: CreateActorRequest = {
        name: "Goblin Scout",
        kind: "MONSTER",
        campaignId: mockCampaignId,
        userId: mockUserId,
        monsterId: mockMonsterId,
        currentHp: 7,
        maxHp: 7,
        ac: 13,
      };

      const result = await service.createActor(request);

      expect(result.name).toBe("Goblin Scout");
      expect(result.kind).toBe("MONSTER");
    });

    it("should throw error for invalid monster reference", async () => {
      mockPrisma.monster.findUnique.mockResolvedValue(null);

      const request: CreateActorRequest = {
        name: "Invalid Monster",
        kind: "MONSTER",
        campaignId: mockCampaignId,
        userId: mockUserId,
        monsterId: "invalid-id",
      };

      await expect(service.createActor(request)).rejects.toThrow("Monster not found");
    });

    it("should throw error for invalid character reference", async () => {
      mockPrisma.character.findUnique.mockResolvedValue(null);

      const request: CreateActorRequest = {
        name: "Invalid Character",
        kind: "PC",
        campaignId: mockCampaignId,
        userId: mockUserId,
        characterId: "invalid-id",
      };

      await expect(service.createActor(request)).rejects.toThrow("Character not found");
    });

    it("should use default values when not provided", async () => {
      mockPrisma.actor.create.mockResolvedValue({
        id: mockActorId,
        name: "NPC",
        kind: "NPC",
      });

      const request: CreateActorRequest = {
        name: "NPC",
        kind: "NPC",
        campaignId: mockCampaignId,
        userId: mockUserId,
      };

      await service.createActor(request);

      expect(mockPrisma.actor.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          currentHp: 0,
          maxHp: 0,
          tempHp: 0,
          ac: 10,
          initiative: 0,
          isActive: true,
        }),
        include: {
          monster: true,
          character: true,
        },
      });
    });
  });

  describe("createActorFromMonster", () => {
    it("should create actor from monster with statblock", async () => {
      const mockMonster = {
        id: mockMonsterId,
        name: "Goblin",
        statblock: {
          hp: { average: 7, formula: "2d6" },
          ac: { value: 15, type: "armor" },
        },
      };

      mockPrisma.monster.findUnique.mockResolvedValue(mockMonster);
      mockPrisma.actor.create.mockResolvedValue({
        id: mockActorId,
        name: "Goblin",
        kind: "MONSTER",
        monsterId: mockMonsterId,
        currentHp: 7,
        maxHp: 7,
        ac: 15,
      });

      const result = await service.createActorFromMonster(
        mockMonsterId,
        mockCampaignId,
        mockUserId,
      );

      expect(result.name).toBe("Goblin");
      expect(mockPrisma.actor.create).toHaveBeenCalledWith({
        data: {
          name: "Goblin",
          kind: "MONSTER",
          campaignId: mockCampaignId,
          userId: mockUserId,
          monsterId: mockMonsterId,
          currentHp: 7,
          maxHp: 7,
          tempHp: 0,
          ac: 15,
          initiative: 0,
          isActive: true,
        },
        include: {
          monster: true,
        },
      });
    });

    it("should use custom name if provided", async () => {
      const mockMonster = {
        id: mockMonsterId,
        name: "Goblin",
        statblock: {
          hp: { average: 7 },
          ac: { value: 15 },
        },
      };

      mockPrisma.monster.findUnique.mockResolvedValue(mockMonster);
      mockPrisma.actor.create.mockResolvedValue({
        id: mockActorId,
        name: "Goblin Chief",
        kind: "MONSTER",
      });

      await service.createActorFromMonster(
        mockMonsterId,
        mockCampaignId,
        mockUserId,
        "Goblin Chief",
      );

      expect(mockPrisma.actor.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Goblin Chief",
        }),
        include: {
          monster: true,
        },
      });
    });

    it("should use defaults for missing statblock values", async () => {
      const mockMonster = {
        id: mockMonsterId,
        name: "Strange Creature",
        statblock: {},
      };

      mockPrisma.monster.findUnique.mockResolvedValue(mockMonster);
      mockPrisma.actor.create.mockResolvedValue({
        id: mockActorId,
        name: "Strange Creature",
        kind: "MONSTER",
      });

      await service.createActorFromMonster(mockMonsterId, mockCampaignId, mockUserId);

      expect(mockPrisma.actor.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          currentHp: 1,
          maxHp: 1,
          ac: 10,
        }),
        include: {
          monster: true,
        },
      });
    });

    it("should throw error for non-existent monster", async () => {
      mockPrisma.monster.findUnique.mockResolvedValue(null);

      await expect(
        service.createActorFromMonster("invalid-id", mockCampaignId, mockUserId),
      ).rejects.toThrow("Monster not found");
    });
  });

  describe("updateActor", () => {
    it("should update all provided fields", async () => {
      const updateRequest: UpdateActorRequest = {
        name: "Updated Name",
        currentHp: 25,
        maxHp: 30,
        tempHp: 5,
        ac: 18,
        initiative: 15,
        isActive: false,
      };

      mockPrisma.actor.update.mockResolvedValue({
        id: mockActorId,
        ...updateRequest,
      });

      await service.updateActor(mockActorId, updateRequest);

      expect(mockPrisma.actor.update).toHaveBeenCalledWith({
        where: { id: mockActorId },
        data: updateRequest,
        include: {
          monster: true,
          character: true,
        },
      });
    });

    it("should update only provided fields", async () => {
      const updateRequest: UpdateActorRequest = {
        currentHp: 10,
        initiative: 20,
      };

      mockPrisma.actor.update.mockResolvedValue({
        id: mockActorId,
        currentHp: 10,
        initiative: 20,
      });

      await service.updateActor(mockActorId, updateRequest);

      expect(mockPrisma.actor.update).toHaveBeenCalledWith({
        where: { id: mockActorId },
        data: {
          currentHp: 10,
          initiative: 20,
        },
        include: {
          monster: true,
          character: true,
        },
      });
    });

    it("should handle undefined values correctly", async () => {
      const updateRequest: UpdateActorRequest = {
        name: undefined,
        currentHp: 0,
        isActive: false,
      };

      mockPrisma.actor.update.mockResolvedValue({
        id: mockActorId,
      });

      await service.updateActor(mockActorId, updateRequest);

      expect(mockPrisma.actor.update).toHaveBeenCalledWith({
        where: { id: mockActorId },
        data: {
          currentHp: 0,
          isActive: false,
        },
        include: {
          monster: true,
          character: true,
        },
      });
    });
  });

  describe("deleteActor", () => {
    it("should delete actor by id", async () => {
      mockPrisma.actor.delete.mockResolvedValue({
        id: mockActorId,
        name: "Deleted Actor",
      });

      const result = await service.deleteActor(mockActorId);

      expect(result.id).toBe(mockActorId);
      expect(mockPrisma.actor.delete).toHaveBeenCalledWith({
        where: { id: mockActorId },
      });
    });
  });

  describe("healActor", () => {
    it("should heal actor up to max HP", async () => {
      const mockActor = {
        id: mockActorId,
        currentHp: 10,
        maxHp: 25,
        tempHp: 0,
      };

      mockPrisma.actor.findUnique.mockResolvedValue(mockActor);
      mockPrisma.actor.update.mockResolvedValue({
        ...mockActor,
        currentHp: 20,
      });

      const result = await service.healActor(mockActorId, 10);

      expect(result.currentHp).toBe(20);
      expect(mockPrisma.actor.update).toHaveBeenCalledWith({
        where: { id: mockActorId },
        data: { currentHp: 20 },
        include: {
          monster: true,
          character: true,
        },
      });
    });

    it("should not heal beyond max HP", async () => {
      const mockActor = {
        id: mockActorId,
        currentHp: 20,
        maxHp: 25,
        tempHp: 0,
      };

      mockPrisma.actor.findUnique.mockResolvedValue(mockActor);
      mockPrisma.actor.update.mockResolvedValue({
        ...mockActor,
        currentHp: 25,
      });

      const result = await service.healActor(mockActorId, 10);

      expect(result.currentHp).toBe(25);
      expect(mockPrisma.actor.update).toHaveBeenCalledWith({
        where: { id: mockActorId },
        data: { currentHp: 25 },
        include: {
          monster: true,
          character: true,
        },
      });
    });

    it("should throw error for non-existent actor", async () => {
      mockPrisma.actor.findUnique.mockResolvedValue(null);

      await expect(service.healActor("invalid-id", 10)).rejects.toThrow("Actor not found");
    });
  });

  describe("damageActor", () => {
    it("should apply damage to temp HP first", async () => {
      const mockActor = {
        id: mockActorId,
        currentHp: 20,
        maxHp: 25,
        tempHp: 10,
      };

      mockPrisma.actor.findUnique.mockResolvedValue(mockActor);
      mockPrisma.actor.update.mockResolvedValue({
        ...mockActor,
        currentHp: 20,
        tempHp: 5,
      });

      const result = await service.damageActor(mockActorId, 5);

      expect(result.currentHp).toBe(20);
      expect(result.tempHp).toBe(5);
      expect(mockPrisma.actor.update).toHaveBeenCalledWith({
        where: { id: mockActorId },
        data: { currentHp: 20, tempHp: 5 },
        include: {
          monster: true,
          character: true,
        },
      });
    });

    it("should apply overflow damage to regular HP", async () => {
      const mockActor = {
        id: mockActorId,
        currentHp: 20,
        maxHp: 25,
        tempHp: 5,
      };

      mockPrisma.actor.findUnique.mockResolvedValue(mockActor);
      mockPrisma.actor.update.mockResolvedValue({
        ...mockActor,
        currentHp: 15,
        tempHp: 0,
      });

      const result = await service.damageActor(mockActorId, 10);

      expect(result.currentHp).toBe(15);
      expect(result.tempHp).toBe(0);
    });

    it("should not reduce HP below 0", async () => {
      const mockActor = {
        id: mockActorId,
        currentHp: 5,
        maxHp: 25,
        tempHp: 0,
      };

      mockPrisma.actor.findUnique.mockResolvedValue(mockActor);
      mockPrisma.actor.update.mockResolvedValue({
        ...mockActor,
        currentHp: 0,
        tempHp: 0,
      });

      const result = await service.damageActor(mockActorId, 10);

      expect(result.currentHp).toBe(0);
    });

    it("should throw error for non-existent actor", async () => {
      mockPrisma.actor.findUnique.mockResolvedValue(null);

      await expect(service.damageActor("invalid-id", 10)).rejects.toThrow("Actor not found");
    });
  });

  describe("addTempHp", () => {
    it("should set temp HP to new value if higher", async () => {
      const mockActor = {
        id: mockActorId,
        currentHp: 20,
        maxHp: 25,
        tempHp: 5,
      };

      mockPrisma.actor.findUnique.mockResolvedValue(mockActor);
      mockPrisma.actor.update.mockResolvedValue({
        ...mockActor,
        tempHp: 10,
      });

      const result = await service.addTempHp(mockActorId, 10);

      expect(result.tempHp).toBe(10);
    });

    it("should keep existing temp HP if higher", async () => {
      const mockActor = {
        id: mockActorId,
        currentHp: 20,
        maxHp: 25,
        tempHp: 15,
      };

      mockPrisma.actor.findUnique.mockResolvedValue(mockActor);
      mockPrisma.actor.update.mockResolvedValue({
        ...mockActor,
        tempHp: 15,
      });

      const result = await service.addTempHp(mockActorId, 10);

      expect(result.tempHp).toBe(15);
    });

    it("should throw error for non-existent actor", async () => {
      mockPrisma.actor.findUnique.mockResolvedValue(null);

      await expect(service.addTempHp("invalid-id", 10)).rejects.toThrow("Actor not found");
    });
  });

  describe("rollInitiative", () => {
    it("should update actor initiative", async () => {
      mockPrisma.actor.update.mockResolvedValue({
        id: mockActorId,
        initiative: 18,
      });

      const result = await service.rollInitiative(mockActorId, 18);

      expect(result.initiative).toBe(18);
      expect(mockPrisma.actor.update).toHaveBeenCalledWith({
        where: { id: mockActorId },
        data: { initiative: 18 },
        include: {
          monster: true,
          character: true,
        },
      });
    });
  });

  describe("getActorStats", () => {
    it("should return actor statistics for campaign", async () => {
      mockPrisma.actor.count.mockResolvedValueOnce(10); // total
      mockPrisma.actor.groupBy.mockResolvedValue([
        { kind: "PC", _count: 3 },
        { kind: "NPC", _count: 2 },
        { kind: "MONSTER", _count: 5 },
      ]);
      mockPrisma.actor.count.mockResolvedValueOnce(7); // active

      const result = await service.getActorStats(mockCampaignId);

      expect(result.total).toBe(10);
      expect(result.active).toBe(7);
      expect(result.byKind).toEqual({
        PC: 3,
        NPC: 2,
        MONSTER: 5,
      });
    });

    it("should handle empty results", async () => {
      mockPrisma.actor.count.mockResolvedValue(0);
      mockPrisma.actor.groupBy.mockResolvedValue([]);

      const result = await service.getActorStats(mockCampaignId);

      expect(result.total).toBe(0);
      expect(result.active).toBe(0);
      expect(result.byKind).toEqual({});
    });
  });
});
