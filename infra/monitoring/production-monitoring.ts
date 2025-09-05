/**
 * Production Monitoring and Alerting System
 * Comprehensive observability for VTT platform
 */

import { createPrometheusRegistry, collectDefaultMetrics } from 'prom-client';
import { WebhookClient } from 'discord.js';
import nodemailer from 'nodemailer';

export interface AlertingConfig {
  discord?: {
    webhookUrl: string;
    mentionRoles?: string[];
  };
  slack?: {
    webhookUrl: string;
    channel: string;
  };
  email?: {
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
    from: string;
    to: string[];
  };
  pagerduty?: {
    integrationKey: string;
  };
}

export interface MonitoringMetrics {
  // System metrics
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  
  // Application metrics
  activeUsers: number;
  concurrentGames: number;
  webSocketConnections: number;
  
  // Performance metrics
  apiResponseTime: number;
  databaseLatency: number;
  errorRate: number;
  
  // Business metrics
  gamesCreated: number;
  charactersCreated: number;
  mapsUploaded: number;
}

export interface AlertRule {
  name: string;
  description: string;
  condition: (metrics: MonitoringMetrics) => boolean;
  severity: 'info' | 'warning' | 'critical';
  cooldownMinutes: number;
  actions: string[];
}

class ProductionMonitor {
  private registry = createPrometheusRegistry();
  private alertingConfig: AlertingConfig;
  private alertRules: AlertRule[];
  private alertCooldowns = new Map<string, number>();
  private discordClient?: WebhookClient;
  private emailTransporter?: nodemailer.Transporter;

  // Prometheus metrics
  private metrics = {
    httpRequestDuration: new this.registry.Histogram({
      name: 'vtt_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    }),
    
    httpRequestsTotal: new this.registry.Counter({
      name: 'vtt_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    }),
    
    websocketConnectionsTotal: new this.registry.Gauge({
      name: 'vtt_websocket_connections_total',
      help: 'Current number of WebSocket connections',
    }),
    
    activeGamesTotal: new this.registry.Gauge({
      name: 'vtt_active_games_total',
      help: 'Current number of active games',
    }),
    
    activeUsersTotal: new this.registry.Gauge({
      name: 'vtt_active_users_total',
      help: 'Current number of active users',
    }),
    
    databaseQueryDuration: new this.registry.Histogram({
      name: 'vtt_database_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['operation', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
    }),
    
    errorRate: new this.registry.Gauge({
      name: 'vtt_error_rate',
      help: 'Application error rate (errors per minute)',
    }),
    
    systemCpuUsage: new this.registry.Gauge({
      name: 'vtt_system_cpu_usage_percent',
      help: 'System CPU usage percentage',
    }),
    
    systemMemoryUsage: new this.registry.Gauge({
      name: 'vtt_system_memory_usage_percent',
      help: 'System memory usage percentage',
    }),
    
    systemDiskUsage: new this.registry.Gauge({
      name: 'vtt_system_disk_usage_percent',
      help: 'System disk usage percentage',
    }),
  };

  constructor(alertingConfig: AlertingConfig) {
    this.alertingConfig = alertingConfig;
    this.initializeAlerting();
    this.setupDefaultAlertRules();
    
    // Collect default Node.js metrics
    collectDefaultMetrics({ register: this.registry, prefix: 'vtt_' });
    
    // Start monitoring loop
    this.startMonitoringLoop();
  }

  private initializeAlerting(): void {
    if (this.alertingConfig.discord?.webhookUrl) {
      this.discordClient = new WebhookClient({ url: this.alertingConfig.discord.webhookUrl });
    }
    
    if (this.alertingConfig.email) {
      this.emailTransporter = nodemailer.createTransporter(this.alertingConfig.email.smtp);
    }
  }

  private setupDefaultAlertRules(): void {
    this.alertRules = [
      {
        name: 'high_cpu_usage',
        description: 'CPU usage above 80%',
        condition: (metrics) => metrics.cpuUsage > 80,
        severity: 'warning',
        cooldownMinutes: 5,
        actions: ['discord', 'email'],
      },
      {
        name: 'critical_cpu_usage',
        description: 'CPU usage above 95%',
        condition: (metrics) => metrics.cpuUsage > 95,
        severity: 'critical',
        cooldownMinutes: 2,
        actions: ['discord', 'email', 'pagerduty'],
      },
      {
        name: 'high_memory_usage',
        description: 'Memory usage above 85%',
        condition: (metrics) => metrics.memoryUsage > 85,
        severity: 'warning',
        cooldownMinutes: 5,
        actions: ['discord', 'email'],
      },
      {
        name: 'critical_memory_usage',
        description: 'Memory usage above 95%',
        condition: (metrics) => metrics.memoryUsage > 95,
        severity: 'critical',
        cooldownMinutes: 1,
        actions: ['discord', 'email', 'pagerduty'],
      },
      {
        name: 'high_error_rate',
        description: 'Error rate above 5%',
        condition: (metrics) => metrics.errorRate > 5,
        severity: 'warning',
        cooldownMinutes: 3,
        actions: ['discord', 'email'],
      },
      {
        name: 'critical_error_rate',
        description: 'Error rate above 15%',
        condition: (metrics) => metrics.errorRate > 15,
        severity: 'critical',
        cooldownMinutes: 1,
        actions: ['discord', 'email', 'pagerduty'],
      },
      {
        name: 'slow_api_responses',
        description: 'Average API response time above 2 seconds',
        condition: (metrics) => metrics.apiResponseTime > 2000,
        severity: 'warning',
        cooldownMinutes: 5,
        actions: ['discord'],
      },
      {
        name: 'very_slow_api_responses',
        description: 'Average API response time above 5 seconds',
        condition: (metrics) => metrics.apiResponseTime > 5000,
        severity: 'critical',
        cooldownMinutes: 2,
        actions: ['discord', 'email', 'pagerduty'],
      },
      {
        name: 'websocket_connection_spike',
        description: 'WebSocket connections above 5000',
        condition: (metrics) => metrics.webSocketConnections > 5000,
        severity: 'info',
        cooldownMinutes: 10,
        actions: ['discord'],
      },
      {
        name: 'low_active_users',
        description: 'Active users dropped below expected minimum',
        condition: (metrics) => metrics.activeUsers < 10 && new Date().getHours() >= 18 && new Date().getHours() <= 23,
        severity: 'warning',
        cooldownMinutes: 30,
        actions: ['discord'],
      },
    ];
  }

  // Express middleware for HTTP metrics
  httpMetricsMiddleware() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = (Date.now() - startTime) / 1000;
        const route = req.route?.path || req.path || 'unknown';
        
        this.metrics.httpRequestDuration.observe(
          { method: req.method, route, status_code: res.statusCode },
          duration
        );
        
        this.metrics.httpRequestsTotal.inc({
          method: req.method,
          route,
          status_code: res.statusCode,
        });
      });
      
      next();
    };
  }

