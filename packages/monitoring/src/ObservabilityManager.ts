/**
 * Central observability manager coordinating logging, metrics, health checks, and alerting
 */

import { EventEmitter } from 'events';
import { Logger, LoggerConfig } from './Logger';
import { MetricsRegistry, SystemMetricsCollector, GameMetricsCollector } from './Metrics';
import { HealthCheckManager, HealthCheckConfig } from './HealthCheck';
import { AlertManager, AlertManagerConfig } from './AlertManager';

export interface ObservabilityConfig {
  logging: LoggerConfig;
  healthChecks: HealthCheckConfig;
  alerts: AlertManagerConfig;
  enableMetrics: boolean;
  enableTracing: boolean;
  dashboardPort?: number;
}

export interface TracingSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string | undefined;
  operationName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  tags: Record<string, any>;
  logs: Array<{ timestamp: Date; message: string; level: string }>;
}

export class ObservabilityManager extends EventEmitter {
  private config: ObservabilityConfig;
  private logger!: Logger;
  private metrics!: MetricsRegistry;
  private healthManager!: HealthCheckManager;
  private alertManager!: AlertManager;
  private activeSpans = new Map<string, TracingSpan>();
  private dashboardServer?: any;

  constructor(config: ObservabilityConfig) {
    super();
    this.config = config;
    this.initialize();
  }

  private initialize(): void {
    // Initialize logger
    this.logger = new Logger(this.config.logging);

    // Initialize metrics
    this.metrics = MetricsRegistry.getInstance();
    if (this.config.enableMetrics) {
      this.setupMetricsCollectors();
    }

    // Initialize health checks
    this.healthManager = new HealthCheckManager(this.config.healthChecks);
    this.setupHealthCheckListeners();

    // Initialize alert manager
    this.alertManager = new AlertManager(this.config.alerts, this.metrics);
    this.setupAlertListeners();

    // Setup cross-component integration
    this.setupIntegration();
  }

  private setupMetricsCollectors(): void {
    const systemCollector = new SystemMetricsCollector();
    const gameCollector = new GameMetricsCollector();

    this.metrics.registerCollector(systemCollector);
    this.metrics.registerCollector(gameCollector);

    // Start collecting system metrics periodically
    setInterval(async () => {
      try {
        await systemCollector.collect();
      } catch (error) {
        this.logger.error('Failed to collect system metrics', error as Error);
      }
    }, 30000); // Every 30 seconds
  }

  private setupHealthCheckListeners(): void {
    // Health check manager doesn't extend EventEmitter in current implementation
    // This would be implemented when HealthCheckManager extends EventEmitter
  }

  private setupAlertListeners(): void {
    this.alertManager.on('alertTriggered', (alert) => {
      this.logger.warn(`Alert triggered: ${alert.name}`, { alert });
      this.metrics.incrementCounter('vtt_alerts_total', 1, {
        severity: alert.severity,
        name: alert.name
      });
    });

    this.alertManager.on('alertResolved', (alert) => {
      this.logger.info(`Alert resolved: ${alert.name}`, { alert });
    });
  }

  private setupIntegration(): void {
    // Integration would be implemented when components extend EventEmitter
    // For now, components communicate through direct method calls
  }

  // Public API
  async start(): Promise<void> {
    this.logger.info('Starting observability manager');

    // Start health checks
    this.healthManager.start();

    // Start alert manager
    this.alertManager.start();

    // Start dashboard if configured
    if (this.config.dashboardPort) {
      await this.startDashboard();
    }

    this.emit('started');
    this.logger.info('Observability manager started successfully');
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping observability manager');

    // Stop components
    this.healthManager.stop();
    this.alertManager.stop();

    if (this.dashboardServer) {
      await this.stopDashboard();
    }

    await this.logger.close();

    this.emit('stopped');
  }

  // Logging interface
  getLogger(context?: Record<string, any>): Logger {
    return context ? this.logger.child(context) : this.logger;
  }

