# VTT Monitoring & Alerting Setup

This document describes the comprehensive monitoring and alerting system for the VTT platform.

## Overview

The monitoring stack includes:
- **Prometheus** - Metrics collection and alerting rules
- **Alertmanager** - Alert routing and notifications
- **Grafana** - Dashboards and visualization
- **Blackbox Exporter** - Health check probes
- **Node Exporter** - System metrics
- **Custom Health Monitor** - Application-specific monitoring

## Quick Start

### Start Monitoring Stack

```bash
# Start all monitoring services
npm run monitor:up

# View logs
npm run monitor:logs

# Stop monitoring services
npm run monitor:down
```

### Run Health Checks

```bash
# Continuous monitoring
npm run monitor:health

# Single health check
npm run monitor:health:once
```

## Services & Ports

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| Prometheus | 9090 | http://localhost:9090 | Metrics & alerts |
| Alertmanager | 9093 | http://localhost:9093 | Alert management |
| Grafana | 3001 | http://localhost:3001 | Dashboards |
| Blackbox Exporter | 9115 | http://localhost:9115 | Health probes |
| Node Exporter | 9100 | http://localhost:9100 | System metrics |

## Health Check Endpoints

The VTT API provides several health check endpoints:

### `/api/health`
Comprehensive health check with detailed status:
```json
{
  "status": "healthy|degraded|unhealthy",
  "uptime": 12345678,
  "timestamp": 1672531200000,
  "version": "1.2.0",
  "checks": {
    "database": {
      "status": "pass",
      "responseTime": 50,
      "message": "Database connection healthy"
    },
    "memory": {
      "status": "pass",
      "message": "Memory usage: 45.2%"
    }
  }
}
```

### `/api/health/live`
Kubernetes liveness probe - simple alive check

### `/api/health/ready`
Kubernetes readiness probe - service ready check

### `/api/metrics`
Application metrics in JSON format

### `/api/metrics/prometheus`
Prometheus-compatible metrics format

## Alert Rules

### Critical Alerts
- **VTTAPIDown** - API server is unreachable
- **VTTHealthCheckFailing** - Health endpoint failing
- **VTTDatabaseUnhealthy** - Database health check failing
- **VTTCriticalMemoryUsage** - Memory usage >95%
- **VTTVeryHighResponseTime** - Response time >5 seconds
- **VTTCriticalErrorRate** - Error rate >15%

### Warning Alerts
- **VTTHighMemoryUsage** - Memory usage >85%
- **VTTHighResponseTime** - Response time >2 seconds
- **VTTHighErrorRate** - Error rate >5%
- **VTTWebSocketConnectionsDrop** - Large drop in connections
- **VTTAIServiceHighLatency** - AI service latency >10s

### Security Alerts
- **VTTHighRateLimitHits** - Rate limit violations >100/min
- **VTTHighAuthFailures** - Auth failures >10/min
- **VTTSuspiciousActivity** - Suspicious requests detected

## Alert Routing

Alerts are routed based on severity and service:

- **Critical alerts** → Immediate notification (email, Slack, PagerDuty)
- **Security alerts** → Security team
- **Database alerts** → DBA team
- **AI service alerts** → AI team
- **Infrastructure alerts** → Infrastructure team

## Configuration

### Prometheus Configuration
Located at `infra/monitoring/prometheus.yml`:
- Scrapes VTT server metrics every 30s
- Includes health check probes via Blackbox Exporter
- Loads alert rules from `rules/` directory

### Alertmanager Configuration
Located at `infra/monitoring/alertmanager.yml`:
- Routes alerts by severity and service
- Supports email, Slack, and PagerDuty notifications
- Implements alert inhibition rules

### Health Monitor Configuration
Located at `config/health-monitor.json`:
- Configures endpoints to monitor
- Sets alert thresholds
- Defines notification channels

## Customization

### Adding New Alert Rules

1. Edit `infra/monitoring/rules/vtt-alerts.yml`
2. Add your alert rule:
```yaml
- alert: MyCustomAlert
  expr: my_metric > threshold
  for: 5m
  labels:
    severity: warning
    service: my-service
  annotations:
    summary: "Custom alert fired"
    description: "My metric is above threshold"
```
3. Reload Prometheus: `curl -X POST http://localhost:9090/-/reload`

### Adding Notification Channels

Edit `infra/monitoring/alertmanager.yml` and add new receivers:
```yaml
receivers:
  - name: 'my-team'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/...'
        channel: '#my-alerts'
```

### Custom Health Checks

Add endpoints to `config/health-monitor.json`:
```json
{
  "endpoints": [
    {
      "name": "My Custom Endpoint",
      "url": "/my/endpoint",
      "critical": true
    }
  ]
}
```

## Metrics Available

### Application Metrics
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request duration histogram
- `vtt_websocket_connections_total` - WebSocket connections
- `vtt_active_campaigns_total` - Active campaigns count
- `vtt_ai_requests_total` - AI service requests
- `vtt_database_connections_active` - Database connections

### Health Check Metrics
- `vtt_health_check_database_status` - Database health (1=healthy, 0=unhealthy)
- `vtt_health_check_memory_usage_percent` - Memory usage percentage
- `probe_success` - Health check probe success (1=success, 0=failure)
- `probe_duration_seconds` - Health check probe duration

### System Metrics (via Node Exporter)
- CPU usage, memory, disk, network
- Process metrics
- Filesystem metrics

## Troubleshooting

### Common Issues

**Prometheus not scraping metrics:**
- Check if VTT server is running on port 8080
- Verify `/api/metrics` endpoint is accessible
- Check Prometheus logs: `docker logs vtt-prometheus`

**Alerts not firing:**
- Verify alert rules syntax: `promtool check rules rules/vtt-alerts.yml`
- Check Prometheus targets: http://localhost:9090/targets
- Review alert status: http://localhost:9090/alerts

**Notifications not working:**
- Check Alertmanager configuration
- Verify webhook URLs and credentials
- Review Alertmanager logs: `docker logs vtt-alertmanager`

### Health Monitor Issues

**Connection refused:**
- Ensure VTT server is running
- Check baseUrl in configuration
- Verify network connectivity

**High response times:**
- Check server load and resources
- Review database performance
- Monitor network latency

## Production Deployment

### Environment Variables

Set these environment variables for production:

```bash
# Alertmanager
SMTP_HOST=smtp.example.com
SMTP_USER=alerts@vtt.example.com
SMTP_PASSWORD=your-password
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
PAGERDUTY_INTEGRATION_KEY=your-key

# Health Monitor
VTT_BASE_URL=https://api.vtt.example.com
WEBHOOK_URL=https://your-webhook-endpoint.com
```

### Security Considerations

- Use HTTPS for all external endpoints
- Secure webhook URLs with authentication
- Rotate credentials regularly
- Limit network access to monitoring services
- Enable authentication for Grafana and Prometheus

### High Availability

For production, consider:
- Running multiple Prometheus instances
- Using Prometheus federation
- Deploying Alertmanager in cluster mode
- Setting up external storage for metrics

## Runbooks

Create runbooks for common alerts at:
- `https://docs.vtt.example.com/runbooks/api-down`
- `https://docs.vtt.example.com/runbooks/database-unhealthy`
- `https://docs.vtt.example.com/runbooks/high-memory`

Each runbook should include:
- Alert description and impact
- Investigation steps
- Resolution procedures
- Escalation contacts
