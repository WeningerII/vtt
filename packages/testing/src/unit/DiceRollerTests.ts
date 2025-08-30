/**
 * Unit tests for DiceRoller system
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DiceRoller } from "@vtt/rules-5e";
import { TestUtils } from "../TestUtils";

describe("DiceRoller Unit Tests", () => {
  let diceRoller: DiceRoller;

  beforeEach(() => {
    // Use deterministic sequence for predictable tests
    diceRoller = TestUtils.createTestDiceRoller([0.5, 0.8, 0.2, 0.9, 0.1]);
  });

  describe("Basic Dice Rolling", () => {
    it("should roll single die correctly", () => {
      const result = diceRoller.rollDie(20);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(20);
    });

    it("should roll multiple dice", () => {
      const rolls = diceRoller.rollDice(3, 6);
      expect(rolls).toHaveLength(3);
      rolls.forEach((roll) => {
        expect(roll).toBeGreaterThanOrEqual(1);
        expect(roll).toBeLessThanOrEqual(6);
      });
    });

    it("should parse dice expressions correctly", () => {
      const result = diceRoller.roll("2d6+3");
      expect(result.rolls).toHaveLength(2);
      expect(result.modifier).toBe(3);
      expect(result.total).toBeGreaterThanOrEqual(5); // Min: 2 + 3
      expect(result.total).toBeLessThanOrEqual(15); // Max: 12 + 3
    });
  });

  describe("Advantage and Disadvantage", () => {
    it("should roll with advantage correctly", () => {
      const result = diceRoller.rollWithAdvantage(20, 5);
      expect(result.rolls).toHaveLength(2);
      expect(result.modifier).toBe(5);
      expect(result.expression).toContain("advantage");
    });

    it("should roll with disadvantage correctly", () => {
      const result = diceRoller.rollWithDisadvantage(20, 3);
      expect(result.rolls).toHaveLength(2);
      expect(result.modifier).toBe(3);
      expect(result.expression).toContain("disadvantage");
    });

    it("should cancel advantage and disadvantage", () => {
      const diceRoll = {
        count: 1,
        sides: 20,
        modifier: 2,
        advantage: true,
        disadvantage: true,
      };

      const result = diceRoller.rollDiceRoll(diceRoll);
      expect(result.rolls).toHaveLength(1); // Should be normal roll
    });
  });

  describe("Critical Hits and Fails", () => {
    it("should detect critical hits on natural 20", () => {
      // Force a roll of 20 (index 0 in our sequence gives 0.5, which becomes 11 on d20)
      // We need to create a roller that gives us exactly 20
      const critRoller = TestUtils.createTestDiceRoller([0.95]); // 0.95 * 20 + 1 = 20
      const result = critRoller.rollAttack(5);

      expect(result.critical).toBe(true);
    });

    it("should detect critical fails on natural 1", () => {
      const failRoller = TestUtils.createTestDiceRoller([0.0]); // 0.0 * 20 + 1 = 1
      const result = failRoller.rollAttack(5);

      expect(result.criticalFail).toBe(true);
    });
  });

  describe("Damage Rolling", () => {
    it("should roll normal damage", () => {
      const result = diceRoller.rollDamage("2d6+3");
      expect(result.rolls).toHaveLength(2);
      expect(result.modifier).toBe(3);
      expect(result.total).toBeGreaterThanOrEqual(5);
    });

    it("should double dice on critical hits", () => {
      const result = diceRoller.rollDamage("2d6+3", true);
      expect(result.rolls).toHaveLength(4); // Doubled dice
      expect(result.expression).toContain("critical hit");
      expect(result.total).toBeGreaterThanOrEqual(7); // 4d6 min + 3
    });
  });

  describe("Special Rolls", () => {
    it("should roll initiative", () => {
      const result = diceRoller.rollInitiative(3);
      expect(result.rolls).toHaveLength(1);
      expect(result.modifier).toBe(3);
    });

    it("should roll ability checks", () => {
      const result = diceRoller.rollAbilityCheck(2, true);
      expect(result.rolls).toHaveLength(2); // Advantage
      expect(result.modifier).toBe(2);
    });

    it("should roll saving throws", () => {
      const result = diceRoller.rollSavingThrow(4, false, true);
      expect(result.rolls).toHaveLength(2); // Disadvantage
      expect(result.modifier).toBe(4);
    });

    it("should roll healing", () => {
      const result = diceRoller.rollHealing("3d8+5");
      expect(result.rolls).toHaveLength(3);
      expect(result.modifier).toBe(5);
    });
  });

  describe("Expression Parsing", () => {
    it("should parse various dice expressions", () => {
      const expressions = ["1d20", "2d6+3", "d8+1", "4d4-2", "1d100"];

      expressions.forEach((_expr) => {
        expect(() => diceRoller.roll(expr)).not.toThrow();
      });
    });

    it("should throw on invalid expressions", () => {
      const invalidExpressions = ["invalid", "2d", "d+3", "2x6+3"];

      invalidExpressions.forEach((_expr) => {
        expect(() => diceRoller.roll(expr)).toThrow();
      });
    });
  });

  describe("Performance", () => {
    it("should handle many rolls efficiently", async () => {
      const rollCount = 10000;

      const benchmark = await TestUtils.benchmark(
        "Dice Rolling",
        () => {
          diceRoller.roll("2d6+3");
        },
        rollCount,
      );

      expect(benchmark.averageTime).toBeLessThan(0.1); // Less than 0.1ms per roll
    });
  });
});
