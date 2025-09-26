/**
 * Error handling utilities for consistent error logging
 */

/**
 * Convert unknown errors to a loggable format
 */
export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  if (error && typeof error === "object" && "message" in error) {
    return new Error(String(error.message));
  }

  return new Error(String(error));
}

/**
 * Convert unknown errors to a loggable object format
 */
export function toErrorObject(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  if (typeof error === "object" && error !== null) {
    return error as Record<string, unknown>;
  }

  return { error: String(error) };
}

/**
 * Safe error logger that handles unknown types
 */
export function logError(
  logger: { error: (message: string, details?: unknown) => void },
  message: string,
  error: unknown,
): void {
  logger.error(message, toErrorObject(error));
}
