import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  EncounterService,
  CreateEncounterRequest,
  AddParticipantRequest,
  EncounterSearchOptions,
} from "./EncounterService";
import { PrismaClient } from "@prisma/client";

// Mock dependencies
vi.mock("@prisma/client");

describe("EncounterService", () => {
  let service: EncounterService;
  let mockPrisma: any;

  const mockEncounterId = "encounter-123";
  const mockCampaignId = "campaign-456";
  const mockActorId = "actor-789";
  const mockActorId2 = "actor-999";

  beforeEach(() => {
    // Setup mock Prisma client
    mockPrisma = {
      encounter: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
      },
      encounterParticipant: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      actor: {
        findUnique: vi.fn(),
      },
    };

    service = new EncounterService(mockPrisma);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("searchEncounters", () => {
    it("should search encounters with default pagination", async () => {
      const mockEncounters = [
        {
          id: "enc-1",
          name: "Goblin Ambush",
          campaignId: mockCampaignId,
          isActive: true,
          participants: [],
        },
      ];

      mockPrisma.encounter.findMany.mockResolvedValue(mockEncounters);
      mockPrisma.encounter.count.mockResolvedValue(1);

      const options: EncounterSearchOptions = {
        campaignId: mockCampaignId,
      };

      const result = await service.searchEncounters(options);

      expect(result.items).toEqual(mockEncounters);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });
  });

  describe("getEncounter", () => {
    it("should get encounter with all relations", async () => {
      const mockEncounter = {
        id: mockEncounterId,
        name: "Test Encounter",
        participants: [],
      };

      mockPrisma.encounter.findUnique.mockResolvedValue(mockEncounter);

      const result = await service.getEncounter(mockEncounterId);

      expect(result).toEqual(mockEncounter);
    });
  });

  describe("createEncounter", () => {
    it("should create encounter with default values", async () => {
      const request: CreateEncounterRequest = {
        name: "Boss Fight",
        campaignId: mockCampaignId,
        description: "Final battle",
      };

      mockPrisma.encounter.create.mockResolvedValue({
        id: mockEncounterId,
        name: "Boss Fight",
        isActive: false,
        participants: [],
      });

      const result = await service.createEncounter(request);

      expect(result.name).toBe("Boss Fight");
      expect(result.isActive).toBe(false);
    });
  });

  describe("addParticipant", () => {
    it("should add participant to encounter", async () => {
      mockPrisma.encounter.findUnique.mockResolvedValue({ id: mockEncounterId });
      mockPrisma.actor.findUnique.mockResolvedValue({ id: mockActorId });
      mockPrisma.encounterParticipant.findUnique.mockResolvedValue(null);
      mockPrisma.encounterParticipant.create.mockResolvedValue({
        encounterId: mockEncounterId,
        actorId: mockActorId,
        initiative: 15,
      });

      const request: AddParticipantRequest = {
        actorId: mockActorId,
        initiative: 15,
      };

      const result = await service.addParticipant(mockEncounterId, request);

      expect(result.actorId).toBe(mockActorId);
      expect(result.initiative).toBe(15);
    });

    it("should throw error for non-existent encounter", async () => {
      mockPrisma.encounter.findUnique.mockResolvedValue(null);

      const request: AddParticipantRequest = {
        actorId: mockActorId,
        initiative: 10,
      };

      await expect(service.addParticipant("invalid-id", request)).rejects.toThrow(
        "Encounter not found",
      );
    });
  });

  describe("startEncounter", () => {
    it("should start encounter with participants", async () => {
      mockPrisma.encounterParticipant.count.mockResolvedValue(2);
      mockPrisma.encounterParticipant.updateMany.mockResolvedValue({});
      mockPrisma.encounter.update.mockResolvedValue({
        id: mockEncounterId,
        isActive: true,
        currentRound: 1,
        currentTurn: 0,
        participants: [],
      });

      const result = await service.startEncounter(mockEncounterId);

      expect(result.isActive).toBe(true);
      expect(result.currentRound).toBe(1);
      expect(result.currentTurn).toBe(0);
    });

    it("should throw error if no participants", async () => {
      mockPrisma.encounterParticipant.count.mockResolvedValue(0);

      await expect(service.startEncounter(mockEncounterId)).rejects.toThrow(
        "Cannot start encounter without participants",
      );
    });
  });

  describe("nextTurn", () => {
    it("should advance to next turn", async () => {
      const mockEncounter = {
        id: mockEncounterId,
        isActive: true,
        currentRound: 1,
        currentTurn: 0,
        participants: [
          { actorId: mockActorId, initiative: 20, isActive: true },
          { actorId: mockActorId2, initiative: 15, isActive: true },
        ],
      };

      mockPrisma.encounter.findUnique.mockResolvedValue(mockEncounter);
      mockPrisma.encounter.update.mockResolvedValue({
        ...mockEncounter,
        currentTurn: 1,
      });

      const result = await service.nextTurn(mockEncounterId);

      expect(result.encounter.currentTurn).toBe(1);
      expect(result.currentParticipant).toEqual(mockEncounter.participants[1]);
    });

    it("should throw error for non-existent encounter", async () => {
      mockPrisma.encounter.findUnique.mockResolvedValue(null);

      await expect(service.nextTurn("invalid-id")).rejects.toThrow("Encounter not found");
    });
  });

  describe("endEncounter", () => {
    it("should end encounter", async () => {
      mockPrisma.encounter.update.mockResolvedValue({
        id: mockEncounterId,
        isActive: false,
        participants: [],
      });

      const result = await service.endEncounter(mockEncounterId);

      expect(result.isActive).toBe(false);
    });
  });

  describe("deleteEncounter", () => {
    it("should delete encounter", async () => {
      mockPrisma.encounter.delete.mockResolvedValue({
        id: mockEncounterId,
        name: "Deleted Encounter",
      });

      const result = await service.deleteEncounter(mockEncounterId);

      expect(result.id).toBe(mockEncounterId);
    });
  });

  describe("rollInitiativeForAll", () => {
    it("should roll initiative for all participants", async () => {
      const mockParticipants = [
        {
          encounterId: mockEncounterId,
          actorId: mockActorId,
          actor: {
            monster: {
              statblock: {
                abilities: { DEX: 14 },
              },
            },
          },
        },
      ];

      mockPrisma.encounterParticipant.findMany.mockResolvedValue(mockParticipants);
      mockPrisma.encounterParticipant.update.mockResolvedValue({});
      mockPrisma.encounter.findUnique.mockResolvedValue({
        id: mockEncounterId,
        participants: [],
      });

      const originalRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0.5);

      await service.rollInitiativeForAll(mockEncounterId);

      expect(mockPrisma.encounterParticipant.update).toHaveBeenCalledWith({
        where: {
          encounterId_actorId: {
            encounterId: mockEncounterId,
            actorId: mockActorId,
          },
        },
        data: { initiative: 13 },
      });

      Math.random = originalRandom;
    });
  });

  describe("getEncounterStats", () => {
    it("should return encounter statistics", async () => {
      mockPrisma.encounter.count.mockResolvedValueOnce(10);
      mockPrisma.encounter.count.mockResolvedValueOnce(2);
      mockPrisma.encounter.aggregate.mockResolvedValue({
        _avg: { currentRound: 5.5 },
      });

      const result = await service.getEncounterStats(mockCampaignId);

      expect(result.total).toBe(10);
      expect(result.active).toBe(2);
      expect(result.averageRounds).toBe(5.5);
    });

    it("should handle no completed encounters", async () => {
      mockPrisma.encounter.count.mockResolvedValueOnce(0);
      mockPrisma.encounter.count.mockResolvedValueOnce(0);
      mockPrisma.encounter.aggregate.mockResolvedValue({
        _avg: { currentRound: null },
      });

      const result = await service.getEncounterStats(mockCampaignId);

      expect(result.total).toBe(0);
      expect(result.active).toBe(0);
      expect(result.averageRounds).toBe(0);
    });
  });
});
