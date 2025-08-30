import {
  TelemetrySystem,
  TelemetryConfig,
  PerformanceMetrics,
  UserMetrics,
  SystemMetrics,
} from "./TelemetrySystem";
import { logger } from "@vtt/logging";

export interface AnalyticsConfig {
  telemetry: TelemetryConfig;
  dashboard: DashboardConfig;
  alerts: AlertConfig;
  reporting: ReportingConfig;
}

export interface DashboardConfig {
  enabled: boolean;
  updateInterval: number; // ms
  maxDataPoints: number;
  charts: ChartConfig[];
}

export interface ChartConfig {
  id: string;
  type: "line" | "bar" | "pie" | "gauge" | "heatmap";
  title: string;
  metrics: string[];
  timeRange: number; // minutes
  refreshRate: number; // ms
}

export interface AlertConfig {
  enabled: boolean;
  rules: AlertRule[];
  channels: AlertChannel[];
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: "above" | "below" | "equals" | "change";
  threshold: number;
  duration: number; // ms
  severity: "low" | "medium" | "high" | "critical";
  enabled: boolean;
}

export interface AlertChannel {
  id: string;
  type: "console" | "notification" | "webhook" | "email";
  config: Record<string, any>;
  enabled: boolean;
}

export interface ReportingConfig {
  enabled: boolean;
  interval: "hourly" | "daily" | "weekly" | "monthly";
  recipients: string[];
  template: string;
  includeCharts: boolean;
}

export interface AnalyticsReport {
  period: { start: number; end: number };
  summary: AnalyticsSummary;
  performance: PerformanceReport;
  user: UserReport;
  system: SystemReport;
  insights: AnalyticsInsight[];
  recommendations: AnalyticsRecommendation[];
}

export interface AnalyticsSummary {
  totalEvents: number;
  totalUsers: number;
  totalSessions: number;
  avgSessionDuration: number;
  errorRate: number;
  uptime: number;
}

export interface PerformanceReport {
  avgFPS: number;
  avgFrameTime: number;
  avgMemoryUsage: number;
  renderTimeP95: number;
  loadTimeP95: number;
  slowestOperations: Array<{ name: string; avgTime: number; count: number }>;
}

export interface UserReport {
  activeUsers: number;
  newUsers: number;
  returningUsers: number;
  avgActionsPerSession: number;
  topFeatures: Array<{ feature: string; usage: number }>;
  conversionRate: number;
  abandonmentRate: number;
}

export interface SystemReport {
  errorsByType: Record<string, number>;
  crashRate: number;
  resourceUtilization: { cpu: number; memory: number; gpu: number };
  networkStats: { latency: number; bandwidth: number; errors: number };
  featureAdoption: Record<string, number>;
}

export interface AnalyticsInsight {
  type: "performance" | "user" | "system" | "business";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  data: Record<string, any>;
  timestamp: number;
}

export interface AnalyticsRecommendation {
  type: "optimization" | "feature" | "ux" | "infrastructure";
  priority: "low" | "medium" | "high";
  title: string;
  description: string;
  impact: string;
  effort: "low" | "medium" | "high";
  actionItems: string[];
}

export class AnalyticsManager {
  private telemetry: TelemetrySystem;
  private config: AnalyticsConfig;
  private isInitialized = false;

  // Data storage
  private eventHistory: Array<{ timestamp: number; events: any[] }> = [];
  private metricsHistory: Array<{ timestamp: number; metrics: any }> = [];
  private alertState = new Map<string, { triggered: boolean; lastCheck: number }>();

  // Dashboard state
  private dashboardUpdateTimer?: number;
  private subscribers: Array<(_data: any) => void> = [];

