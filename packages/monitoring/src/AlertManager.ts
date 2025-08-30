/**
 * Production alerting system for VTT monitoring
 */

import { EventEmitter } from "events";
import { logger } from "@vtt/logging";
import * as nodemailer from "nodemailer";
import { MetricsRegistry } from "./metrics";
import { HealthCheckResult, HealthStatus } from "./HealthCheck";

export type AlertSeverity = "info" | "warning" | "critical";

export interface Alert {
  id: string;
  name: string;
  severity: AlertSeverity;
  message: string;
  source: string;
  timestamp: Date;
  resolved?: Date;
  metadata?: Record<string, any>;
}

export interface AlertRule {
  name: string;
  description: string;
  condition: AlertCondition;
  severity: AlertSeverity;
  enabled: boolean;
  cooldownMs: number;
  recipients: string[];
}

export interface AlertCondition {
  type: "metric" | "health" | "log" | "custom";
  evaluate(context: AlertContext): Promise<boolean>;
}

export interface AlertContext {
  metrics: MetricsRegistry;
  healthResults: HealthCheckResult[];
  currentTime: Date;
  metadata?: Record<string, any>;
}

export interface NotificationChannel {
  name: string;
  send(alert: Alert): Promise<boolean>;
}

export interface AlertManagerConfig {
  rules: AlertRule[];
  channels: NotificationChannel[];
  checkInterval: number;
  retentionDays: number;
}

export class AlertManager extends EventEmitter {
  private config: AlertManagerConfig;
  private activeAlerts = new Map<string, Alert>();
  private alertHistory: Alert[] = [];
  private ruleLastTriggered = new Map<string, number>();
  private intervalId: NodeJS.Timeout | undefined = undefined;
  private metricsRegistry: MetricsRegistry;

  constructor(config: AlertManagerConfig, metricsRegistry: MetricsRegistry) {
    super();
    this.config = config;
    this.metricsRegistry = metricsRegistry;
  }

  start(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(async () => {
      await this.evaluateAlerts();
    }, this.config.checkInterval);

    this.emit("started");
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.emit("stopped");
  }

  private async evaluateAlerts(): Promise<void> {
    const context: AlertContext = {
      metrics: this.metricsRegistry,
      healthResults: [], // Would be populated from health check manager
      currentTime: new Date(),
    };

    for (const rule of this.config.rules) {
      if (!rule.enabled) continue;

      try {
        const shouldAlert = await rule.condition.evaluate(context);

        if (shouldAlert) {
          await this.handleAlertTriggered(rule, context);
        } else {
          await this.handleAlertResolved(rule);
        }
      } catch (error) {
        logger.error(`Error evaluating alert rule ${rule.name}:`, {
          error: error instanceof Error ? error.message : String(error),
        });
        this.emit("ruleError", rule.name, error);
      }
    }

    this.cleanupOldAlerts();
  }

  private async handleAlertTriggered(rule: AlertRule, context: AlertContext): Promise<void> {
    const alertKey = this.getAlertKey(rule);
    const lastTriggered = this.ruleLastTriggered.get(rule.name) || 0;
    const now = Date.now();

    // Check cooldown
    if (now - lastTriggered < rule.cooldownMs) {
      return;
    }

    // Check if alert is already active
    if (this.activeAlerts.has(alertKey)) {
      return;
    }

    const alert: Alert = {
      id: this.generateAlertId(),
      name: rule.name,
      severity: rule.severity,
      message: this.buildAlertMessage(rule, context),
      source: "alert-manager",
      timestamp: context.currentTime,
      metadata: { rule: rule.name },
    };

    this.activeAlerts.set(alertKey, alert);
    this.alertHistory.push(alert);
    this.ruleLastTriggered.set(rule.name, now);

    await this.sendNotifications(alert, rule.recipients);
    this.emit("alertTriggered", alert);
  }

  private async handleAlertResolved(rule: AlertRule): Promise<void> {
    const alertKey = this.getAlertKey(rule);
    const activeAlert = this.activeAlerts.get(alertKey);

    if (activeAlert && !activeAlert.resolved) {
      activeAlert.resolved = new Date();
      this.activeAlerts.delete(alertKey);

      await this.sendResolutionNotifications(activeAlert, rule.recipients);
      this.emit("alertResolved", activeAlert);
    }
  }

