import { logger } from '@vtt/logging';

/**
 * Centralized logging system with structured logging and multiple transports
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
  userId?: string;
  sessionId?: string;
  gameId?: string;
  component?: string;
  action?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface LogTransport {
  name: string;
  log(entry: LogEntry): Promise<void>;
  close(): Promise<void>;
}

export interface LoggerConfig {
  level: LogLevel;
  transports: LogTransport[];
  enableConsole: boolean;
  enableStructuredLogging: boolean;
  defaultContext?: Record<string, any>;
}

export class Logger {
  private config: LoggerConfig;
  private static instance: Logger;

  constructor(config: LoggerConfig) {
    this.config = config;
  }

  static getInstance(config?: LoggerConfig): Logger {
    if (!Logger.instance && config) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
    const configLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= configLevelIndex;
  }

  private async writeLog(entry: LogEntry): Promise<void> {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    // Console logging
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    // Transport logging
    const promises = this.config.transports.map(transport => 
      transport.log(entry).catch(error => 
        console.error(`Transport ${transport.name} failed:`, error)
      )
    );

    await Promise.all(promises);
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const message = entry.message;
    
    let logMessage = `[${timestamp}] ${level} ${message}`;
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      logMessage += ` | Context: ${JSON.stringify(entry.context)}`;
    }
    
    if (entry.error) {
      logMessage += ` | Error: ${entry.error.message}`;
    }

    const logMethod = this.getConsoleMethod(entry.level);
    logMethod(logMessage);
    
    if (entry.error && entry.error.stack) {
      logger.error(entry.error.stack);
    }
  }

  private getConsoleMethod(level: LogLevel): (_...args: any[]) => void {
    switch (level) {
      case 'debug':
        return console.debug;
      case 'info':
        return console.info;
      case 'warn':
        return console.warn;
      case 'error':
      case 'fatal':
        return console.error;
      default:
        return console.log;
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.writeLog({
      timestamp: new Date(),
      level: 'debug',
      message,
      context: { ...this.config.defaultContext, ...context },
    });
  }

  info(message: string, context?: Record<string, any>): void {
    this.writeLog({
      timestamp: new Date(),
      level: 'info',
      message,
      context: { ...this.config.defaultContext, ...context },
    });
  }

  warn(message: string, context?: Record<string, any>): void {
    this.writeLog({
      timestamp: new Date(),
      level: 'warn',
      message,
      context: { ...this.config.defaultContext, ...context },
    });
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      level: 'error',
      message,
      context: { ...this.config.defaultContext, ...(context || {}) },
    };
    if (error !== undefined) {
      logEntry.error = error;
    }
    this.writeLog(logEntry);
  }

  fatal(message: string, error?: Error, context?: Record<string, any>): void {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      level: 'fatal',
      message,
      context: { ...this.config.defaultContext, ...(context || {}) },
    };
    if (error !== undefined) {
      logEntry.error = error;
    }
    this.writeLog(logEntry);
  }

  // Structured logging methods
  logUserAction(userId: string, action: string, context?: Record<string, any>): void {
    this.info(`User action: ${action}`, {
      ...context,
      userId,
      action,
      component: 'user-action',
    });
  }

  logGameEvent(gameId: string, event: string, context?: Record<string, any>): void {
    this.info(`Game event: ${event}`, {
      ...context,
      gameId,
      event,
      component: 'game-engine',
    });
  }

  logPerformance(operation: string, duration: number, context?: Record<string, any>): void {
    this.info(`Performance: ${operation}`, {
      ...context,
      operation,
      duration,
      component: 'performance',
    });
  }

  logSecurity(event: string, severity: 'low' | 'medium' | 'high', context?: Record<string, any>): void {
    const level = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
    this.writeLog({
      timestamp: new Date(),
      level,
      message: `Security event: ${event}`,
      context: {
        ...this.config.defaultContext,
        ...context,
        securityEvent: event,
        severity,
        component: 'security',
      },
    });
  }

  logAPIRequest(method: string, path: string, statusCode: number, duration: number, context?: Record<string, any>): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    this.writeLog({
      timestamp: new Date(),
      level,
      message: `API ${method} ${path} - ${statusCode}`,
      context: {
        ...this.config.defaultContext,
        ...context,
        method,
        path,
        statusCode,
        duration,
        component: 'api',
      },
    });
  }

  // Create child logger with additional context
  child(additionalContext: Record<string, any>): Logger {
    return new Logger({
      ...this.config,
      defaultContext: {
        ...this.config.defaultContext,
        ...additionalContext,
      },
    });
  }

  async close(): Promise<void> {
    const promises = this.config.transports.map(transport => transport.close());
    await Promise.all(promises);
  }
}

// File transport for logging to files
export class FileTransport implements LogTransport {
  name = 'file';
  private filePath: string;
  private maxFileSize: number;
  private maxFiles: number;

  constructor(filePath: string, maxFileSize = 10 * 1024 * 1024, maxFiles = 5) {
    this.filePath = filePath;
    this.maxFileSize = maxFileSize;
    this.maxFiles = maxFiles;
  }

  async log(entry: LogEntry): Promise<void> {
    const logLine = JSON.stringify({
      timestamp: entry.timestamp.toISOString(),
      level: entry.level,
      message: entry.message,
      ...entry.context,
      ...(entry.error && {
        error: {
          message: entry.error.message,
          stack: entry.error.stack,
        },
      }),
    }) + '\n';

    // In a real implementation, you would write to file system
    // For now, we'll just simulate the interface
    logger.info(`[FILE LOG] ${logLine.trim()}`);
  }

  async close(): Promise<void> {
    // Close file handles
  }
}

// HTTP transport for sending logs to external services
export class HTTPTransport implements LogTransport {
  name = 'http';
  private endpoint: string;
  private headers: Record<string, string>;
  private batchSize: number;
  private flushInterval: number;
  private batch: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(
    endpoint: string,
    headers: Record<string, string> = {},
    batchSize = 100,
    flushInterval = 5000
  ) {
    this.endpoint = endpoint;
    this.headers = headers;
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    this.startFlushTimer();
  }

  async log(entry: LogEntry): Promise<void> {
    this.batch.push(entry);
    
    if (this.batch.length >= this.batchSize) {
      await this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.batch.length === 0) return;

    const logsToSend = [...this.batch];
    this.batch = [];

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify({ logs: logsToSend }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('Failed to send logs to HTTP endpoint:', error);
      // Re-add logs to batch for retry (in a real implementation)
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.flushInterval);
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }
}
