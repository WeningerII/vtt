import { logger } from "@vtt/logging";

/**
 * Metrics collection and monitoring system
 */

export type MetricType = "counter" | "gauge" | "histogram" | "timer";

export interface MetricValue {
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}

export interface Metric {
  name: string;
  type: MetricType;
  description: string;
  unit?: string;
  values: MetricValue[];
}

export interface MetricsCollector {
  name: string;
  collect(): Promise<Metric[]>;
}

export class MetricsRegistry {
  private metrics: Map<string, Metric> = new Map();
  private collectors: MetricsCollector[] = [];
  private static instance: MetricsRegistry;

  static getInstance(): MetricsRegistry {
    if (!MetricsRegistry.instance) {
      MetricsRegistry.instance = new MetricsRegistry();
    }
    return MetricsRegistry.instance;
  }

  // Counter metrics - values that only increase
  incrementCounter(name: string, value = 1, labels?: Record<string, string>): void {
    const metric = this.getOrCreateMetric(name, "counter", `Counter metric: ${name}`);
    const lastValue = metric.values[metric.values.length - 1]?.value || 0;

    const metricValue: MetricValue = {
      value: lastValue + value,
      timestamp: new Date(),
    };
    if (labels !== undefined) {
      metricValue.labels = labels;
    }
    metric.values.push(metricValue);

    // Keep only last 1000 values to prevent memory issues
    if (metric.values.length > 1000) {
      metric.values = metric.values.slice(-1000);
    }
  }

  // Gauge metrics - values that can go up or down
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.getOrCreateMetric(name, "gauge", `Gauge metric: ${name}`);

    const metricValue: MetricValue = {
      value,
      timestamp: new Date(),
    };
    if (labels !== undefined) {
      metricValue.labels = labels;
    }
    metric.values.push(metricValue);

    // Keep only last 1000 values
    if (metric.values.length > 1000) {
      metric.values = metric.values.slice(-1000);
    }
  }

  // Histogram metrics - distribution of values
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.getOrCreateMetric(name, "histogram", `Histogram metric: ${name}`);

    const metricValue: MetricValue = {
      value,
      timestamp: new Date(),
    };
    if (labels !== undefined) {
      metricValue.labels = labels;
    }
    metric.values.push(metricValue);

    // Keep only last 10000 values for histograms
    if (metric.values.length > 10000) {
      metric.values = metric.values.slice(-10000);
    }
  }

  // Timer metrics - measure duration
  startTimer(name: string, labels?: Record<string, string>): () => void {
    const startTime = Date.now();

    return () => {
      const duration = Date.now() - startTime;
      this.recordHistogram(name, duration, labels);
    };
  }

  private getOrCreateMetric(name: string, type: MetricType, description: string): Metric {
    let metric = this.metrics.get(name);

    if (!metric) {
      metric = {
        name,
        type,
        description,
        values: [],
      };
      this.metrics.set(name, metric);
    }

    return metric;
  }

  registerCollector(collector: MetricsCollector): void {
    this.collectors.push(collector);
  }

  async getAllMetrics(): Promise<Metric[]> {
    const staticMetrics = Array.from(this.metrics.values());

    // Collect metrics from registered collectors
    const collectedMetrics: Metric[] = [];
    for (const collector of this.collectors) {
      try {
        const metrics = await collector.collect();
        collectedMetrics.push(...metrics);
      } catch (error) {
        logger.error(`Failed to collect metrics from ${collector.name}:`, error);
      }
    }

    return [...staticMetrics, ...collectedMetrics];
  }

  getMetric(name: string): Metric | undefined {
    return this.metrics.get(name);
  }

  // Get metric statistics
  getMetricStats(
    name: string,
    timeWindow?: number,
  ): {
    count: number;
    min: number;
    max: number;
    avg: number;
    sum: number;
    latest: number;
  } | null {
    const metric = this.metrics.get(name);
    if (!metric || metric.values.length === 0) {
      return null;
    }

    let values = metric.values;

    // Filter by time window if specified
    if (timeWindow) {
      const cutoff = new Date(Date.now() - timeWindow);
      values = values.filter((v) => v.timestamp >= cutoff);
    }

    if (values.length === 0) {
      return null;
    }

    const nums = values.map((v) => v.value);
    const sum = nums.reduce((_a, __b) => a + b, 0);

    return {
      count: nums.length,
      min: Math.min(...nums),
      max: Math.max(...nums),
      avg: sum / nums.length,
      sum,
      latest: nums[nums.length - 1] || 0,
    };
  }

  clear(): void {
    this.metrics.clear();
  }
}

