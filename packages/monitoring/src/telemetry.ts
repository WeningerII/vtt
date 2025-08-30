/**
 * OpenTelemetry integration for distributed tracing and metrics
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from "@opentelemetry/sdk-metrics";
import {
  trace,
  context,
  SpanStatusCode,
  metrics,
  DiagConsoleLogger,
  DiagLogLevel,
  diag,
} from "@opentelemetry/api";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  otlpEndpoint?: string;
  enableConsoleExport?: boolean;
  enableDebugLogging?: boolean;
}

export class TelemetryService {
  private sdk: NodeSDK | null = null;
  private tracer: any;
  private meter: any;
  private config: TelemetryConfig;

  constructor(config: TelemetryConfig) {
    this.config = config;

    if (config.enableDebugLogging) {
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
    }
  }

  /**
   * Initialize OpenTelemetry SDK
   */
  async initialize(): Promise<void> {
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.config.environment,
      [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: process.env.HOSTNAME || "unknown",
    });

    // Configure trace exporter
    const traceExporter = this.config.otlpEndpoint
      ? new OTLPTraceExporter({
          url: `${this.config.otlpEndpoint}/v1/traces`,
        })
      : undefined;

    // Configure metric exporter
    const metricExporter = this.config.otlpEndpoint
      ? new OTLPMetricExporter({
          url: `${this.config.otlpEndpoint}/v1/metrics`,
        })
      : new ConsoleMetricExporter();

    const metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 10000, // Export every 10 seconds
    });

    // Initialize SDK
    this.sdk = new NodeSDK({
      resource,
      traceExporter,
      metricReader,
      instrumentations: [
        getNodeAutoInstrumentations({
          "@opentelemetry/instrumentation-fs": {
            enabled: false, // Reduce noise
          },
          "@opentelemetry/instrumentation-http": {
            requestHook: (span, request) => {
              span.setAttribute("http.request.body.size", request.headers["content-length"] || 0);
            },
            responseHook: (span, response) => {
              span.setAttribute("http.response.body.size", response.headers["content-length"] || 0);
            },
          },
        }),
      ],
    });

    await this.sdk.start();

    // Get tracer and meter instances
    this.tracer = trace.getTracer(this.config.serviceName, this.config.serviceVersion);
    this.meter = metrics.getMeter(this.config.serviceName, this.config.serviceVersion);

    // Register custom metrics
    this.registerCustomMetrics();
  }

  /**
   * Register custom application metrics
   */
  private registerCustomMetrics(): void {
    // Request counter
    this.meter.createCounter("vtt.requests", {
      description: "Total number of requests",
    });

    // Request duration histogram
    this.meter.createHistogram("vtt.request.duration", {
      description: "Request duration in milliseconds",
      unit: "ms",
    });

    // Active connections gauge
    this.meter.createUpDownCounter("vtt.connections.active", {
      description: "Number of active connections",
    });

    // Game session metrics
    this.meter.createUpDownCounter("vtt.sessions.active", {
      description: "Number of active game sessions",
    });

    // Player metrics
    this.meter.createUpDownCounter("vtt.players.online", {
      description: "Number of online players",
    });

    // Error counter
    this.meter.createCounter("vtt.errors", {
      description: "Total number of errors",
    });

    // Performance metrics
    this.meter.createHistogram("vtt.operation.duration", {
      description: "Operation duration",
      unit: "ms",
    });

    // Memory usage gauge
    this.meter.createObservableGauge(
      "vtt.memory.usage",
      {
        description: "Memory usage in bytes",
      },
      async (observableResult) => {
        const memUsage = process.memoryUsage();
        observableResult.observe(memUsage.heapUsed, { type: "heap_used" });
        observableResult.observe(memUsage.heapTotal, { type: "heap_total" });
        observableResult.observe(memUsage.rss, { type: "rss" });
        observableResult.observe(memUsage.external, { type: "external" });
      },
    );

    // CPU usage gauge
    this.meter.createObservableGauge(
      "vtt.cpu.usage",
      {
        description: "CPU usage percentage",
        unit: "%",
      },
      async (observableResult) => {
        const cpuUsage = process.cpuUsage();
        const totalCpu = cpuUsage.user + cpuUsage.system;
        observableResult.observe(totalCpu / 1000000); // Convert to percentage
      },
    );
  }

  /**
   * Create a traced operation
   */
  async trace<T>(name: string, fn: () => Promise<T>, attributes?: Record<string, any>): Promise<T> {
    const span = this.tracer.startSpan(name, { attributes });

    try {
      const result = await context.with(trace.setSpan(context.active(), span), fn);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Record a metric value
   */
  recordMetric(name: string, value: number, attributes?: Record<string, any>): void {
    const counter = this.meter.createCounter(name);
    counter.add(value, attributes);
  }

  /**
   * Record a histogram value
   */
  recordHistogram(name: string, value: number, attributes?: Record<string, any>): void {
    const histogram = this.meter.createHistogram(name);
    histogram.record(value, attributes);
  }

  /**
   * Create a span for manual instrumentation
   */
  startSpan(name: string, attributes?: Record<string, any>) {
    return this.tracer.startSpan(name, { attributes });
  }

  /**
   * Get the current active span
   */
  getCurrentSpan() {
    return trace.getSpan(context.active());
  }

  /**
   * Add attributes to the current span
   */
  addSpanAttributes(attributes: Record<string, any>): void {
    const span = this.getCurrentSpan();
    if (span) {
      Object.entries(attributes).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });
    }
  }

  /**
   * Add an event to the current span
   */
  addSpanEvent(name: string, attributes?: Record<string, any>): void {
    const span = this.getCurrentSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  /**
   * Shutdown telemetry
   */
  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
    }
  }
}

