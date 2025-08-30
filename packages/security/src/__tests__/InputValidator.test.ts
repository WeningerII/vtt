/**
 * Input Validator Tests
 * Comprehensive test suite for input validation and sanitization
 */

import { InputValidator } from "../InputValidator";

describe("InputValidator", () => {
  let validator: InputValidator;

  beforeEach(() => {
    validator = new InputValidator();
  });

  describe("Basic Validation", () => {
    test("should validate valid email", () => {
      const result = validator.validate({ email: "test@example.com" }, "userLogin");
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("should reject invalid email", () => {
      const result = validator.validate({ email: "invalid-email" }, "userLogin");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "email" }));
    });

    test("should validate strong password", () => {
      const result = validator.validate({ password: "SecurePass123!" }, "userRegistration");
      expect(result.isValid).toBe(true);
    });

    test("should reject weak password", () => {
      const result = validator.validate({ password: "123" }, "userRegistration");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "password" }));
    });
  });

  describe("SQL Injection Detection", () => {
    test("should detect basic SQL injection attempts", () => {
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "1; DELETE FROM users WHERE id=1",
      ];

      maliciousInputs.forEach((input) => {
        const result = validator.validate({ query: input }, "apiGeneric");
        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.code === "SQL_INJECTION")).toBe(true);
      });
    });

    test("should allow safe SQL-like content", () => {
      const safeInputs = [
        "What's your favorite color?",
        "I have 1 cat and 2 dogs",
        "Please select your preference",
      ];

      safeInputs.forEach((input) => {
        const result = validator.validate({ content: input }, "apiGeneric");
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe("XSS Detection", () => {
    test("should detect XSS attempts", () => {
      const xssInputs = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        "javascript:alert(1)",
        '<iframe src="malicious.com"></iframe>',
        '<div onclick="alert(1)">Click me</div>',
      ];

      xssInputs.forEach((input) => {
        const result = validator.validate({ content: input }, "apiGeneric");
        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.code === "XSS_ATTEMPT")).toBe(true);
      });
    });

    test("should allow safe HTML-like content", () => {
      const safeInputs = [
        "I love &lt;programming&gt;!",
        "Check out this cool feature",
        "Price: $5 < $10",
      ];

      safeInputs.forEach((input) => {
        const result = validator.validate({ content: input }, "apiGeneric");
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe("File Upload Validation", () => {
    test("should validate safe file uploads", () => {
      const safeFiles = [
        { filename: "image.jpg", size: 1024 * 1024, mimetype: "image/jpeg" },
        { filename: "document.pdf", size: 2 * 1024 * 1024, mimetype: "application/pdf" },
        { filename: "scene.json", size: 100 * 1024, mimetype: "application/json" },
      ];

      safeFiles.forEach((file) => {
        const result = validator.validateFileUpload(file);
        expect(result.isValid).toBe(true);
      });
    });

    test("should reject dangerous file uploads", () => {
      const dangerousFiles = [
        { filename: "malware.exe", size: 1024, mimetype: "application/exe" },
        { filename: "script.js", size: 1024, mimetype: "application/javascript" },
        { filename: "shell.php", size: 1024, mimetype: "application/php" },
        { filename: "huge.jpg", size: 100 * 1024 * 1024, mimetype: "image/jpeg" }, // Too large
      ];

      dangerousFiles.forEach((file) => {
        const result = validator.validateFileUpload(file);
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe("Sanitization", () => {
    test("should sanitize HTML content", () => {
      const maliciousHtml = '<script>alert("xss")</script><p>Safe content</p>';
      const sanitized = validator.sanitize(maliciousHtml, {
        html: true,
        allowedTags: ["p", "strong", "em"],
      });

      expect(sanitized).not.toContain("<script>");
      expect(sanitized).toContain("<p>Safe content</p>");
    });

    test("should sanitize SQL injection attempts", () => {
      const maliciousSql = "'; DROP TABLE users; --";
      const sanitized = validator.sanitize(maliciousSql, {
        preventSQLInjection: true,
      });

      expect(sanitized).not.toContain("DROP TABLE");
      expect(sanitized).not.toContain("--");
    });

    test("should preserve safe content during sanitization", () => {
      const safeContent = "Hello, world! This is safe content.";
      const sanitized = validator.sanitize(safeContent, { html: true });

      expect(sanitized).toBe(safeContent);
    });
  });

  describe("Custom Validation Rules", () => {
    test("should support custom validation rules", () => {
      validator.addValidationRule("customRule", (value) => ({
        isValid: value === "expected",
        message: 'Value must be "expected"',
      }));

      const validResult = validator.validate({ test: "expected" }, "custom");
      expect(validResult.isValid).toBe(true);

      const invalidResult = validator.validate({ test: "unexpected" }, "custom");
      expect(invalidResult.isValid).toBe(false);
    });
  });

  describe("Scene Validation", () => {
    test("should validate scene creation data", () => {
      const validScene = {
        name: "Test Scene",
        width: 800,
        height: 600,
        gridSize: 50,
        backgroundColor: "#ffffff",
      };

      const result = validator.validate(validScene, "sceneCreation");
      expect(result.isValid).toBe(true);
    });

    test("should reject invalid scene data", () => {
      const invalidScene = {
        name: "", // Empty name
        width: -100, // Negative width
        height: "invalid", // Non-numeric height
        gridSize: 0, // Zero grid size
      };

      const result = validator.validate(invalidScene, "sceneCreation");
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Token Validation", () => {
    test("should validate token creation data", () => {
      const validToken = {
        name: "Player Character",
        x: 100,
        y: 150,
        size: 1,
        color: "#ff0000",
        imageUrl: "https://example.com/token.png",
      };

      const result = validator.validate(validToken, "tokenCreation");
      expect(result.isValid).toBe(true);
    });

    test("should reject malicious token data", () => {
      const maliciousToken = {
        name: '<script>alert("xss")</script>',
        x: "DROP TABLE tokens",
        y: 150,
        size: -1,
        imageUrl: "javascript:alert(1)",
      };

      const result = validator.validate(maliciousToken, "tokenCreation");
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Performance", () => {
    test("should handle large input validation efficiently", () => {
      const largeInput = {
        content: "a".repeat(10000), // 10KB of content
        list: Array.from({ length: 1000 }, (_, i) => `item${i}`),
      };

      const start = Date.now();
      const result = validator.validate(largeInput, "apiGeneric");
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(result.isValid).toBe(true);
    });

    test("should cache validation schemas for performance", () => {
      const testData = { email: "test@example.com" };

      // First validation - schema compilation
      const start1 = Date.now();
      validator.validate(testData, "userLogin");
      const duration1 = Date.now() - start1;

      // Second validation - should use cached schema
      const start2 = Date.now();
      validator.validate(testData, "userLogin");
      const duration2 = Date.now() - start2;

      expect(duration2).toBeLessThanOrEqual(duration1);
    });
  });

  describe("Error Handling", () => {
    test("should handle unknown schema gracefully", () => {
      const result = validator.validate({ test: "value" }, "unknownSchema");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ code: "UNKNOWN_SCHEMA" }));
    });

    test("should handle malformed input gracefully", () => {
      const result = validator.validate(null as any, "userLogin");
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test("should handle circular references in input", () => {
      const circularInput: any = { name: "test" };
      circularInput.self = circularInput;

      expect(() => {
        validator.validate(circularInput, "apiGeneric");
      }).not.toThrow();
    });
  });
});
