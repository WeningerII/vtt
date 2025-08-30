/**
 * Health check system for monitoring service availability
 */

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  message?: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface HealthCheck {
  name: string;
  description: string;
  timeout: number;
  check(): Promise<HealthCheckResult>;
}

export interface HealthCheckConfig {
  checks: HealthCheck[];
  interval: number;
  timeout: number;
  retries: number;
}

export class HealthCheckManager {
  private config: HealthCheckConfig;
  private results: Map<string, HealthCheckResult> = new Map();
  private intervalId: NodeJS.Timeout | undefined = undefined;
  private isRunning = false;

  constructor(config: HealthCheckConfig) {
    this.config = config;
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.runChecks(); // Run immediately

    this.intervalId = setInterval(() => {
      this.runChecks();
    }, this.config.interval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
  }

  private async runChecks(): Promise<void> {
    const promises = this.config.checks.map((check) => this.runSingleCheck(check));
    await Promise.all(promises);
  }

  private async runSingleCheck(check: HealthCheck): Promise<void> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < this.config.retries) {
      try {
        const result = await this.executeCheck(check);
        this.results.set(check.name, result);
        return;
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (attempt < this.config.retries) {
          await this.sleep(1000 * attempt); // Exponential backoff
        }
      }
    }

    // All retries failed
    this.results.set(check.name, {
      name: check.name,
      status: "unhealthy",
      message: `Check failed after ${this.config.retries} attempts: ${lastError?.message}`,
      duration: 0,
      timestamp: new Date(),
    });
  }

  private async executeCheck(check: HealthCheck): Promise<HealthCheckResult> {
    const startTime = Date.now();

    const timeoutPromise = new Promise<never>((__, __reject) => {
      setTimeout(() => reject(new Error("Health check timeout")), check.timeout);
    });

    try {
      const result = await Promise.race([check.check(), timeoutPromise]);
      return {
        ...result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getResults(): HealthCheckResult[] {
    return Array.from(this.results.values());
  }

  getOverallStatus(): HealthStatus {
    const results = this.getResults();

    if (results.length === 0) return "unhealthy";

    const unhealthyCount = results.filter((r) => r.status === "unhealthy").length;
    const degradedCount = results.filter((r) => r.status === "degraded").length;

    if (unhealthyCount > 0) return "unhealthy";
    if (degradedCount > 0) return "degraded";
    return "healthy";
  }

  getHealthSummary(): {
    status: HealthStatus;
    checks: HealthCheckResult[];
    timestamp: Date;
  } {
    return {
      status: this.getOverallStatus(),
      checks: this.getResults(),
      timestamp: new Date(),
    };
  }
}

// Database health check
export class DatabaseHealthCheck implements HealthCheck {
  name = "database";
  description = "Database connectivity check";
  timeout = 5000;

  private connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Simulate database check
      await this.simulateDBQuery();

      return {
        name: this.name,
        status: "healthy",
        message: "Database connection successful",
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        name: this.name,
        status: "unhealthy",
        message: `Database connection failed: ${(error as Error).message}`,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  private async simulateDBQuery(): Promise<void> {
    // Simulate database query delay
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

    // Simulate occasional failures
    if (Math.random() < 0.05) {
      throw new Error("Connection timeout");
    }
  }
}

// Redis health check
export class RedisHealthCheck implements HealthCheck {
  name = "redis";
  description = "Redis connectivity check";
  timeout = 3000;

  private host: string;
  private port: number;

  constructor(host: string, port: number) {
    this.host = host;
    this.port = port;
  }

  async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Simulate Redis ping
      await this.simulateRedisPing();

      return {
        name: this.name,
        status: "healthy",
        message: "Redis connection successful",
        duration: Date.now() - startTime,
        timestamp: new Date(),
        metadata: { host: this.host, port: this.port },
      };
    } catch (error) {
      return {
        name: this.name,
        status: "unhealthy",
        message: `Redis connection failed: ${(error as Error).message}`,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  private async simulateRedisPing(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));

    if (Math.random() < 0.02) {
      throw new Error("Redis unavailable");
    }
  }
}

// Memory usage health check
export class MemoryHealthCheck implements HealthCheck {
  name = "memory";
  description = "Memory usage check";
  timeout = 1000;

  private warningThreshold: number;
  private criticalThreshold: number;

  constructor(warningThreshold = 0.8, criticalThreshold = 0.95) {
    this.warningThreshold = warningThreshold;
    this.criticalThreshold = criticalThreshold;
  }

  async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const memoryUsage = this.getMemoryUsage();
      const usageRatio = memoryUsage.used / memoryUsage.total;

      let status: HealthStatus = "healthy";
      let message = `Memory usage: ${(usageRatio * 100).toFixed(1)}%`;

      if (usageRatio >= this.criticalThreshold) {
        status = "unhealthy";
        message += " (Critical)";
      } else if (usageRatio >= this.warningThreshold) {
        status = "degraded";
        message += " (Warning)";
      }

      return {
        name: this.name,
        status,
        message,
        duration: Date.now() - startTime,
        timestamp: new Date(),
        metadata: {
          usageRatio,
          usedBytes: memoryUsage.used,
          totalBytes: memoryUsage.total,
        },
      };
    } catch (error) {
      return {
        name: this.name,
        status: "unhealthy",
        message: `Memory check failed: ${(error as Error).message}`,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  private getMemoryUsage(): { used: number; total: number } {
    if (typeof process !== "undefined" && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        used: usage.heapUsed,
        total: usage.heapTotal,
      };
    }

    // Fallback for browser environment
    return {
      used: 50 * 1024 * 1024, // 50MB
      total: 100 * 1024 * 1024, // 100MB
    };
  }
}

// External service health check
export class ExternalServiceHealthCheck implements HealthCheck {
  name: string;
  description: string;
  timeout = 10000;

  private url: string;
  private expectedStatus: number;

  constructor(name: string, url: string, expectedStatus = 200) {
    this.name = name;
    this.description = `External service check: ${name}`;
    this.url = url;
    this.expectedStatus = expectedStatus;
  }

  async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(this.url, {
        method: "GET",
        signal: AbortSignal.timeout(this.timeout),
      });

      const duration = Date.now() - startTime;

      if (response.status === this.expectedStatus) {
        return {
          name: this.name,
          status: "healthy",
          message: `Service responded with status ${response.status}`,
          duration,
          timestamp: new Date(),
          metadata: { statusCode: response.status, responseTime: duration },
        };
      } else {
        return {
          name: this.name,
          status: "degraded",
          message: `Service responded with unexpected status ${response.status}`,
          duration,
          timestamp: new Date(),
          metadata: { statusCode: response.status, responseTime: duration },
        };
      }
    } catch (error) {
      return {
        name: this.name,
        status: "unhealthy",
        message: `Service check failed: ${(error as Error).message}`,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }
}
