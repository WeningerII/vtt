import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRequire } from "node:module";
import type { EntityId } from "@vtt/core-ecs";

const requireModule = createRequire(__filename);

const createTransformStore = () => {
  const x: Record<number, number> = {};
  const y: Record<number, number> = {};
  const rot: Record<number, number> = {};
  const sx: Record<number, number> = {};
  const sy: Record<number, number> = {};
  const zIndex: Record<number, number> = {};

  const has = vi.fn((entityId: number) => entityId in x);

  return {
    has,
    x,
    y,
    rot,
    sx,
    sy,
    zIndex,
  };
};

const createAppearanceStore = () => ({
  sprite: {} as Record<number, number>,
  tintR: {} as Record<number, number>,
  tintG: {} as Record<number, number>,
  tintB: {} as Record<number, number>,
  alpha: {} as Record<number, number>,
  frame: {} as Record<number, number>,
});

const createMovementStore = () => {
  const vx: Record<number, number> = {};
  const vy: Record<number, number> = {};
  const speed: Record<number, number> = {};

  const has = vi.fn((entityId: number) => entityId in vx || entityId in vy);

  return {
    has,
    vx,
    vy,
    speed,
  };
};

const createdEntities = () => {
  const ids = new Set<number>();
  return {
    add(id: number) {
      ids.add(id);
    },
    remove(id: number) {
      ids.delete(id);
    },
    list() {
      return Array.from(ids.values());
    },
    has(id: number) {
      return ids.has(id);
    },
  };
};

function createMockWorld() {
  let nextEntity = 1;
  const entities = createdEntities();
  const transforms = createTransformStore();
  const appearance = createAppearanceStore();
  const movement = createMovementStore();

  const world = {
    create: vi.fn(() => {
      const id = nextEntity++;
      entities.add(id);
      return id;
    }),
    destroyEntity: vi.fn((entityId: number) => {
      entities.remove(entityId);
      delete transforms.x[entityId];
      delete transforms.y[entityId];
      delete movement.vx[entityId];
      delete movement.vy[entityId];
    }),
    getEntities: vi.fn(() => entities.list()),
    isAlive: vi.fn((entityId: number) => entities.has(entityId)),
    transforms,
    appearance,
    movement,
    update: vi.fn(),
  };

  return world;
}

const createMockNetSync = () => ({
  update: vi.fn(() => ({ seq: 1, baseSeq: 0, created: [], updated: [], removed: [] })),
  getSnapshot: vi.fn(() => ({ entities: [] })),
});

type MockWorld = ReturnType<typeof createMockWorld>;

const getMockWorld = (gameSession: GameSession): MockWorld =>
  gameSession.world as unknown as MockWorld;

vi.mock("@vtt/core-ecs", () => {
  const NetworkSyncSystem = vi.fn().mockImplementation(createMockNetSync);

  const MovementSystem = vi.fn();

  const World = vi.fn().mockImplementation(createMockWorld);

  return { World, NetworkSyncSystem, MovementSystem };
});

