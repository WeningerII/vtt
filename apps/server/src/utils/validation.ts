/**
 * Validation utilities for API requests
 */

export interface ValidationRule {
  required?: boolean;
  type?: "string" | "number" | "boolean" | "array" | "object";
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => string | null;
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Validate request body against schema
 */
export function validateRequest(data: any, schema: ValidationSchema): ValidationResult {
  const errors: Record<string, string> = {};

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    // Check required fields
    if (rules.required && (value === undefined || value === null || value === "")) {
      errors[field] = `${field} is required`;
      continue;
    }

    // Skip validation if field is not required and empty
    if (!rules.required && (value === undefined || value === null || value === "")) {
      continue;
    }

    // Type validation
    if (rules.type) {
      const actualType = Array.isArray(value) ? "array" : typeof value;
      if (actualType !== rules.type) {
        errors[field] = `${field} must be of type ${rules.type}`;
        continue;
      }
    }

    // String validations
    if (typeof value === "string") {
      if (rules.minLength && value.length < rules.minLength) {
        errors[field] = `${field} must be at least ${rules.minLength} characters`;
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors[field] = `${field} must be no more than ${rules.maxLength} characters`;
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors[field] = `${field} format is invalid`;
      }
    }

    // Number validations
    if (typeof value === "number") {
      if (rules.min !== undefined && value < rules.min) {
        errors[field] = `${field} must be at least ${rules.min}`;
      }
      if (rules.max !== undefined && value > rules.max) {
        errors[field] = `${field} must be no more than ${rules.max}`;
      }
    }

    // Enum validation
    if (rules.enum && !rules.enum.includes(value)) {
      errors[field] = `${field} must be one of: ${rules.enum.join(", ")}`;
    }

    // Custom validation
    if (rules.custom) {
      const customError = rules.custom(value);
      if (customError) {
        errors[field] = customError;
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Common validation schemas
 */
export const _schemas = {
  createCharacter: {
    name: { required: true, type: "string", minLength: 1, maxLength: 50 },
    race: { required: true, type: "string", minLength: 1, maxLength: 30 },
    class: { required: true, type: "string", minLength: 1, maxLength: 30 },
    level: { type: "number", min: 1, max: 20 },
    background: { type: "string", maxLength: 50 },
    alignment: { type: "string", enum: ["LG", "LN", "LE", "NG", "N", "NE", "CG", "CN", "CE"] },
  },

  createCampaign: {
    name: { required: true, type: "string", minLength: 1, maxLength: 100 },
    description: { type: "string", maxLength: 1000 },
    system: { type: "string", maxLength: 50 },
    maxPlayers: { type: "number", min: 1, max: 20 },
  },

  createScene: {
    name: { required: true, type: "string", minLength: 1, maxLength: 100 },
    width: { required: true, type: "number", min: 100, max: 10000 },
    height: { required: true, type: "number", min: 100, max: 10000 },
  },

  uploadAsset: {
    name: { required: true, type: "string", minLength: 1, maxLength: 255 },
    type: { required: true, type: "string", enum: ["image", "audio", "map", "token", "document"] },
    tags: { type: "array" },
  },
} as const;

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  return input.trim().slice(0, maxLength).replace(/[<>]/g, ""); // Basic XSS prevention
}

/**
 * Validate coordinate values for maps
 */
export function validateCoordinates(
  x: number,
  y: number,
  maxX: number = 10000,
  maxY: number = 10000,
): boolean {
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= maxX && y >= 0 && y <= maxY;
}

/**
 * Validate pagination parameters
 */
export function validatePagination(page?: number, limit?: number): { page: number; limit: number } {
  const validPage = Number.isInteger(page) && page! > 0 ? page! : 1;
  const validLimit = Number.isInteger(limit) && limit! > 0 && limit! <= 100 ? limit! : 20;

  return { page: validPage, limit: validLimit };
}
