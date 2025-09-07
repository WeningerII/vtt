/**
 * Input Validation System
 * Comprehensive input validation, sanitization, and schema enforcement
 */

import { z } from "zod";

export interface ValidationRule {
  name: string;
  description: string;
  validator: (_value: any) => ValidationResult;
  severity: "error" | "warning" | "info";
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  sanitized?: any;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface SanitizationOptions {
  stripHtml?: boolean;
  normalizeWhitespace?: boolean;
  trimStrings?: boolean;
  lowercaseEmails?: boolean;
  removeScripts?: boolean;
  maxLength?: number;
}

export class InputValidator {
  private rules = new Map<string, ValidationRule>();
  private schemas = new Map<string, z.ZodSchema<any>>();

  constructor() {
    this.setupDefaultRules();
    this.setupDefaultSchemas();
  }

  /**
   * Validate input against a registered schema
   */
  validateSchema(schemaName: string, data: any): ValidationResult {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      return {
        valid: false,
        errors: [
          { field: "schema", message: `Schema not found: ${schemaName}`, code: "SCHEMA_NOT_FOUND" },
        ],
        warnings: [],
      };
    }

    try {
      const result = schema.parse(data);
      return {
        valid: true,
        errors: [],
        warnings: [],
        sanitized: result,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
            code: err.code,
            value: data,
          })),
          warnings: [],
        };
      }

      return {
        valid: false,
        errors: [{ field: "unknown", message: "Validation failed", code: "VALIDATION_ERROR" }],
        warnings: [],
      };
    }
  }

  /**
   * Validate and sanitize user input
   */
  validateInput(
    data: Record<string, any>,
    schemaName?: string,
    options: SanitizationOptions = {},
  ): ValidationResult {
    // First sanitize the input
    const sanitized = this.sanitizeInput(data, options);

    // Then validate against schema if provided
    if (schemaName) {
      return this.validateSchema(schemaName, sanitized);
    }

    // Otherwise apply general validation rules
    return this.applyValidationRules(sanitized);
  }

  /**
   * Sanitize input data
   */
  sanitizeInput(data: any, options: SanitizationOptions = {}): any {
    if (typeof data === "string") {
      return this.sanitizeString(data, options);
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeInput(item, options));
    }

    if (typeof data === "object" && data !== null) {
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeInput(value, options);
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Register a custom validation rule
   */
  registerRule(rule: ValidationRule): void {
    this.rules.set(rule.name, rule);
  }

  /**
   * Register a custom schema
   */
  registerSchema(name: string, schema: z.ZodSchema): void {
    this.schemas.set(name, schema);
  }

  /**
   * Validate file upload
   */
  validateFileUpload(file: {
    name: string;
    size: number;
    type: string;
    content?: ArrayBuffer;
  }): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // File name validation
    if (!file.name || file.name.trim().length === 0) {
      errors.push({
        field: "name",
        message: "File name is required",
        code: "REQUIRED",
      });
    } else if (file.name.length > 255) {
      errors.push({
        field: "name",
        message: "File name too long",
        code: "MAX_LENGTH",
        value: file.name,
      });
    } else if (/[<>:"/\\|?*]/.test(file.name)) {
      errors.push({
        field: "name",
        message: "File name contains invalid characters",
        code: "INVALID_CHARACTERS",
        value: file.name,
      });
    }

    // File size validation
    const maxFileSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxFileSize) {
      errors.push({
        field: "size",
        message: `File too large (max: ${maxFileSize / 1024 / 1024}MB)`,
        code: "FILE_TOO_LARGE",
        value: file.size,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private sanitizeString(str: string, options: SanitizationOptions): string {
    let result = str;

    if (options.trimStrings !== false) {
      result = result.trim();
    }

    if (options.normalizeWhitespace) {
      result = result.replace(/\s+/g, " ");
    }

    if (options.stripHtml) {
      result = result.replace(/<[^>]*>/g, "");
    }

    if (options.removeScripts) {
      result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
      result = result.replace(/javascript:/gi, "");
      result = result.replace(/on\w+\s*=/gi, "");
    }

    if (options.lowercaseEmails && this.isEmail(result)) {
      result = result.toLowerCase();
    }

    if (options.maxLength && result.length > options.maxLength) {
      result = result.substring(0, options.maxLength);
    }

    return result;
  }

  private isEmail(str: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
  }

  private applyValidationRules(data: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const rule of this.rules.values()) {
      try {
        const result = rule.validator(data);
        errors.push(...result.errors);
        warnings.push(...result.warnings);
      } catch (error) {
        errors.push({
          field: "validation",
          message: `Rule "${rule.name}" failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "RULE_ERROR",
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitized: data,
    };
  }

  private setupDefaultRules(): void {
    // SQL Injection detection
    this.registerRule({
      name: "sql_injection",
      description: "Detects potential SQL injection attempts",
      severity: "error",
      validator: (data: any) => {
        const errors: ValidationError[] = [];
        const sqlPatterns = [
          /('|(\x27)|(\x2D)|(\x23)|\(|\*|;|<|>|\[|\]|\{|\}|\||&)/i,
          /(select|union|insert|update|delete|drop|create|alter|exec|execute|script)/i,
        ];

        const checkString = (str: string, field: string) => {
          for (const pattern of sqlPatterns) {
            if (pattern.test(str)) {
              errors.push({
                field,
                message: "Potential SQL injection detected",
                code: "SQL_INJECTION",
                value: str,
              });
              break;
            }
          }
        };

        this.traverseObject(data, checkString);

        return { valid: errors.length === 0, errors, warnings: [] };
      },
    });

    // XSS detection
    this.registerRule({
      name: "xss_detection",
      description: "Detects potential XSS attacks",
      severity: "error",
      validator: (data: any) => {
        const errors: ValidationError[] = [];
        const xssPatterns = [
          /<script[^>]*>.*?<\/script>/gi,
          /javascript:/gi,
          /on\w+\s*=/gi,
          /<iframe[^>]*>/gi,
          /<object[^>]*>/gi,
          /eval\s*\(/gi,
        ];

        const checkString = (str: string, field: string) => {
          for (const pattern of xssPatterns) {
            if (pattern.test(str)) {
              errors.push({
                field,
                message: "Potential XSS attack detected",
                code: "XSS_DETECTED",
                value: str,
              });
              break;
            }
          }
        };

        this.traverseObject(data, checkString);

        return { valid: errors.length === 0, errors, warnings: [] };
      },
    });
  }

  private setupDefaultSchemas(): void {
    // User authentication schemas
    this.registerSchema(
      "user/login",
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
        rememberMe: z.boolean().optional(),
      }),
    );

    this.registerSchema(
      "user/register",
      z.object({
        email: z.string().email(),
        password: z.string().min(8).max(128),
        username: z.string().min(3).max(30),
        acceptTerms: z.boolean().refine((val) => val === true),
      }),
    );

    // Scene management schemas
    this.registerSchema(
      "scene/create",
      z.object({
        name: z.string().min(1).max(100),
        width: z.number().int().min(100).max(10000),
        height: z.number().int().min(100).max(10000),
        gridSize: z.number().int().min(5).max(200).optional(),
        backgroundColor: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional(),
      }),
    );

    // Token management schemas
    this.registerSchema(
      "token/create",
      z.object({
        name: z.string().min(1).max(50),
        x: z.number(),
        y: z.number(),
        size: z.number().min(0.1).max(5),
        color: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional(),
        imageUrl: z.string().url().optional(),
      }),
    );
  }

  private traverseObject(
    obj: any,
    callback: (str: string, field: string) => void,
    path = "",
  ): void {
    if (typeof obj === "string") {
      callback(obj, path);
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.traverseObject(item, callback, `${path}[${index}]`);
      });
    } else if (typeof obj === "object" && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        const newPath = path ? `${path}.${key}` : key;
        this.traverseObject(value, callback, newPath);
      }
    }
  }
}
