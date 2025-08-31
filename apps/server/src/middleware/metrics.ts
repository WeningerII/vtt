/**
 * Application metrics and monitoring middleware
 * Provides comprehensive observability for the VTT application
 */

import { Context, Middleware } from "../router/types";
import { logger } from "@vtt/logging";

interface MetricData {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  lastUpdated: number;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: number;
  version: string;
  checks: Record<string, {
    status: 'pass' | 'fail' | 'warn';
    responseTime?: number;
    message?: string;
  }>;
}

class MetricsCollector {
  private metrics: Map<string, MetricData> = new Map();
  private requestCounts: Map<string, number> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private activeConnections = 0;
  private startTime = Date.now();

  // Request metrics
  recordRequest(method: string, path: string, statusCode: number, duration: number): void {
    const key = `${method}_${path}`;
    const errorKey = `${method}_${path}_errors`;
    
    // Update request count
    this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1);
    
    // Update error count for non-2xx responses
    if (statusCode >= 400) {
      this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    }
    
    // Update response time metrics
    this.updateMetric(`response_time_${key}`, duration);
    this.updateMetric('response_time_all', duration);
  }

  // Generic metric updates
  private updateMetric(key: string, value: number): void {
    const existing = this.metrics.get(key) || {
      count: 0,
      sum: 0,
      min: Infinity,
      max: -Infinity,
      avg: 0,
      lastUpdated: Date.now()
    };

    existing.count++;
    existing.sum += value;
    existing.min = Math.min(existing.min, value);
    existing.max = Math.max(existing.max, value);
    existing.avg = existing.sum / existing.count;
    existing.lastUpdated = Date.now();

    this.metrics.set(key, existing);
  }

  // Connection tracking
  incrementConnections(): void {
    this.activeConnections++;
  }

  decrementConnections(): void {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
  }

  // Custom business metrics
  recordBusinessMetric(name: string, value: number): void {
    this.updateMetric(`business_${name}`, value);
  }

  // Get all metrics
  getMetrics(): Record<string, any> {
    const now = Date.now();
    const uptime = now - this.startTime;

    return {
      system: {
        uptime_ms: uptime,
        uptime_human: this.formatUptime(uptime),
        active_connections: this.activeConnections,
        memory_usage: process.memoryUsage(),
        cpu_usage: process.cpuUsage(),
      },
      http: {
        requests: Object.fromEntries(this.requestCounts),
        errors: Object.fromEntries(this.errorCounts),
        response_times: Object.fromEntries(this.metrics),
      },
      business: this.getBusinessMetrics(),
      timestamp: now,
    };
  }

  private getBusinessMetrics(): Record<string, any> {
    const businessMetrics: Record<string, any> = {};
    for (const [key, metric] of this.metrics.entries()) {
      if (key.startsWith('business_')) {
        businessMetrics[key.replace('business_', '')] = metric;
      }
    }
    return businessMetrics;
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

// Global metrics instance
export const metricsCollector = new MetricsCollector();

/**
 * Metrics collection middleware
 */
export const metricsMiddleware: Middleware = async (ctx: Context, next) => {
  const startTime = Date.now();
  const method = ctx.req.method || 'UNKNOWN';
  const path = ctx.req.url || '/';

  // Increment active connections
  metricsCollector.incrementConnections();

  try {
    await next();
  } finally {
    // Decrement active connections
    metricsCollector.decrementConnections();

    // Record request metrics
    const duration = Date.now() - startTime;
    const statusCode = ctx.res.statusCode || 500;
    
    // Normalize path for metrics (remove query params and IDs)
    const normalizedPath = normalizePath(path);
    
    metricsCollector.recordRequest(method, normalizedPath, statusCode, duration);

    // Log slow requests
    if (duration > 1000) {
      logger.warn(`Slow request detected: ${method} ${path} - ${duration}ms`);
    }
  }
};

/**
 * Normalize paths for consistent metrics
 */
function normalizePath(path: string): string {
  // Remove query parameters
  const cleanPath = path.split('?')[0] || '/';
  
  // Replace UUIDs and numeric IDs with placeholders
  return cleanPath
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id')
    .replace(/\/[a-zA-Z0-9_-]{20,}/g, '/:token');
}

/**
 * Health check system
 */
class HealthChecker {
  private checks: Map<string, () => Promise<{ status: 'pass' | 'fail' | 'warn'; message?: string; responseTime?: number }>> = new Map();

  addCheck(name: string, checkFn: () => Promise<{ status: 'pass' | 'fail' | 'warn'; message?: string; responseTime?: number }>): void {
    this.checks.set(name, checkFn);
  }

  async runChecks(): Promise<HealthStatus> {
    const startTime = Date.now();
    const results: Record<string, any> = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Run all health checks
    for (const [name, checkFn] of this.checks.entries()) {
      try {
        const checkStart = Date.now();
        const result = await Promise.race([
          checkFn(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), 5000))
        ]) as { status: 'pass' | 'fail' | 'warn'; message?: string; responseTime?: number };
        
        result.responseTime = Date.now() - checkStart;
        results[name] = result;

        // Update overall status
        if (result.status === 'fail') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'warn' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        results[name] = {
          status: 'fail',
          message: error instanceof Error ? error.message : 'Unknown error',
          responseTime: Date.now() - startTime
        };
        overallStatus = 'unhealthy';
      }
    }

    return {
      status: overallStatus,
      uptime: Date.now() - metricsCollector['startTime'],
      timestamp: Date.now(),
      version: process.env.npm_package_version || '1.0.0',
      checks: results,
    };
  }
}

