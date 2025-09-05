/**
 * Type safety utilities for the VTT core system
 */
import { logger } from '@vtt/logging';

// Type guard for checking if value is defined
export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

// Type guard for checking if value is a string
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

// Type guard for checking if value is a number
export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

// Type guard for checking if value is an object
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Type guard for checking if value is an array
export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

// Safe JSON parse with type validation
export function safeJsonParse<T>(json: string, validator?: (data: unknown) => data is T): T | null {
  try {
    const parsed = JSON.parse(json);
    if (validator && !validator(parsed)) {
      logger.warn("JSON parse validation failed", { json });
      return null;
    }
    return parsed;
  } catch (error) {
    logger.error("JSON parse error", { error, json });
    return null;
  }
}

// Safe property access
export function getProperty<T, K extends keyof T>(
  obj: T,
  key: K,
  defaultValue?: T[K],
): T[K] | undefined {
  return obj?.[key] ?? defaultValue;
}

// Exhaustive check for discriminated unions
export function exhaustiveCheck(value: never): never {
  throw new Error(`Unhandled discriminated union member: ${JSON.stringify(value)}`);
}

// Result type for error handling without exceptions
export type Result<T, E = Error> = { success: true; value: T } | { success: false; error: E };

export function ok<T>(value: T): Result<T> {
  return { success: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

// Async result wrapper
export async function tryAsync<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    return err(error as Error);
  }
}
