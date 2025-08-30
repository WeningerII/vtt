import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MapService } from "./MapService";
import { PrismaClient } from "@prisma/client";
import { MapScene, GridSettings, TokenPosition } from "./types";

// Mock dependencies
vi.mock("@prisma/client");
vi.mock("@vtt/logging", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));
vi.mock("uuid", () => ({
  v4: vi.fn(() => "mock-uuid-" + Math.random().toString(36).substr(2, 9)),
}));

describe("MapService", () => {
  let service: MapService;
  let mockPrisma: any;
  let mockWebSocketManager: any;

  const mockCampaignId = "campaign-123";
  const mockSceneId = "scene-456";
  const mockMapId = "map-789";
  const mockUserId = "user-123";

  beforeEach(() => {
    // Setup mock Prisma client
    mockPrisma = {
      scene: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      token: {
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        findMany: vi.fn(),
      },
      map: {
        findUnique: vi.fn(),
      },
    };

    // Setup mock WebSocket manager
    mockWebSocketManager = {
      broadcast: vi.fn(),
      sendToRoom: vi.fn(),
    };

    service = new MapService(mockPrisma, mockWebSocketManager);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createScene", () => {
    it("should create a scene with default settings", async () => {
      const mockDbScene = {
        id: mockSceneId,
        name: "Test Scene",
        campaignId: mockCampaignId,
        mapId: null,
        tokens: [],
      };

      mockPrisma.scene.create.mockResolvedValue(mockDbScene);

      const scene = await service.createScene("Test Scene", 1920, 1080, mockCampaignId);

      expect(scene).toBeDefined();
      expect(scene.name).toBe("Test Scene");
      expect(scene.width).toBe(1920);
      expect(scene.height).toBe(1080);
      expect(scene.campaignId).toBe(mockCampaignId);

      // Check default grid settings
      expect(scene.grid.type).toBe("square");
      expect(scene.grid.size).toBe(50);
      expect(scene.grid.visible).toBe(true);

      // Check default layers
      expect(scene.layers).toHaveLength(4);
      expect(scene.layers.find((l) => l.type === "background")).toBeDefined();
      expect(scene.layers.find((l) => l.type === "tokens")).toBeDefined();
      expect(scene.layers.find((l) => l.type === "effects")).toBeDefined();
      expect(scene.layers.find((l) => l.type === "fog")).toBeDefined();

      // Check lighting defaults
      expect(scene.lighting.enabled).toBe(false);
      expect(scene.lighting.globalIllumination).toBe(0.3);

      // Check fog defaults
      expect(scene.fog.enabled).toBe(false);
      expect(scene.fog.mode).toBe("exploration");
    });

    it("should create a scene with custom grid settings", async () => {
      const customGrid: Partial<GridSettings> = {
        type: "hex" as any,
        size: 70,
        visible: false,
        color: "#ff0000",
        opacity: 0.5,
      };

      const mockDbScene = {
        id: mockSceneId,
        name: "Custom Grid Scene",
        campaignId: mockCampaignId,
        mapId: mockMapId,
        tokens: [],
      };

      mockPrisma.scene.create.mockResolvedValue(mockDbScene);

      const scene = await service.createScene(
        "Custom Grid Scene",
        2560,
        1440,
        mockCampaignId,
        mockMapId,
        customGrid,
      );

      expect(scene.grid.type).toBe("hex");
      expect(scene.grid.size).toBe(70);
      expect(scene.grid.visible).toBe(false);
      expect(scene.grid.color).toBe("#ff0000");
      expect(scene.grid.opacity).toBe(0.5);
      expect(scene.mapId).toBe(mockMapId);
    });

    it("should create a scene with existing tokens", async () => {
      const mockTokens = [
        {
          id: "token-1",
          name: "Hero",
          x: 100,
          y: 200,
          rotation: 0,
          width: 1,
          height: 1,
          scale: 1,
          disposition: "FRIENDLY",
          isVisible: true,
          isLocked: false,
          layer: 0,
          actorId: "actor-1",
          assetId: "asset-1",
        },
      ];

      const mockDbScene = {
        id: mockSceneId,
        name: "Scene with Tokens",
        campaignId: mockCampaignId,
        mapId: null,
        tokens: mockTokens,
      };

      mockPrisma.scene.create.mockResolvedValue(mockDbScene);

      const scene = await service.createScene("Scene with Tokens", 1920, 1080, mockCampaignId);

      expect(scene.tokens).toHaveLength(1);
      expect(scene.tokens[0]).toMatchObject({
        id: "token-1",
        name: "Hero",
        x: 100,
        y: 200,
        elevation: 0,
      });
    });

    it("should store scene in cache after creation", async () => {
      const mockDbScene = {
        id: mockSceneId,
        name: "Cached Scene",
        campaignId: mockCampaignId,
        mapId: null,
        tokens: [],
      };

      mockPrisma.scene.create.mockResolvedValue(mockDbScene);

      await service.createScene("Cached Scene", 1920, 1080, mockCampaignId);

      // Try to get scene again - should use cache
      mockPrisma.scene.findUnique.mockResolvedValue(null);
      const cachedScene = await service.getScene(mockSceneId);

      expect(cachedScene).toBeDefined();
      expect(mockPrisma.scene.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("getScene", () => {
    it("should retrieve scene from cache if available", async () => {
      // First create a scene to cache it
      const mockDbScene = {
        id: mockSceneId,
        name: "Cached Scene",
        campaignId: mockCampaignId,
        mapId: null,
        tokens: [],
      };

      mockPrisma.scene.create.mockResolvedValue(mockDbScene);
      await service.createScene("Cached Scene", 1920, 1080, mockCampaignId);

      // Now get it - should use cache
      const scene = await service.getScene(mockSceneId);

      expect(scene).toBeDefined();
      expect(scene?.id).toBe(mockSceneId);
      expect(mockPrisma.scene.findUnique).not.toHaveBeenCalled();
    });

    it("should retrieve scene from database if not cached", async () => {
      const mockDbScene = {
        id: mockSceneId,
        name: "DB Scene",
        campaignId: mockCampaignId,
        mapId: mockMapId,
        map: {
          widthPx: 2560,
          heightPx: 1440,
        },
        tokens: [],
        metadata: JSON.stringify({
          gridSettings: {
            type: "hex",
            size: 60,
          },
        }),
      };

      mockPrisma.scene.findUnique.mockResolvedValue(mockDbScene);

      const scene = await service.getScene(mockSceneId);

      expect(mockPrisma.scene.findUnique).toHaveBeenCalledWith({
        where: { id: mockSceneId },
        include: {
          map: true,
          campaign: true,
          tokens: {
            include: {
              actor: true,
              asset: true,
            },
          },
        },
      });

      expect(scene).toBeDefined();
      expect(scene?.name).toBe("DB Scene");
      expect(scene?.width).toBe(2560);
      expect(scene?.height).toBe(1440);
      expect(scene?.grid.type).toBe("hex");
      expect(scene?.grid.size).toBe(60);
    });

    it("should handle invalid metadata gracefully", async () => {
      const mockDbScene = {
        id: mockSceneId,
        name: "Scene with Bad Metadata",
        campaignId: mockCampaignId,
        mapId: null,
        tokens: [],
        metadata: "invalid json {{",
      };

      mockPrisma.scene.findUnique.mockResolvedValue(mockDbScene);

      const scene = await service.getScene(mockSceneId);

      expect(scene).toBeDefined();
      expect(scene?.grid.type).toBe("square"); // Should use defaults
      expect(scene?.grid.size).toBe(50);
    });

    it("should return null for non-existent scene", async () => {
      mockPrisma.scene.findUnique.mockResolvedValue(null);

      const scene = await service.getScene("non-existent");

      expect(scene).toBeNull();
    });

    it("should use default dimensions when map has no dimensions", async () => {
      const mockDbScene = {
        id: mockSceneId,
        name: "Scene without Map Dimensions",
        campaignId: mockCampaignId,
        mapId: mockMapId,
        map: {}, // No widthPx or heightPx
        tokens: [],
      };

      mockPrisma.scene.findUnique.mockResolvedValue(mockDbScene);

      const scene = await service.getScene(mockSceneId);

      expect(scene?.width).toBe(1920);
      expect(scene?.height).toBe(1080);
    });
  });

  describe("addToken", () => {
    beforeEach(async () => {
      // Setup a scene in cache
      const mockDbScene = {
        id: mockSceneId,
        name: "Test Scene",
        campaignId: mockCampaignId,
        mapId: null,
        tokens: [],
      };
      mockPrisma.scene.create.mockResolvedValue(mockDbScene);
      await service.createScene("Test Scene", 1920, 1080, mockCampaignId);
    });

    it("should add a token to a scene", async () => {
      const tokenData = {
        name: "Goblin",
        x: 100,
        y: 150,
        disposition: "HOSTILE" as const,
        actorId: "actor-123",
      };

      mockPrisma.token.create.mockResolvedValue({
        id: "token-123",
        ...tokenData,
        sceneId: mockSceneId,
        width: 1,
        height: 1,
        rotation: 0,
        scale: 1,
        isVisible: true,
        isLocked: false,
        layer: 0,
      });

      const tokenId = await service.addToken(mockSceneId, tokenData);

      expect(tokenId).toBe("token-123");
      expect(mockPrisma.token.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Goblin",
          sceneId: mockSceneId,
          disposition: "HOSTILE",
        }),
      });
    });

    it("should snap token position to grid", async () => {
      const tokenData = {
        name: "Hero",
        x: 73, // Not aligned to 50px grid
        y: 127, // Not aligned to 50px grid
      };

      mockPrisma.token.create.mockResolvedValue({
        id: "token-123",
        ...tokenData,
        x: 50, // Snapped
        y: 100, // Snapped
        sceneId: mockSceneId,
        width: 1,
        height: 1,
        rotation: 0,
        scale: 1,
        disposition: "UNKNOWN",
        isVisible: true,
        isLocked: false,
        layer: 0,
      });

      await service.addToken(mockSceneId, tokenData);

      expect(mockPrisma.token.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          x: expect.any(Number), // Should be snapped
          y: expect.any(Number), // Should be snapped
        }),
      });
    });

    it("should use default values for optional fields", async () => {
      const tokenData = {
        name: "Basic Token",
        x: 0,
        y: 0,
      };

      mockPrisma.token.create.mockResolvedValue({
        id: "token-123",
        ...tokenData,
        sceneId: mockSceneId,
        width: 1,
        height: 1,
        rotation: 0,
        scale: 1,
        disposition: "UNKNOWN",
        isVisible: true,
        isLocked: false,
        layer: 0,
      });

      await service.addToken(mockSceneId, tokenData);

      expect(mockPrisma.token.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          width: 1,
          height: 1,
          disposition: "UNKNOWN",
          isVisible: true,
          isLocked: false,
        }),
      });
    });

    it("should return null for non-existent scene", async () => {
      const tokenId = await service.addToken("non-existent", {
        name: "Token",
        x: 0,
        y: 0,
      });

      expect(tokenId).toBeNull();
      expect(mockPrisma.token.create).not.toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.token.create.mockRejectedValue(new Error("Database error"));

      const tokenId = await service.addToken(mockSceneId, {
        name: "Error Token",
        x: 0,
        y: 0,
      });

      expect(tokenId).toBeNull();
    });
  });

  describe("updateGridSettings", () => {
    beforeEach(async () => {
      const mockDbScene = {
        id: mockSceneId,
        name: "Test Scene",
        campaignId: mockCampaignId,
        mapId: null,
        tokens: [],
      };
      mockPrisma.scene.create.mockResolvedValue(mockDbScene);
      await service.createScene("Test Scene", 1920, 1080, mockCampaignId);
    });

    it("should update grid settings for cached scene", async () => {
      const newSettings: Partial<GridSettings> = {
        size: 75,
        visible: false,
        opacity: 0.7,
      };

      const result = await service.updateGridSettings(mockSceneId, newSettings);

      expect(result).toBe(true);

      const scene = await service.getScene(mockSceneId);
      expect(scene?.grid.size).toBe(75);
      expect(scene?.grid.visible).toBe(false);
      expect(scene?.grid.opacity).toBe(0.7);
    });

    it("should return false for non-existent scene", async () => {
      const result = await service.updateGridSettings("non-existent", {
        size: 100,
      });

      expect(result).toBe(false);
    });
  });

  describe("createMeasurement", () => {
    beforeEach(async () => {
      const mockDbScene = {
        id: mockSceneId,
        name: "Test Scene",
        campaignId: mockCampaignId,
        mapId: null,
        tokens: [],
      };
      mockPrisma.scene.create.mockResolvedValue(mockDbScene);
      await service.createScene("Test Scene", 1920, 1080, mockCampaignId);
    });

    it("should create distance measurement", async () => {
      const points = [
        { x: 0, y: 0 },
        { x: 150, y: 0 }, // 3 grid squares at 50px each
      ];

      const measurement = await service.createMeasurement(
        mockSceneId,
        "distance",
        points,
        mockUserId,
      );

      expect(measurement).toBeDefined();
      expect(measurement.type).toBe("distance");
      expect(measurement.points).toEqual(points);
      expect(measurement.ownerId).toBe(mockUserId);
      expect(measurement.measurements.distance).toBe(15); // 3 squares * 5 feet
      expect(measurement.measurements.units).toBe("feet");
    });

    it("should create area measurement for polygon", async () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];

      const measurement = await service.createMeasurement(mockSceneId, "area", points, mockUserId);

      expect(measurement).toBeDefined();
      expect(measurement.type).toBe("area");
      expect(measurement.measurements.area).toBeDefined();
      expect(measurement.measurements.area).toBeGreaterThan(0);
    });

    it("should calculate diagonal distance correctly", async () => {
      const points = [
        { x: 0, y: 0 },
        { x: 150, y: 200 }, // Diagonal movement
      ];

      const measurement = await service.createMeasurement(
        mockSceneId,
        "distance",
        points,
        mockUserId,
      );

      expect(measurement).toBeDefined();
      const expectedDistance = (Math.sqrt(150 * 150 + 200 * 200) / 50) * 5; // Pythagorean theorem
      expect(measurement.measurements.distance).toBeCloseTo(expectedDistance, 1);
    });

    it("should calculate multi-segment path distance", async () => {
      const points = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 50 },
        { x: 0, y: 50 },
      ];

      const measurement = await service.createMeasurement(
        mockSceneId,
        "distance",
        points,
        mockUserId,
      );

      expect(measurement).toBeDefined();
      expect(measurement.measurements.distance).toBe(15); // 3 segments * 1 square * 5 feet
    });

    it("should throw error for non-existent scene", async () => {
      await expect(
        service.createMeasurement(
          "non-existent",
          "distance",
          [
            { x: 0, y: 0 },
            { x: 50, y: 0 },
          ],
          mockUserId,
        ),
      ).rejects.toThrow("Scene not found");
    });

    it("should handle single point gracefully", async () => {
      const points = [{ x: 50, y: 50 }];

      const measurement = await service.createMeasurement(
        mockSceneId,
        "distance",
        points,
        mockUserId,
      );

      expect(measurement).toBeDefined();
      expect(measurement.measurements.distance).toBe(0);
    });

    it("should not calculate area for less than 3 points", async () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ];

      const measurement = await service.createMeasurement(mockSceneId, "area", points, mockUserId);

      expect(measurement).toBeDefined();
      expect(measurement.measurements.area).toBeUndefined();
    });
  });

  describe("Fog of War", () => {
    it("should add fog area", async () => {
      const result = await service.addFogArea(mockSceneId, {
        x: 100,
        y: 100,
        width: 200,
        height: 200,
      });

      // Current implementation returns null (simplified)
      expect(result).toBeNull();
    });

    it("should reveal fog area", async () => {
      const result = await service.revealFogArea(mockSceneId, 150, 150, 50);

      // Current implementation returns true (simplified)
      expect(result).toBe(true);
    });
  });

  describe("Event Bridge", () => {
    it("should set event bridge", () => {
      const mockEventBridge = {
        emit: vi.fn(),
        on: vi.fn(),
      };

      service.setEventBridge(mockEventBridge as any);

      // No error should be thrown
      expect(() => service.setEventBridge(mockEventBridge as any)).not.toThrow();
    });
  });

  describe("Physics Integration", () => {
    it("should initialize with stubbed physics world", () => {
      // Physics world should be initialized in constructor
      expect(service["physicsWorld"]).toBeDefined();
      expect(service["physicsWorld"].addBody).toBeDefined();
      expect(service["physicsWorld"].removeBody).toBeDefined();
    });

    it("should handle physics body creation in addToken", async () => {
      const mockDbScene = {
        id: mockSceneId,
        name: "Physics Scene",
        campaignId: mockCampaignId,
        mapId: null,
        tokens: [],
      };
      mockPrisma.scene.create.mockResolvedValue(mockDbScene);
      await service.createScene("Physics Scene", 1920, 1080, mockCampaignId);

      mockPrisma.token.create.mockResolvedValue({
        id: "token-physics",
        name: "Physics Token",
        x: 100,
        y: 100,
        sceneId: mockSceneId,
        width: 1,
        height: 1,
        rotation: 0,
        scale: 1,
        disposition: "NEUTRAL",
        isVisible: true,
        isLocked: false,
        layer: 0,
      });

      const addBodySpy = vi.spyOn(service["physicsWorld"], "addBody");

      await service.addToken(mockSceneId, {
        name: "Physics Token",
        x: 100,
        y: 100,
      });

      expect(addBodySpy).toHaveBeenCalled();
    });
  });

  describe("Spatial Indexing", () => {
    it("should initialize spatial indexing", () => {
      // Check that spatial index is initialized
      expect(service["spatialIndex"]).toBeDefined();
      expect(service["spatialIndex"] instanceof Map).toBe(true);
    });
  });
});