// Express middleware for automatic tracing
export function tracingMiddleware(telemetry: TelemetryService) {
  return async (req: any, res: any, next: any) => {
    const span = telemetry.startSpan(`${req.method} ${req.path}`, {
      "http.method": req.method,
      "http.url": req.url,
      "http.target": req.path,
      "http.host": req.hostname,
      "http.scheme": req.protocol,
      "http.user_agent": req.get("user-agent"),
      "http.request_content_length": req.get("content-length"),
      "net.peer.ip": req.ip,
    });

    // Store span in request for later use
    req.span = span;

    // Track response
    const originalSend = res.send;
    res.send = function (data: any) {
      span.setAttribute("http.status_code", res.statusCode);
      span.setAttribute("http.response_content_length", res.get("content-length"));

      if (res.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`,
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.end();
      return originalSend.call(this, data);
    };

    context.with(trace.setSpan(context.active(), span), () => {
      next();
    });
  };
}

// WebSocket tracing helper
export function traceWebSocketConnection(telemetry: TelemetryService, ws: any, userId?: string) {
  const span = telemetry.startSpan("websocket.connection", {
    "ws.user_id": userId,
    "ws.protocol": ws.protocol,
  });

  ws.on("message", (data: any) => {
    telemetry.addSpanEvent("message.received", {
      "message.size": data.length,
    });
  });

  ws.on("close", (code: number, reason: string) => {
    span.setAttribute("ws.close_code", code);
    span.setAttribute("ws.close_reason", reason);
    span.end();
  });

  ws.on("error", (error: Error) => {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  });

  return span;
}

// Database query tracing helper
export async function traceQuery<T>(
  telemetry: TelemetryService,
  queryName: string,
  query: () => Promise<T>,
  metadata?: {
    table?: string;
    operation?: string;
    database?: string;
  },
): Promise<T> {
  return telemetry.trace(`db.${queryName}`, query, {
    "db.system": "postgresql",
    "db.operation": metadata?.operation,
    "db.table": metadata?.table,
    "db.name": metadata?.database,
  });
}

// Cache operation tracing helper
export async function traceCacheOperation<T>(
  telemetry: TelemetryService,
  operation: "get" | "set" | "delete",
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  return telemetry.trace(`cache.${operation}`, fn, {
    "cache.key": key,
    "cache.operation": operation,
  });
}

// Export singleton instance
let telemetryInstance: TelemetryService | null = null;

export function initializeTelemetry(config: TelemetryConfig): TelemetryService {
  if (!telemetryInstance) {
    telemetryInstance = new TelemetryService(config);
    telemetryInstance.initialize().catch(console.error);
  }
  return telemetryInstance;
}

export function getTelemetry(): TelemetryService | null {
  return telemetryInstance;
}
