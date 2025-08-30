import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GameSession, GameConfig, Player, GamePhase } from "./GameSession";
import { EntityId } from "@vtt/core-ecs";

// Mock dependencies
vi.mock("@vtt/core-ecs", () => ({
  World: vi.fn().mockImplementation((capacity: number) => ({
    create: vi.fn(() => 1),
    isAlive: vi.fn(() => true),
    getEntities: vi.fn(() => [1, 2, 3]),
    destroyEntity: vi.fn(),
    update: vi.fn(),
    transforms: {
      add: vi.fn(),
      has: vi.fn(() => true),
      x: { 1: 0 },
      y: { 1: 0 },
    },
    appearance: {
      add: vi.fn(),
    },
    movement: {
      add: vi.fn(),
      has: vi.fn(() => true),
      vx: { 1: 0 },
      vy: { 1: 0 },
    },
  })),
  NetworkSyncSystem: vi.fn().mockImplementation(() => ({
    update: vi.fn(() => ({ changes: [] })),
    getSnapshot: vi.fn(() => ({ entities: [] })),
  })),
  MovementSystem: vi.fn(),
}));

vi.mock("@vtt/logging", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("./DiceRoller", () => ({
  createDiceRollResult: vi.fn((dice: string, label?: string) => ({
    dice,
    label,
    total: 10,
    rolls: [
      { die: "d6", result: 4 },
      { die: "d6", result: 6 },
    ],
  })),
}));

describe("GameSession", () => {
  let session: GameSession;
  const mockConfig: GameConfig = {
    gameId: "test-game-123",
    mapId: "map-456",
    maxPlayers: 6,
    tickRate: 30,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    session = new GameSession(mockConfig);
  });

  afterEach(() => {
    session.destroy();
    vi.clearAllTimers();
    vi.restoreAllMocks();
  });

  describe("Initialization", () => {
    it("should initialize with correct configuration", () => {
      expect(session.gameId).toBe("test-game-123");
      expect(session.world).toBeDefined();
      expect(session.netSync).toBeDefined();
    });

    it("should start tick interval with correct rate", () => {
      const intervalSpy = vi.spyOn(global, "setInterval");
      const newSession = new GameSession({ ...mockConfig, tickRate: 60 });

      expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 16); // 1000/60 ≈ 16

      newSession.destroy();
    });

    it("should set initial phase to exploration", () => {
      expect(session.getPhase()).toBe("exploration");
    });
  });

  describe("Player Management", () => {
    const userId1 = "user-1";
    const userId2 = "user-2";
    const displayName1 = "Player One";
    const displayName2 = "Player Two";

    describe("addPlayer", () => {
      it("should add new player successfully", () => {
        const result = session.addPlayer(userId1, displayName1);

        expect(result).toBe(true);

        const player = session.getPlayer(userId1);
        expect(player).toBeDefined();
        expect(player?.userId).toBe(userId1);
        expect(player?.displayName).toBe(displayName1);
        expect(player?.connected).toBe(true);
      });

      it("should not add duplicate player", () => {
        session.addPlayer(userId1, displayName1);
        const result = session.addPlayer(userId1, "Different Name");

        expect(result).toBe(false);

        const player = session.getPlayer(userId1);
        expect(player?.displayName).toBe(displayName1); // Name unchanged
      });
    });

    describe("removePlayer", () => {
      it("should remove existing player", () => {
        session.addPlayer(userId1, displayName1);
        session.removePlayer(userId1);

        const player = session.getPlayer(userId1);
        expect(player).toBeUndefined();
      });

      it("should handle removing non-existent player", () => {
        expect(() => session.removePlayer("non-existent")).not.toThrow();
      });
    });

    describe("setPlayerConnected", () => {
      beforeEach(() => {
        session.addPlayer(userId1, displayName1);
      });

      it("should update player connection status", () => {
        const result = session.setPlayerConnected(userId1, false);

        expect(result).toBe(true);

        const player = session.getPlayer(userId1);
        expect(player?.connected).toBe(false);
      });

      it("should return false for non-existent player", () => {
        const result = session.setPlayerConnected("non-existent", true);
        expect(result).toBe(false);
      });
    });

    describe("getPlayers", () => {
      it("should return all players", () => {
        session.addPlayer(userId1, displayName1);
        session.addPlayer(userId2, displayName2);

        const players = session.getPlayers();

        expect(players).toHaveLength(2);
        expect(players.find((p) => p.userId === userId1)).toBeDefined();
        expect(players.find((p) => p.userId === userId2)).toBeDefined();
      });

      it("should return empty array when no players", () => {
        expect(session.getPlayers()).toEqual([]);
      });
    });

    describe("getConnectedPlayers", () => {
      it("should return only connected players", () => {
        session.addPlayer(userId1, displayName1);
        session.addPlayer(userId2, displayName2);
        session.setPlayerConnected(userId1, false);

        const connected = session.getConnectedPlayers();

        expect(connected).toHaveLength(1);
        expect(connected[0].userId).toBe(userId2);
      });
    });

    describe("Player counts", () => {
      it("should return correct player count", () => {
        expect(session.getPlayerCount()).toBe(0);

        session.addPlayer(userId1, displayName1);
        expect(session.getPlayerCount()).toBe(1);

        session.addPlayer(userId2, displayName2);
        expect(session.getPlayerCount()).toBe(2);

        session.removePlayer(userId1);
        expect(session.getPlayerCount()).toBe(1);
      });

      it("should return correct connected player count", () => {
        session.addPlayer(userId1, displayName1);
        session.addPlayer(userId2, displayName2);

        expect(session.getConnectedPlayerCount()).toBe(2);

        session.setPlayerConnected(userId1, false);
        expect(session.getConnectedPlayerCount()).toBe(1);
      });

      it("should correctly identify empty session", () => {
        expect(session.isEmpty()).toBe(true);

        session.addPlayer(userId1, displayName1);
        expect(session.isEmpty()).toBe(false);

        session.setPlayerConnected(userId1, false);
        expect(session.isEmpty()).toBe(true);
      });
    });
  });

  describe("Entity Management", () => {
    describe("createToken", () => {
      it("should create token with position", () => {
        const entityId = session.createToken(100, 200, "owner-123");

        expect(entityId).toBe(1);
        expect(session.world.transforms.add).toHaveBeenCalledWith(
          entityId,
          expect.objectContaining({ x: 100, y: 200 }),
        );
        expect(session.world.appearance.add).toHaveBeenCalled();
        expect(session.world.movement.add).toHaveBeenCalled();
      });

      it("should create token without owner", () => {
        const entityId = session.createToken(50, 75);

        expect(entityId).toBe(1);
        expect(session.world.transforms.add).toHaveBeenCalledWith(
          entityId,
          expect.objectContaining({ x: 50, y: 75 }),
        );
      });
    });

    describe("moveToken", () => {
      const entityId = 1 as EntityId;

      it("should move token with animation", () => {
        const result = session.moveToken(entityId, 200, 300, true);

        expect(result).toBe(true);
        expect(session.world.movement.vx[entityId]).toBeDefined();
        expect(session.world.movement.vy[entityId]).toBeDefined();
      });

      it("should move token instantly without animation", () => {
        const result = session.moveToken(entityId, 200, 300, false);

        expect(result).toBe(true);
        expect(session.world.transforms.x[entityId]).toBe(200);
        expect(session.world.transforms.y[entityId]).toBe(300);
      });

      it("should return false for dead entity", () => {
        session.world.isAlive = vi.fn(() => false);

        const result = session.moveToken(entityId, 200, 300);

        expect(result).toBe(false);
      });

      it("should return false for entity without transform", () => {
        session.world.transforms.has = vi.fn(() => false);

        const result = session.moveToken(entityId, 200, 300);

        expect(result).toBe(false);
      });

      it("should stop movement after animation duration", () => {
        session.world.transforms.x[entityId] = 0;
        session.world.transforms.y[entityId] = 0;

        session.moveToken(entityId, 200, 300, true);

        // Fast-forward time
        vi.advanceTimersByTime(2000); // Max 2 seconds animation

        expect(session.world.movement.vx[entityId]).toBe(0);
        expect(session.world.movement.vy[entityId]).toBe(0);
        expect(session.world.transforms.x[entityId]).toBe(200);
        expect(session.world.transforms.y[entityId]).toBe(300);
      });
    });
  });

  describe("Dice Rolling", () => {
    it("should roll dice for valid player", () => {
      session.addPlayer("user-1", "Player One");

      const result = session.rollDice("2d6", "user-1", "Attack Roll");

      expect(result).toBeDefined();
      expect(result?.dice).toBe("2d6");
      expect(result?.label).toBe("Attack Roll");
      expect(result?.total).toBe(10);
    });

    it("should return null for invalid player", () => {
      const result = session.rollDice("2d6", "non-existent", "Attack Roll");

      expect(result).toBeNull();
    });
  });

  describe("Combat Management", () => {
    const entity1 = 1 as EntityId;
    const entity2 = 2 as EntityId;
    const entity3 = 3 as EntityId;

    describe("Phase management", () => {
      it("should set and get phase", () => {
        session.setPhase("combat");
        expect(session.getPhase()).toBe("combat");

        session.setPhase("downtime");
        expect(session.getPhase()).toBe("downtime");
      });
    });

    describe("initiateCombat", () => {
      it("should initialize combat with entities", () => {
        const entities = [entity1, entity2, entity3];

        session.initiateCombat(entities);

        expect(session.getPhase()).toBe("combat");
        const state = session.getGameState();
        expect(state.turnOrder).toEqual(["1", "2", "3"]);
        expect(state.currentTurn).toBe("1");
      });

      it("should handle empty entity list", () => {
        session.initiateCombat([]);

        expect(session.getPhase()).toBe("combat");
        const state = session.getGameState();
        expect(state.turnOrder).toEqual([]);
        expect(state.currentTurn).toBeUndefined();
      });
    });

    describe("nextTurn", () => {
      beforeEach(() => {
        session.initiateCombat([entity1, entity2, entity3]);
      });

      it("should advance to next turn", () => {
        const next = session.nextTurn();

        expect(next).toBe(entity2);

        const state = session.getGameState();
        expect(state.currentTurn).toBe("2");
      });

      it("should wrap around to first entity", () => {
        session.nextTurn(); // to entity2
        session.nextTurn(); // to entity3
        const next = session.nextTurn(); // should wrap to entity1

        expect(next).toBe(entity1);
      });

      it("should return undefined for empty turn order", () => {
        session.endCombat();

        const next = session.nextTurn();

        expect(next).toBeUndefined();
      });
    });

    describe("endCombat", () => {
      it("should reset combat state", () => {
        session.initiateCombat([entity1, entity2]);
        session.endCombat();

        expect(session.getPhase()).toBe("exploration");

        const state = session.getGameState();
        expect(state.turnOrder).toEqual([]);
        expect(state.currentTurn).toBeUndefined();
      });
    });
  });

  describe("Game State", () => {
    it("should return complete game state", () => {
      session.addPlayer("user-1", "Player One");
      session.addPlayer("user-2", "Player Two");
      session.setPlayerConnected("user-2", false);
      session.initiateCombat([1 as EntityId, 2 as EntityId]);

      const state = session.getGameState();

      expect(state.gameId).toBe("test-game-123");
      expect(state.mapId).toBe("map-456");
      expect(state.players).toHaveLength(2);
      expect(state.phase).toBe("combat");
      expect(state.turnOrder).toEqual(["1", "2"]);
      expect(state.currentTurn).toBe("1");
    });
  });

  describe("Network Sync", () => {
    it("should get network delta", () => {
      const delta = session.getNetworkDelta();

      expect(delta).toBeDefined();
      expect(session.netSync.update).toHaveBeenCalledWith(session.world);
    });

    it("should get snapshot", () => {
      const snapshot = session.getSnapshot();

      expect(snapshot).toBeDefined();
      expect(session.netSync.getSnapshot).toHaveBeenCalled();
    });
  });

  describe("Simulation Loop", () => {
    it("should update world on tick", () => {
      const updateSpy = vi.spyOn(session.world, "update");

      // Advance timer to trigger tick
      vi.advanceTimersByTime(35); // One tick at 30fps

      expect(updateSpy).toHaveBeenCalled();
    });

    it("should handle tick errors gracefully", () => {
      const { logger } = require("@vtt/logging");
      session.world.update = vi.fn(() => {
        throw new Error("Tick error");
      });

      // Advance timer to trigger tick
      vi.advanceTimersByTime(35);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Tick error"),
        expect.any(Error),
      );
    });
  });

  describe("Cleanup", () => {
    it("should clean up resources on destroy", () => {
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");
      session.addPlayer("user-1", "Player One");

      session.destroy();

      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(session.getPlayerCount()).toBe(0);
      expect(session.world.destroyEntity).toHaveBeenCalledTimes(3); // For mock entities [1,2,3]
    });

    it("should handle multiple destroy calls", () => {
      session.destroy();
      expect(() => session.destroy()).not.toThrow();
    });
  });
});
