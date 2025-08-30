/**
 * Tests for Combat API Routes
 */
import { IncomingMessage, ServerResponse } from "http";
import { RouteContext } from "../router/context";
import { combatAnalysisHandler, combatSimulationHandler, tacticalDecisionHandler } from "./combat";
import { PrismaClient } from "@prisma/client";
import { jest } from "@jest/globals";

// Mock dependencies
jest.mock("@prisma/client");
jest.mock("../ai/combat");
jest.mock("../services/ActorIntegrationService");

describe("Combat Routes", () => {
  let mockReq: jest.Mocked<IncomingMessage>;
  let mockRes: jest.Mocked<ServerResponse>;
  let mockContext: RouteContext;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    // Create mock request
    mockReq = {
      url: "",
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-token",
      },
      on: jest.fn(),
      once: jest.fn(),
      emit: jest.fn(),
      removeListener: jest.fn(),
    } as any;

    // Create mock response
    mockRes = {
      writeHead: jest.fn(),
      end: jest.fn(),
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      statusCode: 200,
    } as any;

    // Create mock context
    mockContext = {
      req: mockReq,
      res: mockRes,
      url: new URL("http://localhost"),
      params: {},
      query: {},
      userId: "test-user",
      user: { id: "test-user", email: "test@example.com" },
    } as RouteContext;

    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
  });

  describe("tacticalDecisionHandler", () => {
    it("should return tactical decision for valid request", async () => {
      const requestBody = {
        character: {
          id: "char-1",
          name: "Fighter",
          class: "fighter",
          level: 5,
          hp: { current: 30, max: 50 },
          position: { x: 0, y: 0 },
          abilities: [],
          conditions: [],
          resources: {
            actionSurge: 1,
            secondWind: 1,
            spellSlots: { 1: 0, 2: 0, 3: 0 },
          },
        },
        allies: [],
        enemies: [
          {
            id: "enemy-1",
            name: "Goblin",
            type: "goblin",
            hp: { current: 10, max: 10 },
            position: { x: 10, y: 0 },
            ac: 15,
            threat: "low",
          },
        ],
        battlefield: {
          terrain: ["grass"],
          hazards: [],
          cover: [],
          lighting: "bright",
          weather: "clear",
        },
      };

      // Mock request body reading
      let dataHandler: any;
      let endHandler: any;
      mockReq.on = jest.fn((event, handler) => {
        if (event === "data") dataHandler = handler;
        if (event === "end") endHandler = handler;
        return mockReq;
      });

      // Execute handler
      const handlerPromise = tacticalDecisionHandler(mockContext);

      // Simulate data events
      if (dataHandler) {
        dataHandler(Buffer.from(JSON.stringify(requestBody)));
      }
      if (endHandler) {
        endHandler();
      }

      await handlerPromise;

      // Verify response
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      expect(mockRes.end).toHaveBeenCalled();

      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toHaveProperty("action");
      expect(responseData.data).toHaveProperty("reasoning");
    });

    it("should return 400 for invalid request body", async () => {
      const invalidBody = {
        // Missing required fields
        character: { name: "Test" },
      };

      // Mock request body reading
      let dataHandler: any;
      let endHandler: any;
      mockReq.on = jest.fn((event, handler) => {
        if (event === "data") dataHandler = handler;
        if (event === "end") endHandler = handler;
        return mockReq;
      });

      // Execute handler
      const handlerPromise = tacticalDecisionHandler(mockContext);

      // Simulate data events
      if (dataHandler) {
        dataHandler(Buffer.from(JSON.stringify(invalidBody)));
      }
      if (endHandler) {
        endHandler();
      }

      await handlerPromise;

      // Verify error response
      expect(mockRes.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      expect(mockRes.end).toHaveBeenCalled();

      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData.error).toBeDefined();
    });

    it("should return 401 for unauthenticated requests", async () => {
      // Remove authentication
      mockContext.userId = undefined;
      mockContext.user = undefined;

      await tacticalDecisionHandler(mockContext);

      expect(mockRes.writeHead).toHaveBeenCalledWith(401, { "Content-Type": "application/json" });
      expect(mockRes.end).toHaveBeenCalled();

      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData.error).toBe("Authentication required");
    });
  });

  describe("combatSimulationHandler", () => {
    it("should simulate combat for valid request", async () => {
      const requestBody = {
        party: [
          {
            id: "char-1",
            name: "Fighter",
            hp: 50,
            ac: 18,
            initiative: 10,
          },
        ],
        enemies: [
          {
            id: "enemy-1",
            name: "Goblin",
            hp: 10,
            ac: 15,
            initiative: 8,
          },
        ],
        battlefield: {
          terrain: ["grass"],
          hazards: [],
          cover: [],
          lighting: "bright",
        },
        maxRounds: 10,
      };

      // Mock request body reading
      let dataHandler: any;
      let endHandler: any;
      mockReq.on = jest.fn((event, handler) => {
        if (event === "data") dataHandler = handler;
        if (event === "end") endHandler = handler;
        return mockReq;
      });

      // Execute handler
      const handlerPromise = combatSimulationHandler(mockContext);

      // Simulate data events
      if (dataHandler) {
        dataHandler(Buffer.from(JSON.stringify(requestBody)));
      }
      if (endHandler) {
        endHandler();
      }

      await handlerPromise;

      // Verify response
      expect(mockRes.writeHead).toHaveBeenCalledWith(201, { "Content-Type": "application/json" });
      expect(mockRes.end).toHaveBeenCalled();

      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toHaveProperty("simulationId");
      expect(responseData.data).toHaveProperty("winner");
      expect(responseData.data).toHaveProperty("rounds");
    });

    it("should validate battlefield data", async () => {
      const requestBody = {
        party: [{ id: "char-1", name: "Fighter", hp: 50, ac: 18, initiative: 10 }],
        enemies: [{ id: "enemy-1", name: "Goblin", hp: 10, ac: 15, initiative: 8 }],
        battlefield: {
          // Invalid lighting value
          terrain: ["grass"],
          lighting: "invalid",
        },
      };

      // Mock request body reading
      let dataHandler: any;
      let endHandler: any;
      mockReq.on = jest.fn((event, handler) => {
        if (event === "data") dataHandler = handler;
        if (event === "end") endHandler = handler;
        return mockReq;
      });

      // Execute handler
      const handlerPromise = combatSimulationHandler(mockContext);

      // Simulate data events
      if (dataHandler) {
        dataHandler(Buffer.from(JSON.stringify(requestBody)));
      }
      if (endHandler) {
        endHandler();
      }

      await handlerPromise;

      // Should handle validation error
      expect(mockRes.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
    });
  });

  describe("combatAnalysisHandler", () => {
    it("should analyze combat scenario", async () => {
      const requestBody = {
        combatState: {
          round: 5,
          activeCharacter: "char-1",
          characters: [
            {
              id: "char-1",
              name: "Fighter",
              hp: { current: 30, max: 50 },
              position: { x: 0, y: 0 },
              conditions: [],
            },
          ],
          enemies: [
            {
              id: "enemy-1",
              name: "Goblin",
              hp: { current: 5, max: 10 },
              position: { x: 10, y: 0 },
              conditions: ["frightened"],
            },
          ],
        },
        options: {
          includeProjections: true,
          analyzeThreats: true,
        },
      };

      // Mock request body reading
      let dataHandler: any;
      let endHandler: any;
      mockReq.on = jest.fn((event, handler) => {
        if (event === "data") dataHandler = handler;
        if (event === "end") endHandler = handler;
        return mockReq;
      });

      // Execute handler
      const handlerPromise = combatAnalysisHandler(mockContext);

      // Simulate data events
      if (dataHandler) {
        dataHandler(Buffer.from(JSON.stringify(requestBody)));
      }
      if (endHandler) {
        endHandler();
      }

      await handlerPromise;

      // Verify response
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      expect(mockRes.end).toHaveBeenCalled();

      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toHaveProperty("threatAssessment");
      expect(responseData.data).toHaveProperty("winProbability");
    });

    it("should handle empty combat state", async () => {
      const requestBody = {
        combatState: {
          round: 0,
          activeCharacter: null,
          characters: [],
          enemies: [],
        },
      };

      // Mock request body reading
      let dataHandler: any;
      let endHandler: any;
      mockReq.on = jest.fn((event, handler) => {
        if (event === "data") dataHandler = handler;
        if (event === "end") endHandler = handler;
        return mockReq;
      });

      // Execute handler
      const handlerPromise = combatAnalysisHandler(mockContext);

      // Simulate data events
      if (dataHandler) {
        dataHandler(Buffer.from(JSON.stringify(requestBody)));
      }
      if (endHandler) {
        endHandler();
      }

      await handlerPromise;

      // Should still return valid analysis
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData.success).toBe(true);
      expect(responseData.data.threatAssessment).toBe("none");
    });
  });

  describe("Error Handling", () => {
    it("should handle JSON parsing errors gracefully", async () => {
      // Mock request body reading with invalid JSON
      let dataHandler: any;
      let endHandler: any;
      mockReq.on = jest.fn((event, handler) => {
        if (event === "data") dataHandler = handler;
        if (event === "end") endHandler = handler;
        return mockReq;
      });

      // Execute handler
      const handlerPromise = tacticalDecisionHandler(mockContext);

      // Simulate invalid JSON data
      if (dataHandler) {
        dataHandler(Buffer.from("{ invalid json"));
      }
      if (endHandler) {
        endHandler();
      }

      await handlerPromise;

      expect(mockRes.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData.error).toBe("Invalid JSON body");
    });

    it("should handle service errors gracefully", async () => {
      const requestBody = {
        character: {
          id: "char-1",
          name: "Fighter",
          class: "fighter",
          level: 5,
          hp: { current: 30, max: 50 },
          position: { x: 0, y: 0 },
          abilities: [],
          conditions: [],
          resources: {
            actionSurge: 1,
            secondWind: 1,
            spellSlots: { 1: 0, 2: 0, 3: 0 },
          },
        },
        allies: [],
        enemies: [],
        battlefield: {
          terrain: [],
          hazards: [],
          cover: [],
          lighting: "bright",
        },
      };

      // Mock the CrucibleService to throw an error
      const CrucibleService = require("../ai/combat").CrucibleService;
      CrucibleService.prototype.makeTacticalDecision = jest
        .fn()
        .mockRejectedValue(new Error("Service error"));

      // Mock request body reading
      let dataHandler: any;
      let endHandler: any;
      mockReq.on = jest.fn((event, handler) => {
        if (event === "data") dataHandler = handler;
        if (event === "end") endHandler = handler;
        return mockReq;
      });

      // Execute handler
      const handlerPromise = tacticalDecisionHandler(mockContext);

      // Simulate data events
      if (dataHandler) {
        dataHandler(Buffer.from(JSON.stringify(requestBody)));
      }
      if (endHandler) {
        endHandler();
      }

      await handlerPromise;

      expect(mockRes.writeHead).toHaveBeenCalledWith(500, { "Content-Type": "application/json" });
      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBeDefined();
    });
  });
});