// Game-specific metrics collector
export class GameMetricsCollector implements MetricsCollector {
  name = "game-metrics";
  private gameStates: Map<string, any> = new Map();

  updateGameState(gameId: string, state: any): void {
    this.gameStates.set(gameId, {
      ...state,
      lastUpdated: new Date(),
    });
  }

  async collect(): Promise<Metric[]> {
    const metrics: Metric[] = [];
    const now = new Date();

    // Active games metric
    metrics.push({
      name: "vtt_active_games_total",
      type: "gauge",
      description: "Number of active games",
      values: [
        {
          value: this.gameStates.size,
          timestamp: now,
        },
      ],
    });

    // Players per game
    const playersPerGame = Array.from(this.gameStates.values()).map(
      (state) => state.players?.length || 0,
    );

    if (playersPerGame.length > 0) {
      metrics.push({
        name: "vtt_players_per_game",
        type: "histogram",
        description: "Distribution of players per game",
        values: playersPerGame.map((count) => ({
          value: count,
          timestamp: now,
        })),
      });
    }

    return metrics;
  }
}

// System metrics collector
export class SystemMetricsCollector implements MetricsCollector {
  name = "system-metrics";

  async collect(): Promise<Metric[]> {
    const metrics: Metric[] = [];
    const now = new Date();

    // Memory usage
    if (typeof process !== "undefined" && process.memoryUsage) {
      const memUsage = process.memoryUsage();

      metrics.push({
        name: "vtt_memory_usage_bytes",
        type: "gauge",
        description: "Memory usage in bytes",
        unit: "bytes",
        values: [
          { value: memUsage.heapUsed, timestamp: now, labels: { type: "heap_used" } },
          { value: memUsage.heapTotal, timestamp: now, labels: { type: "heap_total" } },
          { value: memUsage.rss, timestamp: now, labels: { type: "rss" } },
        ],
      });
    }

    // CPU usage (simplified)
    if (typeof process !== "undefined" && process.cpuUsage) {
      const cpuUsage = process.cpuUsage();

      metrics.push({
        name: "vtt_cpu_usage_microseconds",
        type: "counter",
        description: "CPU usage in microseconds",
        unit: "microseconds",
        values: [
          { value: cpuUsage.user, timestamp: now, labels: { type: "user" } },
          { value: cpuUsage.system, timestamp: now, labels: { type: "system" } },
        ],
      });
    }

    return metrics;
  }
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private static registry = MetricsRegistry.getInstance();

  static measureFunction<T>(_name: string, _fn: () => T, labels?: Record<string, string>): T {
    const endTimer = this.registry.startTimer(`vtt_function_duration_ms`, {
      function: name,
      ...labels,
    });

    try {
      const result = fn();
      this.registry.incrementCounter(`vtt_function_calls_total`, 1, {
        function: name,
        status: "success",
        ...labels,
      });
      return result;
    } catch (error) {
      this.registry.incrementCounter(`vtt_function_calls_total`, 1, {
        function: name,
        status: "error",
        ...labels,
      });
      throw error;
    } finally {
      endTimer();
    }
  }

  static async measureAsyncFunction<T>(
    _name: string,
    _fn: () => Promise<T>,
    labels?: Record<string, string>,
  ): Promise<T> {
    const endTimer = this.registry.startTimer(`vtt_function_duration_ms`, {
      function: name,
      ...labels,
    });

    try {
      const result = await fn();
      this.registry.incrementCounter(`vtt_function_calls_total`, 1, {
        function: name,
        status: "success",
        ...labels,
      });
      return result;
    } catch (error) {
      this.registry.incrementCounter(`vtt_function_calls_total`, 1, {
        function: name,
        status: "error",
        ...labels,
      });
      throw error;
    } finally {
      endTimer();
    }
  }

  static recordUserAction(action: string, userId?: string): void {
    this.registry.incrementCounter(`vtt_user_actions_total`, 1, {
      action,
      ...(userId && { user_id: userId }),
    });
  }

  static recordAPICall(method: string, path: string, statusCode: number, duration: number): void {
    this.registry.incrementCounter(`vtt_api_requests_total`, 1, {
      method,
      path,
      status_code: statusCode.toString(),
    });

    this.registry.recordHistogram(`vtt_api_request_duration_ms`, duration, {
      method,
      path,
    });
  }

  static recordWebSocketConnection(event: "connect" | "disconnect"): void {
    this.registry.incrementCounter(`vtt_websocket_connections_total`, 1, {
      event,
    });
  }

  static recordGameEvent(event: string, gameId?: string): void {
    this.registry.incrementCounter(`vtt_game_events_total`, 1, {
      event,
      ...(gameId && { game_id: gameId }),
    });
  }
}
