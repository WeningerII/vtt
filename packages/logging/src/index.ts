/**
 * @vtt/logging - Structured logging with Pino and OpenTelemetry
 */

import pino from 'pino';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import type { NodeSDKConfiguration } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import os from 'node:os';

// Logger configuration
export interface LoggerConfig {
  level?: string;
  pretty?: boolean;
  service?: string;
  version?: string;
  environment?: string;
  otlpEndpoint?: string;
}

// Create Pino logger instance
export function createLogger(config: LoggerConfig = {}) {
  const options: pino.LoggerOptions = {
    level: config.level || process.env.LOG_LEVEL || 'info',
    formatters: {
      level: (label) => ({ level: label }),
      bindings: () => ({
        service: config.service || 'vtt',
        version: config.version || '0.0.0',
        environment: config.environment || process.env.NODE_ENV || 'development',
        pid: process.pid,
        hostname: os.hostname(),
      }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
  };

  // Add pretty printing in development
  if (config.pretty || process.env.NODE_ENV === 'development') {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  return pino(options);
}

// Initialize OpenTelemetry
export function initTelemetry(config: LoggerConfig = {}) {
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: config.service || 'vtt',
    [SemanticResourceAttributes.SERVICE_VERSION]: config.version || '0.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment || process.env.NODE_ENV || 'development',
  });

  const traceExporter = config.otlpEndpoint
    ? new OTLPTraceExporter({
        url: `${config.otlpEndpoint}/v1/traces`,
        headers: {},
      })
    : undefined;

  const instrumentations = getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-fs': {
      enabled: false, // Disable fs instrumentation to reduce noise
    },
  });

  const sdkOptions: Partial<NodeSDKConfiguration> = {
    resource,
    instrumentations,
  };
  if (traceExporter) {
    sdkOptions.traceExporter = traceExporter;
  }
  const sdk = new NodeSDK(sdkOptions);

  sdk.start();
  return sdk;
}

// Trace wrapper for async operations
export async function withTrace<T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: Record<string, any>
): Promise<T> {
  const tracer = trace.getTracer('vtt');
  const span = attributes
    ? tracer.startSpan(name, { attributes })
    : tracer.startSpan(name);

  try {
    const result = await context.with(trace.setSpan(context.active(), span), fn);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

// Structured logging helpers
export class StructuredLogger {
  private logger: pino.Logger;

  constructor(config: LoggerConfig = {}) {
    this.logger = createLogger(config);
  }

  // Log with context
  withContext(context: Record<string, any>) {
    return this.logger.child(context);
  }

  // Performance logging
  logPerformance(operation: string, duration: number, metadata?: Record<string, any>) {
    this.logger.info({
      type: 'performance',
      operation,
      duration,
      ...metadata,
    }, `Performance: ${operation} took ${duration}ms`);
  }

  // Error logging with stack trace
  logError(error: Error, context?: Record<string, any>) {
    this.logger.error({
      type: 'error',
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      ...context,
    }, error.message);
  }

  // Audit logging
  logAudit(action: string, userId: string, metadata?: Record<string, any>) {
    this.logger.info({
      type: 'audit',
      action,
      userId,
      timestamp: new Date().toISOString(),
      ...metadata,
    }, `Audit: ${action} by ${userId}`);
  }

  // Security event logging
  logSecurity(event: string, severity: 'low' | 'medium' | 'high' | 'critical', details?: Record<string, any>) {
    const level = severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'info';
    this.logger[level]({
      type: 'security',
      event,
      severity,
      ...details,
    }, `Security event: ${event}`);
  }

  // Request logging
  logRequest(method: string, path: string, statusCode: number, duration: number, metadata?: Record<string, any>) {
    this.logger.info({
      type: 'request',
      method,
      path,
      statusCode,
      duration,
      ...metadata,
    }, `${method} ${path} ${statusCode} ${duration}ms`);
  }

  // Business metrics logging
  logMetric(name: string, value: number, unit: string, tags?: Record<string, any>) {
    this.logger.info({
      type: 'metric',
      name,
      value,
      unit,
      tags,
    }, `Metric: ${name}=${value}${unit}`);
  }

  // Direct access to logger methods
  trace(msg: string, obj?: Record<string, any>) { this.logger.trace(obj, msg); }
  debug(msg: string, obj?: Record<string, any>) { this.logger.debug(obj, msg); }
  info(msg: string, obj?: Record<string, any>) { this.logger.info(obj, msg); }
  warn(msg: string, obj?: Record<string, any>) { this.logger.warn(obj, msg); }
  error(msg: string, obj?: Record<string, any>) { this.logger.error(obj, msg); }
  fatal(msg: string, obj?: Record<string, any>) { this.logger.fatal(obj, msg); }
}

// Express middleware for request logging
export function requestLoggingMiddleware(logger: StructuredLogger) {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.logRequest(
        req.method,
        req.path,
        res.statusCode,
        duration,
        {
          ip: req.ip,
          userAgent: req.get('user-agent'),
          referer: req.get('referer'),
        }
      );
    });

    next();
  };
}

// Default logger instance
export const logger = new StructuredLogger();

// Re-export types
export { pino };
export type { Logger } from 'pino';
