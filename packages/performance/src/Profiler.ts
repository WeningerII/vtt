/**
 * Performance profiling and measurement utilities for VTT systems
 */

import perfNow from "performance-now";
import { logger } from "@vtt/logging";

export interface ProfileEntry {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any> | undefined;
  children: ProfileEntry[];
  parent?: ProfileEntry;
}

export interface PerformanceMetrics {
  name: string;
  samples: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  standardDeviation: number;
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

export interface SystemResourceMetrics {
  timestamp: number;
  memory: {
    used: number;
    total: number;
    heap: number;
    external: number;
    rss: number;
  };
  cpu: {
    user: number;
    system: number;
    idle: number;
  };
  gc?: {
    collections: number;
    duration: number;
    type: string;
  };
}

export class Profiler {
  private activeProfiles = new Map<string, ProfileEntry>();
  private completedProfiles: ProfileEntry[] = [];
  private performanceData = new Map<string, number[]>();
  private resourceHistory: SystemResourceMetrics[] = [];
  private maxHistorySize = 10000;
  private gcObserver?: PerformanceObserver;

  constructor() {
    this.setupGCMonitoring();
    this.startResourceMonitoring();
  }

  // Profiling API
  startProfile(name: string, metadata?: Record<string, any>): ProfileEntry {
    const profile: ProfileEntry = {
      name,
      startTime: perfNow(),
      metadata: metadata || undefined,
      children: [],
    };

    this.activeProfiles.set(name, profile);
    return profile;
  }

  endProfile(name: string): ProfileEntry | null {
    const profile = this.activeProfiles.get(name);
    if (!profile) {
      logger.warn(`No active profile found for: ${name}`);
      return null;
    }

    const endTime = perfNow();
    profile.endTime = endTime;
    profile.duration = endTime - profile.startTime;

    this.activeProfiles.delete(name);
    this.completedProfiles.push(profile);

    // Store performance data for statistics
    if (!this.performanceData.has(name)) {
      this.performanceData.set(name, []);
    }
    this.performanceData.get(name)!.push(profile.duration);

    // Cleanup old data
    this.cleanupOldData();

    return profile;
  }

  // Decorator for automatic profiling
  profile<T extends (...args: any[]) => any>(
    name: string,
    fn: T,
    metadata?: Record<string, any>,
  ): T {
    return ((...args: any[]) => {
      this.startProfile(name, metadata);
      try {
        const result = fn(...args);

        if (result instanceof Promise) {
          return result.finally(() => {
            this.endProfile(name);
          });
        } else {
          this.endProfile(name);
          return result;
        }
      } catch (error) {
        this.endProfile(name);
        throw error;
      }
    }) as T;
  }

  // Async profiling wrapper
  async profileAsync<T>(
    name: string,
    _operation: () => Promise<T>,
    metadata?: Record<string, any>,
  ): Promise<T> {
    this.startProfile(name, metadata);
    try {
      const result = await _operation();
      return result;
    } finally {
      this.endProfile(name);
    }
  }

  // Performance measurement and analysis
  measureFunction<T extends (...args: any[]) => any>(
    name: string,
    fn: T,
    iterations: number = 1000,
  ): PerformanceMetrics {
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = perfNow();
      fn();
      const end = perfNow();
      durations.push(end - start);
    }

    return this.calculateMetrics(name, durations);
  }

  async measureAsyncFunction<T>(
    name: string,
    _fn: () => Promise<T>,
    iterations: number = 100,
  ): Promise<PerformanceMetrics> {
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = perfNow();
      await _fn();
      const end = perfNow();
      durations.push(end - start);
    }

