/**
 * Enhanced error handling middleware for VTT routes
 */

import { Context } from "../router/types";
import { logger } from "@vtt/logging";

export interface VTTError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export class ValidationError extends Error implements VTTError {
  statusCode = 400;
  code = "VALIDATION_ERROR";

  constructor(
    message: string,
    public details?: any,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error implements VTTError {
  statusCode = 404;
  code = "NOT_FOUND";

  constructor(resource: string, id?: string) {
    super(id ? `${resource} with id '${id}' not found` : `${resource} not found`);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error implements VTTError {
  statusCode = 409;
  code = "CONFLICT";

  constructor(
    message: string,
    public details?: any,
  ) {
    super(message);
    this.name = "ConflictError";
  }
}

export class BusinessLogicError extends Error implements VTTError {
  statusCode = 422;
  code = "BUSINESS_LOGIC_ERROR";

  constructor(
    message: string,
    public details?: any,
  ) {
    super(message);
    this.name = "BusinessLogicError";
  }
}

export function handleRouteError(ctx: Context, error: any): void {
  logger.error(`[${ctx.requestId}] Route error:`, error as any);

  let statusCode = 500;
  let code = "INTERNAL_ERROR";
  let message = "Internal server error";
  let details: any = undefined;

  if (error instanceof ValidationError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof NotFoundError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
  } else if (error instanceof ConflictError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof BusinessLogicError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error.code === "P2002") {
    // Prisma unique constraint violation
    statusCode = 409;
    code = "DUPLICATE_ENTRY";
    message = "Resource already exists";
    details = { constraint: error.meta?.target };
  } else if (error.code === "P2025") {
    // Prisma record not found
    statusCode = 404;
    code = "NOT_FOUND";
    message = "Resource not found";
  } else if (error.code === "P2003") {
    // Prisma foreign key constraint violation
    statusCode = 400;
    code = "INVALID_REFERENCE";
    message = "Referenced resource does not exist";
    details = { field: error.meta?.field_name };
  } else if (error.message?.includes("Invalid JSON")) {
    statusCode = 400;
    code = "INVALID_JSON";
    message = "Invalid JSON in request body";
  }

  const response = {
    error: {
      code,
      message,
      ...(details && { details }),
      ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
    },
  };

  ctx.res.writeHead(statusCode, { "Content-Type": "application/json" });
  ctx.res.end(JSON.stringify(response));
}

export function validateRequired(data: any, fields: string[]): void {
  const missing = fields.filter((field) => {
    const value = data[field];
    return value === undefined || value === null || value === "";
  });

  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(", ")}`, { missing });
  }
}

export function validateEnum(value: any, validValues: string[], fieldName: string): void {
  if (value && !validValues.includes(value)) {
    throw new ValidationError(`Invalid ${fieldName}. Must be one of: ${validValues.join(", ")}`, {
      field: fieldName,
      validValues,
      received: value,
    });
  }
}

export function validateNumber(
  value: any,
  fieldName: string,
  options: { min?: number; max?: number; integer?: boolean } = {},
): void {
  if (value !== undefined && value !== null) {
    if (typeof value !== "number" || isNaN(value)) {
      throw new ValidationError(`${fieldName} must be a valid number`, {
        field: fieldName,
        received: value,
      });
    }

    if (options.integer && !Number.isInteger(value)) {
      throw new ValidationError(`${fieldName} must be an integer`, {
        field: fieldName,
        received: value,
      });
    }

    if (options.min !== undefined && value < options.min) {
      throw new ValidationError(`${fieldName} must be at least ${options.min}`, {
        field: fieldName,
        min: options.min,
        received: value,
      });
    }

    if (options.max !== undefined && value > options.max) {
      throw new ValidationError(`${fieldName} must be at most ${options.max}`, {
        field: fieldName,
        max: options.max,
        received: value,
      });
    }
  }
}

export function validateString(
  value: any,
  fieldName: string,
  options: { minLength?: number; maxLength?: number; pattern?: RegExp } = {},
): void {
  if (value !== undefined && value !== null) {
    if (typeof value !== "string") {
      throw new ValidationError(`${fieldName} must be a string`, {
        field: fieldName,
        received: typeof value,
      });
    }

    if (options.minLength !== undefined && value.length < options.minLength) {
      throw new ValidationError(`${fieldName} must be at least ${options.minLength} characters`, {
        field: fieldName,
        minLength: options.minLength,
        received: value.length,
      });
    }

    if (options.maxLength !== undefined && value.length > options.maxLength) {
      throw new ValidationError(`${fieldName} must be at most ${options.maxLength} characters`, {
        field: fieldName,
        maxLength: options.maxLength,
        received: value.length,
      });
    }

    if (options.pattern && !options.pattern.test(value)) {
      throw new ValidationError(`${fieldName} format is invalid`, {
        field: fieldName,
        pattern: options.pattern.toString(),
        received: value,
      });
    }
  }
}

export function validateArray(
  value: any,
  fieldName: string,
  options: {
    minLength?: number;
    maxLength?: number;
    itemValidator?: (item: any, _index: number) => void;
  } = {},
): void {
  if (value !== undefined && value !== null) {
    if (!Array.isArray(value)) {
      throw new ValidationError(`${fieldName} must be an array`, {
        field: fieldName,
        received: typeof value,
      });
    }

    if (options.minLength !== undefined && value.length < options.minLength) {
      throw new ValidationError(`${fieldName} must have at least ${options.minLength} items`, {
        field: fieldName,
        minLength: options.minLength,
        received: value.length,
      });
    }

    if (options.maxLength !== undefined && value.length > options.maxLength) {
      throw new ValidationError(`${fieldName} must have at most ${options.maxLength} items`, {
        field: fieldName,
        maxLength: options.maxLength,
        received: value.length,
      });
    }

    if (options.itemValidator) {
      value.forEach((item, index) => {
        try {
          options.itemValidator!(item, index);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new ValidationError(`${fieldName}[${index}]: ${msg}`, {
            field: fieldName,
            index,
            originalError: err,
          });
        }
      });
    }
  }
}

export function validateUUID(value: any, fieldName: string): void {
  if (value !== undefined && value !== null) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (typeof value !== "string" || !uuidRegex.test(value)) {
      throw new ValidationError(`${fieldName} must be a valid UUID`, {
        field: fieldName,
        received: value,
      });
    }
  }
}

export function validateCoordinates(x: any, y: any): void {
  validateNumber(x, "x");
  validateNumber(y, "y");

  if (typeof x === "number" && typeof y === "number") {
    if (x < -10000 || x > 10000) {
      throw new ValidationError("x coordinate out of bounds (-10000 to 10000)", {
        field: "x",
        received: x,
      });
    }
    if (y < -10000 || y > 10000) {
      throw new ValidationError("y coordinate out of bounds (-10000 to 10000)", {
        field: "y",
        received: y,
      });
    }
  }
}