export const healthChecker = new HealthChecker();

// Register default health checks
healthChecker.addCheck('memory', async () => {
  const usage = process.memoryUsage();
  const usedMB = usage.heapUsed / 1024 / 1024;
  const totalMB = usage.heapTotal / 1024 / 1024;
  const usagePercent = (usedMB / totalMB) * 100;

  if (usagePercent > 90) {
    return { status: 'fail', message: `Memory usage critical: ${usagePercent.toFixed(1)}%` };
  } else if (usagePercent > 70) {
    return { status: 'warn', message: `Memory usage high: ${usagePercent.toFixed(1)}%` };
  }
  return { status: 'pass', message: `Memory usage: ${usagePercent.toFixed(1)}%` };
});

healthChecker.addCheck('uptime', async () => {
  const uptimeMs = Date.now() - metricsCollector['startTime'];
  const uptimeMinutes = uptimeMs / 1000 / 60;

  if (uptimeMinutes < 1) {
    return { status: 'warn', message: 'Service recently started' };
  }
  return { status: 'pass', message: `Uptime: ${Math.floor(uptimeMinutes)} minutes` };
});

// Business logic health checks can be added by other modules
export function addDatabaseHealthCheck(prisma: any): void {
  healthChecker.addCheck('database', async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'pass', message: 'Database connection healthy' };
    } catch (error) {
      return { 
        status: 'fail', 
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  });
}

export function addAIServiceHealthCheck(): void {
  healthChecker.addCheck('ai_services', async () => {
    // This would check AI provider availability
    // For now, just return a basic check
    const checks = ['openai', 'anthropic', 'stability'];
    const results = await Promise.allSettled(
      checks.map(async (provider) => {
        // Simulate provider check
        await new Promise(resolve => setTimeout(resolve, 100));
        return { provider, available: Math.random() > 0.1 };
      })
    );

    const available = results.filter(r => r.status === 'fulfilled' && r.value.available).length;
    
    if (available === 0) {
      return { status: 'fail', message: 'No AI providers available' };
    } else if (available < checks.length) {
      return { status: 'warn', message: `${available}/${checks.length} AI providers available` };
    }
    
    return { status: 'pass', message: 'All AI providers available' };
  });
}
