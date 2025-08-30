/**
 * Global error handler and error recovery system
 */

import { VTTError, ErrorCode, ErrorSeverity, ErrorContext, isVTTError } from './VTTError';
// Note: Logger type definition for interface compatibility
interface Logger {
  debug(message: string, context?: any): void;
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, context?: any): void;
  fatal(message: string, context?: any): void;
}

export interface ErrorHandlerConfig {
  logErrors: boolean;
  reportErrors: boolean;
  enableRetry: boolean;
  maxRetries: number;
  retryDelayMs: number;
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerTimeoutMs: number;
}

export interface ErrorReporter {
  report(error: VTTError): Promise<void>;
}

export interface RetryPolicy {
  shouldRetry(error: VTTError, attempt: number): boolean;
  getDelay(attempt: number): number;
}

export class ErrorHandler {
  private config: ErrorHandlerConfig;
  private logger: Logger;
  private reporters: ErrorReporter[] = [];
  private retryPolicy: RetryPolicy;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor(
    config: ErrorHandlerConfig,
    logger: Logger,
    retryPolicy?: RetryPolicy
  ) {
    this.config = config;
    this.logger = logger;
    this.retryPolicy = retryPolicy || new DefaultRetryPolicy();
  }

  addReporter(reporter: ErrorReporter): void {
    this.reporters.push(reporter);
  }

  async handleError(error: Error | VTTError, context?: ErrorContext): Promise<void> {
    const vttError = this.normalizeError(error, context);
    
    // Log error
    if (this.config.logErrors) {
      await this.logError(vttError);
    }

    // Report error to external services
    if (this.config.reportErrors && this.shouldReport(vttError)) {
      await this.reportError(vttError);
    }

    // Update circuit breaker state
    if (this.config.enableCircuitBreaker) {
      this.updateCircuitBreaker(vttError);
    }
  }

  async executeWithRetry<T>(
    _operation: () => Promise<T>,
    operationName: string,
    context?: ErrorContext
  ): Promise<T> {
    if (!this.config.enableRetry) {
      return operation();
    }

    let lastError: VTTError;
    let attempt = 0;

    while (attempt < this.config.maxRetries) {
      try {
        const result = await operation();
        
        // Reset circuit breaker on success
        if (this.config.enableCircuitBreaker) {
          this.getCircuitBreaker(operationName).recordSuccess();
        }

        return result;
      } catch (error) {
        const vttError = this.normalizeError(error as Error, context);
        lastError = vttError;
        attempt++;

        // Handle error
        await this.handleError(vttError, context);

        // Check if we should retry
        if (attempt >= this.config.maxRetries || !this.retryPolicy.shouldRetry(vttError, attempt)) {
          break;
        }

        // Wait before retry
        const delay = this.retryPolicy.getDelay(attempt);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  async executeWithCircuitBreaker<T>(
    _operation: () => Promise<T>,
    operationName: string,
    context?: ErrorContext
  ): Promise<T> {
    if (!this.config.enableCircuitBreaker) {
      return operation();
    }

    const circuitBreaker = this.getCircuitBreaker(operationName);
    
    if (circuitBreaker.isOpen()) {
      throw new VTTError(
        ErrorCode.SYSTEM_SERVICE_UNAVAILABLE,
        `Circuit breaker is open for operation: ${operationName}`,
        { context: context || {} }
      );
    }

    try {
      const result = await operation();
      circuitBreaker.recordSuccess();
      return result;
    } catch (error) {
      const vttError = this.normalizeError(error as Error, context);
      circuitBreaker.recordFailure();
      throw vttError;
    }
  }

  private normalizeError(error: Error | VTTError, context?: ErrorContext): VTTError {
    if (isVTTError(error)) {
      // Create new error with merged context to avoid mutating readonly property
      return new VTTError(
        error.code,
        error.message,
        {
          severity: error.severity,
          context: { ...error.context, ...(context || {}) },
          isRetryable: error.isRetryable,
          statusCode: error.statusCode,
          ...(error.originalError && { originalError: error.originalError }),
        }
      );
    }

    // Convert regular Error to VTTError
    return new VTTError(
      ErrorCode.SYSTEM_INTERNAL_ERROR,
      error.message || 'Unknown error',
      {
        context: context || {},
        originalError: error,
      }
    );
  }

  private async logError(error: VTTError): Promise<void> {
    const logLevel = this.getLogLevel(error.severity);
    
    this.logger[logLevel]('Error occurred', {
      errorCode: error.code,
      message: error.message,
      severity: error.severity,
      context: error.context,
      stack: error.stack,
      isRetryable: error.isRetryable,
      statusCode: error.statusCode,
    });
  }

  private async reportError(error: VTTError): Promise<void> {
    const reportPromises = this.reporters.map(async reporter => {
      try {
        await reporter.report(error);
      } catch (reportError) {
        this.logger.warn('Failed to report error', {
          originalError: error.code,
          reportError: reportError instanceof Error ? reportError.message : 'Unknown error',
        });
      }
    });

    await Promise.allSettled(reportPromises);
  }

  private shouldReport(error: VTTError): boolean {
    // Don't report low severity errors or validation errors
    return error.severity !== ErrorSeverity.LOW && 
           !error.code.startsWith('VALIDATION');
  }

  private getLogLevel(severity: ErrorSeverity): 'debug' | 'info' | 'warn' | 'error' | 'fatal' {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'info';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.CRITICAL:
        return 'fatal';
      default:
        return 'error';
    }
  }

  private updateCircuitBreaker(error: VTTError): void {
    // Update circuit breaker based on error type
    const operationName = this.getOperationNameFromError(error);
    if (operationName) {
      const circuitBreaker = this.getCircuitBreaker(operationName);
      circuitBreaker.recordFailure();
    }
  }

  private getOperationNameFromError(error: VTTError): string | null {
    // Extract operation name from error context or code
    if (error.context?.operation) {
      return error.context.operation as string;
    }

    // Map error codes to operation names
    const operationMap: Record<string, string> = {
      [ErrorCode.AUTH_INVALID_CREDENTIALS]: 'authentication',
      [ErrorCode.GAME_NOT_FOUND]: 'game-lookup',
      [ErrorCode.ASSET_UPLOAD_FAILED]: 'asset-upload',
      [ErrorCode.AI_PROVIDER_ERROR]: 'ai-provider',
    };

    return operationMap[error.code] || null;
  }

  private getCircuitBreaker(operationName: string): CircuitBreaker {
    if (!this.circuitBreakers.has(operationName)) {
      this.circuitBreakers.set(
        operationName,
        new CircuitBreaker(
          this.config.circuitBreakerThreshold,
          this.config.circuitBreakerTimeoutMs
        )
      );
    }
    return this.circuitBreakers.get(operationName)!;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Circuit breaker implementation
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number,
    private timeoutMs: number
  ) {}

  isOpen(): boolean {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.timeoutMs) {
        this.state = 'half-open';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = 'open';
    }
  }
}

// Default retry policy
class DefaultRetryPolicy implements RetryPolicy {
  shouldRetry(error: VTTError, attempt: number): boolean {
    // Don't retry non-retryable errors
    if (!error.isRetryable) {
      return false;
    }

    // Don't retry authentication errors
    if (error.code.startsWith('AUTH')) {
      return false;
    }

    // Don't retry validation errors
    if (error.code.startsWith('VALIDATION')) {
      return false;
    }

    return attempt < 3;
  }