  // Metrics interface  
  getMetrics(): MetricsRegistry {
    return this.metrics;
  }

  recordUserAction(userId: string, action: string, metadata?: Record<string, any>): void {
    this.logger.logUserAction(userId, action, metadata);
    this.metrics.incrementCounter('vtt_user_actions_total', 1, {
      action,
      user_id: userId
    });
  }

  recordGameEvent(gameId: string, event: string, metadata?: Record<string, any>): void {
    this.logger.logGameEvent(gameId, event, metadata);
    this.metrics.incrementCounter('vtt_game_events_total', 1, {
      event,
      game_id: gameId
    });
  }

  recordAPIRequest(method: string, path: string, statusCode: number, duration: number): void {
    this.logger.logAPIRequest(method, path, statusCode, duration);
    this.metrics.incrementCounter('vtt_api_requests_total', 1, {
      method,
      path,
      status_code: statusCode.toString()
    });
    this.metrics.recordHistogram('vtt_api_request_duration_ms', duration, {
      method,
      path
    });
  }

  recordSecurityEvent(event: string, severity: 'low' | 'medium' | 'high', metadata?: Record<string, any>): void {
    this.logger.logSecurity(event, severity, metadata);
    this.metrics.incrementCounter('vtt_security_events_total', 1, {
      event,
      severity
    });
  }

  // Distributed tracing interface
  startSpan(operationName: string, parentSpan?: TracingSpan): TracingSpan {
    if (!this.config.enableTracing) {
      // Return a no-op span
      return {
        traceId: 'disabled',
        spanId: 'disabled',
        operationName,
        startTime: new Date(),
        tags: Record<string, any>,
        logs: []
      };
    }

    const span: TracingSpan = {
      traceId: parentSpan?.traceId || this.generateTraceId(),
      spanId: this.generateSpanId(),
      parentSpanId: parentSpan?.spanId || undefined,
      operationName,
      startTime: new Date(),
      tags: Record<string, any>,
      logs: []
    };

    this.activeSpans.set(span.spanId, span);
    return span;
  }

  finishSpan(span: TracingSpan, tags?: Record<string, any>): void {
    if (!this.config.enableTracing || span.spanId === 'disabled') {
      return;
    }

    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();
    
    if (tags) {
      span.tags = { ...span.tags, ...tags };
    }

    // Log span completion
    this.logger.info(`Span completed: ${span.operationName}`, {
      traceId: span.traceId,
      spanId: span.spanId,
      duration: span.duration,
      tags: span.tags
    });

    // Record span metrics
    this.metrics.recordHistogram('vtt_span_duration_ms', span.duration, {
      operation: span.operationName
    });

    this.activeSpans.delete(span.spanId);
  }

  addSpanLog(span: TracingSpan, message: string, level: string = 'info'): void {
    if (!this.config.enableTracing || span.spanId === 'disabled') {
      return;
    }

    span.logs.push({
      timestamp: new Date(),
      message,
      level
    });
  }

