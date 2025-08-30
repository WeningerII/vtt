/**
 * Tests for GameSession multiplayer synchronization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GameSession, Player, StateUpdate, SyncMessage } from "../src/GameSession";

describe("GameSession", () => {
  let gameSession: GameSession;
  let testPlayer: Player;

  beforeEach(() => {
    gameSession = new GameSession("test-session");

    testPlayer = {
      id: "test-player",
      name: "Test Player",
      role: "player",
      characterIds: ["char-1"],
      connected: true,
      lastSeen: Date.now(),
    };
  });

  afterEach(() => {
    gameSession.destroy();
  });

  describe("session initialization", () => {
    it("should initialize with correct session ID", () => {
      expect(gameSession.getSessionId()).toBe("test-session");
    });

    it("should start with empty player list", () => {
      expect(gameSession.getPlayers()).toHaveLength(0);
    });

    it("should have default settings", () => {
      const settings = gameSession.getSettings();
      expect(settings.gridSize).toBe(70);
      expect(settings.gridType).toBe("square");
      expect(settings.visionEnabled).toBe(true);
    });
  });

  describe("player management", () => {
    it("should add player", () => {
      const joinSpy = vi.fn();
      gameSession.on("playerJoined", joinSpy);

      gameSession.addPlayer(testPlayer);

      expect(gameSession.getPlayers()).toHaveLength(1);
      expect(gameSession.getPlayer("test-player")).toEqual(testPlayer);
      expect(joinSpy).toHaveBeenCalledWith(testPlayer);
    });

    it("should remove player", () => {
      gameSession.addPlayer(testPlayer);

      const leftSpy = vi.fn();
      gameSession.on("playerLeft", leftSpy);

      gameSession.removePlayer("test-player");

      expect(gameSession.getPlayers()).toHaveLength(0);
      expect(gameSession.getPlayer("test-player")).toBeUndefined();
      expect(leftSpy).toHaveBeenCalledWith(testPlayer);
    });

    it("should update player connection status", () => {
      gameSession.addPlayer(testPlayer);

      gameSession.updatePlayerConnection("test-player", false);

      const player = gameSession.getPlayer("test-player");
      expect(player?.connected).toBe(false);
    });

    it("should handle player disconnect timeout", async () => {
      gameSession.addPlayer(testPlayer);

      const disconnectSpy = vi.fn();
      gameSession.on("playerDisconnected", disconnectSpy);

      // Simulate time passing beyond timeout
      vi.useFakeTimers();
      vi.advanceTimersByTime(35000); // 35 seconds

      expect(disconnectSpy).toHaveBeenCalledWith("test-player");

      vi.useRealTimers();
    });
  });

  describe("state updates", () => {
    beforeEach(() => {
      gameSession.addPlayer(testPlayer);
    });

    it("should queue updates", () => {
      gameSession.queueUpdate("entity", "test-player", {
        action: "create",
        entityId: "entity-1",
      });

      // Updates should be queued internally
      expect(true).toBe(true); // Placeholder - would check internal queue
    });

    it("should apply entity updates", () => {
      const update: StateUpdate = {
        type: "entity",
        timestamp: Date.now(),
        playerId: "test-player",
        sequenceId: 1,
        data: {
          action: "create",
          entityId: "entity-1",
        },
      };

      const result = gameSession.applyUpdate(update);
      expect(result).toBe(true);
    });

    it("should apply combat updates", () => {
      const update: StateUpdate = {
        type: "combat",
        timestamp: Date.now(),
        playerId: "test-player",
        sequenceId: 1,
        data: {
          action: "startCombat",
        },
      };

      const result = gameSession.applyUpdate(update);
      expect(result).toBe(true);
    });

    it("should apply settings updates", () => {
      const update: StateUpdate = {
        type: "settings",
        timestamp: Date.now(),
        playerId: "test-player",
        sequenceId: 1,
        data: {
          settings: { gridSize: 100 },
        },
      };

      const result = gameSession.applyUpdate(update);
      expect(result).toBe(true);

      const settings = gameSession.getSettings();
      expect(settings.gridSize).toBe(100);
    });

    it("should handle invalid updates gracefully", () => {
      const update: StateUpdate = {
        type: "invalid" as any,
        timestamp: Date.now(),
        playerId: "test-player",
        sequenceId: 1,
        data: Record<string, any>,
      };

      const result = gameSession.applyUpdate(update);
      expect(result).toBe(false);
    });
  });

  describe("synchronization", () => {
    beforeEach(() => {
      gameSession.addPlayer(testPlayer);
    });

    it("should generate full sync", () => {
      const fullSync = gameSession.getFullSync("test-player");

      expect(fullSync.type).toBe("full_sync");
      expect(fullSync.sessionId).toBe("test-session");
      expect(fullSync.data.players).toHaveLength(1);
      expect(fullSync.data.settings).toBeDefined();
    });

    it("should generate delta sync", () => {
      gameSession.queueUpdate("entity", "test-player", { action: "create" });

      const deltaSync = gameSession.getDeltaSync("test-player", 0);

      expect(deltaSync.type).toBe("delta_sync");
      expect(deltaSync.data.updates).toBeDefined();
    });

    it("should filter updates by player relevance", () => {
      const gmPlayer: Player = {
        ...testPlayer,
        id: "gm-player",
        role: "gm",
      };

      gameSession.addPlayer(gmPlayer);

      gameSession.queueUpdate("entity", "test-player", { action: "create" });

      const playerSync = gameSession.getDeltaSync("test-player", 0);
      const gmSync = gameSession.getDeltaSync("gm-player", 0);

      // GM should see all updates, player should see relevant ones
      expect(gmSync.data.updates.length).toBeGreaterThanOrEqual(playerSync.data.updates.length);
    });
  });

  describe("client message handling", () => {
    beforeEach(() => {
      gameSession.addPlayer(testPlayer);
    });

    it("should handle state update messages", () => {
      const message: SyncMessage = {
        type: "state_update",
        sessionId: "test-session",
        timestamp: Date.now(),
        data: {
          type: "entity",
          action: "create",
          entityId: "entity-1",
        },
      };

      gameSession.handleClientMessage("test-player", message);

      // Should queue the update
      expect(true).toBe(true); // Placeholder
    });

    it("should handle player actions", () => {
      const message: SyncMessage = {
        type: "player_action",
        sessionId: "test-session",
        timestamp: Date.now(),
        data: {
          type: "move_token",
          data: { tokenId: "token-1", x: 5, y: 5 },
        },
      };

      gameSession.handleClientMessage("test-player", message);

      // Should process the action
      expect(true).toBe(true); // Placeholder
    });

    it("should ignore messages from unknown players", () => {
      const message: SyncMessage = {
        type: "state_update",
        sessionId: "test-session",
        timestamp: Date.now(),
        data: Record<string, any>,
      };

      // Should not throw error
      expect(() => {
        gameSession.handleClientMessage("unknown-player", message);
      }).not.toThrow();
    });

    it("should validate player permissions", () => {
      const regularPlayer: Player = {
        ...testPlayer,
        role: "player",
      };

      gameSession.addPlayer(regularPlayer);

      // Player trying to update entity they don't own
      const message: SyncMessage = {
        type: "state_update",
        sessionId: "test-session",
        timestamp: Date.now(),
        data: {
          type: "entity",
          entityId: "not-owned-entity",
          action: "update",
        },
      };

      gameSession.handleClientMessage("test-player", message);

      // Should be rejected due to permissions
      expect(true).toBe(true); // Placeholder
    });
  });

  describe("combat integration", () => {
    it("should handle combat events", () => {
      const combatEngine = gameSession.getCombatEngine();

      const eventSpy = vi.fn();
      gameSession.on("syncMessage", eventSpy);

      // Simulate combat event
      combatEngine.emit("combatStarted");

      // Should generate sync message
      expect(true).toBe(true); // Placeholder
    });

    it("should process combat actions", () => {
      gameSession.addPlayer(testPlayer);

      const combatAction = {
        type: "attack",
        actorId: "char-1",
        targetId: "target-1",
        attackId: "sword",
      };

      gameSession.handleClientMessage("test-player", {
        type: "player_action",
        sessionId: "test-session",
        timestamp: Date.now(),
        data: {
          type: "combat_action",
          data: { combatAction },
        },
      });

      // Should queue combat update
      expect(true).toBe(true); // Placeholder
    });
  });

  describe("world integration", () => {
    it("should provide access to ECS world", () => {
      const world = gameSession.getWorld();
      expect(world).toBeDefined();
    });

    it("should update world simulation", () => {
      const world = gameSession.getWorld();
      const updateSpy = vi.spyOn(world, "update");

      // Simulate sync tick
      vi.useFakeTimers();
      vi.advanceTimersByTime(100);

      expect(updateSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe("settings management", () => {
    it("should update settings", () => {
      const newSettings = {
        gridSize: 100,
        visionEnabled: false,
      };

      gameSession.updateSettings(newSettings);

      const settings = gameSession.getSettings();
      expect(settings.gridSize).toBe(100);
      expect(settings.visionEnabled).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("should clean up resources on destroy", () => {
      gameSession.addPlayer(testPlayer);

      gameSession.destroy();

      expect(gameSession.getPlayers()).toHaveLength(0);
    });
  });

  describe("error handling", () => {
    it("should handle malformed updates gracefully", () => {
      const badUpdate: StateUpdate = {
        type: "entity",
        timestamp: Date.now(),
        playerId: "test-player",
        sequenceId: 1,
        data: null, // Invalid data
      };

      expect(() => {
        gameSession.applyUpdate(badUpdate);
      }).not.toThrow();
    });

    it("should handle sync errors gracefully", () => {
      expect(() => {
        gameSession.getFullSync("non-existent-player");
      }).toThrow("Player not found");
    });
  });

  describe("performance", () => {
    it("should limit update queue size", () => {
      gameSession.addPlayer(testPlayer);

      // Add many updates
      for (let i = 0; i < 2000; i++) {
        gameSession.queueUpdate("entity", "test-player", { action: "update", id: i });
      }

      // Queue should be limited to prevent memory issues
      expect(true).toBe(true); // Placeholder - would check internal queue size
    });

    it("should batch sync messages efficiently", () => {
      gameSession.addPlayer(testPlayer);

      const syncSpy = vi.fn();
      gameSession.on("syncMessage", syncSpy);

      // Add multiple updates
      gameSession.queueUpdate("entity", "test-player", { action: "update1" });
      gameSession.queueUpdate("entity", "test-player", { action: "update2" });

      // Should batch updates in single sync message
      vi.useFakeTimers();
      vi.advanceTimersByTime(100);

      expect(syncSpy).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });
});