  getDelay(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000; // Up to 1 second jitter
    return exponentialDelay + jitter;
  }
}

// Error boundary for React components
export class ErrorBoundary {
  private errorHandler: ErrorHandler;

  constructor(errorHandler: ErrorHandler) {
    this.errorHandler = errorHandler;
  }

  handleComponentError(error: Error, errorInfo: any): void {
    const vttError = new VTTError(
      ErrorCode.SYSTEM_INTERNAL_ERROR,
      'React component error',
      {
        originalError: error,
        context: {
          componentStack: errorInfo.componentStack,
          errorBoundary: true,
        },
      }
    );

    this.errorHandler.handleError(vttError);
  }
}

// Global error handlers
export const _setupGlobalErrorHandlers = (errorHandler: ErrorHandler): void => {
  // Handle unhandled promise rejections
  if (typeof process !== 'undefined') {
    process.on('unhandledRejection', (_reason: any, _promise: Promise<any>) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      const vttError = new VTTError(
        ErrorCode.SYSTEM_INTERNAL_ERROR,
        'Unhandled promise rejection',
        {
          originalError: error,
          context: { unhandledRejection: true },
        }
      );
      errorHandler.handleError(vttError);
    });

    process.on('uncaughtException', (error: Error) => {
      const vttError = new VTTError(
        ErrorCode.SYSTEM_INTERNAL_ERROR,
        'Uncaught exception',
        {
          originalError: error,
          context: { uncaughtException: true },
        }
      );
      errorHandler.handleError(vttError);
      process.exit(1);
    });
  }

  // Handle browser errors
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      const vttError = new VTTError(
        ErrorCode.SYSTEM_INTERNAL_ERROR,
        'Browser error',
        {
          originalError: event.error,
          context: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            browserError: true,
          },
        }
      );
      errorHandler.handleError(vttError);
    });

    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      const vttError = new VTTError(
        ErrorCode.SYSTEM_INTERNAL_ERROR,
        'Unhandled promise rejection',
        {
          originalError: error,
          context: { unhandledRejection: true, browser: true },
        }
      );
      errorHandler.handleError(vttError);
    });
  }
};
