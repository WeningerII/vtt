/**
 * Comprehensive error handling system for VTT
 */

export enum ErrorCode {
  // Authentication & Authorization
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  AUTH_ACCESS_DENIED = 'AUTH_ACCESS_DENIED',
  AUTH_USER_NOT_FOUND = 'AUTH_USER_NOT_FOUND',
  AUTH_USER_ALREADY_EXISTS = 'AUTH_USER_ALREADY_EXISTS',
  AUTH_PASSWORD_TOO_WEAK = 'AUTH_PASSWORD_TOO_WEAK',
  AUTH_EMAIL_NOT_VERIFIED = 'AUTH_EMAIL_NOT_VERIFIED',

  // Game Session
  GAME_NOT_FOUND = 'GAME_NOT_FOUND',
  GAME_FULL = 'GAME_FULL',
  GAME_ALREADY_STARTED = 'GAME_ALREADY_STARTED',
  GAME_INVALID_STATE = 'GAME_INVALID_STATE',
  GAME_PLAYER_NOT_FOUND = 'GAME_PLAYER_NOT_FOUND',
  GAME_INVALID_ACTION = 'GAME_INVALID_ACTION',
  GAME_PERMISSION_DENIED = 'GAME_PERMISSION_DENIED',

  // Combat System
  COMBAT_NOT_ACTIVE = 'COMBAT_NOT_ACTIVE',
  COMBAT_INVALID_TURN = 'COMBAT_INVALID_TURN',
  COMBAT_INVALID_TARGET = 'COMBAT_INVALID_TARGET',
  COMBAT_INSUFFICIENT_RESOURCES = 'COMBAT_INSUFFICIENT_RESOURCES',
  COMBAT_INVALID_SPELL = 'COMBAT_INVALID_SPELL',
  COMBAT_INVALID_ABILITY = 'COMBAT_INVALID_ABILITY',

  // Asset Management
  ASSET_NOT_FOUND = 'ASSET_NOT_FOUND',
  ASSET_UPLOAD_FAILED = 'ASSET_UPLOAD_FAILED',
  ASSET_INVALID_TYPE = 'ASSET_INVALID_TYPE',
  ASSET_TOO_LARGE = 'ASSET_TOO_LARGE',
  ASSET_ACCESS_DENIED = 'ASSET_ACCESS_DENIED',
  ASSET_STORAGE_ERROR = 'ASSET_STORAGE_ERROR',

  // Network & Connection
  NETWORK_CONNECTION_LOST = 'NETWORK_CONNECTION_LOST',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_INVALID_MESSAGE = 'NETWORK_INVALID_MESSAGE',
  NETWORK_RATE_LIMITED = 'NETWORK_RATE_LIMITED',

  // Validation
  VALIDATION_REQUIRED_FIELD = 'VALIDATION_REQUIRED_FIELD',
  VALIDATION_INVALID_FORMAT = 'VALIDATION_INVALID_FORMAT',
  VALIDATION_OUT_OF_RANGE = 'VALIDATION_OUT_OF_RANGE',
  VALIDATION_INVALID_ENUM = 'VALIDATION_INVALID_ENUM',

  // System
  SYSTEM_INTERNAL_ERROR = 'SYSTEM_INTERNAL_ERROR',
  SYSTEM_SERVICE_UNAVAILABLE = 'SYSTEM_SERVICE_UNAVAILABLE',
  SYSTEM_CONFIGURATION_ERROR = 'SYSTEM_CONFIGURATION_ERROR',
  SYSTEM_RESOURCE_EXHAUSTED = 'SYSTEM_RESOURCE_EXHAUSTED',