  // Performance monitoring utilities
  async measureAsync<T>(
    _operationName: string,
    _operation: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    const span = this.startSpan(operationName);
    const startTime = Date.now();

    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      this.finishSpan(span, { success: true, ...context });
      this.recordPerformance(operationName, duration, { success: true, ...context });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.finishSpan(span, { success: false, error: errorMsg, ...context });
      this.recordPerformance(operationName, duration, { success: false, ...context });
      this.logger.error(`Operation failed: ${operationName}`, error as Error, context);
      
      throw error;
    }
  }

  measure<T>(
    _operationName: string,
    _operation: () => T,
    context?: Record<string, any>
  ): T {
    const span = this.startSpan(operationName);
    const startTime = Date.now();

    try {
      const result = operation();
      const duration = Date.now() - startTime;
      
      this.finishSpan(span, { success: true, ...context });
      this.recordPerformance(operationName, duration, { success: true, ...context });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.finishSpan(span, { success: false, error: errorMsg, ...context });
      this.recordPerformance(operationName, duration, { success: false, ...context });
      this.logger.error(`Operation failed: ${operationName}`, error as Error, context);
      
      throw error;
    }
  }

  private recordPerformance(operation: string, duration: number, context?: Record<string, any>): void {
    this.logger.logPerformance(operation, duration, context);
    this.metrics.recordHistogram('vtt_operation_duration_ms', duration, {
      operation,
      ...context
    });
  }

  // Health and alerting interface
  getHealthStatus(): any {
    return this.healthManager.getHealthSummary();
  }

  getActiveAlerts(): any[] {
    return this.alertManager.getActiveAlerts();
  }

  acknowledgeAlert(alertId: string, userId: string): boolean {
    return this.alertManager.acknowledgeAlert(alertId, userId);
  }

  // Dashboard management
  private async startDashboard(): Promise<void> {
    if (!this.config.dashboardPort) return;

    // In a real implementation, this would start an HTTP server
    // serving a monitoring dashboard with metrics, logs, and alerts
    this.logger.info(`Dashboard would be available at http://localhost:${this.config.dashboardPort}`);
    
    // Simulate dashboard server
    this.dashboardServer = {
      port: this.config.dashboardPort,
      close: () => Promise.resolve()
    };
  }

  private async stopDashboard(): Promise<void> {
    if (this.dashboardServer) {
      await this.dashboardServer.close();
      this.dashboardServer = undefined;
    }
  }

  // Utility methods
  private generateTraceId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private generateSpanId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  // Export observability data
  async exportMetrics(format: 'prometheus' | 'json' = 'json'): Promise<string> {
    const metrics = await this.metrics.getAllMetrics();
    
    if (format === 'prometheus') {
      return this.formatMetricsAsPrometheus(metrics);
    }
    
    return JSON.stringify(metrics, null, 2);
  }

  private formatMetricsAsPrometheus(metrics: any[]): string {
    let output = '';
    
    for (const metric of metrics) {
      output += `# HELP ${metric.name} ${metric.description}\n`;
      output += `# TYPE ${metric.name} ${metric.type}\n`;
      
      for (const value of metric.values) {
        const labels = value.labels ? 
          Object.entries(value.labels).map([k, _v] => `${k}="${v}"`).join(',') : '';
        const labelStr = labels ? `{${labels}}` : '';
        
        output += `${metric.name}${labelStr} ${value.value} ${value.timestamp.getTime()}\n`;
      }
      output += '\n';
    }
    
    return output;
  }

  async exportLogs(_limit: number = 1000, level?: string): Promise<any[]> {
    // In a real implementation, this would query the log storage
    return [];
  }

  async exportTraces(traceId?: string, limit: number = 100): Promise<TracingSpan[]> {
    if (traceId) {
      return Array.from(this.activeSpans.values()).filter(span => span.traceId === traceId);
    }
    
    return Array.from(this.activeSpans.values()).slice(0, limit);
  }

  // System information
  getSystemInfo(): Record<string, any> {
    return {
      observability: {
        logging: {
          level: this.config.logging.level,
          transports: this.config.logging.transports.length
        },
        metrics: {
          enabled: this.config.enableMetrics,
          activeMetrics: this.metrics ? Array.from((this.metrics as any).metrics?.size || 0) : 0
        },
        tracing: {
          enabled: this.config.enableTracing,
          activeSpans: this.activeSpans.size
        },
        healthChecks: {
          count: this.config.healthChecks.checks.length,
          interval: this.config.healthChecks.interval
        },
        alerts: {
          rules: this.config.alerts.rules.length,
          activeAlerts: this.alertManager.getActiveAlerts().length
        }
      },
      runtime: {
        nodeVersion: process.version || 'unknown',
        platform: process.platform || 'unknown',
        uptime: process.uptime ? process.uptime() : 0,
        memory: process.memoryUsage ? process.memoryUsage() : Record<string, any>
      }
    };
  }
}