    return this.calculateMetrics(name, durations);
  }

  private calculateMetrics(name: string, durations: number[]): PerformanceMetrics {
    const sorted = durations.sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);
    const mean = sum / durations.length;

    const variance =
      durations.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / durations.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      name,
      samples: durations.length,
      mean,
      median: sorted[Math.floor(sorted.length / 2)] || 0,
      min: sorted[0] || 0,
      max: sorted[sorted.length - 1] || 0,
      standardDeviation,
      percentiles: {
        p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
        p90: sorted[Math.floor(sorted.length * 0.9)] || 0,
        p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
        p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
      },
    };
  }

  // System resource monitoring
  private setupGCMonitoring(): void {
    if (typeof PerformanceObserver !== "undefined") {
      try {
        this.gcObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          for (const entry of entries) {
            if (entry.entryType === "measure" && entry.name.includes("gc")) {
              // GC event detected
              this.recordGCEvent(entry);
            }
          }
        });
        this.gcObserver.observe({ entryTypes: ["measure", "mark"] });
      } catch (error) {
        logger.warn("GC monitoring not available:", error as Record<string, any>);
      }
    }
  }

  private recordGCEvent(entry: PerformanceEntry): void {
    const latestMetrics = this.resourceHistory[this.resourceHistory.length - 1];
    if (latestMetrics) {
      latestMetrics.gc = {
        collections: (latestMetrics.gc?.collections || 0) + 1,
        duration: entry.duration,
        type: entry.name,
      };
    }
  }

  private startResourceMonitoring(): void {
    setInterval(() => {
      this.collectResourceMetrics();
    }, 1000); // Collect every second
  }

  private collectResourceMetrics(): void {
    const metrics: SystemResourceMetrics = {
      timestamp: Date.now(),
      memory: this.getMemoryMetrics(),
      cpu: this.getCPUMetrics(),
    };

    this.resourceHistory.push(metrics);

    // Limit history size
    if (this.resourceHistory.length > this.maxHistorySize) {
      this.resourceHistory = this.resourceHistory.slice(-this.maxHistorySize);
    }
  }

  private getMemoryMetrics() {
    if (typeof process !== "undefined" && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        used: usage.heapUsed,
        total: usage.heapTotal,
        heap: usage.heapUsed,
        external: usage.external,
        rss: usage.rss,
      };
    }

    // Browser fallback
    return {
      used: 0,
      total: 0,
      heap: 0,
      external: 0,
      rss: 0,
    };
  }

  private getCPUMetrics() {
    if (typeof process !== "undefined" && process.cpuUsage) {
      const usage = process.cpuUsage();
      return {
        user: usage.user / 1000000, // Convert to milliseconds
        system: usage.system / 1000000,
        idle: 0,
      };
    }

    return { user: 0, system: 0, idle: 0 };
  }

  private cleanupOldData(): void {
    // Keep only recent completed profiles
    if (this.completedProfiles.length > 1000) {
      this.completedProfiles = this.completedProfiles.slice(-1000);
    }

    // Cleanup performance data
    for (const [name, data] of this.performanceData) {
      if (data.length > 1000) {
        this.performanceData.set(name, data.slice(-1000));
      }
    }
  }

  // Analysis and reporting
  getProfileSummary(name?: string): PerformanceMetrics[] {
    const results: PerformanceMetrics[] = [];

    for (const [profileName, durations] of this.performanceData) {
      if (!name || profileName === name) {
        results.push(this.calculateMetrics(profileName, durations));
      }
    }
    const sortedByMean = results.sort((a, b) => b.mean - a.mean);
    return sortedByMean;
  }

  getResourceMetrics(timeWindowMs?: number): SystemResourceMetrics[] {
    if (!timeWindowMs) {
      return [...this.resourceHistory];
    }

    const cutoff = Date.now() - timeWindowMs;
    return this.resourceHistory.filter((m) => m.timestamp >= cutoff);
  }

  // ... (rest of the code remains the same)

  generateReport(): {
    summary: PerformanceMetrics[];
    bottlenecks: Array<{
      name: string;
      averageTime: number;
      samples: number;
      severity: "low" | "medium" | "high" | "critical";
    }>;
    resourceUsage: {
      currentMemory: number;
      averageMemory: number;
      peakMemory: number;
      memoryTrend: "increasing" | "stable" | "decreasing";
    };
    recommendations: string[];
  } {
    const summary = this.getProfileSummary();
    const bottlenecks = this.findBottlenecks();
    const recentMetrics = this.getResourceMetrics(60000); // Last minute

    const memoryHistory = this.resourceHistory.map((m) => m.memory.used);
    const currentMemory = memoryHistory[memoryHistory.length - 1] || 0;
    const recentMemory =
      memoryHistory.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, memoryHistory.length) || 0;
    const peakMemory = Math.max(...memoryHistory) || 0;

    // Simple trend analysis
    const firstHalf = memoryHistory.slice(0, Math.floor(memoryHistory.length / 2));
    const secondHalf = memoryHistory.slice(Math.floor(memoryHistory.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length || 0;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length || 0;

    let memoryTrend: "increasing" | "stable" | "decreasing" = "stable";
    if (secondAvg > firstAvg * 1.1) {memoryTrend = "increasing";}
    else if (secondAvg < firstAvg * 0.9) {memoryTrend = "decreasing";}

    const recommendations = this.generateRecommendations(bottlenecks, memoryTrend);

    return {
      summary,
      bottlenecks: bottlenecks
        .sort((a, b) => a.count - b.count)
        .slice(0, 3)
        .map((b) => ({
          name: b.name,
          averageTime: b.avgTime,
          samples: b.count,
          severity: b.impact === "high" ? "critical" : "medium",
        })),
      resourceUsage: {
        currentMemory,
        averageMemory: firstAvg,
        peakMemory,
        memoryTrend,
      },
      recommendations,
    };
  }

  public findBottlenecks() {
    const bottlenecks: Array<{ name: string; impact: string; avgTime: number; count: number }> = [];

    for (const [name, times] of this.performanceData.entries()) {
      if (times.length === 0) {continue;}

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const count = times.length;

      if (avgTime > 100) {
        // More than 100ms
        bottlenecks.push({
          name,
          impact: "high",
          avgTime,
          count,
        });
      } else if (avgTime > 50) {
        // More than 50ms
        bottlenecks.push({
          name,
          impact: "medium",
          avgTime,
          count,
        });
      }
    }

    return bottlenecks.sort((a, b) => b.avgTime - a.avgTime);
  }

  private generateRecommendations(bottlenecks: any[], memoryTrend: string): string[] {
    const recommendations: string[] = [];

    if (bottlenecks.length > 0) {
      recommendations.push(
        `Found ${bottlenecks.length} performance bottlenecks requiring attention`,
      );

      const longRunning = bottlenecks.filter((b) => b.impact === "high");
      if (longRunning.length > 0) {
        recommendations.push(
          `CRITICAL: ${longRunning.map((b) => b.name).join(", ")} are taking >100ms per operation`,
        );
      }
    }

    if (memoryTrend === "increasing") {
      recommendations.push("Memory usage is trending upward - check for memory leaks");
    }

    if (bottlenecks.some((b) => b.name.includes("render"))) {
      recommendations.push("Consider render optimization: object pooling, culling, or LOD systems");
    }

    if (bottlenecks.some((b) => b.name.includes("network"))) {
      recommendations.push(
        "Network operations are slow - consider batching, compression, or caching",
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("No significant performance issues detected");
    }

    return recommendations;
  }

  // Cleanup
  dispose(): void {
    if (this.gcObserver) {
      this.gcObserver.disconnect();
    }

    this.activeProfiles.clear();
    this.completedProfiles = [];
    this.performanceData.clear();
    this.resourceHistory = [];
  }
}