  // Database query metrics
  recordDatabaseQuery(operation: string, table: string, duration: number): void {
    this.metrics.databaseQueryDuration.observe(
      { operation, table },
      duration / 1000
    );
  }

  // WebSocket connection tracking
  updateWebSocketConnections(count: number): void {
    this.metrics.websocketConnectionsTotal.set(count);
  }

  // Game metrics
  updateActiveGames(count: number): void {
    this.metrics.activeGamesTotal.set(count);
  }

  updateActiveUsers(count: number): void {
    this.metrics.activeUsersTotal.set(count);
  }

  // System metrics collection
  private async collectSystemMetrics(): Promise<MonitoringMetrics> {
    // Simulated system metrics - replace with actual system monitoring
    const metrics: MonitoringMetrics = {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      diskUsage: Math.random() * 100,
      activeUsers: Math.floor(Math.random() * 1000),
      concurrentGames: Math.floor(Math.random() * 50),
      webSocketConnections: Math.floor(Math.random() * 2000),
      apiResponseTime: Math.random() * 3000,
      databaseLatency: Math.random() * 100,
      errorRate: Math.random() * 10,
      gamesCreated: Math.floor(Math.random() * 10),
      charactersCreated: Math.floor(Math.random() * 20),
      mapsUploaded: Math.floor(Math.random() * 5),
    };

    // Update Prometheus metrics
    this.metrics.systemCpuUsage.set(metrics.cpuUsage);
    this.metrics.systemMemoryUsage.set(metrics.memoryUsage);
    this.metrics.systemDiskUsage.set(metrics.diskUsage);
    this.metrics.errorRate.set(metrics.errorRate);
    this.metrics.activeUsersTotal.set(metrics.activeUsers);
    this.metrics.activeGamesTotal.set(metrics.concurrentGames);
    this.metrics.websocketConnectionsTotal.set(metrics.webSocketConnections);

    return metrics;
  }

  private startMonitoringLoop(): void {
    setInterval(async () => {
      try {
        const metrics = await this.collectSystemMetrics();
        await this.evaluateAlertRules(metrics);
      } catch (error) {
        console.error('Monitoring loop error:', error);
      }
    }, 30000); // Check every 30 seconds
  }

  private async evaluateAlertRules(metrics: MonitoringMetrics): Promise<void> {
    const now = Date.now();
    
    for (const rule of this.alertRules) {
      const lastAlert = this.alertCooldowns.get(rule.name) || 0;
      const cooldownPeriod = rule.cooldownMinutes * 60 * 1000;
      
      if (rule.condition(metrics) && (now - lastAlert) > cooldownPeriod) {
        await this.triggerAlert(rule, metrics);
        this.alertCooldowns.set(rule.name, now);
      }
    }
  }