  private async sendNotifications(alert: Alert, _recipients: string[]): Promise<void> {
    const promises = this.config.channels.map(async (channel) => {
      try {
        await channel.send(alert);
        this.emit("notificationSent", alert.id, channel.name);
      } catch (error) {
        logger.error(`Failed to send notification via ${channel.name}:`, {
          error: error instanceof Error ? error.message : String(error),
        });
        this.emit("notificationFailed", alert.id, channel.name, error);
      }
    });

    await Promise.allSettled(promises);
  }

  private async sendResolutionNotifications(alert: Alert, recipients: string[]): Promise<void> {
    const resolutionAlert = {
      ...alert,
      message: `RESOLVED: ${alert.message}`,
      severity: "info" as AlertSeverity,
    };

    await this.sendNotifications(resolutionAlert, recipients);
  }

  private buildAlertMessage(rule: AlertRule, context: AlertContext): string {
    return `Alert: ${rule.description} at ${context.currentTime.toISOString()}`;
  }

  private getAlertKey(rule: AlertRule): string {
    return `${rule.name}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private cleanupOldAlerts(): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.retentionDays);

    this.alertHistory = this.alertHistory.filter((alert) => alert.timestamp >= cutoff);
  }

  // Public API methods
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  getAlertHistory(limit = 100): Alert[] {
    return this.alertHistory
      .sort((_a, _b) => _b.timestamp.getTime() - _a.timestamp.getTime())
      .slice(0, limit);
  }

  acknowledgeAlert(alertId: string, userId: string): boolean {
    for (const alert of this.activeAlerts.values()) {
      if (alert.id === alertId) {
        alert.metadata = {
          ...alert.metadata,
          acknowledgedBy: userId,
          acknowledgedAt: new Date(),
        };
        this.emit("alertAcknowledged", alert, userId);
        return true;
      }
    }
    return false;
  }

  silenceAlert(ruleName: string, durationMs: number): void {
    const until = Date.now() + durationMs;
    this.ruleLastTriggered.set(ruleName, until);
    this.emit("alertSilenced", ruleName, durationMs);
  }

  addRule(rule: AlertRule): void {
    this.config.rules.push(rule);
    this.emit("ruleAdded", rule.name);
  }

  updateRule(ruleName: string, updates: Partial<AlertRule>): boolean {
    const ruleIndex = this.config.rules.findIndex((r) => r.name === ruleName);
    if (ruleIndex !== -1) {
      const currentRule = this.config.rules[ruleIndex];
      if (!currentRule) return false;

      this.config.rules[ruleIndex] = {
        name: currentRule.name,
        description: currentRule.description,
        condition: currentRule.condition,
        severity: currentRule.severity,
        enabled: currentRule.enabled,
        cooldownMs: currentRule.cooldownMs,
        recipients: currentRule.recipients,
        ...updates,
      };
      this.emit("ruleUpdated", ruleName);
      return true;
    }
    return false;
  }

  removeRule(ruleName: string): boolean {
    const ruleIndex = this.config.rules.findIndex((r) => r.name === ruleName);
    if (ruleIndex !== -1) {
      this.config.rules.splice(ruleIndex, 1);
      this.emit("ruleRemoved", ruleName);
      return true;
    }
    return false;
  }
}

// Predefined alert conditions
export class MetricThresholdCondition implements AlertCondition {
  readonly type = "metric" as const;

  constructor(
    private metricName: string,
    private threshold: number,
    private operator: ">" | "<" | ">=" | "<=" | "==" | "!=",
    private timeWindowMs?: number,
  ) {}

  async evaluate(context: AlertContext): Promise<boolean> {
    const metric = context.metrics.getMetric(this.metricName);
    if (!metric || metric.values.length === 0) {
      return false;
    }

    let values = metric.values;

    if (this.timeWindowMs) {
      const cutoff = new Date(context.currentTime.getTime() - this.timeWindowMs);
      values = values.filter((v) => v.timestamp >= cutoff);
    }

    if (values.length === 0) {
      return false;
    }

    const latestValue = values[values.length - 1]?.value;
    if (latestValue === undefined) return false;

    switch (this.operator) {
      case ">":
        return latestValue > this.threshold;
      case "<":
        return latestValue < this.threshold;
      case ">=":
        return latestValue >= this.threshold;
      case "<=":
        return latestValue <= this.threshold;
      case "==":
        return latestValue === this.threshold;
      case "!=":
        return latestValue !== this.threshold;
      default:
        return false;
    }
  }
}

export class HealthCheckCondition implements AlertCondition {
  type = "health" as const;

  constructor(
    private checkName: string,
    private expectedStatus: HealthStatus,
  ) {}

  async evaluate(context: AlertContext): Promise<boolean> {
    const healthResult = context.healthResults.find((r) => r.name === this.checkName);
    if (!healthResult) {
      return true; // Alert if health check is missing
    }

    return healthResult.status !== this.expectedStatus;
  }
}

export class ErrorRateCondition implements AlertCondition {
  type = "metric" as const;

  constructor(
    private errorMetric: string,
    private totalMetric: string,
    private thresholdPercent: number,
    private timeWindowMs: number = 5 * 60 * 1000, // 5 minutes
  ) {}

  async evaluate(context: AlertContext): Promise<boolean> {
    const errorMetric = context.metrics.getMetric(this.errorMetric);
    const totalMetric = context.metrics.getMetric(this.totalMetric);

    if (!errorMetric || !totalMetric || !errorMetric.values || !totalMetric.values) {
      return false;
    }

    const cutoff = new Date(context.currentTime.getTime() - this.timeWindowMs);

    const errorValues = errorMetric.values.filter((v) => v.timestamp >= cutoff);
    const totalValues = totalMetric.values.filter((v) => v.timestamp >= cutoff);

    if (errorValues.length === 0 || totalValues.length === 0) {
      return false;
    }

    const errorCount = errorValues[errorValues.length - 1]?.value ?? 0;
    const totalCount = totalValues[totalValues.length - 1]?.value ?? 0;

    if (totalCount === 0) {
      return false;
    }

    const errorRate = (errorCount / totalCount) * 100;
    return errorRate > this.thresholdPercent;
  }
}

// Notification channels
export class EmailNotificationChannel implements NotificationChannel {
  name = "email";
  private transporter: nodemailer.Transporter;

  constructor(
    private smtpConfig: nodemailer.TransportOptions,
    private fromAddress: string,
  ) {
    this.transporter = nodemailer.createTransport(this.smtpConfig);
  }

  async send(alert: Alert): Promise<boolean> {
    try {
      const subject = `[${alert.severity.toUpperCase()}] ${alert.name}`;
      const html = this.buildEmailContent(alert);

      await this.transporter.sendMail({
        from: this.fromAddress,
        to: alert.metadata?.recipients || [],
        subject,
        html,
      });

      return true;
    } catch (error) {
      logger.error("Failed to send email notification:", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private buildEmailContent(alert: Alert): string {
    const severityColor = {
      info: "#2196F3",
      warning: "#FF9800",
      critical: "#F44336",
    }[alert.severity];

    return `
      <html>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto;">
            <div style="background: ${severityColor}; color: white; padding: 15px; border-radius: 5px 5px 0 0;">
              <h2 style="margin: 0;">${alert.severity.toUpperCase()} Alert</h2>
            </div>
            <div style="border: 1px solid #ddd; border-top: none; padding: 20px; border-radius: 0 0 5px 5px;">
              <h3>${alert.name}</h3>
              <p><strong>Message:</strong> ${alert.message}</p>
              <p><strong>Time:</strong> ${alert.timestamp.toISOString()}</p>
              <p><strong>Source:</strong> ${alert.source}</p>
              ${alert.metadata ? `<p><strong>Details:</strong> ${JSON.stringify(alert.metadata, null, 2)}</p>` : ""}
            </div>
          </div>
        </body>
      </html>
    `;
  }
}

export class SlackNotificationChannel implements NotificationChannel {
  name = "slack";

  constructor(private webhookUrl: string) {}

  async send(alert: Alert): Promise<boolean> {
    try {
      const color = {
        info: "#36a64f",
        warning: "#ff9800",
        critical: "#ff4444",
      }[alert.severity];

      const payload = {
        attachments: [
          {
            color,
            title: `${alert.severity.toUpperCase()}: ${alert.name}`,
            text: alert.message,
            fields: [
              { title: "Time", value: alert.timestamp.toISOString(), short: true },
              { title: "Source", value: alert.source, short: true },
            ],
            footer: "VTT Monitoring",
            ts: Math.floor(alert.timestamp.getTime() / 1000),
          },
        ],
      };

      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      return response.ok;
    } catch (error) {
      logger.error("Failed to send Slack notification:", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}

export class WebhookNotificationChannel implements NotificationChannel {
  name = "webhook";

  constructor(
    private url: string,
    private headers: Record<string, string> = {},
  ) {}

  async send(alert: Alert): Promise<boolean> {
    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.headers,
        },
        body: JSON.stringify(alert),
      });

      return response.ok;
    } catch (error) {
      logger.error("Failed to send webhook notification:", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
