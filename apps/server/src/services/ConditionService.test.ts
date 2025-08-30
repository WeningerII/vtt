import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ConditionService,
  CreateConditionRequest,
  UpdateConditionRequest,
  ApplyConditionRequest,
  ConditionSearchOptions,
} from "./ConditionService";
import { PrismaClient } from "@prisma/client";

// Mock dependencies
vi.mock("@prisma/client");

describe("ConditionService", () => {
  let service: ConditionService;
  let mockPrisma: any;

  const mockConditionId = "condition-123";
  const mockActorId = "actor-456";
  const mockTokenId = "token-789";
  const mockParticipantId = "participant-111";
  const mockAppliedConditionId = "applied-222";

  beforeEach(() => {
    // Setup mock Prisma client
    mockPrisma = {
      condition: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      appliedCondition: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      actor: {
        findUnique: vi.fn(),
      },
      token: {
        findUnique: vi.fn(),
      },
      encounterParticipant: {
        findUnique: vi.fn(),
      },
    };

    service = new ConditionService(mockPrisma);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("searchConditions", () => {
    it("should search conditions with default pagination", async () => {
      const mockConditions = [
        { id: "cond-1", name: "Blessed", type: "BUFF" },
        { id: "cond-2", name: "Poisoned", type: "DEBUFF" },
      ];

      mockPrisma.condition.findMany.mockResolvedValue(mockConditions);
      mockPrisma.condition.count.mockResolvedValue(2);

      const result = await service.searchConditions();

      expect(result.items).toEqual(mockConditions);
      expect(result.total).toBe(2);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);

      expect(mockPrisma.condition.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 50,
        orderBy: { name: "asc" },
      });
    });

    it("should filter conditions by type", async () => {
      mockPrisma.condition.findMany.mockResolvedValue([]);
      mockPrisma.condition.count.mockResolvedValue(0);

      const options: ConditionSearchOptions = {
        type: "BUFF",
      };

      await service.searchConditions(options);

      expect(mockPrisma.condition.findMany).toHaveBeenCalledWith({
        where: { type: "BUFF" },
        skip: 0,
        take: 50,
        orderBy: { name: "asc" },
      });
    });

    it("should respect custom pagination", async () => {
      mockPrisma.condition.findMany.mockResolvedValue([]);
      mockPrisma.condition.count.mockResolvedValue(100);

      const options: ConditionSearchOptions = {
        limit: 25,
        offset: 50,
      };

      const result = await service.searchConditions(options);

      expect(mockPrisma.condition.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 50,
        take: 25,
        orderBy: { name: "asc" },
      });
      expect(result.limit).toBe(25);
      expect(result.offset).toBe(50);
    });

    it("should cap limit at 200", async () => {
      mockPrisma.condition.findMany.mockResolvedValue([]);
      mockPrisma.condition.count.mockResolvedValue(500);

      const options: ConditionSearchOptions = {
        limit: 300,
      };

      await service.searchConditions(options);

      expect(mockPrisma.condition.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 200,
        orderBy: { name: "asc" },
      });
    });
  });

  describe("getCondition", () => {
    it("should get condition with all applied instances", async () => {
      const mockCondition = {
        id: mockConditionId,
        name: "Stunned",
        type: "DEBUFF",
        appliedConditions: [
          {
            id: "applied-1",
            actor: { id: "actor-1", name: "Hero" },
            token: null,
            encounterParticipant: null,
          },
        ],
      };

      mockPrisma.condition.findUnique.mockResolvedValue(mockCondition);

      const result = await service.getCondition(mockConditionId);

      expect(result).toEqual(mockCondition);
      expect(mockPrisma.condition.findUnique).toHaveBeenCalledWith({
        where: { id: mockConditionId },
        include: {
          appliedConditions: {
            include: {
              actor: true,
              token: true,
              encounterParticipant: {
                include: {
                  actor: true,
                },
              },
            },
          },
        },
      });
    });

    it("should return null for non-existent condition", async () => {
      mockPrisma.condition.findUnique.mockResolvedValue(null);

      const result = await service.getCondition("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("createCondition", () => {
    it("should create condition with all fields", async () => {
      const request: CreateConditionRequest = {
        name: "Hasted",
        type: "BUFF",
        description: "Your speed is doubled",
        duration: 10,
        metadata: { speedMultiplier: 2 },
      };

      mockPrisma.condition.create.mockResolvedValue({
        id: mockConditionId,
        ...request,
      });

      const result = await service.createCondition(request);

      expect(result.name).toBe("Hasted");
      expect(result.type).toBe("BUFF");
      expect(mockPrisma.condition.create).toHaveBeenCalledWith({
        data: {
          name: "Hasted",
          type: "BUFF",
          description: "Your speed is doubled",
          duration: 10,
          metadata: { speedMultiplier: 2 },
        },
      });
    });

    it("should use defaults for optional fields", async () => {
      const request: CreateConditionRequest = {
        name: "Confused",
        type: "DEBUFF",
      };

      mockPrisma.condition.create.mockResolvedValue({
        id: mockConditionId,
        name: "Confused",
        type: "DEBUFF",
      });

      await service.createCondition(request);

      expect(mockPrisma.condition.create).toHaveBeenCalledWith({
        data: {
          name: "Confused",
          type: "DEBUFF",
          description: "",
          duration: undefined,
          metadata: {},
        },
      });
    });
  });

  describe("updateCondition", () => {
    it("should update all provided fields", async () => {
      const request: UpdateConditionRequest = {
        name: "Updated Name",
        type: "NEUTRAL",
        description: "Updated description",
        duration: 5,
        metadata: { updated: true },
      };

      mockPrisma.condition.update.mockResolvedValue({
        id: mockConditionId,
        ...request,
      });

      await service.updateCondition(mockConditionId, request);

      expect(mockPrisma.condition.update).toHaveBeenCalledWith({
        where: { id: mockConditionId },
        data: request,
      });
    });

    it("should update only provided fields", async () => {
      const request: UpdateConditionRequest = {
        duration: 15,
        type: "BUFF",
      };

      mockPrisma.condition.update.mockResolvedValue({
        id: mockConditionId,
        duration: 15,
        type: "BUFF",
      });

      await service.updateCondition(mockConditionId, request);

      expect(mockPrisma.condition.update).toHaveBeenCalledWith({
        where: { id: mockConditionId },
        data: {
          duration: 15,
          type: "BUFF",
        },
      });
    });

    it("should handle undefined values correctly", async () => {
      const request: UpdateConditionRequest = {
        name: undefined,
        duration: 0,
      };

      mockPrisma.condition.update.mockResolvedValue({
        id: mockConditionId,
      });

      await service.updateCondition(mockConditionId, request);

      expect(mockPrisma.condition.update).toHaveBeenCalledWith({
        where: { id: mockConditionId },
        data: {
          duration: 0,
        },
      });
    });
  });

  describe("deleteCondition", () => {
    it("should delete condition by id", async () => {
      mockPrisma.condition.delete.mockResolvedValue({
        id: mockConditionId,
        name: "Deleted Condition",
      });

      const result = await service.deleteCondition(mockConditionId);

      expect(result.id).toBe(mockConditionId);
      expect(mockPrisma.condition.delete).toHaveBeenCalledWith({
        where: { id: mockConditionId },
      });
    });
  });

  describe("applyConditionToActor", () => {
    it("should apply condition to actor", async () => {
      const mockCondition = {
        id: mockConditionId,
        name: "Blessed",
        type: "BUFF",
        duration: 10,
      };

      const mockActor = {
        id: mockActorId,
        name: "Hero",
      };

      mockPrisma.condition.findUnique.mockResolvedValue(mockCondition);
      mockPrisma.actor.findUnique.mockResolvedValue(mockActor);
      mockPrisma.appliedCondition.create.mockResolvedValue({
        id: mockAppliedConditionId,
        conditionId: mockConditionId,
        actorId: mockActorId,
        condition: mockCondition,
        actor: mockActor,
        duration: 10,
        appliedAt: new Date(),
      });

      const request: ApplyConditionRequest = {
        conditionId: mockConditionId,
        duration: 10,
        appliedBy: "GM",
      };

      const result = await service.applyConditionToActor(mockActorId, request);

      expect(result.conditionId).toBe(mockConditionId);
      expect(result.actorId).toBe(mockActorId);
      expect(mockPrisma.appliedCondition.create).toHaveBeenCalledWith({
        data: {
          conditionId: mockConditionId,
          actorId: mockActorId,
          duration: 10,
          metadata: {},
          appliedBy: "GM",
          appliedAt: expect.any(Date),
        },
        include: {
          condition: true,
          actor: true,
        },
      });
    });

    it("should use condition default duration if not specified", async () => {
      const mockCondition = {
        id: mockConditionId,
        name: "Stunned",
        duration: 5,
      };

      mockPrisma.condition.findUnique.mockResolvedValue(mockCondition);
      mockPrisma.actor.findUnique.mockResolvedValue({ id: mockActorId });
      mockPrisma.appliedCondition.create.mockResolvedValue({
        id: mockAppliedConditionId,
        duration: 5,
      });

      const request: ApplyConditionRequest = {
        conditionId: mockConditionId,
      };

      await service.applyConditionToActor(mockActorId, request);

      expect(mockPrisma.appliedCondition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          duration: 5,
        }),
        include: {
          condition: true,
          actor: true,
        },
      });
    });

    it("should throw error for non-existent condition", async () => {
      mockPrisma.condition.findUnique.mockResolvedValue(null);

      const request: ApplyConditionRequest = {
        conditionId: "invalid-id",
      };

      await expect(service.applyConditionToActor(mockActorId, request)).rejects.toThrow(
        "Condition not found",
      );
    });

    it("should throw error for non-existent actor", async () => {
      mockPrisma.condition.findUnique.mockResolvedValue({ id: mockConditionId });
      mockPrisma.actor.findUnique.mockResolvedValue(null);

      const request: ApplyConditionRequest = {
        conditionId: mockConditionId,
      };

      await expect(service.applyConditionToActor("invalid-id", request)).rejects.toThrow(
        "Actor not found",
      );
    });
  });

  describe("applyConditionToToken", () => {
    it("should apply condition to token", async () => {
      const mockCondition = {
        id: mockConditionId,
        name: "Invisible",
        type: "BUFF",
      };

      const mockToken = {
        id: mockTokenId,
        name: "Rogue Token",
      };

      mockPrisma.condition.findUnique.mockResolvedValue(mockCondition);
      mockPrisma.token.findUnique.mockResolvedValue(mockToken);
      mockPrisma.appliedCondition.create.mockResolvedValue({
        id: mockAppliedConditionId,
        conditionId: mockConditionId,
        tokenId: mockTokenId,
        condition: mockCondition,
        token: mockToken,
      });

      const request: ApplyConditionRequest = {
        conditionId: mockConditionId,
        metadata: { source: "spell" },
      };

      const result = await service.applyConditionToToken(mockTokenId, request);

      expect(result.tokenId).toBe(mockTokenId);
      expect(mockPrisma.appliedCondition.create).toHaveBeenCalledWith({
        data: {
          conditionId: mockConditionId,
          tokenId: mockTokenId,
          duration: undefined,
          metadata: { source: "spell" },
          appliedBy: undefined,
          appliedAt: expect.any(Date),
        },
        include: {
          condition: true,
          token: true,
        },
      });
    });

    it("should throw error for non-existent token", async () => {
      mockPrisma.condition.findUnique.mockResolvedValue({ id: mockConditionId });
      mockPrisma.token.findUnique.mockResolvedValue(null);

      const request: ApplyConditionRequest = {
        conditionId: mockConditionId,
      };

      await expect(service.applyConditionToToken("invalid-id", request)).rejects.toThrow(
        "Token not found",
      );
    });
  });

  describe("applyConditionToEncounterParticipant", () => {
    it("should apply condition to encounter participant", async () => {
      const mockCondition = {
        id: mockConditionId,
        name: "Frightened",
        type: "DEBUFF",
      };

      const mockParticipant = {
        id: mockParticipantId,
        actorId: mockActorId,
      };

      mockPrisma.condition.findUnique.mockResolvedValue(mockCondition);
      mockPrisma.encounterParticipant.findUnique.mockResolvedValue(mockParticipant);
      mockPrisma.appliedCondition.create.mockResolvedValue({
        id: mockAppliedConditionId,
        conditionId: mockConditionId,
        encounterParticipantId: mockParticipantId,
        condition: mockCondition,
        encounterParticipant: mockParticipant,
      });

      const request: ApplyConditionRequest = {
        conditionId: mockConditionId,
        duration: 3,
      };

      const result = await service.applyConditionToEncounterParticipant(mockParticipantId, request);

      expect(result.encounterParticipantId).toBe(mockParticipantId);
      expect(mockPrisma.appliedCondition.create).toHaveBeenCalledWith({
        data: {
          conditionId: mockConditionId,
          encounterParticipantId: mockParticipantId,
          duration: 3,
          metadata: {},
          appliedBy: undefined,
          appliedAt: expect.any(Date),
        },
        include: {
          condition: true,
          encounterParticipant: {
            include: {
              actor: true,
            },
          },
        },
      });
    });

    it("should throw error for non-existent participant", async () => {
      mockPrisma.condition.findUnique.mockResolvedValue({ id: mockConditionId });
      mockPrisma.encounterParticipant.findUnique.mockResolvedValue(null);

      const request: ApplyConditionRequest = {
        conditionId: mockConditionId,
      };

      await expect(
        service.applyConditionToEncounterParticipant("invalid-id", request),
      ).rejects.toThrow("Encounter participant not found");
    });
  });

  describe("removeAppliedCondition", () => {
    it("should remove applied condition", async () => {
      mockPrisma.appliedCondition.delete.mockResolvedValue({
        id: mockAppliedConditionId,
      });

      const result = await service.removeAppliedCondition(mockAppliedConditionId);

      expect(result.id).toBe(mockAppliedConditionId);
      expect(mockPrisma.appliedCondition.delete).toHaveBeenCalledWith({
        where: { id: mockAppliedConditionId },
      });
    });
  });

  describe("getAppliedCondition", () => {
    it("should get applied condition with all relations", async () => {
      const mockAppliedCondition = {
        id: mockAppliedConditionId,
        conditionId: mockConditionId,
        actorId: mockActorId,
        condition: { name: "Blessed" },
        actor: { name: "Hero" },
        token: null,
        encounterParticipant: null,
      };

      mockPrisma.appliedCondition.findUnique.mockResolvedValue(mockAppliedCondition);

      const result = await service.getAppliedCondition(mockAppliedConditionId);

      expect(result).toEqual(mockAppliedCondition);
      expect(mockPrisma.appliedCondition.findUnique).toHaveBeenCalledWith({
        where: { id: mockAppliedConditionId },
        include: {
          condition: true,
          actor: true,
          token: true,
          encounterParticipant: {
            include: {
              actor: true,
            },
          },
        },
      });
    });
  });

  describe("getActorConditions", () => {
    it("should get all conditions for an actor", async () => {
      const mockConditions = [
        {
          id: "applied-1",
          conditionId: "cond-1",
          condition: { name: "Blessed", type: "BUFF" },
          appliedAt: new Date("2024-01-02"),
        },
        {
          id: "applied-2",
          conditionId: "cond-2",
          condition: { name: "Poisoned", type: "DEBUFF" },
          appliedAt: new Date("2024-01-01"),
        },
      ];

      mockPrisma.appliedCondition.findMany.mockResolvedValue(mockConditions);

      const result = await service.getActorConditions(mockActorId);

      expect(result).toEqual(mockConditions);
      expect(mockPrisma.appliedCondition.findMany).toHaveBeenCalledWith({
        where: { actorId: mockActorId },
        include: {
          condition: true,
        },
        orderBy: { appliedAt: "desc" },
      });
    });
  });

  describe("getTokenConditions", () => {
    it("should get all conditions for a token", async () => {
      const mockConditions = [
        {
          id: "applied-1",
          tokenId: mockTokenId,
          condition: { name: "Invisible" },
        },
      ];

      mockPrisma.appliedCondition.findMany.mockResolvedValue(mockConditions);

      const result = await service.getTokenConditions(mockTokenId);

      expect(result).toEqual(mockConditions);
      expect(mockPrisma.appliedCondition.findMany).toHaveBeenCalledWith({
        where: { tokenId: mockTokenId },
        include: {
          condition: true,
        },
        orderBy: { appliedAt: "desc" },
      });
    });
  });

  describe("getEncounterParticipantConditions", () => {
    it("should get all conditions for an encounter participant", async () => {
      const mockConditions = [
        {
          id: "applied-1",
          encounterParticipantId: mockParticipantId,
          condition: { name: "Stunned" },
        },
      ];

      mockPrisma.appliedCondition.findMany.mockResolvedValue(mockConditions);

      const result = await service.getEncounterParticipantConditions(mockParticipantId);

      expect(result).toEqual(mockConditions);
      expect(mockPrisma.appliedCondition.findMany).toHaveBeenCalledWith({
        where: { encounterParticipantId: mockParticipantId },
        include: {
          condition: true,
        },
        orderBy: { appliedAt: "desc" },
      });
    });
  });

  describe("updateAppliedCondition", () => {
    it("should update duration and metadata", async () => {
      const updates = {
        duration: 5,
        metadata: { intensity: "strong" },
      };

      mockPrisma.appliedCondition.update.mockResolvedValue({
        id: mockAppliedConditionId,
        ...updates,
      });

      await service.updateAppliedCondition(mockAppliedConditionId, updates);

      expect(mockPrisma.appliedCondition.update).toHaveBeenCalledWith({
        where: { id: mockAppliedConditionId },
        data: updates,
        include: {
          condition: true,
          actor: true,
          token: true,
          encounterParticipant: {
            include: {
              actor: true,
            },
          },
        },
      });
    });

    it("should update only provided fields", async () => {
      const updates = {
        duration: 10,
      };

      mockPrisma.appliedCondition.update.mockResolvedValue({
        id: mockAppliedConditionId,
        duration: 10,
      });

      await service.updateAppliedCondition(mockAppliedConditionId, updates);

      expect(mockPrisma.appliedCondition.update).toHaveBeenCalledWith({
        where: { id: mockAppliedConditionId },
        data: { duration: 10 },
        include: {
          condition: true,
          actor: true,
          token: true,
          encounterParticipant: {
            include: {
              actor: true,
            },
          },
        },
      });
    });
  });

  describe("getConditionStats", () => {
    it("should return condition statistics", async () => {
      mockPrisma.condition.count.mockResolvedValue(10);
      mockPrisma.condition.groupBy.mockResolvedValue([
        { type: "BUFF", _count: 4 },
        { type: "DEBUFF", _count: 5 },
        { type: "NEUTRAL", _count: 1 },
      ]);
      mockPrisma.appliedCondition.count.mockResolvedValue(15);

      const result = await service.getConditionStats();

      expect(result.total).toBe(10);
      expect(result.active).toBe(15);
      expect(result.byType).toEqual({
        BUFF: 4,
        DEBUFF: 5,
        NEUTRAL: 1,
      });
    });

    it("should handle empty results", async () => {
      mockPrisma.condition.count.mockResolvedValue(0);
      mockPrisma.condition.groupBy.mockResolvedValue([]);
      mockPrisma.appliedCondition.count.mockResolvedValue(0);

      const result = await service.getConditionStats();

      expect(result.total).toBe(0);
      expect(result.active).toBe(0);
      expect(result.byType).toEqual({});
    });
  });

  describe("cleanupExpiredConditions", () => {
    it("should remove expired conditions", async () => {
      const expiredConditions = [
        {
          id: "expired-1",
          duration: 1,
          appliedAt: new Date("2024-01-01"),
        },
        {
          id: "expired-2",
          duration: 2,
          appliedAt: new Date("2024-01-01"),
        },
      ];

      mockPrisma.appliedCondition.findMany.mockResolvedValue(expiredConditions);
      mockPrisma.appliedCondition.delete.mockResolvedValue({});

      const result = await service.cleanupExpiredConditions();

      expect(result.removed).toBe(2);
      expect(mockPrisma.appliedCondition.delete).toHaveBeenCalledTimes(2);
      expect(mockPrisma.appliedCondition.delete).toHaveBeenCalledWith({
        where: { id: "expired-1" },
      });
      expect(mockPrisma.appliedCondition.delete).toHaveBeenCalledWith({
        where: { id: "expired-2" },
      });
    });

    it("should handle no expired conditions", async () => {
      mockPrisma.appliedCondition.findMany.mockResolvedValue([]);

      const result = await service.cleanupExpiredConditions();

      expect(result.removed).toBe(0);
      expect(mockPrisma.appliedCondition.delete).not.toHaveBeenCalled();
    });

    it("should only find conditions with duration", async () => {
      mockPrisma.appliedCondition.findMany.mockResolvedValue([]);

      await service.cleanupExpiredConditions();

      expect(mockPrisma.appliedCondition.findMany).toHaveBeenCalledWith({
        where: {
          duration: { not: null },
          appliedAt: {
            lte: expect.any(Date),
          },
        },
      });
    });
  });
});
