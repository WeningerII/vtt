/**
 * Integration tests for GameSession functionality
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TestUtils } from "../TestUtils";
import { _GameSession, Player } from "@vtt/net";

describe("GameSession Integration Tests", () => {
  let testSession: ReturnType<typeof TestUtils.createTestSession>;

  beforeEach(() => {
    testSession = TestUtils.createTestSession(4);
  });

  afterEach(() => {
    testSession.cleanup();
  });

  describe("Player Management", () => {
    it("should add and remove players correctly", () => {
      const session = testSession.session;
      const initialPlayerCount = session.getPlayers().length;

      const newPlayer: Player = {
        id: "new-player",
        name: "NewPlayer",
        role: "player",
        characterIds: ["new-char"],
        connected: true,
        lastSeen: Date.now(),
      };

      session.addPlayer(newPlayer);
      expect(session.getPlayers()).toHaveLength(initialPlayerCount + 1);
      expect(session.getPlayer("new-player")).toEqual(newPlayer);

      session.removePlayer("new-player");
      expect(session.getPlayers()).toHaveLength(initialPlayerCount);
      expect(session.getPlayer("new-player")).toBeUndefined();
    });

    it("should handle player connection state changes", () => {
      const session = testSession.session;
      const playerId = testSession.players[0].id;

      session.updatePlayerConnection(playerId, false);
      const player = session.getPlayer(playerId);
      expect(player?.connected).toBe(false);

      session.updatePlayerConnection(playerId, true);
      const reconnectedPlayer = session.getPlayer(playerId);
      expect(reconnectedPlayer?.connected).toBe(true);
    });
  });

  describe("State Synchronization", () => {
    it("should generate full sync messages", () => {
      const session = testSession.session;
      const playerId = testSession.players[0].id;

      const syncMessage = session.getFullSync(playerId);

      expect(syncMessage.type).toBe("full_sync");
      expect(syncMessage.sessionId).toBe(session.getSessionId());
      expect(syncMessage.data).toHaveProperty("players");
      expect(syncMessage.data).toHaveProperty("worldState");
      expect(syncMessage.data).toHaveProperty("combatState");
      expect(syncMessage.data).toHaveProperty("currentScene");
      expect(syncMessage.data).toHaveProperty("settings");
    });

    it("should generate delta sync messages", () => {
      const session = testSession.session;
      const playerId = testSession.players[0].id;

      // Queue some updates
      session.queueUpdate("entity", playerId, {
        action: "create",
        entityId: "test-entity",
      });

      const deltaSync = session.getDeltaSync(playerId, 0);

      expect(deltaSync.type).toBe("delta_sync");
      expect(deltaSync.data.updates).toHaveLength(1);
      expect(deltaSync.data.updates[0].type).toBe("entity");
    });

    it("should filter updates based on player permissions", () => {
      const session = testSession.session;
      const gmId = testSession.players[0].id; // First player is GM
      const playerId = testSession.players[1].id; // Second player is regular player

      // Queue a GM-only update
      session.queueUpdate("settings", "system", {
        settings: { gridSize: 100 },
      });

      const gmSync = session.getDeltaSync(gmId, 0);
      const playerSync = session.getDeltaSync(playerId, 0);

      expect(gmSync.data.updates).toHaveLength(1);
      expect(playerSync.data.updates).toHaveLength(1); // Settings are public
    });
  });

  describe("Combat Integration", () => {
    it("should handle combat state updates", () => {
      const session = testSession.session;
      const combat = session.getCombatEngine();

      // Add a combatant
      const combatant = {
        id: "test-combatant",
        name: "Test Fighter",
        initiative: 15,
        hitPoints: 30,
        maxHitPoints: 30,
        armorClass: 16,
        isPlayer: true,
      };

      combat.addCombatant(combatant);
      combat.startCombat();

      expect(combat.isInCombat()).toBe(true);
      expect(combat.getCombatants()).toHaveLength(1);
      expect(combat.getCurrentCombatant()?.id).toBe("test-combatant");
    });
  });

  describe("AI Entity Management", () => {
    it("should add and remove AI entities", () => {
      const session = testSession.session;

      session.addAIEntity("ai-guard-1", "guard");
      const aiEntities = session.getAIEntities();

      expect(aiEntities).toHaveLength(1);
      expect(session.getAIEntity("ai-guard-1")).toBeDefined();

      session.removeAIEntity("ai-guard-1");
      expect(session.getAIEntities()).toHaveLength(0);
      expect(session.getAIEntity("ai-guard-1")).toBeUndefined();
    });
  });

  describe("Message Handling", () => {
    it("should handle player actions", async () => {
      const session = testSession.session;
      const playerId = testSession.players[1].id;

      const moveAction = {
        type: "player_action",
        sessionId: session.getSessionId(),
        timestamp: Date.now(),
        data: {
          type: "move_token",
          data: {
            tokenId: "player-token",
            x: 100,
            y: 200,
          },
        },
      };

      let updateReceived = false;
      session.on("syncMessage", () => {
        updateReceived = true;
      });

      session.handleClientMessage(playerId, moveAction);

      // Wait for async processing
      await TestUtils.waitFor(() => updateReceived);
      expect(updateReceived).toBe(true);
    });

    it("should validate player permissions", () => {
      const session = testSession.session;
      const playerId = testSession.players[1].id; // Regular player

      const invalidAction = {
        type: "state_update",
        sessionId: session.getSessionId(),
        timestamp: Date.now(),
        data: {
          type: "settings",
          settings: { gridSize: 200 },
        },
      };

      // This should be rejected for non-GM players
      const consoleSpy = TestUtils.captureConsole();
      session.handleClientMessage(playerId, invalidAction);

      expect(consoleSpy.warns.some((w) => w.includes("permission"))).toBe(true);
      consoleSpy.restore();
    });
  });

  describe("Performance", () => {
    it("should handle many simultaneous updates efficiently", async () => {
      const session = testSession.session;
      const updateCount = 1000;

      const benchmark = await TestUtils.benchmark(
        "Queue Updates",
        () => {
          session.queueUpdate("entity", "system", {
            action: "updateComponent",
            entityId: Math.floor(Math.random() * 100),
            componentType: "Transform2D",
            data: { x: Math.random() * 1000, y: Math.random() * 1000 },
          });
        },
        updateCount,
      );

      expect(benchmark.averageTime).toBeLessThan(1); // Less than 1ms per update
    });
  });
});