  // Alert processing
  private alertCheckTimer?: number;
  private activeAlerts: Array<{ rule: AlertRule; triggeredAt: number; severity: string }> = [];

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = {
      telemetry: {
        endpoint: "",
        batchSize: 50,
        flushInterval: 30000,
        maxRetries: 3,
        retryDelay: 1000,
        enabledCategories: ["performance", "user", "system", "error"],
        samplingRate: 1.0,
        enableLocalStorage: true,
        enableErrorTracking: true,
        enablePerformanceTracking: true,
        enableUserTracking: true,
        privacyMode: false,
        ...config.telemetry,
      },
      dashboard: {
        enabled: true,
        updateInterval: 5000,
        maxDataPoints: 1000,
        charts: [],
        ...config.dashboard,
      },
      alerts: {
        enabled: true,
        rules: [],
        channels: [],
        ...config.alerts,
      },
      reporting: {
        enabled: false,
        interval: "daily",
        recipients: [],
        template: "default",
        includeCharts: false,
        ...config.reporting,
      },
    };

    this.telemetry = new TelemetrySystem(this.config.telemetry);
    this.setupDefaultAlerts();
    this.setupDefaultCharts();
  }

  public async initialize(userId?: string): Promise<void> {
    if (this.isInitialized) return;

    await this.telemetry.initialize(userId);

    if (this.config.dashboard.enabled) {
      this.startDashboardUpdates();
    }

    if (this.config.alerts.enabled) {
      this.startAlertProcessing();
    }

    if (this.config.reporting.enabled) {
      this.setupReporting();
    }

    this.isInitialized = true;
    logger.info("AnalyticsManager initialized");
  }

  // Telemetry proxy methods
  public track(type: string, data: Record<string, any> = {}, category: any = "user"): void {
    this.telemetry.track(type, data, category);
  }

  public trackError(error: Error, context: Record<string, any> = {}): void {
    this.telemetry.trackError(error, context);
  }

  public trackPerformance(metrics: Partial<PerformanceMetrics>): void {
    this.telemetry.trackPerformance(metrics);
  }

  public trackUserAction(action: string, target?: string, value?: any): void {
    this.telemetry.trackUserAction(action, target, value);
  }

  public startTiming(name: string): () => void {
    return this.telemetry.startTiming(name);
  }

  // Dashboard methods
  public subscribeToDashboard(_callback: (data: any) => void): () => void {
    this.subscribers.push(callback);

    // Send initial data
    callback(this.getDashboardData());

    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  public getDashboardData(): any {
    const metrics = this.telemetry.getMetrics();
    const currentTime = Date.now();

    return {
      timestamp: currentTime,
      metrics,
      charts: this.generateChartData(),
      alerts: this.activeAlerts,
      summary: this.generateSummary(metrics),
    };
  }

  private generateChartData(): any {
    const chartData: Record<string, any> = {};

    for (const chart of this.config.dashboard.charts) {
      chartData[chart.id] = this.getChartData(chart);
    }

    return chartData;
  }

  private getChartData(chart: ChartConfig): any {
    const timeRange = chart.timeRange * 60 * 1000; // Convert minutes to ms
    const cutoff = Date.now() - timeRange;

    const relevantData = this.metricsHistory.filter((entry) => entry.timestamp > cutoff);

    switch (chart.type) {
      case "line":
        return {
          labels: relevantData.map((entry) => new Date(entry.timestamp).toLocaleTimeString()),
          datasets: chart.metrics.map((metric) => ({
            label: metric,
            data: relevantData.map((entry) => this.extractMetricValue(entry.metrics, metric)),
          })),
        };

      case "bar":
        return {
          labels: chart.metrics,
          data: chart.metrics.map((metric) => {
            const latest = relevantData[relevantData.length - 1];
            return latest ? this.extractMetricValue(latest.metrics, metric) : 0;
          }),
        };

      case "pie": {
        const total = relevantData.length;
        return {
          labels: chart.metrics,
          data: chart.metrics.map((metric) => {
            const count = relevantData.filter(
              (entry) => this.extractMetricValue(entry.metrics, metric) > 0,
            ).length;
            return total > 0 ? (count / total) * 100 : 0;
          }),
        };
      }
      case "gauge": {
        const latest = relevantData[relevantData.length - 1];
        return {
          value: latest ? this.extractMetricValue(latest.metrics, chart.metrics[0]) : 0,
          max: 100,
        };
      }
      default:
        return {};
    }
  }

  private extractMetricValue(metrics: any, path: string): number {
    const parts = path.split(".");
    let value = metrics;

    for (const part of parts) {
      value = value?.[part];
    }

    return typeof value === "number" ? value : 0;
  }

  private generateSummary(metrics: any): AnalyticsSummary {
    const { _performance, user, system } = metrics;

    return {
      totalEvents: this.eventHistory.reduce((_sum, _entry) => sum + entry.events.length, 0),
      totalUsers: 1, // Would track unique users
      totalSessions: 1, // Would track session count
      avgSessionDuration: user.sessionDuration,
      errorRate: system.errorRate,
      uptime: system.uptime,
    };
  }

  // Alert methods
  public addAlertRule(rule: AlertRule): void {
    this.config.alerts.rules.push(rule);
    this.alertState.set(rule.id, { triggered: false, lastCheck: Date.now() });
  }

  public removeAlertRule(ruleId: string): void {
    this.config.alerts.rules = this.config.alerts.rules.filter((rule) => rule.id !== ruleId);
    this.alertState.delete(ruleId);
  }

  public getActiveAlerts(): Array<{ rule: AlertRule; triggeredAt: number; severity: string }> {
    return [...this.activeAlerts];
  }

  private startAlertProcessing(): void {
    this.alertCheckTimer = window.setInterval(() => {
      this.processAlerts();
    }, 5000); // Check every 5 seconds
  }

  private processAlerts(): void {
    const currentMetrics = this.telemetry.getMetrics();
    const currentTime = Date.now();

    for (const rule of this.config.alerts.rules) {
      if (!rule.enabled) continue;

      const state = this.alertState.get(rule.id)!;
      const metricValue = this.extractMetricValue(currentMetrics, rule.metric);
      const shouldTrigger = this.evaluateAlertCondition(rule, metricValue);

      if (shouldTrigger && !state.triggered) {
        // Check if condition has been true for required duration
        if (currentTime - state.lastCheck >= rule.duration) {
          this.triggerAlert(rule);
          state.triggered = true;
        }
      } else if (!shouldTrigger && state.triggered) {
        this.resolveAlert(rule);
        state.triggered = false;
      }

      state.lastCheck = currentTime;
    }
  }

  private evaluateAlertCondition(rule: AlertRule, value: number): boolean {
    switch (rule.condition) {
      case "above":
        return value > rule.threshold;
      case "below":
        return value < rule.threshold;
      case "equals":
        return Math.abs(value - rule.threshold) < 0.001;
      case "change":
        // Would need historical data for change detection
        return false;
      default:
        return false;
    }
  }

  private triggerAlert(rule: AlertRule): void {
    const alert = {
      rule,
      triggeredAt: Date.now(),
      severity: rule.severity,
    };

    this.activeAlerts.push(alert);

    // Send alerts through configured channels
    for (const channel of this.config.alerts.channels) {
      if (channel.enabled) {
        this.sendAlert(channel, rule);
      }
    }

    logger.warn(`Alert triggered: ${rule.name}`);
  }

  private resolveAlert(rule: AlertRule): void {
    const index = this.activeAlerts.findIndex((alert) => alert.rule.id === rule.id);
    if (index > -1) {
      this.activeAlerts.splice(index, 1);
      logger.info(`Alert resolved: ${rule.name}`);
    }
  }

  private sendAlert(channel: AlertChannel, rule: AlertRule): void {
    switch (channel.type) {
      case "console":
        logger.error(`ALERT [${rule.severity.toUpperCase()}]: ${rule.name}`);
        break;

      case "notification":
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(`Alert: ${rule.name}`, {
            body: `${rule.metric} ${rule.condition} ${rule.threshold}`,
            icon: "/alert-icon.png",
          });
        }
        break;

      case "webhook":
        fetch(channel.config.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            alert: rule.name,
            severity: rule.severity,
            metric: rule.metric,
            threshold: rule.threshold,
            timestamp: Date.now(),
          }),
        }).catch((error) => logger.error("Webhook alert failed:", error));
        break;

      default:
        logger.info(`Alert channel ${channel.type} not implemented`);
    }
  }

  // Reporting methods
  public async generateReport(period?: { start: number; end: number }): Promise<AnalyticsReport> {
    const defaultPeriod = {
      start: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
      end: Date.now(),
    };

    const reportPeriod = period || defaultPeriod;
    const metrics = this.telemetry.getMetrics();

    const report: AnalyticsReport = {
      period: reportPeriod,
      summary: this.generateSummary(metrics),
      performance: this.generatePerformanceReport(metrics.performance),
      user: this.generateUserReport(metrics.user),
      system: this.generateSystemReport(metrics.system),
      insights: this.generateInsights(metrics),
      recommendations: this.generateRecommendations(metrics),
    };

    return report;
  }

  private generatePerformanceReport(metrics: PerformanceMetrics): PerformanceReport {
    return {
      avgFPS: metrics.fps,
      avgFrameTime: metrics.frameTime,
      avgMemoryUsage: metrics.memoryUsage,
      renderTimeP95: metrics.renderTime * 1.2, // Estimate
      loadTimeP95: metrics.loadTime * 1.1, // Estimate
      slowestOperations: [], // Would be populated from detailed metrics
    };
  }

  private generateUserReport(metrics: UserMetrics): UserReport {
    return {
      activeUsers: 1, // Would track from session data
      newUsers: 1,
      returningUsers: 0,
      avgActionsPerSession: metrics.actionsPerSession,
      topFeatures: metrics.featuresUsed.map((feature) => ({ feature, usage: 1 })),
      conversionRate: metrics.conversionEvents.length > 0 ? 1 : 0,
      abandonmentRate: 0,
    };
  }

  private generateSystemReport(metrics: SystemMetrics): SystemReport {
    return {
      errorsByType: { general: metrics.errorRate },
      crashRate: metrics.crashRate,
      resourceUtilization: metrics.resourceUsage,
      networkStats: { latency: 0, bandwidth: 0, errors: 0 },
      featureAdoption: metrics.featureUsage,
    };
  }

  private generateInsights(metrics: any): AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = [];

    // Performance insights
    if (metrics.performance.fps < 30) {
      insights.push({
        type: "performance",
        severity: "warning",
        title: "Low FPS Detected",
        description: `Average FPS is ${metrics.performance.fps}, below optimal threshold of 30`,
        data: { fps: metrics.performance.fps },
        timestamp: Date.now(),
      });
    }

    // Memory insights
    if (metrics.performance.memoryUsage > 500) {
      insights.push({
        type: "performance",
        severity: "warning",
        title: "High Memory Usage",
        description: `Memory usage is ${metrics.performance.memoryUsage}MB, approaching limits`,
        data: { memoryUsage: metrics.performance.memoryUsage },
        timestamp: Date.now(),
      });
    }

    // Error rate insights
    if (metrics.system.errorRate > 0.05) {
      insights.push({
        type: "system",
        severity: "critical",
        title: "High Error Rate",
        description: `Error rate is ${(metrics.system.errorRate * 100).toFixed(1)}%, exceeding 5% threshold`,
        data: { errorRate: metrics.system.errorRate },
        timestamp: Date.now(),
      });
    }

    return insights;
  }

  private generateRecommendations(metrics: any): AnalyticsRecommendation[] {
    const recommendations: AnalyticsRecommendation[] = [];

    if (metrics.performance.fps < 60) {
      recommendations.push({
        type: "optimization",
        priority: "high",
        title: "Optimize Rendering Performance",
        description: "Frame rate is below optimal 60 FPS target",
        impact: "Improved user experience and smoother gameplay",
        effort: "medium",
        actionItems: [
          "Profile rendering bottlenecks",
          "Optimize shader complexity",
          "Implement LOD system",
          "Enable occlusion culling",
        ],
      });
    }

    if (metrics.user.featuresUsed.length < 5) {
      recommendations.push({
        type: "feature",
        priority: "medium",
        title: "Improve Feature Discovery",
        description: "Users are utilizing fewer features than expected",
        impact: "Increased user engagement and retention",
        effort: "low",
        actionItems: [
          "Add feature tooltips",
          "Implement guided tours",
          "Improve UI/UX design",
          "Add feature highlights",
        ],
      });
    }

    return recommendations;
  }

  private setupDefaultAlerts(): void {
    const defaultRules: AlertRule[] = [
      {
        id: "low_fps",
        name: "Low FPS",
        metric: "performance.fps",
        condition: "below",
        threshold: 30,
        duration: 10000,
        severity: "medium",
        enabled: true,
      },
      {
        id: "high_memory",
        name: "High Memory Usage",
        metric: "performance.memoryUsage",
        condition: "above",
        threshold: 1000,
        duration: 30000,
        severity: "high",
        enabled: true,
      },
      {
        id: "high_error_rate",
        name: "High Error Rate",
        metric: "system.errorRate",
        condition: "above",
        threshold: 0.1,
        duration: 5000,
        severity: "critical",
        enabled: true,
      },
    ];

    this.config.alerts.rules.push(...defaultRules);

    for (const rule of defaultRules) {
      this.alertState.set(rule.id, { triggered: false, lastCheck: Date.now() });
    }
  }

  private setupDefaultCharts(): void {
    const defaultCharts: ChartConfig[] = [
      {
        id: "fps_chart",
        type: "line",
        title: "FPS Over Time",
        metrics: ["performance.fps"],
        timeRange: 15,
        refreshRate: 5000,
      },
      {
        id: "memory_chart",
        type: "line",
        title: "Memory Usage",
        metrics: ["performance.memoryUsage"],
        timeRange: 30,
        refreshRate: 5000,
      },
      {
        id: "error_rate_gauge",
        type: "gauge",
        title: "Error Rate",
        metrics: ["system.errorRate"],
        timeRange: 5,
        refreshRate: 5000,
      },
    ];

    this.config.dashboard.charts.push(...defaultCharts);
  }

  private setupReporting(): void {
    // Setup periodic reporting based on interval
    // This would typically integrate with a reporting service
    logger.info("Reporting system setup (placeholder)");
  }

  private startDashboardUpdates(): void {
    this.dashboardUpdateTimer = window.setInterval(() => {
      const metrics = this.telemetry.getMetrics();
      const timestamp = Date.now();

      // Store metrics history
      this.metricsHistory.push({ timestamp, metrics });

      // Trim history to max data points
      if (this.metricsHistory.length > this.config.dashboard.maxDataPoints) {
        this.metricsHistory.shift();
      }

      // Notify subscribers
      const dashboardData = this.getDashboardData();
      for (const subscriber of this.subscribers) {
        subscriber(dashboardData);
      }
    }, this.config.dashboard.updateInterval);
  }

  public async dispose(): Promise<void> {
    // Clean up timers
    if (this.dashboardUpdateTimer) {
      clearInterval(this.dashboardUpdateTimer);
    }

    if (this.alertCheckTimer) {
      clearInterval(this.alertCheckTimer);
    }

    // Dispose telemetry
    await this.telemetry.dispose();

    this.isInitialized = false;
    logger.info("AnalyticsManager disposed");
  }
}
