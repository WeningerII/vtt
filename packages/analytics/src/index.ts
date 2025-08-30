// Analytics and telemetry system exports
export { TelemetrySystem } from "./TelemetrySystem";
export type {
  TelemetryEvent,
  TelemetryMetadata,
  TelemetryConfig,
  PerformanceMetrics,
  UserMetrics,
  SystemMetrics,
} from "./TelemetrySystem";

export { AnalyticsManager } from "./AnalyticsManager";
export type {
  AnalyticsConfig,
  DashboardConfig,
  ChartConfig,
  AlertConfig,
  AlertRule,
  AlertChannel,
  ReportingConfig,
  AnalyticsReport,
  AnalyticsSummary,
  PerformanceReport,
  UserReport,
  SystemReport,
  AnalyticsInsight,
  AnalyticsRecommendation,
} from "./AnalyticsManager";

// Utility functions for quick analytics setup
export function createBasicAnalyticsConfig(_endpoint: string): Partial<AnalyticsConfig> {
  return {
    telemetry: {
      endpoint,
      batchSize: 50,
      flushInterval: 30000,
      enabledCategories: ["performance", "user", "system", "error"],
      samplingRate: 1.0,
      enableErrorTracking: true,
      enablePerformanceTracking: true,
      enableUserTracking: true,
      privacyMode: false,
    },
    dashboard: {
      enabled: true,
      updateInterval: 5000,
      maxDataPoints: 1000,
      charts: [],
    },
    alerts: {
      enabled: true,
      rules: [],
      channels: [
        {
          id: "console",
          type: "console",
          config: Record<string, any>,
          enabled: true,
        },
      ],
    },
    reporting: {
      enabled: false,
      interval: "daily",
      recipients: [],
      template: "default",
      includeCharts: false,
    },
  };
}

export function createPerformanceAlerts(): AlertRule[] {
  return [
    {
      id: "low_fps_critical",
      name: "Critical FPS Drop",
      metric: "performance.fps",
      condition: "below",
      threshold: 15,
      duration: 5000,
      severity: "critical",
      enabled: true,
    },
    {
      id: "high_memory_warning",
      name: "High Memory Usage",
      metric: "performance.memoryUsage",
      condition: "above",
      threshold: 500,
      duration: 15000,
      severity: "medium",
      enabled: true,
    },
    {
      id: "long_frame_time",
      name: "Long Frame Time",
      metric: "performance.frameTime",
      condition: "above",
      threshold: 33,
      duration: 10000,
      severity: "high",
      enabled: true,
    },
  ];
}

export function createUserEngagementCharts(): ChartConfig[] {
  return [
    {
      id: "session_duration",
      type: "line",
      title: "Session Duration",
      metrics: ["user.sessionDuration"],
      timeRange: 60,
      refreshRate: 10000,
    },
    {
      id: "actions_per_session",
      type: "bar",
      title: "Actions Per Session",
      metrics: ["user.actionsPerSession"],
      timeRange: 30,
      refreshRate: 15000,
    },
    {
      id: "feature_usage",
      type: "pie",
      title: "Feature Usage Distribution",
      metrics: ["user.featuresUsed"],
      timeRange: 120,
      refreshRate: 30000,
    },
  ];
}