vi.mock("@vtt/logging", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { GameSession, type GameConfig } from "./GameSession";

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
    vi.useRealTimers();
    vi.clearAllMocks();
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

      expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 16);

      newSession.destroy();
      intervalSpy.mockRestore();
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

    it("should add and remove players", () => {
      expect(session.addPlayer(userId1, displayName1)).toBe(true);
      expect(session.addPlayer(userId1, "duplicate")).toBe(false);
      expect(session.getPlayer(userId1)?.displayName).toBe(displayName1);

      session.removePlayer(userId1);
      expect(session.getPlayer(userId1)).toBeUndefined();
    });

    it("should track connection state and counts", () => {
      session.addPlayer(userId1, displayName1);
      session.addPlayer(userId2, displayName2);

      expect(session.getPlayerCount()).toBe(2);
      expect(session.getConnectedPlayerCount()).toBe(2);

      session.setPlayerConnected(userId1, false);
      expect(session.getConnectedPlayerCount()).toBe(1);
      expect(session.isEmpty()).toBe(false);

      session.setPlayerConnected(userId2, false);
      expect(session.isEmpty()).toBe(true);
    });
  });

  describe("Entity Management", () => {
    it("should create tokens with default values", () => {
      const entityId = session.createToken(100, 200, "owner");
      const world = getMockWorld(session);

      expect(entityId).toBe(1);
      expect(world.transforms.x[entityId]).toBe(100);
      expect(world.transforms.y[entityId]).toBe(200);
      expect(world.movement.vx[entityId]).toBe(0);
      expect(world.appearance.sprite[entityId]).toBe(0);
    });

    describe("moveToken", () => {
      let entityId: EntityId;
      let world: MockWorld;

      beforeEach(() => {
        entityId = session.createToken(0, 0) as EntityId;
        world = getMockWorld(session);
        world.transforms.x[entityId] = 0;
        world.transforms.y[entityId] = 0;
        world.movement.vx[entityId] = 0;
        world.movement.vy[entityId] = 0;
      });

      it("should animate movement when requested", () => {
        const setTimeoutSpy = vi.spyOn(global, "setTimeout");
        const result = session.moveToken(entityId, 200, 300, true);

        expect(result).toBe(true);
        expect(world.movement.vx[entityId]).not.toBeUndefined();
        expect(world.movement.vy[entityId]).not.toBeUndefined();
        expect(setTimeoutSpy).toHaveBeenCalled();

        const duration = setTimeoutSpy.mock.calls[0]?.[1] as number;
        vi.advanceTimersByTime(duration);

        expect(world.movement.vx[entityId]).toBe(0);
        expect(world.movement.vy[entityId]).toBe(0);
        expect(world.transforms.x[entityId]).toBe(200);
        expect(world.transforms.y[entityId]).toBe(300);

        setTimeoutSpy.mockRestore();
      });

      it("should move instantly when animation disabled", () => {
        expect(session.moveToken(entityId, 50, 75, false)).toBe(true);
        expect(world.transforms.x[entityId]).toBe(50);
        expect(world.transforms.y[entityId]).toBe(75);
      });

      it("should guard against invalid entities", () => {
        world.destroyEntity(entityId);
        expect(session.moveToken(entityId, 10, 10)).toBe(false);

        const orphanEntity = session.createToken(5, 5) as EntityId;
        const updatedWorld = getMockWorld(session);
        delete updatedWorld.transforms.x[orphanEntity];
        delete updatedWorld.transforms.y[orphanEntity];

        expect(session.moveToken(orphanEntity, 10, 10)).toBe(false);
      });
    });
  });

  describe("Dice Rolling", () => {
    it("should roll dice with optional label", () => {
      const result = session.rollDice("2d6", "Attack Roll");

      expect(result).toBeDefined();
      expect(result?.dice).toBe("2d6");
      expect(result?.label).toBe("Attack Roll");
    });

    it("should throw for invalid dice notation", () => {
      expect(() => session.rollDice("not dice")).toThrowError("Failed to roll dice: not dice");
    });
  });

  describe("Combat Management", () => {
    const entity1 = 1 as EntityId;
    const entity2 = 2 as EntityId;
    const entity3 = 3 as EntityId;

    it("should manage combat phases and turn order", () => {
      session.setPhase("combat");
      expect(session.getPhase()).toBe("combat");

      session.setPhase("downtime");
      expect(session.getPhase()).toBe("downtime");

      session.initiateCombat([entity1, entity2, entity3]);
      let state = session.getGameState();
      expect(state.turnOrder).toEqual(["1", "2", "3"]);
      expect(state.currentTurn).toBe("1");

      expect(session.nextTurn()).toBe(entity2);
      expect(session.nextTurn()).toBe(entity3);
      expect(session.nextTurn()).toBe(entity1);

      session.endCombat();
      state = session.getGameState();
      expect(session.getPhase()).toBe("exploration");
      expect(state.turnOrder).toEqual([]);
      expect(state.currentTurn).toBeUndefined();
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

      vi.advanceTimersByTime(35);

      expect(updateSpy).toHaveBeenCalled();
      updateSpy.mockRestore();
    });

    it("should handle tick errors gracefully", () => {
      const { logger } = requireModule("@vtt/logging");
      session.world.update = vi.fn(() => {
        throw new Error("Tick error");
      });

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
      expect(session.world.destroyEntity).toHaveBeenCalledTimes(3);

      clearIntervalSpy.mockRestore();
    });

    it("should handle multiple destroy calls", () => {
      session.destroy();
      expect(() => session.destroy()).not.toThrow();
    });
  });
});
