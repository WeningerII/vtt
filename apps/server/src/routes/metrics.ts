/**
 * Metrics and health check API endpoints
 */

import { RouteHandler } from "../router/types";
import { metricsCollector, healthChecker, type MetricsSnapshot } from "../middleware/metrics";
import { handleRouteError } from "../middleware/errorHandler";
import { getErrorMessage } from "../utils/errors";

/**
 * GET /api/health - Basic health check endpoint
 */
export const healthCheckHandler: RouteHandler = async (ctx) => {
  try {
    const health = await healthChecker.runChecks();

    // Set appropriate HTTP status based on health
    const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;

    ctx.res.writeHead(statusCode, {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    });
    ctx.res.end(JSON.stringify(health, null, 2));
  } catch (error) {
    handleRouteError(ctx, error);
  }
};

/**
 * GET /api/health/live - Kubernetes liveness probe
 */
export const livenessProbeHandler: RouteHandler = async (ctx) => {
  // Simple liveness check - just verify the service is running
  ctx.res.writeHead(200, { "Content-Type": "application/json" });
  ctx.res.end(
    JSON.stringify({
      status: "alive",
      timestamp: new Date().toISOString(),
    }),
  );
};

/**
 * GET /api/health/ready - Kubernetes readiness probe
 */
export const readinessProbeHandler: RouteHandler = async (ctx) => {
  try {
    const health = await healthChecker.runChecks();

    // Service is ready if it's healthy or degraded (but not unhealthy)
    const isReady = health.status !== "unhealthy";
    const statusCode = isReady ? 200 : 503;

    ctx.res.writeHead(statusCode, {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    });
    ctx.res.end(
      JSON.stringify({
        status: isReady ? "ready" : "not_ready",
        health: health.status,
        timestamp: new Date().toISOString(),
      }),
    );
  } catch (error) {
    ctx.res.writeHead(503, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        status: "not_ready",
        error: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      }),
    );
  }
};

/**
 * GET /api/metrics - Application metrics endpoint
 */
export const metricsHandler: RouteHandler = async (ctx) => {
  try {
    const metrics = metricsCollector.getMetrics();

    ctx.res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    });
    ctx.res.end(JSON.stringify(metrics, null, 2));
  } catch (error) {
    handleRouteError(ctx, error);
  }
};

/**
 * GET /api/metrics/prometheus - Prometheus-compatible metrics
 */
export const prometheusMetricsHandler: RouteHandler = async (ctx) => {
  try {
    const metrics = metricsCollector.getMetrics();
    const prometheusFormat = convertToPrometheusFormat(metrics);

    ctx.res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    });
    ctx.res.end(prometheusFormat);
  } catch (error) {
    handleRouteError(ctx, error);
  }
};

/**
 * Convert metrics to Prometheus format
 */
function convertToPrometheusFormat(metrics: MetricsSnapshot): string {
  const lines: string[] = [];
  const timestamp = Date.now();

  // System metrics
  if (metrics.system) {
    lines.push(`# HELP vtt_uptime_seconds Application uptime in seconds`);
    lines.push(`# TYPE vtt_uptime_seconds counter`);
    lines.push(`vtt_uptime_seconds ${Math.floor(metrics.system.uptime_ms / 1000)} ${timestamp}`);

    lines.push(`# HELP vtt_active_connections Current active connections`);
    lines.push(`# TYPE vtt_active_connections gauge`);
    lines.push(`vtt_active_connections ${metrics.system.active_connections} ${timestamp}`);

    if (metrics.system.memory_usage) {
      const mem = metrics.system.memory_usage;
      lines.push(`# HELP vtt_memory_heap_used_bytes Heap memory used in bytes`);
      lines.push(`# TYPE vtt_memory_heap_used_bytes gauge`);
      lines.push(`vtt_memory_heap_used_bytes ${mem.heapUsed} ${timestamp}`);

      lines.push(`# HELP vtt_memory_heap_total_bytes Total heap memory in bytes`);
      lines.push(`# TYPE vtt_memory_heap_total_bytes gauge`);
      lines.push(`vtt_memory_heap_total_bytes ${mem.heapTotal} ${timestamp}`);
    }
  }

  // HTTP metrics
  if (metrics.http?.requests) {
    lines.push(`# HELP vtt_http_requests_total Total HTTP requests by method and path`);
    lines.push(`# TYPE vtt_http_requests_total counter`);

    for (const [key, count] of Object.entries(metrics.http.requests)) {
      const [method, ...pathParts] = key.split("_");
      const path = pathParts.join("_");
      lines.push(
        `vtt_http_requests_total{method="${method}",path="${path}"} ${count} ${timestamp}`,
      );
    }
  }

  if (metrics.http?.errors) {
    lines.push(`# HELP vtt_http_errors_total Total HTTP errors by method and path`);
    lines.push(`# TYPE vtt_http_errors_total counter`);

    for (const [key, count] of Object.entries(metrics.http.errors)) {
      const cleanKey = key.replace("_errors", "");
      const [method, ...pathParts] = cleanKey.split("_");
      const path = pathParts.join("_");
      lines.push(`vtt_http_errors_total{method="${method}",path="${path}"} ${count} ${timestamp}`);
    }
  }

  // Response time metrics
  for (const [key, metric] of Object.entries(metrics.http.response_times)) {
    const metricName = key.replace(/^response_time_/, "");

    lines.push(`# HELP vtt_http_response_time_seconds HTTP response time in seconds`);
    lines.push(`# TYPE vtt_http_response_time_seconds histogram`);
    lines.push(
      `vtt_http_response_time_seconds_sum{endpoint="${metricName}"} ${metric.sum / 1000} ${timestamp}`,
    );
    lines.push(
      `vtt_http_response_time_seconds_count{endpoint="${metricName}"} ${metric.count} ${timestamp}`,
    );
  }

  // Business metrics
  for (const [key, metric] of Object.entries(metrics.business)) {
    lines.push(`# HELP vtt_business_${key} Business metric: ${key}`);
    lines.push(`# TYPE vtt_business_${key} gauge`);
    lines.push(`vtt_business_${key} ${metric.avg} ${timestamp}`);
  }

  return `${lines.join("\n")}\n`;
}

/**
 * Record custom business metrics
 */
export const recordBusinessMetric = (name: string, value: number): void => {
  metricsCollector.recordBusinessMetric(name, value);
};
