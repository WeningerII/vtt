import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { RouteContext } from "../../utils/router";
import { Readable } from "stream";

// Mock dependencies
jest.mock("@vtt/logging", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    character: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    encounter: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $disconnect: jest.fn(),
  })),
}));

jest.mock("../../ai/combat", () => ({
  CrucibleService: jest.fn().mockImplementation(() => ({
    generateCombatSuggestion: jest.fn(),
    analyzeCombatSituation: jest.fn(),
    suggestOptimalAction: jest.fn(),
  })),
}));

// Import route handlers after mocking
import {
  combatSuggestionHandler,
  combatAnalysisHandler,
  actionSuggestionHandler,
  extractSpellSlots,
  calculateMovementSpeed,
} from "../combat";

// Helper to create mock request/response
function createMockContext(method: string, url: string, body?: any): RouteContext {
  const req = {
    method,
    url,
    headers: { "content-type": "application/json" },
  } as any;

  if (body) {
    req.body = JSON.stringify(body);
    Object.assign(
      req,
      new Readable({
        read() {
          this.push(JSON.stringify(body));
          this.push(null);
        },
      }),
    );
  }

  const res = {
    writeHead: jest.fn(),
    end: jest.fn(),
    setHeader: jest.fn(),
  } as any;

  return { req, res, params: {} };
}

