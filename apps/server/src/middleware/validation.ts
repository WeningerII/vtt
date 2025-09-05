/**
 * Comprehensive input validation middleware using Zod
 * Provides security-focused validation with sanitization and protection
 * against injection attacks, XSS, and malformed data
 */

import { z } from "zod";
import { Context } from "../router/types";
import { ValidationError } from "./errorHandler";

// Security-focused string validation
const sanitizedString = (options: {
  min?: number;
  max?: number;
  allowHtml?: boolean;
  pattern?: RegExp;
} = {}) => {
  return z
    .string()
    .min(options.min || 1, "String too short")
    .max(options.max || 1000, "String too long")
    .transform((val) => {
      // Trim whitespace
      let cleaned = val.trim();
      
      // Basic HTML/XSS sanitization unless explicitly allowed
      if (!options.allowHtml) {
        cleaned = cleaned.replace(/<[^>]*>/g, ''); // Strip all HTML tags
        cleaned = cleaned.replace(/[<>"'&]/g, ''); // Remove dangerous characters
      }
      
      // Apply pattern validation if provided
      if (options.pattern && !options.pattern.test(cleaned)) {
        throw new Error("String format invalid");
      }
      
      return cleaned;
    });
};

// Common validation schemas
export const CommonSchemas = {
  // User input schemas
  name: sanitizedString({ min: 1, max: 100, pattern: /^[a-zA-Z0-9\s\-_'.]+$/ }),
  description: sanitizedString({ min: 0, max: 2000, allowHtml: false }),
  email: z.string().email("Invalid email format").max(320),
  
  // ID schemas
  uuid: z.string().uuid("Invalid UUID format"),
  objectId: z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectID format"),
  alphanumericId: z.string().regex(/^[a-zA-Z0-9_-]+$/, "Invalid ID format"),
  
  // Numeric schemas with bounds
  positiveInt: z.number().int().positive("Must be positive integer"),
  nonNegativeInt: z.number().int().nonnegative("Must be non-negative integer"),
  limitedInt: (min = 0, max = Number.MAX_SAFE_INTEGER) => 
    z.number().int().min(min).max(max),
  
  // Pagination schemas
  pagination: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  }),
  
  // Search schemas
  searchQuery: sanitizedString({ min: 0, max: 200, pattern: /^[a-zA-Z0-9\s\-_'."]+$/ }),
  
  // File upload schemas
  filename: sanitizedString({ 
    min: 1, 
    max: 255, 
    pattern: /^[a-zA-Z0-9\s\-_'.()\[\]]+\.[a-zA-Z0-9]+$/ 
  }),
};

// Domain-specific validation schemas
export const GameSchemas = {
  // Character schemas
  characterCreate: z.object({
    name: CommonSchemas.name,
    race: sanitizedString({ max: 50, pattern: /^[a-zA-Z\s-]+$/ }),
    class: sanitizedString({ max: 50, pattern: /^[a-zA-Z\s-]+$/ }),
    level: CommonSchemas.limitedInt(1, 20),
    background: sanitizedString({ min: 0, max: 100 }).optional(),
    alignment: z.enum([
      "lawful good", "neutral good", "chaotic good",
      "lawful neutral", "true neutral", "chaotic neutral", 
      "lawful evil", "neutral evil", "chaotic evil"
    ]).optional(),
    abilities: z.object({
      strength: CommonSchemas.limitedInt(1, 30),
      dexterity: CommonSchemas.limitedInt(1, 30),
      constitution: CommonSchemas.limitedInt(1, 30),
      intelligence: CommonSchemas.limitedInt(1, 30),
      wisdom: CommonSchemas.limitedInt(1, 30),
      charisma: CommonSchemas.limitedInt(1, 30),
    }).optional(),
    campaignId: CommonSchemas.uuid.optional(),
    templateId: CommonSchemas.uuid.optional(),
  }),
  
  // Campaign schemas
  campaignCreate: z.object({
    name: CommonSchemas.name,
    description: CommonSchemas.description.optional(),
    gameSystem: z.enum(["dnd5e", "pathfinder", "custom"]).default("dnd5e"),
    isPublic: z.boolean().default(false),
    maxPlayers: CommonSchemas.limitedInt(2, 12).default(6),
  }),
  
  // Monster schemas
  monsterQuery: z.object({
    q: CommonSchemas.searchQuery.optional(),
    tags: z.string().regex(/^[a-zA-Z0-9,\s-]+$/).optional(),
    cr_min: CommonSchemas.limitedInt(0, 30).optional(),
    cr_max: CommonSchemas.limitedInt(0, 30).optional(),
    type: sanitizedString({ max: 50 }).optional(),
  }).merge(CommonSchemas.pagination),
  
  // Combat schemas
  tacticalDecision: z.object({
    character: z.object({
      id: CommonSchemas.uuid,
      name: CommonSchemas.name,
      level: CommonSchemas.limitedInt(1, 20),
      hitPoints: z.object({
        current: CommonSchemas.nonNegativeInt,
        max: CommonSchemas.positiveInt,
      }),
      abilities: z.object({
        strength: CommonSchemas.limitedInt(1, 30),
        dexterity: CommonSchemas.limitedInt(1, 30),
        constitution: CommonSchemas.limitedInt(1, 30),
        intelligence: CommonSchemas.limitedInt(1, 30),
        wisdom: CommonSchemas.limitedInt(1, 30),
        charisma: CommonSchemas.limitedInt(1, 30),
      }),
    }),
    allies: z.array(z.object({
      id: CommonSchemas.uuid,
      name: CommonSchemas.name,
      position: z.object({
        x: CommonSchemas.nonNegativeInt,
        y: CommonSchemas.nonNegativeInt,
      }),
    })).max(10),
    enemies: z.array(z.object({
      id: CommonSchemas.uuid,
      name: CommonSchemas.name,
      challengeRating: CommonSchemas.limitedInt(0, 30),
      position: z.object({
        x: CommonSchemas.nonNegativeInt,
        y: CommonSchemas.nonNegativeInt,
      }),
    })).max(20),
    battlefield: z.object({
      width: CommonSchemas.limitedInt(10, 100),
      height: CommonSchemas.limitedInt(10, 100),
      terrain: z.enum(["plains", "forest", "desert", "mountain", "urban", "dungeon"]),
      weather: z.enum(["clear", "rain", "fog", "storm"]).optional(),
    }),
    objectives: z.array(sanitizedString({ max: 200 })).max(5).optional(),
  }),
};

/**
 * Enhanced request validation middleware with security features
 */
export const validateRequest = (schemas: {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
  headers?: z.ZodSchema;
}) => {
  return async (ctx: Context, next?: () => Promise<void>) => {
    try {
      // Validate and parse request body with size limits
      if (schemas.body && ctx.req.method !== 'GET') {
        const contentLength = ctx.req.headers['content-length'];
        if (contentLength && parseInt(contentLength) > 1024 * 1024) { // 1MB limit
          throw new ValidationError("Request body too large", { limit: "1MB" });
        }
        
        const body = await parseJsonBody(ctx.req);
        (ctx as any).validatedBody = schemas.body.parse(body);
      }

      // Validate query parameters with URL length limits
      if (schemas.query) {
        if (ctx.req.url && ctx.req.url.length > 4096) { // 4KB URL limit
          throw new ValidationError("URL too long", { limit: "4KB" });
        }
        
        const url = new URL(ctx.req.url!, `http://${ctx.req.headers.host}`);
        const query = Object.fromEntries(url.searchParams);
        (ctx as any).validatedQuery = schemas.query.parse(query);
      }

      // Validate path parameters
      if (schemas.params) {
        (ctx as any).validatedParams = schemas.params.parse(ctx.params);
      }

      // Validate critical headers
      if (schemas.headers) {
        (ctx as any).validatedHeaders = schemas.headers.parse(ctx.req.headers);
      }

      if (next) {await next();}
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          "Input validation failed",
          {
            errors: error.errors.map(err => ({
              path: err.path.join('.'),
              message: err.message,
              code: err.code,
            })),
          }
        );
      }
      throw error;
    }
  };
};

/**
 * Parse and validate JSON body with security checks
 */
async function parseJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    const maxSize = 1024 * 1024; // 1MB
    
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxSize) {
        reject(new ValidationError("Request body too large"));
        return;
      }
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        if (!body.trim()) {
          resolve({});
          return;
        }
        
        // Basic JSON bomb protection
        if (body.length > maxSize) {
          reject(new ValidationError("JSON payload too large"));
          return;
        }
        
        const parsed = JSON.parse(body);
        
        // Prevent prototype pollution
        if (hasProtoProperty(parsed)) {
          reject(new ValidationError("Potentially malicious JSON detected"));
          return;
        }
        
        resolve(parsed);
      } catch (e) {
        reject(new ValidationError("Invalid JSON format", { originalError: e }));
      }
    });
    
    req.on('error', reject);
  });
}

/**
 * Check for prototype pollution attempts
 */
function hasProtoProperty(obj: any): boolean {
  if (typeof obj !== 'object' || obj === null) {return false;}
  
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  
  for (const key of Object.keys(obj)) {
    if (dangerousKeys.includes(key)) {return true;}
    if (typeof obj[key] === 'object' && hasProtoProperty(obj[key])) {return true;}
  }
  
  return false;
}

/**
 * Validate file uploads with security checks
 */
export const validateFileUpload = (options: {
  maxSize?: number;
  allowedTypes?: string[];
  maxFiles?: number;
}) => {
  const { maxSize = 10 * 1024 * 1024, allowedTypes = [], maxFiles = 1 } = options;
  
  return (ctx: Context, next?: () => Promise<void>) => {
    // File upload validation logic would go here
    // This is a placeholder for file upload security
    if (next) {return next();}
  };
};
