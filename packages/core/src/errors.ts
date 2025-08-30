
// Enhanced error handling
export class ApplicationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string = 'INTERNAL_ERROR',
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Global error handler
export function handleError(error: Error | ApplicationError): void {
  if (error instanceof ApplicationError && error.isOperational) {
    logger.error('Operational error occurred', {
      code: error.code,
      message: error.message,
      stack: error.stack,
    });
  } else {
    logger.fatal('Unexpected error occurred', {
      message: error.message,
      stack: error.stack,
    });
    // Crash the process for non-operational errors
    process.exit(1);
  }
}

// Async error wrapper
export function asyncHandler<T>(
  fn: (...args: any[]) => Promise<T>
): (...args: any[]) => Promise<T> {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error as Error);
      throw error;
    }
  };
}
