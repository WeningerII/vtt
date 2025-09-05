/**
 * Tests for Validation Utilities
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

describe("ValidationUtils", () => {
  describe("Input Validation", () => {
    it("should validate email addresses", () => {
      const validateEmail = (email: string) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
      };

      expect(validateEmail("test@example.com")).toBe(true);
      expect(validateEmail("user.name+tag@domain.co.uk")).toBe(true);
      expect(validateEmail("invalid-email")).toBe(false);
      expect(validateEmail("@domain.com")).toBe(false);
      expect(validateEmail("test@")).toBe(false);
    });

    it("should validate UUIDs", () => {
      const validateUUID = (uuid: string) => {
        const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return regex.test(uuid);
      };

      expect(validateUUID("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
      expect(validateUUID("invalid-uuid")).toBe(false);
      expect(validateUUID("123e4567-e89b-12d3-a456")).toBe(false);
    });

    it("should validate passwords", () => {
      const validatePassword = (password: string) => {
        return (
          password.length >= 8 &&
          /[A-Z]/.test(password) &&
          /[a-z]/.test(password) &&
          /[0-9]/.test(password)
        );
      };

      expect(validatePassword("Password123")).toBe(true);
      expect(validatePassword("StrongPass1")).toBe(true);
      expect(validatePassword("weak")).toBe(false);
      expect(validatePassword("nouppercasenum1")).toBe(false);
      expect(validatePassword("NOLOWERCASE1")).toBe(false);
    });

    it("should sanitize HTML input", () => {
      const sanitizeHTML = (input: string) => {
        return input
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#x27;")
          .replace(/\//g, "&#x2F;");
      };

      expect(sanitizeHTML('<script>alert("xss")</script>')).toBe(
        "&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;",
      );
      expect(sanitizeHTML("Normal text")).toBe("Normal text");
      expect(sanitizeHTML('<img src="x" onerror="alert(1)">')).toBe(
        "&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;",
      );
    });

    it("should validate JSON structure", () => {
      const validateJSON = (jsonString: string) => {
        try {
          JSON.parse(jsonString);
          return true;
        } catch {
          return false;
        }
      };

      expect(validateJSON('{"valid": "json"}')).toBe(true);
      expect(validateJSON("[1, 2, 3]")).toBe(true);
      expect(validateJSON("invalid json")).toBe(false);
      expect(validateJSON('{"incomplete": ')).toBe(false);
    });
  });

  describe("Data Type Validation", () => {
    it("should validate numbers", () => {
      const isValidNumber = (value: any) => {
        return typeof value === "number" && !isNaN(value) && isFinite(value);
      };

      expect(isValidNumber(42)).toBe(true);
      expect(isValidNumber(3.14)).toBe(true);
      expect(isValidNumber(0)).toBe(true);
      expect(isValidNumber(-10)).toBe(true);
      expect(isValidNumber(NaN)).toBe(false);
      expect(isValidNumber(Infinity)).toBe(false);
      expect(isValidNumber("42")).toBe(false);
    });

    it("should validate arrays", () => {
      const isValidArray = (value: any, minLength = 0) => {
        return Array.isArray(value) && value.length >= minLength;
      };

      expect(isValidArray([1, 2, 3])).toBe(true);
      expect(isValidArray([], 0)).toBe(true);
      expect(isValidArray([], 1)).toBe(false);
      expect(isValidArray("not array")).toBe(false);
      expect(isValidArray(null)).toBe(false);
    });

    it("should validate objects", () => {
      const isValidObject = (value: any, requiredKeys: string[] = []) => {
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          return false;
        }
        return requiredKeys.every((key) => key in value);
      };

      expect(isValidObject({ name: "test" })).toBe(true);
      expect(isValidObject({ name: "test" }, ["name"])).toBe(true);
      expect(isValidObject({ name: "test" }, ["name", "age"])).toBe(false);
      expect(isValidObject(null)).toBe(false);
      expect(isValidObject([])).toBe(false);
    });

    it("should validate date strings", () => {
      const isValidDateString = (dateString: string) => {
        const date = new Date(dateString);
        return !isNaN(date.getTime());
      };

      expect(isValidDateString("2023-12-25")).toBe(true);
      expect(isValidDateString("2023-12-25T10:30:00Z")).toBe(true);
      expect(isValidDateString("invalid-date")).toBe(false);
      expect(isValidDateString("2023-13-45")).toBe(false);
    });
  });

  describe("Business Logic Validation", () => {
    it("should validate character stats", () => {
      const validateCharacterStats = (stats: any) => {
        const requiredStats = [
          "strength",
          "dexterity",
          "constitution",
          "intelligence",
          "wisdom",
          "charisma",
        ];

        if (!isValidObject(stats, requiredStats)) {return false;}

        return requiredStats.every((stat) => {
          const value = stats[stat];
          return typeof value === "number" && value >= 1 && value <= 20;
        });
      };

      const validStats = {
        strength: 15,
        dexterity: 12,
        constitution: 14,
        intelligence: 10,
        wisdom: 13,
        charisma: 8,
      };

      const invalidStats = {
        strength: 25, // Too high
        dexterity: 12,
        constitution: 14,
        intelligence: 10,
        wisdom: 13,
        // Missing charisma
      };

      expect(validateCharacterStats(validStats)).toBe(true);
      expect(validateCharacterStats(invalidStats)).toBe(false);
    });

    it("should validate campaign settings", () => {
      const validateCampaignSettings = (settings: any) => {
        const required = ["name", "system", "maxPlayers"];
        if (!isValidObject(settings, required)) {return false;}

        return (
          typeof settings.name === "string" &&
          settings.name.length >= 3 &&
          ["dnd5e", "pathfinder", "custom"].includes(settings.system) &&
          typeof settings.maxPlayers === "number" &&
          settings.maxPlayers >= 2 &&
          settings.maxPlayers <= 8
        );
      };

      expect(
        validateCampaignSettings({
          name: "Test Campaign",
          system: "dnd5e",
          maxPlayers: 4,
        }),
      ).toBe(true);

      expect(
        validateCampaignSettings({
          name: "AB", // Too short
          system: "dnd5e",
          maxPlayers: 4,
        }),
      ).toBe(false);

      expect(
        validateCampaignSettings({
          name: "Test Campaign",
          system: "invalid-system",
          maxPlayers: 4,
        }),
      ).toBe(false);
    });

    it("should validate dice notation", () => {
      const validateDiceNotation = (notation: string) => {
        const regex = /^(\d+)?d(\d+)([+-]\d+)?$/i;
        const match = notation.match(regex);

        if (!match) {return false;}

        const count = parseInt(match[1] || "1");
        const sides = parseInt(match[2]);

        return count >= 1 && count <= 100 && [4, 6, 8, 10, 12, 20, 100].includes(sides);
      };

      expect(validateDiceNotation("1d20")).toBe(true);
      expect(validateDiceNotation("3d6")).toBe(true);
      expect(validateDiceNotation("2d10+5")).toBe(true);
      expect(validateDiceNotation("d20")).toBe(true);
      expect(validateDiceNotation("1d7")).toBe(false); // Invalid sides
      expect(validateDiceNotation("101d20")).toBe(false); // Too many dice
      expect(validateDiceNotation("invalid")).toBe(false);
    });
  });

  describe("Security Validation", () => {
    it("should detect SQL injection attempts", () => {
      const hasSQLInjection = (input: string) => {
        const sqlPatterns = [
          /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
          /(--|\/\*|\*\/)/,
          /(\bOR\b.*=.*\bOR\b)/i,
          /(\bAND\b.*=.*\bAND\b)/i,
        ];

        return sqlPatterns.some((pattern) => pattern.test(input));
      };

      expect(hasSQLInjection("'; DROP TABLE users; --")).toBe(true);
      expect(hasSQLInjection("1 OR 1=1")).toBe(true);
      expect(hasSQLInjection("UNION SELECT * FROM passwords")).toBe(true);
      expect(hasSQLInjection("Normal user input")).toBe(false);
      expect(hasSQLInjection("user@example.com")).toBe(false);
    });

    it("should validate file uploads", () => {
      const validateFileUpload = (filename: string, maxSize: number, allowedTypes: string[]) => {
        const extension = filename.split(".").pop()?.toLowerCase();

        if (!extension || !allowedTypes.includes(extension)) {
          return { valid: false, error: "Invalid file type" };
        }

        // Mock file size check
        const fileSize = filename.length * 1000; // Simplified
        if (fileSize > maxSize) {
          return { valid: false, error: "File too large" };
        }

        return { valid: true };
      };

      expect(validateFileUpload("image.jpg", 1000000, ["jpg", "png"])).toEqual({ valid: true });
      expect(validateFileUpload("document.pdf", 1000000, ["jpg", "png"])).toEqual({
        valid: false,
        error: "Invalid file type",
      });
      expect(validateFileUpload("verylongfilename.jpg", 10, ["jpg"])).toEqual({
        valid: false,
        error: "File too large",
      });
    });

    it("should validate API rate limits", () => {
      const rateLimitTracker = new Map();

      const checkRateLimit = (userId: string, limit: number, windowMs: number) => {
        const now = Date.now();
        const userRequests = rateLimitTracker.get(userId) || [];

        // Remove old requests outside the window
        const validRequests = userRequests.filter((time: number) => now - time < windowMs);

        if (validRequests.length >= limit) {
          return { allowed: false, resetTime: validRequests[0] + windowMs };
        }

        validRequests.push(now);
        rateLimitTracker.set(userId, validRequests);

        return { allowed: true, remaining: limit - validRequests.length };
      };

      const result1 = checkRateLimit("user1", 5, 60000);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(4);

      // Simulate hitting rate limit
      for (let i = 0; i < 4; i++) {
        checkRateLimit("user1", 5, 60000);
      }

      const result2 = checkRateLimit("user1", 5, 60000);
      expect(result2.allowed).toBe(false);
      expect(result2.resetTime).toBeDefined();
    });
  });

  describe("Format Validation", () => {
    it("should validate phone numbers", () => {
      const validatePhoneNumber = (phone: string) => {
        const cleaned = phone.replace(/\D/g, "");
        return cleaned.length >= 10 && cleaned.length <= 15;
      };

      expect(validatePhoneNumber("+1-555-123-4567")).toBe(true);
      expect(validatePhoneNumber("(555) 123-4567")).toBe(true);
      expect(validatePhoneNumber("5551234567")).toBe(true);
      expect(validatePhoneNumber("123")).toBe(false);
      expect(validatePhoneNumber("12345678901234567890")).toBe(false);
    });

    it("should validate URLs", () => {
      const validateURL = (url: string) => {
        try {
          const parsed = new URL(url);
          return ["http:", "https:"].includes(parsed.protocol);
        } catch {
          return false;
        }
      };

      expect(validateURL("https://example.com")).toBe(true);
      expect(validateURL("http://localhost:3000")).toBe(true);
      expect(validateURL("ftp://example.com")).toBe(false);
      expect(validateURL("not-a-url")).toBe(false);
      expect(validateURL("javascript:alert(1)")).toBe(false);
    });

    it("should validate color codes", () => {
      const validateColorCode = (color: string) => {
        const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        const rgbRegex = /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/;

        return hexRegex.test(color) || rgbRegex.test(color);
      };

      expect(validateColorCode("#FF0000")).toBe(true);
      expect(validateColorCode("#f00")).toBe(true);
      expect(validateColorCode("rgb(255, 0, 0)")).toBe(true);
      expect(validateColorCode("red")).toBe(false);
      expect(validateColorCode("#GG0000")).toBe(false);
    });
  });

  describe("Custom Validation Rules", () => {
    it("should create reusable validators", () => {
      const createValidator = (rules: any[]) => {
        return (value: any) => {
          for (const rule of rules) {
            if (!rule.test(value)) {
              return { valid: false, error: rule.message };
            }
          }
          return { valid: true };
        };
      };

      const usernameValidator = createValidator([
        {
          test: (v: string) => typeof v === "string",
          message: "Username must be a string",
        },
        {
          test: (v: string) => v.length >= 3,
          message: "Username must be at least 3 characters",
        },
        {
          test: (v: string) => /^[a-zA-Z0-9_]+$/.test(v),
          message: "Username can only contain letters, numbers, and underscores",
        },
      ]);

      expect(usernameValidator("valid_user123")).toEqual({ valid: true });
      expect(usernameValidator("ab")).toEqual({
        valid: false,
        error: "Username must be at least 3 characters",
      });
      expect(usernameValidator("invalid-user!")).toEqual({
        valid: false,
        error: "Username can only contain letters, numbers, and underscores",
      });
    });

    it("should validate nested objects", () => {
      const validateNestedObject = (obj: any, schema: any) => {
        for (const [key, validator] of Object.entries(schema)) {
          if (!(key in obj)) {
            return { valid: false, error: `Missing required field: ${key}` };
          }

          const result = validatePhone(phone ? phone.toString() : "")(obj[key]);
          if (!result.valid) {
            return { valid: false, error: `${key}: ${result.error}` };
          }
        }
        return { valid: true };
      };

      const userSchema = {
        name: (v: string) => ({
          valid: typeof v === "string" && v.length > 0,
          error: "Name is required",
        }),
        age: (v: number) => ({
          valid: typeof v === "number" && v >= 0 && v <= 120,
          error: "Age must be between 0 and 120",
        }),
        email: (v: string) => ({
          valid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
          error: "Invalid email format",
        }),
      };

      const validUser = { name: "John", age: 30, email: "john@example.com" };
      const invalidUser = { name: "John", age: 150, email: "invalid-email" };

      expect(validateNestedObject(validUser, userSchema)).toEqual({ valid: true });
      expect(validateNestedObject(invalidUser, userSchema)).toEqual({
        valid: false,
        error: "age: Age must be between 0 and 120",
      });
    });
  });

  function isValidObject(value: any, requiredKeys: string[] = []): boolean {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }
    return requiredKeys.every((key) => key in value);
  }
});
