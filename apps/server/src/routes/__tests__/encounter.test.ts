import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import {
  createEncounterHandler,
  getEncounterHandler,
  updateEncounterHandler,
  deleteEncounterHandler,
  addActorHandler,
} from "../encounter";
import { Context } from "../../router/types";
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
    encounter: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    character: {
      findMany: jest.fn(),
    },
    monster: {
      findMany: jest.fn(),
    },
    $disconnect: jest.fn(),
  })),
}));

jest.mock("../../services/ActorIntegrationService", () => ({
  ActorIntegrationService: jest.fn().mockImplementation(() => ({
    createEncounter: jest.fn(),
    getEncounter: jest.fn(),
    updateEncounter: jest.fn(),
    deleteEncounter: jest.fn(),
    addCharacterToEncounter: jest.fn(),
    addMonsterToEncounter: jest.fn(),
  })),
}));

jest.mock("../character/CharacterService", () => ({
  CharacterService: jest.fn().mockImplementation(() => ({
    getCharacter: jest.fn(),
    getCharacters: jest.fn(),
  })),
}));

jest.mock("../services/MonsterService", () => ({
  MonsterService: jest.fn().mockImplementation(() => ({
    getMonster: jest.fn(),
    getMonsters: jest.fn(),
  })),
}));

// Helper to create mock request/response
function createMockContext(method: string, url: string, body?: any): Context {
  const req = {
    method,
    url,
    headers: { "content-type": "application/json" },
  } as any;

  if (body) {
    req.body = JSON.stringify(body);
    // Mock readable stream for request body
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

describe("Encounter Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /encounters - createEncounterHandler", () => {
    it("creates a new encounter successfully", async () => {
      const mockEncounter = {
        id: "encounter-1",
        name: "Test Encounter",
        campaignId: "campaign-1",
        status: "inactive",
        actors: [],
      };

      const mockActorService = {
        createEncounter: jest.fn().mockResolvedValue(mockEncounter),
      };

      // Mock the service creation
      jest.doMock("../encounter", () => ({
        ...jest.requireActual("../encounter"),
        getServices: () => ({
          actorService: mockActorService,
        }),
      }));

      const ctx = createMockContext("POST", "/encounters", {
        name: "Test Encounter",
        campaignId: "campaign-1",
        characterIds: ["char-1"],
        monsters: [{ monsterId: "goblin", count: 2 }],
      });

      await createEncounterHandler(ctx);

      expect(mockActorService.createEncounter).toHaveBeenCalledWith(
        "Test Encounter",
        "campaign-1",
        ["char-1"],
        [{ monsterId: "goblin", count: 2 }],
      );
      expect(ctx.res.writeHead).toHaveBeenCalledWith(201, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(JSON.stringify(mockEncounter));
    });

    it("returns 400 when name is missing", async () => {
      const ctx = createMockContext("POST", "/encounters", {
        campaignId: "campaign-1",
      });

      await createEncounterHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(
        JSON.stringify({ error: "Name and campaignId are required" }),
      );
    });

    it("returns 400 when campaignId is missing", async () => {
      const ctx = createMockContext("POST", "/encounters", {
        name: "Test Encounter",
      });

      await createEncounterHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(
        JSON.stringify({ error: "Name and campaignId are required" }),
      );
    });

    it("handles service errors gracefully", async () => {
      const mockActorService = {
        createEncounter: jest.fn().mockRejectedValue(new Error("Database error")),
      };

      jest.doMock("../encounter", () => ({
        ...jest.requireActual("../encounter"),
        getServices: () => ({
          actorService: mockActorService,
        }),
      }));

      const ctx = createMockContext("POST", "/encounters", {
        name: "Test Encounter",
        campaignId: "campaign-1",
      });

      await createEncounterHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(500, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(
        JSON.stringify({ error: "Failed to create encounter" }),
      );
    });

    it("handles invalid JSON body", async () => {
      const ctx = createMockContext("POST", "/encounters");
      // Simulate invalid JSON
      ctx.req.body = "invalid json";

      await createEncounterHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(JSON.stringify({ error: "Invalid JSON body" }));
    });
  });

  describe("GET /encounters/:id - getEncounterHandler", () => {
    it("retrieves an encounter successfully", async () => {
      const mockEncounter = {
        id: "encounter-1",
        name: "Test Encounter",
        campaignId: "campaign-1",
        status: "active",
        currentTurn: 0,
        round: 1,
        actors: [
          {
            id: "actor-1",
            type: "character",
            characterId: "char-1",
            name: "Aragorn",
            initiative: 18,
            hitPoints: { current: 75, max: 100 },
          },
        ],
      };

      const mockActorService = {
        getEncounter: jest.fn().mockResolvedValue(mockEncounter),
      };

      jest.doMock("../encounter", () => ({
        ...jest.requireActual("../encounter"),
        getServices: () => ({
          actorService: mockActorService,
        }),
      }));

      const ctx = createMockContext("GET", "/encounters/encounter-1");
      ctx.params = { id: "encounter-1" };

      await getEncounterHandler(ctx);

      expect(mockActorService.getEncounter).toHaveBeenCalledWith("encounter-1");
      expect(ctx.res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(JSON.stringify(mockEncounter));
    });

    it("returns 404 when encounter not found", async () => {
      const mockActorService = {
        getEncounter: jest.fn().mockResolvedValue(null),
      };

      jest.doMock("../encounter", () => ({
        ...jest.requireActual("../encounter"),
        getServices: () => ({
          actorService: mockActorService,
        }),
      }));

      const ctx = createMockContext("GET", "/encounters/nonexistent");
      ctx.params = { id: "nonexistent" };

      await getEncounterHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(404, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(JSON.stringify({ error: "Encounter not found" }));
    });

    it("returns 400 when id parameter is missing", async () => {
      const ctx = createMockContext("GET", "/encounters/");
      ctx.params = {};

      await getEncounterHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(
        JSON.stringify({ error: "Encounter ID is required" }),
      );
    });
  });

  describe("PUT /encounters/:id - updateEncounterHandler", () => {
    it("updates an encounter successfully", async () => {
      const updatedEncounter = {
        id: "encounter-1",
        name: "Updated Encounter",
        status: "active",
        currentTurn: 1,
        round: 2,
      };

      const mockActorService = {
        updateEncounter: jest.fn().mockResolvedValue(updatedEncounter),
      };

      jest.doMock("../encounter", () => ({
        ...jest.requireActual("../encounter"),
        getServices: () => ({
          actorService: mockActorService,
        }),
      }));

      const ctx = createMockContext("PUT", "/encounters/encounter-1", {
        name: "Updated Encounter",
        status: "active",
        currentTurn: 1,
        round: 2,
      });
      ctx.params = { id: "encounter-1" };

      await updateEncounterHandler(ctx);

      expect(mockActorService.updateEncounter).toHaveBeenCalledWith("encounter-1", {
        name: "Updated Encounter",
        status: "active",
        currentTurn: 1,
        round: 2,
      });
      expect(ctx.res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(JSON.stringify(updatedEncounter));
    });

    it("returns 404 when updating nonexistent encounter", async () => {
      const mockActorService = {
        updateEncounter: jest.fn().mockResolvedValue(null),
      };

      jest.doMock("../encounter", () => ({
        ...jest.requireActual("../encounter"),
        getServices: () => ({
          actorService: mockActorService,
        }),
      }));

      const ctx = createMockContext("PUT", "/encounters/nonexistent", {
        name: "Updated Encounter",
      });
      ctx.params = { id: "nonexistent" };

      await updateEncounterHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(404, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(JSON.stringify({ error: "Encounter not found" }));
    });

    it("validates encounter status updates", async () => {
      const ctx = createMockContext("PUT", "/encounters/encounter-1", {
        status: "invalid-status",
      });
      ctx.params = { id: "encounter-1" };

      await updateEncounterHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(
        JSON.stringify({ error: "Invalid encounter status" }),
      );
    });

    it("validates turn and round numbers", async () => {
      const ctx = createMockContext("PUT", "/encounters/encounter-1", {
        currentTurn: -1,
        round: 0,
      });
      ctx.params = { id: "encounter-1" };

      await updateEncounterHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(
        JSON.stringify({ error: "Turn and round must be non-negative numbers" }),
      );
    });
  });

  describe("DELETE /encounters/:id - deleteEncounterHandler", () => {
    it("deletes an encounter successfully", async () => {
      const mockActorService = {
        deleteEncounter: jest.fn().mockResolvedValue(true),
      };

      jest.doMock("../encounter", () => ({
        ...jest.requireActual("../encounter"),
        getServices: () => ({
          actorService: mockActorService,
        }),
      }));

      const ctx = createMockContext("DELETE", "/encounters/encounter-1");
      ctx.params = { id: "encounter-1" };

      await deleteEncounterHandler(ctx);

      expect(mockActorService.deleteEncounter).toHaveBeenCalledWith("encounter-1");
      expect(ctx.res.writeHead).toHaveBeenCalledWith(204);
      expect(ctx.res.end).toHaveBeenCalled();
    });

    it("returns 404 when deleting nonexistent encounter", async () => {
      const mockActorService = {
        deleteEncounter: jest.fn().mockResolvedValue(false),
      };

      jest.doMock("../encounter", () => ({
        ...jest.requireActual("../encounter"),
        getServices: () => ({
          actorService: mockActorService,
        }),
      }));

      const ctx = createMockContext("DELETE", "/encounters/nonexistent");
      ctx.params = { id: "nonexistent" };

      await deleteEncounterHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(404, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(JSON.stringify({ error: "Encounter not found" }));
    });
  });

  describe("Actor Management", () => {
    it("adds character to encounter", async () => {
      const mockActorService = {
        addCharacterToEncounter: jest.fn().mockResolvedValue({
          id: "actor-1",
          type: "character",
          characterId: "char-1",
          name: "Aragorn",
        }),
      };

      jest.doMock("../encounter", () => ({
        ...jest.requireActual("../encounter"),
        getServices: () => ({
          actorService: mockActorService,
        }),
      }));

      const ctx = createMockContext("POST", "/encounters/encounter-1/actors", {
        type: "character",
        characterId: "char-1",
        initiative: 15,
      });
      ctx.params = { id: "encounter-1" };

      await addActorHandler(ctx);

      expect(mockActorService.addCharacterToEncounter).toHaveBeenCalledWith(
        "encounter-1",
        "char-1",
        15,
      );
      expect(ctx.res.writeHead).toHaveBeenCalledWith(201, { "Content-Type": "application/json" });
    });

    it("adds monster to encounter", async () => {
      const mockActorService = {
        addMonsterToEncounter: jest.fn().mockResolvedValue({
          id: "actor-2",
          type: "monster",
          monsterId: "goblin",
          name: "Goblin #1",
        }),
      };

      jest.doMock("../encounter", () => ({
        ...jest.requireActual("../encounter"),
        getServices: () => ({
          actorService: mockActorService,
        }),
      }));

      const ctx = createMockContext("POST", "/encounters/encounter-1/actors", {
        type: "monster",
        monsterId: "goblin",
        name: "Goblin #1",
        initiative: 12,
      });
      ctx.params = { id: "encounter-1" };

      await addActorHandler(ctx);

      expect(mockActorService.addMonsterToEncounter).toHaveBeenCalledWith(
        "encounter-1",
        "goblin",
        "Goblin #1",
        12,
      );
      expect(ctx.res.writeHead).toHaveBeenCalledWith(201, { "Content-Type": "application/json" });
    });

    it("validates actor type", async () => {
      const ctx = createMockContext("POST", "/encounters/encounter-1/actors", {
        type: "invalid",
        initiative: 15,
      });
      ctx.params = { id: "encounter-1" };

      await addActorHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(
        JSON.stringify({ error: "Actor type must be character or monster" }),
      );
    });

    it("validates initiative value", async () => {
      const ctx = createMockContext("POST", "/encounters/encounter-1/actors", {
        type: "character",
        characterId: "char-1",
        initiative: "invalid",
      });
      ctx.params = { id: "encounter-1" };

      await addActorHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(
        JSON.stringify({ error: "Initiative must be a number" }),
      );
    });
  });

  describe("Error Handling", () => {
    it("handles database connection errors", async () => {
      jest.doMock("../encounter", () => ({
        ...jest.requireActual("../encounter"),
        getServices: () => {
          throw new Error("Database connection failed");
        },
      }));

      const ctx = createMockContext("GET", "/encounters/encounter-1");
      ctx.params = { id: "encounter-1" };

      await getEncounterHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(500, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(JSON.stringify({ error: "Internal server error" }));
    });

    it("handles service initialization errors", async () => {
      const mockPrismaClient = {
        $disconnect: jest.fn(),
      };

      jest.doMock("@prisma/client", () => ({
        PrismaClient: jest.fn().mockImplementation(() => {
          throw new Error("Prisma initialization failed");
        }),
      }));

      const ctx = createMockContext("POST", "/encounters", {
        name: "Test Encounter",
        campaignId: "campaign-1",
      });

      await createEncounterHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(500, { "Content-Type": "application/json" });
    });

    it("handles malformed request bodies", async () => {
      const ctx = createMockContext("POST", "/encounters");
      // Simulate malformed body
      ctx.req.body = '{"name": "Test", "campaignId":}'; // Invalid JSON

      await createEncounterHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(JSON.stringify({ error: "Invalid JSON body" }));
    });
  });

  describe("Integration Tests", () => {
    it("creates encounter with characters and monsters", async () => {
      const mockServices = {
        actorService: {
          createEncounter: jest.fn().mockResolvedValue({
            id: "encounter-1",
            name: "Integration Test",
            campaignId: "campaign-1",
            actors: [
              { type: "character", characterId: "char-1", name: "Aragorn" },
              { type: "monster", monsterId: "goblin", name: "Goblin #1" },
            ],
          }),
        },
      };

      jest.doMock("../encounter", () => ({
        ...jest.requireActual("../encounter"),
        getServices: () => mockServices,
      }));

      const ctx = createMockContext("POST", "/encounters", {
        name: "Integration Test",
        campaignId: "campaign-1",
        characterIds: ["char-1"],
        monsters: [{ monsterId: "goblin", count: 1 }],
      });

      await createEncounterHandler(ctx);

      expect(mockServices.actorService.createEncounter).toHaveBeenCalledWith(
        "Integration Test",
        "campaign-1",
        ["char-1"],
        [{ monsterId: "goblin", count: 1 }],
      );
      expect(ctx.res.writeHead).toHaveBeenCalledWith(201, { "Content-Type": "application/json" });
    });

    it("handles complete encounter lifecycle", async () => {
      const encounterId = "encounter-1";
      const mockServices = {
        actorService: {
          createEncounter: jest.fn().mockResolvedValue({ id: encounterId }),
          getEncounter: jest.fn().mockResolvedValue({ id: encounterId }),
          updateEncounter: jest.fn().mockResolvedValue({ id: encounterId, status: "active" }),
          deleteEncounter: jest.fn().mockResolvedValue(true),
        },
      };

      jest.doMock("../encounter", () => ({
        ...jest.requireActual("../encounter"),
        getServices: () => mockServices,
      }));

      // Create
      let ctx = createMockContext("POST", "/encounters", {
        name: "Lifecycle Test",
        campaignId: "campaign-1",
      });
      await createEncounterHandler(ctx);
      expect(ctx.res.writeHead).toHaveBeenCalledWith(201, expect.any(Object));

      // Get
      ctx = createMockContext("GET", `/encounters/${encounterId}`);
      ctx.params = { id: encounterId };
      await getEncounterHandler(ctx);
      expect(ctx.res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));

      // Update
      ctx = createMockContext("PUT", `/encounters/${encounterId}`, { status: "active" });
      ctx.params = { id: encounterId };
      await updateEncounterHandler(ctx);
      expect(ctx.res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));

      // Delete
      ctx = createMockContext("DELETE", `/encounters/${encounterId}`);
      ctx.params = { id: encounterId };
      await deleteEncounterHandler(ctx);
      expect(ctx.res.writeHead).toHaveBeenCalledWith(204);
    });
  });
});
