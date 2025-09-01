#!/usr/bin/env node

/**
 * VTT Health Check Monitor
 * Monitors VTT API health endpoints and sends alerts
 * Usage: node scripts/health-monitor.js [--config config.json] [--once]
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

class HealthMonitor {
  constructor(config) {
    this.config = {
      endpoints: [
        { name: 'Health Check', url: '/api/health', critical: true },
        { name: 'Liveness', url: '/api/health/live', critical: true },
        { name: 'Readiness', url: '/api/health/ready', critical: true },
        { name: 'Metrics', url: '/api/metrics', critical: false },
        { name: 'Prometheus Metrics', url: '/api/metrics/prometheus', critical: false }
      ],
      baseUrl: 'http://localhost:8080',
      timeout: 10000,
      interval: 30000, // 30 seconds
      retries: 3,
      alertThresholds: {
        responseTime: 5000, // 5 seconds
        errorRate: 0.1, // 10%
        consecutiveFailures: 3
      },
      notifications: {
        webhook: null,
        email: null,
        slack: null
      },
      ...config
    };
    
    this.stats = new Map();
    this.alertState = new Map();
    this.isRunning = false;
  }

  async checkEndpoint(endpoint) {
    const startTime = Date.now();
    const url = new URL(endpoint.url, this.config.baseUrl);
    
    return new Promise((resolve) => {
      const client = url.protocol === 'https:' ? https : http;
      
      const req = client.request(url, {
        method: 'GET',
        timeout: this.config.timeout,
        headers: {
          'User-Agent': 'VTT-Health-Monitor/1.0'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          const success = res.statusCode >= 200 && res.statusCode < 400;
          
          resolve({
            success,
            statusCode: res.statusCode,
            responseTime,
            data: data.length > 0 ? data : null,
            error: null
          });
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          statusCode: null,
          responseTime: Date.now() - startTime,
          data: null,
          error: error.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          statusCode: null,
          responseTime: this.config.timeout,
          data: null,
          error: 'Request timeout'
        });
      });

      req.end();
    });
  }

  async checkAllEndpoints() {
    const results = [];
    
    for (const endpoint of this.config.endpoints) {
      let result = null;
      let attempts = 0;
      
      // Retry logic
      while (attempts < this.config.retries && (!result || !result.success)) {
        if (attempts > 0) {
          await this.sleep(1000); // Wait 1 second between retries
        }
        result = await this.checkEndpoint(endpoint);
        attempts++;
      }
      
      result.endpoint = endpoint;
      result.attempts = attempts;
      results.push(result);
      
      // Update statistics
      this.updateStats(endpoint.name, result);
      
      // Check for alerts
      await this.checkAlerts(endpoint, result);
    }
    
    return results;
  }

  updateStats(endpointName, result) {
    if (!this.stats.has(endpointName)) {
      this.stats.set(endpointName, {
        totalChecks: 0,
        successCount: 0,
        failureCount: 0,
        totalResponseTime: 0,
        consecutiveFailures: 0,
        lastSuccess: null,
        lastFailure: null,
        avgResponseTime: 0
      });
    }
    
    const stats = this.stats.get(endpointName);
    stats.totalChecks++;
    stats.totalResponseTime += result.responseTime;
    stats.avgResponseTime = stats.totalResponseTime / stats.totalChecks;
    
    if (result.success) {
      stats.successCount++;
      stats.consecutiveFailures = 0;
      stats.lastSuccess = new Date();
    } else {
      stats.failureCount++;
      stats.consecutiveFailures++;
      stats.lastFailure = new Date();
    }
    
    this.stats.set(endpointName, stats);
  }

  async checkAlerts(endpoint, result) {
    const alertKey = endpoint.name;
    const stats = this.stats.get(endpoint.name);
    
    // Check for consecutive failures
    if (stats.consecutiveFailures >= this.config.alertThresholds.consecutiveFailures) {
      if (!this.alertState.has(alertKey + '_failures')) {
        await this.sendAlert({
          type: 'consecutive_failures',
          endpoint: endpoint.name,
          severity: endpoint.critical ? 'critical' : 'warning',
          message: `${endpoint.name} has failed ${stats.consecutiveFailures} consecutive times`,
          details: {
            lastError: result.error,
            statusCode: result.statusCode,
            responseTime: result.responseTime
          }
        });
        this.alertState.set(alertKey + '_failures', Date.now());
      }
    } else {
      // Clear alert if endpoint is now healthy
      if (this.alertState.has(alertKey + '_failures')) {
        await this.sendAlert({
          type: 'recovery',
          endpoint: endpoint.name,
          severity: 'info',
          message: `${endpoint.name} has recovered`,
          details: {
            statusCode: result.statusCode,
            responseTime: result.responseTime
          }
        });
        this.alertState.delete(alertKey + '_failures');
      }
    }
    
    // Check for high response time
    if (result.success && result.responseTime > this.config.alertThresholds.responseTime) {
      const alertKey2 = alertKey + '_slow';
      if (!this.alertState.has(alertKey2)) {
        await this.sendAlert({
          type: 'high_response_time',
          endpoint: endpoint.name,
          severity: 'warning',
          message: `${endpoint.name} response time is high: ${result.responseTime}ms`,
          details: {
            responseTime: result.responseTime,
            threshold: this.config.alertThresholds.responseTime
          }
        });
        this.alertState.set(alertKey2, Date.now());
      }
    }
  }

  async sendAlert(alert) {
    const timestamp = new Date().toISOString();
    const alertMessage = {
      timestamp,
      service: 'vtt-health-monitor',
      ...alert
    };
    
    console.log(`🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);
    
    // Send to configured notification channels
    if (this.config.notifications.webhook) {
      await this.sendWebhookAlert(alertMessage);
    }
    
    if (this.config.notifications.slack) {
      await this.sendSlackAlert(alertMessage);
    }
    
    // Log to file
    await this.logAlert(alertMessage);
  }

  async sendWebhookAlert(alert) {
    try {
      const url = new URL(this.config.notifications.webhook);
      const client = url.protocol === 'https:' ? https : http;
      
      const data = JSON.stringify(alert);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };
      
      return new Promise((resolve, reject) => {
        const req = client.request(options, (res) => {
          resolve(res.statusCode < 400);
        });
        
        req.on('error', reject);
        req.write(data);
        req.end();
      });
    } catch (error) {
      console.error('Failed to send webhook alert:', error.message);
    }
  }

  async sendSlackAlert(alert) {
    if (!this.config.notifications.slack?.webhook) return;
    
    try {
      const color = {
        critical: 'danger',
        warning: 'warning',
        info: 'good'
      }[alert.severity] || 'warning';
      
      const slackMessage = {
        text: `VTT Health Monitor Alert`,
        attachments: [{
          color,
          title: alert.message,
          fields: [
            { title: 'Endpoint', value: alert.endpoint, short: true },
            { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
            { title: 'Time', value: alert.timestamp, short: false }
          ]
        }]
      };
      
      await this.sendWebhookAlert(slackMessage);
    } catch (error) {
      console.error('Failed to send Slack alert:', error.message);
    }
  }

  async logAlert(alert) {
    const logDir = path.join(__dirname, '../logs');
    const logFile = path.join(logDir, 'health-alerts.log');
    
    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      const logEntry = `${alert.timestamp} [${alert.severity.toUpperCase()}] ${alert.endpoint}: ${alert.message}\n`;
      fs.appendFileSync(logFile, logEntry);
    } catch (error) {
      console.error('Failed to log alert:', error.message);
    }
  }

  printStatus(results) {
    console.log('\n📊 VTT Health Check Status');
    console.log('=' .repeat(50));
    
    for (const result of results) {
      const status = result.success ? '✅' : '❌';
      const responseTime = `${result.responseTime}ms`;
      const attempts = result.attempts > 1 ? ` (${result.attempts} attempts)` : '';
      
      console.log(`${status} ${result.endpoint.name}: ${responseTime}${attempts}`);
      
      if (!result.success) {
        console.log(`   Error: ${result.error || 'HTTP ' + result.statusCode}`);
      }
    }
    
    // Print statistics
    console.log('\n📈 Statistics:');
    for (const [name, stats] of this.stats) {
      const successRate = ((stats.successCount / stats.totalChecks) * 100).toFixed(1);
      console.log(`   ${name}: ${successRate}% success, ${stats.avgResponseTime.toFixed(0)}ms avg`);
    }
    
    console.log(`\nLast check: ${new Date().toISOString()}`);
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log(`🚀 Starting VTT Health Monitor`);
    console.log(`   Base URL: ${this.config.baseUrl}`);
    console.log(`   Check interval: ${this.config.interval}ms`);
    console.log(`   Monitoring ${this.config.endpoints.length} endpoints`);
    
    while (this.isRunning) {
      try {
        const results = await this.checkAllEndpoints();
        this.printStatus(results);
      } catch (error) {
        console.error('Health check error:', error.message);
      }
      
      if (this.isRunning) {
        await this.sleep(this.config.interval);
      }
    }
  }

  stop() {
    this.isRunning = false;
    console.log('\n👋 Stopping VTT Health Monitor');
  }

  async runOnce() {
    console.log('🔍 Running single health check...');
    const results = await this.checkAllEndpoints();
    this.printStatus(results);
    
    const allHealthy = results.every(r => r.success);
    process.exit(allHealthy ? 0 : 1);
  }
}

// CLI handling
async function main() {
  const args = process.argv.slice(2);
  const configPath = args.includes('--config') ? args[args.indexOf('--config') + 1] : null;
  const runOnce = args.includes('--once');
  
  let config = {};
  if (configPath && fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  
  const monitor = new HealthMonitor(config);
  
  if (runOnce) {
    await monitor.runOnce();
  } else {
    // Handle graceful shutdown
    process.on('SIGINT', () => monitor.stop());
    process.on('SIGTERM', () => monitor.stop());
    
    await monitor.start();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = HealthMonitor;