describe("Combat Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /combat/suggestion - combatSuggestionHandler", () => {
    it("generates combat suggestions successfully", async () => {
      const mockSuggestion = {
        action: "attack",
        target: "goblin-1",
        reasoning: "Target has low AC and HP",
        probability: 0.85,
        expectedDamage: 12,
      };

      const mockCrucibleService = {
        generateCombatSuggestion: jest.fn().mockResolvedValue(mockSuggestion),
      };

      jest.doMock("../ai/combat", () => ({
        CrucibleService: jest.fn().mockImplementation(() => mockCrucibleService),
      }));

      const ctx = createMockContext("POST", "/combat/suggestion", {
        characterId: "char-1",
        encounterId: "encounter-1",
        currentSituation: {
          enemies: [{ id: "goblin-1", hp: 5, ac: 15 }],
          allies: [{ id: "char-1", hp: 75, ac: 16 }],
        },
      });

      await combatSuggestionHandler(ctx);

      expect(mockCrucibleService.generateCombatSuggestion).toHaveBeenCalledWith(
        "char-1",
        "encounter-1",
        expect.objectContaining({
          enemies: expect.any(Array),
          allies: expect.any(Array),
        }),
      );
      expect(ctx.res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(JSON.stringify(mockSuggestion));
    });

    it("returns 400 when characterId is missing", async () => {
      const ctx = createMockContext("POST", "/combat/suggestion", {
        encounterId: "encounter-1",
      });

      await combatSuggestionHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(
        JSON.stringify({ error: "characterId and encounterId are required" }),
      );
    });

    it("returns 400 when encounterId is missing", async () => {
      const ctx = createMockContext("POST", "/combat/suggestion", {
        characterId: "char-1",
      });

      await combatSuggestionHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(
        JSON.stringify({ error: "characterId and encounterId are required" }),
      );
    });

    it("handles AI service errors gracefully", async () => {
      const mockCrucibleService = {
        generateCombatSuggestion: jest.fn().mockRejectedValue(new Error("AI service unavailable")),
      };

      jest.doMock("../ai/combat", () => ({
        CrucibleService: jest.fn().mockImplementation(() => mockCrucibleService),
      }));

      const ctx = createMockContext("POST", "/combat/suggestion", {
        characterId: "char-1",
        encounterId: "encounter-1",
        currentSituation: {},
      });

      await combatSuggestionHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(500, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(
        JSON.stringify({ error: "Failed to generate combat suggestion" }),
      );
    });

    it("validates current situation data", async () => {
      const ctx = createMockContext("POST", "/combat/suggestion", {
        characterId: "char-1",
        encounterId: "encounter-1",
        // Missing currentSituation
      });

      await combatSuggestionHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(
        JSON.stringify({ error: "currentSituation is required" }),
      );
    });
  });

  describe("POST /combat/analysis - combatAnalysisHandler", () => {
    it("analyzes combat situation successfully", async () => {
      const mockAnalysis = {
        threatLevel: "moderate",
        recommendations: ["Focus fire on spellcaster", "Use defensive positioning"],
        tacticalAdvantages: ["Higher ground", "Numerical superiority"],
        estimatedOutcome: "favorable",
        confidence: 0.78,
      };

      const mockCrucibleService = {
        analyzeCombatSituation: jest.fn().mockResolvedValue(mockAnalysis),
      };

      jest.doMock("../ai/combat", () => ({
        CrucibleService: jest.fn().mockImplementation(() => mockCrucibleService),
      }));

      const ctx = createMockContext("POST", "/combat/analysis", {
        encounterId: "encounter-1",
        combatState: {
          round: 3,
          currentTurn: 1,
          actors: [
            { id: "char-1", type: "character", hp: 75, conditions: [] },
            { id: "goblin-1", type: "monster", hp: 12, conditions: ["poisoned"] },
          ],
        },
      });

      await combatAnalysisHandler(ctx);

      expect(mockCrucibleService.analyzeCombatSituation).toHaveBeenCalledWith(
        "encounter-1",
        expect.objectContaining({
          round: 3,
          currentTurn: 1,
          actors: expect.any(Array),
        }),
      );
      expect(ctx.res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(JSON.stringify(mockAnalysis));
    });

    it("returns 400 when encounterId is missing", async () => {
      const ctx = createMockContext("POST", "/combat/analysis", {
        combatState: {},
      });

      await combatAnalysisHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(
        JSON.stringify({ error: "encounterId and combatState are required" }),
      );
    });

    it("validates combat state structure", async () => {
      const ctx = createMockContext("POST", "/combat/analysis", {
        encounterId: "encounter-1",
        combatState: {
          // Missing required fields
          round: "invalid",
        },
      });

      await combatAnalysisHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(
        JSON.stringify({ error: "Invalid combat state format" }),
      );
    });
  });

  describe("POST /combat/action-suggestion - actionSuggestionHandler", () => {
    it("suggests optimal actions successfully", async () => {
      const mockActionSuggestion = {
        primaryAction: {
          type: "attack",
          target: "goblin-1",
          weapon: "longsword",
          hitChance: 0.75,
          averageDamage: 8.5,
        },
        alternativeActions: [
          {
            type: "spell",
            spell: "magic missile",
            targets: ["goblin-1", "goblin-2"],
            spellSlot: 1,
          },
        ],
        movementSuggestion: {
          position: { x: 15, y: 20 },
          reasoning: "Flank the enemy spellcaster",
        },
      };

      const mockCrucibleService = {
        suggestOptimalAction: jest.fn().mockResolvedValue(mockActionSuggestion),
      };

      jest.doMock("../ai/combat", () => ({
        CrucibleService: jest.fn().mockImplementation(() => mockCrucibleService),
      }));

      const ctx = createMockContext("POST", "/combat/action-suggestion", {
        characterId: "char-1",
        availableActions: ["attack", "spell", "dash"],
        targetOptions: ["goblin-1", "goblin-2"],
        characterState: {
          hp: 75,
          spellSlots: { 1: 3, 2: 2 },
          position: { x: 10, y: 15 },
        },
      });

      await actionSuggestionHandler(ctx);

      expect(mockCrucibleService.suggestOptimalAction).toHaveBeenCalledWith(
        "char-1",
        ["attack", "spell", "dash"],
        ["goblin-1", "goblin-2"],
        expect.objectContaining({
          hp: 75,
          spellSlots: { 1: 3, 2: 2 },
          position: { x: 10, y: 15 },
        }),
      );
      expect(ctx.res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(JSON.stringify(mockActionSuggestion));
    });

    it("returns 400 when required parameters are missing", async () => {
      const ctx = createMockContext("POST", "/combat/action-suggestion", {
        characterId: "char-1",
        // Missing availableActions and other required fields
      });

      await actionSuggestionHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(
        JSON.stringify({ error: "characterId, availableActions, and characterState are required" }),
      );
    });

    it("handles empty action lists", async () => {
      const ctx = createMockContext("POST", "/combat/action-suggestion", {
        characterId: "char-1",
        availableActions: [],
        targetOptions: [],
        characterState: { hp: 75 },
      });

      await actionSuggestionHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(
        JSON.stringify({ error: "At least one available action is required" }),
      );
    });
  });

  describe("Helper Functions", () => {
    describe("extractSpellSlots", () => {
      it("returns existing spell slots", () => {
        const character = {
          spellSlots: { 1: 4, 2: 3, 3: 2 },
        };

        const result = extractSpellSlots(character);

        expect(result).toEqual({ 1: 4, 2: 3, 3: 2 });
      });

      it("calculates spell slots for wizard", () => {
        const character = {
          class: "wizard",
          level: 5,
        };

        const result = extractSpellSlots(character);

        expect(result).toEqual({
          1: expect.any(Number),
          2: expect.any(Number),
          3: expect.any(Number),
        });
        expect(result[1]).toBeGreaterThan(0);
        expect(result[2]).toBeGreaterThan(0);
        expect(result[3]).toBeGreaterThan(0);
      });

      it("returns empty object for non-spellcasters", () => {
        const character = {
          class: "fighter",
          level: 10,
        };

        const result = extractSpellSlots(character);

        expect(result).toEqual({});
      });

      it("handles missing class and level", () => {
        const character = {};

        const result = extractSpellSlots(character);

        expect(result).toEqual({});
      });

      it("calculates correct spell slots for different levels", () => {
        const level1Wizard = { class: "wizard", level: 1 };
        const level10Wizard = { class: "wizard", level: 10 };

        const level1Slots = extractSpellSlots(level1Wizard);
        const level10Slots = extractSpellSlots(level10Wizard);

        expect(level10Slots[1]).toBeGreaterThanOrEqual(level1Slots[1]);
        expect(level10Slots[5]).toBeDefined();
        expect(level1Slots[5]).toBeUndefined();
      });
    });

    describe("calculateMovementSpeed", () => {
      it("returns base speed for human", () => {
        const character = { race: "human" };

        const result = calculateMovementSpeed(character);

        expect(result).toBe(30);
      });

      it("returns reduced speed for dwarf", () => {
        const character = { race: "dwarf" };

        const result = calculateMovementSpeed(character);

        expect(result).toBe(25);
      });

      it("returns increased speed for wood elf", () => {
        const character = { race: "wood elf" };

        const result = calculateMovementSpeed(character);

        expect(result).toBe(35);
      });

      it("applies speed modifiers from abilities", () => {
        const character = {
          race: "human",
          abilities: { speed: 40 },
        };

        const result = calculateMovementSpeed(character);

        expect(result).toBe(40);
      });

      it("handles missing race", () => {
        const character = {};

        const result = calculateMovementSpeed(character);

        expect(result).toBe(30);
      });

      it("handles case-insensitive race names", () => {
        const character = { race: "DWARF" };

        const result = calculateMovementSpeed(character);

        expect(result).toBe(25);
      });
    });
  });

  describe("Error Handling", () => {
    it("handles malformed JSON requests", async () => {
      const ctx = createMockContext("POST", "/combat/suggestion");
      ctx.req.body = "invalid json";

      await combatSuggestionHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(JSON.stringify({ error: "Invalid JSON body" }));
    });

    it("handles database connection failures", async () => {
      jest.doMock("@prisma/client", () => ({
        PrismaClient: jest.fn().mockImplementation(() => {
          throw new Error("Database connection failed");
        }),
      }));

      const ctx = createMockContext("POST", "/combat/suggestion", {
        characterId: "char-1",
        encounterId: "encounter-1",
        currentSituation: {},
      });

      await combatSuggestionHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(500, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(JSON.stringify({ error: "Internal server error" }));
    });

    it("handles AI service timeout", async () => {
      const mockCrucibleService = {
        generateCombatSuggestion: jest
          .fn()
          .mockImplementation(
            () => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 100)),
          ),
      };

      jest.doMock("../ai/combat", () => ({
        CrucibleService: jest.fn().mockImplementation(() => mockCrucibleService),
      }));

      const ctx = createMockContext("POST", "/combat/suggestion", {
        characterId: "char-1",
        encounterId: "encounter-1",
        currentSituation: {},
      });

      await combatSuggestionHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(500, { "Content-Type": "application/json" });
    });
  });

  describe("Integration Tests", () => {
    it("integrates character data with AI suggestions", async () => {
      const mockCharacter = {
        id: "char-1",
        name: "Aragorn",
        class: "ranger",
        level: 10,
        abilities: { strength: 16, dexterity: 14 },
        spellSlots: { 1: 4, 2: 3 },
      };

      const mockPrisma = {
        character: {
          findUnique: jest.fn().mockResolvedValue(mockCharacter),
        },
      };

      const mockCrucibleService = {
        generateCombatSuggestion: jest.fn().mockResolvedValue({
          action: "attack",
          reasoning: "High strength modifier favors melee combat",
        }),
      };

      jest.doMock("@prisma/client", () => ({
        PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
      }));

      jest.doMock("../ai/combat", () => ({
        CrucibleService: jest.fn().mockImplementation(() => mockCrucibleService),
      }));

      const ctx = createMockContext("POST", "/combat/suggestion", {
        characterId: "char-1",
        encounterId: "encounter-1",
        currentSituation: { enemies: [], allies: [] },
      });

      await combatSuggestionHandler(ctx);

      expect(mockPrisma.character.findUnique).toHaveBeenCalledWith({
        where: { id: "char-1" },
      });
      expect(mockCrucibleService.generateCombatSuggestion).toHaveBeenCalledWith(
        "char-1",
        "encounter-1",
        expect.objectContaining({
          character: mockCharacter,
        }),
      );
      expect(ctx.res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    });

    it("handles complete combat flow", async () => {
      const encounterId = "encounter-1";
      const characterId = "char-1";

      // Mock services for full flow
      const mockServices = {
        prisma: {
          character: { findUnique: jest.fn().mockResolvedValue({ id: characterId }) },
          encounter: { findUnique: jest.fn().mockResolvedValue({ id: encounterId }) },
        },
        crucible: {
          analyzeCombatSituation: jest.fn().mockResolvedValue({ threatLevel: "low" }),
          generateCombatSuggestion: jest.fn().mockResolvedValue({ action: "attack" }),
          suggestOptimalAction: jest.fn().mockResolvedValue({ primaryAction: { type: "attack" } }),
        },
      };

      // Analysis
      let ctx = createMockContext("POST", "/combat/analysis", {
        encounterId,
        combatState: { round: 1, actors: [] },
      });
      await combatAnalysisHandler(ctx);

      // Suggestion
      ctx = createMockContext("POST", "/combat/suggestion", {
        characterId,
        encounterId,
        currentSituation: {},
      });
      await combatSuggestionHandler(ctx);

      // Action suggestion
      ctx = createMockContext("POST", "/combat/action-suggestion", {
        characterId,
        availableActions: ["attack"],
        characterState: { hp: 100 },
      });
      await actionSuggestionHandler(ctx);

      // All should return 200 status
      expect(ctx.res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    });
  });
});