  // AI Provider
  AI_PROVIDER_ERROR = 'AI_PROVIDER_ERROR',
  AI_QUOTA_EXCEEDED = 'AI_QUOTA_EXCEEDED',
  AI_INVALID_REQUEST = 'AI_INVALID_REQUEST',
  AI_MODEL_UNAVAILABLE = 'AI_MODEL_UNAVAILABLE',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ErrorContext {
  userId?: string;
  gameId?: string;
  sessionId?: string;
  requestId?: string;
  timestamp?: Date;
  userAgent?: string;
  ip?: string;
  [key: string]: any;
}

export class VTTError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly isRetryable: boolean;
  public readonly statusCode: number;
  public readonly originalError?: Error | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    options: {
      severity?: ErrorSeverity;
      context?: ErrorContext | undefined;
      isRetryable?: boolean;
      statusCode?: number;
      originalError?: Error | undefined;
    } = {}
  ) {
    super(message);
    this.name = 'VTTError';
    this.code = code;
    this.severity = options.severity || this.getDefaultSeverity(code);
    this.context = { timestamp: new Date(), ...options.context };
    this.isRetryable = options.isRetryable || this.getDefaultRetryable(code);
    this.statusCode = options.statusCode || this.getDefaultStatusCode(code);
    this.originalError = options.originalError ?? undefined;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, VTTError);
    }
  }

  private getDefaultSeverity(code: ErrorCode): ErrorSeverity {
    const severityMap: Record<string, ErrorSeverity> = {
      // Critical errors
      [ErrorCode.SYSTEM_INTERNAL_ERROR]: ErrorSeverity.CRITICAL,
      [ErrorCode.SYSTEM_SERVICE_UNAVAILABLE]: ErrorSeverity.CRITICAL,
      [ErrorCode.NETWORK_CONNECTION_LOST]: ErrorSeverity.CRITICAL,

      // High severity
      [ErrorCode.AUTH_ACCESS_DENIED]: ErrorSeverity.HIGH,
      [ErrorCode.GAME_PERMISSION_DENIED]: ErrorSeverity.HIGH,
      [ErrorCode.ASSET_ACCESS_DENIED]: ErrorSeverity.HIGH,

      // Medium severity
      [ErrorCode.AUTH_INVALID_CREDENTIALS]: ErrorSeverity.MEDIUM,
      [ErrorCode.GAME_NOT_FOUND]: ErrorSeverity.MEDIUM,
      [ErrorCode.ASSET_NOT_FOUND]: ErrorSeverity.MEDIUM,

      // Low severity
      [ErrorCode.VALIDATION_REQUIRED_FIELD]: ErrorSeverity.LOW,
      [ErrorCode.VALIDATION_INVALID_FORMAT]: ErrorSeverity.LOW,
    };

    return severityMap[code] || ErrorSeverity.MEDIUM;
  }

  private getDefaultRetryable(code: ErrorCode): boolean {
    const retryableErrors = new Set([
      ErrorCode.NETWORK_TIMEOUT,
      ErrorCode.NETWORK_CONNECTION_LOST,
      ErrorCode.SYSTEM_SERVICE_UNAVAILABLE,
      ErrorCode.SYSTEM_RESOURCE_EXHAUSTED,
      ErrorCode.AI_PROVIDER_ERROR,
    ]);

    return retryableErrors.has(code);
  }

  private getDefaultStatusCode(code: ErrorCode): number {
    const statusCodeMap: Record<string, number> = {
      // 400 Bad Request
      [ErrorCode.VALIDATION_REQUIRED_FIELD]: 400,
      [ErrorCode.VALIDATION_INVALID_FORMAT]: 400,
      [ErrorCode.VALIDATION_OUT_OF_RANGE]: 400,
      [ErrorCode.VALIDATION_INVALID_ENUM]: 400,
      [ErrorCode.GAME_INVALID_ACTION]: 400,
      [ErrorCode.COMBAT_INVALID_TARGET]: 400,

      // 401 Unauthorized
      [ErrorCode.AUTH_INVALID_CREDENTIALS]: 401,
      [ErrorCode.AUTH_TOKEN_EXPIRED]: 401,
      [ErrorCode.AUTH_TOKEN_INVALID]: 401,

      // 403 Forbidden
      [ErrorCode.AUTH_ACCESS_DENIED]: 403,
      [ErrorCode.GAME_PERMISSION_DENIED]: 403,
      [ErrorCode.ASSET_ACCESS_DENIED]: 403,

      // 404 Not Found
      [ErrorCode.GAME_NOT_FOUND]: 404,
      [ErrorCode.AUTH_USER_NOT_FOUND]: 404,
      [ErrorCode.ASSET_NOT_FOUND]: 404,

      // 409 Conflict
      [ErrorCode.AUTH_USER_ALREADY_EXISTS]: 409,
      [ErrorCode.GAME_ALREADY_STARTED]: 409,
      [ErrorCode.GAME_FULL]: 409,

      // 413 Payload Too Large
      [ErrorCode.ASSET_TOO_LARGE]: 413,

      // 429 Too Many Requests
      [ErrorCode.NETWORK_RATE_LIMITED]: 429,
      [ErrorCode.AI_QUOTA_EXCEEDED]: 429,

      // 500 Internal Server Error
      [ErrorCode.SYSTEM_INTERNAL_ERROR]: 500,
      [ErrorCode.ASSET_STORAGE_ERROR]: 500,

      // 503 Service Unavailable
      [ErrorCode.SYSTEM_SERVICE_UNAVAILABLE]: 503,
      [ErrorCode.AI_MODEL_UNAVAILABLE]: 503,
    };

    return statusCodeMap[code] || 500;
  }

  toJSON(): object {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      context: this.context,
      isRetryable: this.isRetryable,
      statusCode: this.statusCode,
      stack: this.stack,
      originalError: this.originalError?.message,
    };
  }

  override toString(): string {
    return `${this.name} [${this.code}]: ${this.message}`;
  }
}

