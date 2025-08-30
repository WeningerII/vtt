/**
 * Tests for CombatEngine
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CombatEngine,
  Combatant,
  CombatAction,
  _Attack,
  _DamageRoll,
} from "../src/combat/CombatEngine";

describe("CombatEngine", () => {
  let combatEngine: CombatEngine;
  let testCombatant: Combatant;

  beforeEach(() => {
    combatEngine = new CombatEngine();

    testCombatant = {
      id: "test-combatant",
      name: "Test Fighter",
      type: "player",
      stats: {
        hitPoints: { current: 50, max: 50, temporary: 0 },
        armorClass: 16,
        speed: 30,
        proficiencyBonus: 2,
        abilities: {
          strength: 16,
          dexterity: 14,
          constitution: 14,
          intelligence: 10,
          wisdom: 12,
          charisma: 8,
        },
        savingThrows: {
          strength: 5,
          constitution: 4,
        },
        skills: {
          athletics: 5,
          perception: 3,
        },
        resistances: [],
        immunities: [],
        vulnerabilities: [],
        conditions: [],
      },
      attacks: [
        {
          id: "longsword",
          name: "Longsword",
          type: "melee",
          attackBonus: 5,
          damage: [{ dice: "1d8", bonus: 3, type: "slashing" }],
          range: 5,
          properties: ["versatile"],
        },
      ],
      spells: [],
      position: { x: 0, y: 0 },
      initiative: 0,
      isActive: true,
      actionsUsed: 0,
      bonusActionUsed: false,
      reactionUsed: false,
      movementUsed: 0,
    };
  });

  describe("combatant management", () => {
    it("should add combatant", () => {
      combatEngine.addCombatant(testCombatant);
      const combatants = combatEngine.getCombatants();

      expect(combatants).toHaveLength(1);
      expect(combatants[0]).toEqual(testCombatant);
    });

    it("should remove combatant", () => {
      combatEngine.addCombatant(testCombatant);
      combatEngine.removeCombatant("test-combatant");

      const combatants = combatEngine.getCombatants();
      expect(combatants).toHaveLength(0);
    });

    it("should emit events when adding combatant", () => {
      const eventSpy = vi.fn();
      combatEngine.on("combatantAdded", eventSpy);

      combatEngine.addCombatant(testCombatant);

      expect(eventSpy).toHaveBeenCalledWith(testCombatant);
    });
  });

  describe("initiative and turn order", () => {
    it("should roll initiative for all combatants", () => {
      const combatant2: Combatant = {
        ...testCombatant,
        id: "test-combatant-2",
        name: "Test Rogue",
        stats: {
          ...testCombatant.stats,
          abilities: { ...testCombatant.stats.abilities, dexterity: 18 },
        },
      };

      combatEngine.addCombatant(testCombatant);
      combatEngine.addCombatant(combatant2);

      const eventSpy = vi.fn();
      combatEngine.on("initiativeRolled", eventSpy);

      combatEngine.rollInitiative();

      expect(eventSpy).toHaveBeenCalled();
      expect(testCombatant.initiative).toBeGreaterThan(0);
      expect(combatant2.initiative).toBeGreaterThan(0);

      const turnOrder = combatEngine.getTurnOrder();
      expect(turnOrder).toHaveLength(2);
    });

    it("should sort initiative correctly", () => {
      // Mock Math.random to control dice rolls
      const originalRandom = Math.random;
      let callCount = 0;
      Math.random = vi.fn(() => {
        // First roll: 0.5 (11 + 2 = 13 for testCombatant)
        // Second roll: 0.9 (19 + 4 = 23 for highDexCombatant)
        return callCount++ === 0 ? 0.5 : 0.9;
      });

      const highDexCombatant: Combatant = {
        ...testCombatant,
        id: "high-dex",
        stats: {
          ...testCombatant.stats,
          abilities: { ...testCombatant.stats.abilities, dexterity: 18 },
        },
      };

      combatEngine.addCombatant(testCombatant);
      combatEngine.addCombatant(highDexCombatant);
      combatEngine.rollInitiative();

      const turnOrder = combatEngine.getTurnOrder();
      expect(turnOrder[0]).toBe("high-dex"); // Higher initiative goes first

      Math.random = originalRandom;
    });
  });

  describe("combat flow", () => {
    beforeEach(() => {
      combatEngine.addCombatant(testCombatant);
    });

    it("should start combat", () => {
      const startSpy = vi.fn();
      const turnSpy = vi.fn();

      combatEngine.on("combatStarted", startSpy);
      combatEngine.on("turnStarted", turnSpy);

      combatEngine.startCombat();

      expect(combatEngine.isInCombat()).toBe(true);
      expect(combatEngine.getCurrentRound()).toBe(1);
      expect(startSpy).toHaveBeenCalled();
      expect(turnSpy).toHaveBeenCalledWith(testCombatant);
    });

    it("should advance turns", () => {
      const combatant2: Combatant = { ...testCombatant, id: "combatant-2" };
      combatEngine.addCombatant(combatant2);

      combatEngine.startCombat();
      const firstCombatant = combatEngine.getCurrentCombatant();

      const turnEndSpy = vi.fn();
      const turnStartSpy = vi.fn();

      combatEngine.on("turnEnded", turnEndSpy);
      combatEngine.on("turnStarted", turnStartSpy);

      combatEngine.nextTurn();

      expect(turnEndSpy).toHaveBeenCalledWith(firstCombatant);
      expect(turnStartSpy).toHaveBeenCalled();
      expect(combatEngine.getCurrentCombatant()).not.toBe(firstCombatant);
    });

    it("should advance rounds", () => {
      combatEngine.startCombat();

      const roundEndSpy = vi.fn();
      const roundStartSpy = vi.fn();

      combatEngine.on("roundEnded", roundEndSpy);
      combatEngine.on("roundStarted", roundStartSpy);

      combatEngine.nextTurn(); // Should advance to round 2

      expect(combatEngine.getCurrentRound()).toBe(2);
      expect(roundEndSpy).toHaveBeenCalledWith(1);
      expect(roundStartSpy).toHaveBeenCalledWith(2);
    });

    it("should end combat", () => {
      combatEngine.startCombat();

      const endSpy = vi.fn();
      combatEngine.on("combatEnded", endSpy);

      combatEngine.endCombat();

      expect(combatEngine.isInCombat()).toBe(false);
      expect(endSpy).toHaveBeenCalled();
    });
  });

  describe("combat actions", () => {
    let targetCombatant: Combatant;

    beforeEach(() => {
      targetCombatant = {
        ...testCombatant,
        id: "target",
        name: "Target",
        position: { x: 1, y: 0 }, // Within range
      };

      combatEngine.addCombatant(testCombatant);
      combatEngine.addCombatant(targetCombatant);
      combatEngine.startCombat();
    });

    it("should execute attack action", () => {
      const attackAction: CombatAction = {
        type: "attack",
        actorId: "test-combatant",
        targetId: "target",
        attackId: "longsword",
      };

      const result = combatEngine.executeAction(attackAction);

      expect(result.success).toBe(true);
      expect(testCombatant.actionsUsed).toBe(1);
    });

    it("should prevent actions when not actor's turn", () => {
      combatEngine.nextTurn(); // Move to next combatant's turn

      const attackAction: CombatAction = {
        type: "attack",
        actorId: "test-combatant",
        targetId: "target",
        attackId: "longsword",
      };

      const result = combatEngine.executeAction(attackAction);

      expect(result.success).toBe(false);
      expect(result.message).toBe("Not your turn");
    });

    it("should prevent actions when no actions remaining", () => {
      testCombatant.actionsUsed = 1;

      const attackAction: CombatAction = {
        type: "attack",
        actorId: "test-combatant",
        targetId: "target",
        attackId: "longsword",
      };

      const result = combatEngine.executeAction(attackAction);

      expect(result.success).toBe(false);
      expect(result.message).toBe("No actions remaining");
    });

    it("should check attack range", () => {
      targetCombatant.position = { x: 10, y: 10 }; // Out of range

      const attackAction: CombatAction = {
        type: "attack",
        actorId: "test-combatant",
        targetId: "target",
        attackId: "longsword",
      };

      const result = combatEngine.executeAction(attackAction);

      expect(result.success).toBe(false);
      expect(result.message).toBe("Target out of range");
    });

    it("should execute move action", () => {
      const moveAction: CombatAction = {
        type: "move",
        actorId: "test-combatant",
        targetPosition: { x: 1, y: 1 },
      };

      const result = combatEngine.executeAction(moveAction);

      expect(result.success).toBe(true);
      expect(testCombatant.position).toEqual({ x: 1, y: 1 });
      expect(testCombatant.movementUsed).toBeGreaterThan(0);
    });

    it("should prevent movement beyond speed", () => {
      testCombatant.movementUsed = testCombatant.stats.speed;

      const moveAction: CombatAction = {
        type: "move",
        actorId: "test-combatant",
        targetPosition: { x: 10, y: 10 },
      };

      const result = combatEngine.executeAction(moveAction);

      expect(result.success).toBe(false);
      expect(result.message).toBe("Not enough movement remaining");
    });

    it("should execute dash action", () => {
      const dashAction: CombatAction = {
        type: "dash",
        actorId: "test-combatant",
      };

      const result = combatEngine.executeAction(dashAction);

      expect(result.success).toBe(true);
      expect(testCombatant.actionsUsed).toBe(1);
      expect(result.effects).toContain("+30 movement");
    });
  });

  describe("damage and healing", () => {
    beforeEach(() => {
      combatEngine.addCombatant(testCombatant);
    });

    it("should apply damage", () => {
      const originalHP = testCombatant.stats.hitPoints.current;

      const damageSpy = vi.fn();
      combatEngine.on("damageApplied", damageSpy);

      combatEngine.applyDamage("test-combatant", 10);

      expect(testCombatant.stats.hitPoints.current).toBe(originalHP - 10);
      expect(damageSpy).toHaveBeenCalled();
    });

    it("should apply temporary hit points first", () => {
      testCombatant.stats.hitPoints.temporary = 5;
      const originalHP = testCombatant.stats.hitPoints.current;

      combatEngine.applyDamage("test-combatant", 10);

      expect(testCombatant.stats.hitPoints.temporary).toBe(0);
      expect(testCombatant.stats.hitPoints.current).toBe(originalHP - 5);
    });

    it("should not reduce HP below 0", () => {
      combatEngine.applyDamage("test-combatant", 100);

      expect(testCombatant.stats.hitPoints.current).toBe(0);
    });

    it("should handle unconsciousness at 0 HP", () => {
      const unconsciousSpy = vi.fn();
      combatEngine.on("combatantUnconscious", unconsciousSpy);

      combatEngine.applyDamage("test-combatant", 100);

      expect(testCombatant.stats.conditions).toContain("unconscious");
      expect(unconsciousSpy).toHaveBeenCalledWith(testCombatant);
    });

    it("should apply healing", () => {
      testCombatant.stats.hitPoints.current = 25;

      const healingSpy = vi.fn();
      combatEngine.on("healingApplied", healingSpy);

      combatEngine.heal("test-combatant", 10);

      expect(testCombatant.stats.hitPoints.current).toBe(35);
      expect(healingSpy).toHaveBeenCalled();
    });

    it("should not heal above maximum", () => {
      combatEngine.heal("test-combatant", 100);

      expect(testCombatant.stats.hitPoints.current).toBe(testCombatant.stats.hitPoints.max);
    });
  });

  describe("damage modifiers", () => {
    beforeEach(() => {
      combatEngine.addCombatant(testCombatant);
    });

    it("should apply resistances", () => {
      testCombatant.stats.resistances = ["fire"];

      // Access private method for testing
      const applyModifiers = (combatEngine as any).applyDamageModifiers;
      const modifiedDamage = applyModifiers.call(combatEngine, testCombatant, 10, "fire");

      expect(modifiedDamage).toBe(5); // Half damage
    });

    it("should apply immunities", () => {
      testCombatant.stats.immunities = ["poison"];

      const applyModifiers = (combatEngine as any).applyDamageModifiers;
      const modifiedDamage = applyModifiers.call(combatEngine, testCombatant, 10, "poison");

      expect(modifiedDamage).toBe(0); // No damage
    });

    it("should apply vulnerabilities", () => {
      testCombatant.stats.vulnerabilities = ["cold"];

      const applyModifiers = (combatEngine as any).applyDamageModifiers;
      const modifiedDamage = applyModifiers.call(combatEngine, testCombatant, 10, "cold");

      expect(modifiedDamage).toBe(20); // Double damage
    });
  });

  describe("utility functions", () => {
    it("should calculate ability modifiers correctly", () => {
      const getAbilityModifier = (combatEngine as any).getAbilityModifier;

      expect(getAbilityModifier.call(combatEngine, 10)).toBe(0);
      expect(getAbilityModifier.call(combatEngine, 16)).toBe(3);
      expect(getAbilityModifier.call(combatEngine, 8)).toBe(-1);
    });

    it("should calculate distance correctly", () => {
      const calculateDistance = (combatEngine as any).calculateDistance;

      const distance = calculateDistance.call(combatEngine, { x: 0, y: 0 }, { x: 3, y: 4 });

      expect(distance).toBe(25); // 5 feet per square, 5 squares = 25 feet
    });

    it("should roll dice correctly", () => {
      const rollDice = (combatEngine as any).rollDice;

      // Mock Math.random for consistent results
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.5); // Always roll middle value

      const result = rollDice.call(combatEngine, "2d6");

      expect(result.rolls).toHaveLength(2);
      expect(result.total).toBeGreaterThan(0);

      Math.random = originalRandom;
    });
  });

  describe("event system", () => {
    it("should register and call event handlers", () => {
      const handler = vi.fn();
      combatEngine.on("test-event", handler);

      // Access private emit method
      const emit = (combatEngine as any).emit;
      emit.call(combatEngine, "test-event", "test-data");

      expect(handler).toHaveBeenCalledWith("test-data");
    });

    it("should remove event handlers", () => {
      const handler = vi.fn();
      combatEngine.on("test-event", handler);
      combatEngine.off("test-event", handler);

      const emit = (combatEngine as any).emit;
      emit.call(combatEngine, "test-event", "test-data");

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