  private async triggerAlert(rule: AlertRule, metrics: MonitoringMetrics): Promise<void> {
    console.log(`🚨 Alert triggered: ${rule.name} - ${rule.description}`);
    
    const alertMessage = this.formatAlertMessage(rule, metrics);
    
    for (const action of rule.actions) {
      try {
        switch (action) {
          case 'discord':
            await this.sendDiscordAlert(rule, alertMessage);
            break;
          case 'slack':
            await this.sendSlackAlert(rule, alertMessage);
            break;
          case 'email':
            await this.sendEmailAlert(rule, alertMessage);
            break;
          case 'pagerduty':
            await this.sendPagerDutyAlert(rule, alertMessage);
            break;
        }
      } catch (error) {
        console.error(`Failed to send ${action} alert:`, error);
      }
    }
  }

  private formatAlertMessage(rule: AlertRule, metrics: MonitoringMetrics): string {
    const severityEmoji = {
      info: '🔵',
      warning: '🟡',
      critical: '🔴',
    };
    
    return `${severityEmoji[rule.severity]} **${rule.severity.toUpperCase()}** Alert: ${rule.name}\n\n` +
           `**Description:** ${rule.description}\n\n` +
           `**System Status:**\n` +
           `• CPU Usage: ${metrics.cpuUsage.toFixed(1)}%\n` +
           `• Memory Usage: ${metrics.memoryUsage.toFixed(1)}%\n` +
           `• Active Users: ${metrics.activeUsers}\n` +
           `• Active Games: ${metrics.concurrentGames}\n` +
           `• WebSocket Connections: ${metrics.webSocketConnections}\n` +
           `• API Response Time: ${metrics.apiResponseTime.toFixed(0)}ms\n` +
           `• Error Rate: ${metrics.errorRate.toFixed(1)}%\n\n` +
           `**Time:** ${new Date().toISOString()}\n` +
           `**Environment:** ${process.env.NODE_ENV || 'development'}`;
  }

  private async sendDiscordAlert(rule: AlertRule, message: string): Promise<void> {
    if (!this.discordClient) {return;}
    
    const mentions = this.alertingConfig.discord?.mentionRoles?.map(role => `<@&${role}>`).join(' ') || '';
    
    await this.discordClient.send({
      content: mentions,
      embeds: [{
        title: `VTT Platform Alert: ${rule.name}`,
        description: message,
        color: rule.severity === 'critical' ? 0xFF0000 : rule.severity === 'warning' ? 0xFFA500 : 0x0099FF,
        timestamp: new Date().toISOString(),
        footer: {
          text: 'VTT Production Monitor',
        },
      }],
    });
  }

  private async sendSlackAlert(rule: AlertRule, message: string): Promise<void> {
    if (!this.alertingConfig.slack?.webhookUrl) {return;}
    
    const response = await fetch(this.alertingConfig.slack.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: this.alertingConfig.slack.channel,
        text: `VTT Alert: ${rule.name}`,
        attachments: [{
          color: rule.severity === 'critical' ? 'danger' : rule.severity === 'warning' ? 'warning' : 'good',
          text: message,
          ts: Math.floor(Date.now() / 1000),
        }],
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.statusText}`);
    }
  }

  private async sendEmailAlert(rule: AlertRule, message: string): Promise<void> {
    if (!this.emailTransporter || !this.alertingConfig.email) {return;}
    
    await this.emailTransporter.sendMail({
      from: this.alertingConfig.email.from,
      to: this.alertingConfig.email.to.join(', '),
      subject: `VTT ${rule.severity.toUpperCase()} Alert: ${rule.name}`,
      text: message,
      html: `<pre>${message.replace(/\n/g, '<br>')}</pre>`,
    });
  }

  private async sendPagerDutyAlert(rule: AlertRule, message: string): Promise<void> {
    if (!this.alertingConfig.pagerduty?.integrationKey) {return;}
    
    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing_key: this.alertingConfig.pagerduty.integrationKey,
        event_action: 'trigger',
        dedup_key: `vtt_alert_${rule.name}`,
        payload: {
          summary: `VTT ${rule.severity.toUpperCase()}: ${rule.description}`,
          severity: rule.severity,
          source: 'VTT Production Monitor',
          custom_details: message,
        },
      }),
    });
    
    if (!response.ok) {
      throw new Error(`PagerDuty alert failed: ${response.statusText}`);
    }
  }

  // Health check endpoint
  getHealthStatus(): object {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  // Prometheus metrics endpoint
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  // Manual alert testing
  async testAlert(ruleName: string): Promise<void> {
    const rule = this.alertRules.find(r => r.name === ruleName);
    if (!rule) {
      throw new Error(`Alert rule '${ruleName}' not found`);
    }
    
    const testMetrics = await this.collectSystemMetrics();
    await this.triggerAlert(rule, testMetrics);
  }
}

export default ProductionMonitor;

// Example configuration
export const EXAMPLE_MONITORING_CONFIG: AlertingConfig = {
  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
    mentionRoles: ['123456789012345678'], // Replace with actual role IDs
  },
  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    },
    from: process.env.ALERT_FROM_EMAIL || 'alerts@vtt-platform.com',
    to: (process.env.ALERT_TO_EMAILS || '').split(','),
  },
  pagerduty: {
    integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY || '',
  },
};