// Specialized error classes
export class AuthenticationError extends VTTError {
  constructor(
    code: ErrorCode,
    message: string,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(code, message, {
      severity: ErrorSeverity.HIGH,
      ...(context && { context }),
      ...(originalError && { originalError }),
      isRetryable: false,
    });
  }
}

export class ValidationError extends VTTError {
  public readonly field?: string;
  public readonly value?: any;

  constructor(
    field: string,
    message: string,
    value?: any,
    context?: ErrorContext
  ) {
    super(ErrorCode.VALIDATION_REQUIRED_FIELD, message, {
      severity: ErrorSeverity.LOW,
      context: { field, value, ...context },
      isRetryable: false,
      statusCode: 400,
    });
    this.field = field;
    this.value = value;
  }
}

export class GameError extends VTTError {
  constructor(
    code: ErrorCode,
    message: string,
    gameId?: string,
    context?: ErrorContext
  ) {
    const finalContext = gameId ? { gameId, ...context } : context;
    super(code, message, {
      severity: ErrorSeverity.MEDIUM,
      ...(finalContext && { context: finalContext }),
      isRetryable: false,
    });
  }
}

export class NetworkError extends VTTError {
  constructor(
    code: ErrorCode,
    message: string,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(code, message, {
      severity: ErrorSeverity.HIGH,
      ...(context && { context }),
      ...(originalError && { originalError }),
      isRetryable: true,
    });
  }
}

// Error factory functions
export const _createAuthError = (
  code: ErrorCode,
  message: string,
  context?: ErrorContext,
  originalError?: Error
): AuthenticationError => {
  return new AuthenticationError(code, message, context, originalError);
};

export const _createValidationError = (
  field: string,
  message: string,
  value?: any,
  context?: ErrorContext
): ValidationError => {
  return new ValidationError(field, message, value, context);
};

export const _createGameError = (
  code: ErrorCode,
  message: string,
  gameId?: string,
  context?: ErrorContext
): GameError => {
  return new GameError(code, message, gameId, context);
};

export const _createNetworkError = (
  code: ErrorCode,
  message: string,
  context?: ErrorContext,
  originalError?: Error
): NetworkError => {
  return new NetworkError(code, message, context, originalError);
};

// Error utilities
export const isVTTError = (error: any): error is VTTError => {
  return error instanceof VTTError;
};

export const _isRetryableError = (error: any): boolean => {
  return isVTTError(error) && error.isRetryable;
};

export const _getErrorSeverity = (error: any): ErrorSeverity => {
  if (isVTTError(error)) {
    return error.severity;
  }
  return ErrorSeverity.MEDIUM;
};

export const _getErrorStatusCode = (error: any): number => {
  if (isVTTError(error)) {
    return error.statusCode;
  }
  return 500;
};
