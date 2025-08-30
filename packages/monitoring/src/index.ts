/**
 * Monitoring package exports
 */

export * from "./logger";
export * from "./metrics";
// export * from './HealthCheck'; // File doesn't exist yet
// export * from './AlertManager'; // File doesn't exist yet
// export * from './ObservabilityManager'; // File doesn't exist yet

// Convenience factory for production setup
export async function createProductionObservability(_config?: Partial<any>): Promise<any> {
  const defaultConfig = {
    logging: {
      level: "info",
      transports: [
        { type: "console", format: "structured" },
        { type: "file", filename: "vtt.log", maxFiles: 10, maxSize: "10MB" },
      ],
    },
    healthChecks: {
      checks: [],
      interval: 30000,
      timeout: 5000,
      retries: 3,
    },
    alerts: {
      rules: [],
      channels: [],
      checkInterval: 60000,
      retentionDays: 30,
    },
    enableMetrics: true,
    enableTracing: true,
    dashboardPort: 3001,
  };

  // const _metricsModule = await import('./metrics');
  // const ObservabilityManager = (await import('./ObservabilityManager')).ObservabilityManager;
  // return new ObservabilityManager({
  //   ...defaultConfig,
  //   ...config
  // });
  return { ...defaultConfig, ...config }; // Placeholder until ObservabilityManager exists
}
