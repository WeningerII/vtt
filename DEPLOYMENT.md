# VTT Production Deployment Guide

## Overview

This guide covers deploying the Virtual Tabletop system to production using Docker Compose with comprehensive security, monitoring, and performance optimizations.

## Prerequisites

- Docker 24.0+ and Docker Compose v2
- Domain names configured (e.g., `vtt.yourdomain.com`, `api.yourdomain.com`)
- SSL certificates for HTTPS
- Linux server with minimum 4GB RAM, 2 CPU cores, 50GB storage

## Quick Start

1. **Clone and prepare environment:**
```bash
git clone <your-vtt-repo>
cd vtt
cp .env.production .env.production.local
# Edit .env.production.local with your actual values
```

2. **Generate SSL certificates:**
```bash
# Using Let's Encrypt (recommended)
sudo certbot certonly --standalone -d vtt.yourdomain.com -d api.yourdomain.com

# Copy certificates to the expected location
sudo cp /etc/letsencrypt/live/vtt.yourdomain.com/fullchain.pem ./certs/vtt.yourdomain.com.crt
sudo cp /etc/letsencrypt/live/vtt.yourdomain.com/privkey.pem ./certs/vtt.yourdomain.com.key
sudo cp /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem ./certs/api.yourdomain.com.crt
sudo cp /etc/letsencrypt/live/api.yourdomain.com/privkey.pem ./certs/api.yourdomain.com.key
sudo chown -R $(whoami):$(whoami) ./certs/
```

3. **Deploy the application:**
```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d

# Initialize the database
docker-compose -f docker-compose.prod.yml exec server pnpm db:migrate:deploy
docker-compose -f docker-compose.prod.yml exec server pnpm db:seed
```

## Architecture

```
[Internet] → [Nginx Reverse Proxy] → [VTT Client + Server]
                      ↓
[PostgreSQL] ← [Redis Cache] ← [VTT Server API]
                      ↓
[Prometheus + Grafana Monitoring]
```

## Security Features

### Application Security
- **Input Validation**: Comprehensive validation with XSS and SQL injection protection
- **Rate Limiting**: API endpoint protection with configurable limits
- **Authentication**: JWT-based auth with role-based access control
- **Threat Protection**: Real-time threat detection and automated responses

### Infrastructure Security
- **HTTPS Only**: TLS 1.2/1.3 with secure cipher suites
- **Security Headers**: HSTS, CSP, X-Frame-Options, etc.
- **Container Security**: Non-root users, read-only filesystems where possible
- **Network Isolation**: Internal Docker network with restricted access

### Monitoring & Observability
- **Application Metrics**: Custom business metrics and performance indicators
- **System Metrics**: CPU, memory, disk, network monitoring
- **Security Monitoring**: Failed login attempts, rate limit violations
- **Real-time Alerts**: Grafana dashboards with alert rules

## Configuration Reference

### Environment Variables

#### Core Application
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@postgres:5432/vtt_prod
REDIS_URL=redis://:password@redis:6379
JWT_SECRET=your-jwt-secret
```

#### Security Settings
```bash
RATE_LIMIT_MAX=1000           # Requests per window
RATE_LIMIT_WINDOW=900000      # Window in milliseconds (15 min)
UPLOAD_MAX_SIZE=50mb          # Maximum file upload size
CORS_ORIGIN=https://vtt.yourdomain.com
```

#### Performance Tuning
```bash
WORKER_PROCESSES=auto         # Nginx worker processes
MAX_CONNECTIONS=1024          # Nginx max connections
KEEPALIVE_TIMEOUT=65          # Connection keepalive
```

### Service Configuration

#### PostgreSQL
- **Version**: 16-alpine
- **Memory**: Optimized for workload
- **Backups**: Automated daily backups
- **Replication**: Master-slave setup for high availability

#### Redis
- **Version**: 7-alpine  
- **Memory Policy**: allkeys-lru with 256MB limit
- **Persistence**: RDB snapshots enabled
- **Security**: Password authentication required

#### Nginx
- **HTTP/2**: Enabled with SSL
- **Compression**: Gzip for static assets
- **Caching**: Static asset caching with proper headers
- **Rate Limiting**: Multiple zones for different endpoint types

## Monitoring Setup

### Prometheus Metrics

**System Metrics:**
- CPU usage, memory consumption, disk I/O
- Network traffic and connection counts
- Container resource utilization

**Application Metrics:**
- Request rates and response times
- Database connection pool status
- Cache hit/miss ratios
- WebSocket connection counts

**Business Metrics:**
- Active user sessions
- Scene creation/modification rates
- File upload success/failure rates
- Authentication success/failure rates

### Grafana Dashboards

**Infrastructure Dashboard:**
- System resource utilization
- Container health and status
- Network and disk performance

**Application Dashboard:**
- API response times and error rates
- User activity and session metrics
- Real-time connection monitoring

**Security Dashboard:**
- Failed authentication attempts
- Rate limiting violations
- Threat detection alerts
- Suspicious activity patterns

## Maintenance & Operations

### Regular Maintenance Tasks

**Daily:**
- Check system resource usage
- Review security logs for anomalies
- Verify backup completion

**Weekly:**  
- Update Docker images for security patches
- Review and rotate logs
- Performance optimization review

**Monthly:**
- SSL certificate renewal check
- Database maintenance and optimization
- Security audit and penetration testing

### Backup Strategy

**Database Backups:**
```bash
# Automated daily backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U vtt_user vtt_prod > backup_$(date +%Y%m%d).sql

# Restore from backup
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U vtt_user vtt_prod < backup_20240101.sql
```

**File Uploads Backup:**
```bash
# Backup uploaded assets
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/

# Sync to remote storage (recommended)
rsync -av uploads/ user@backup-server:/backups/vtt/uploads/
```

### Scaling Considerations

**Horizontal Scaling:**
- Load balancer with multiple server instances
- Database read replicas for query performance
- Redis Cluster for distributed caching
- CDN for static asset delivery

**Vertical Scaling:**
- Increase container resource limits
- Optimize database configuration
- Tune Nginx worker processes
- Implement connection pooling

## Troubleshooting

### Common Issues

**High Memory Usage:**
```bash
# Check container memory usage
docker stats

# Optimize database queries
docker-compose -f docker-compose.prod.yml exec server pnpm db:analyze
```

**SSL Certificate Issues:**
```bash
# Test certificate validity
openssl x509 -in ./certs/vtt.yourdomain.com.crt -text -noout

# Renew certificates
sudo certbot renew --dry-run
```

**Database Connection Problems:**
```bash
# Check database connectivity
docker-compose -f docker-compose.prod.yml exec postgres psql -U vtt_user -d vtt_prod -c "SELECT 1;"

# Monitor connection pool
docker-compose -f docker-compose.prod.yml logs server | grep "pool"
```

### Performance Optimization

**Database Optimization:**
- Regular VACUUM and ANALYZE operations
- Index optimization for frequently queried data
- Connection pool tuning based on load

**Caching Strategy:**
- Redis for session storage and temporary data
- Nginx caching for static assets
- Application-level caching for expensive operations

**Network Optimization:**
- Enable HTTP/2 and compression
- Optimize image sizes and formats
- Implement lazy loading for large datasets

## Security Checklist

- [ ] SSL certificates installed and auto-renewal configured
- [ ] Security headers properly configured in Nginx
- [ ] Database and Redis passwords set to strong values
- [ ] JWT secrets are cryptographically secure
- [ ] File upload restrictions and scanning enabled
- [ ] Rate limiting configured for all endpoints
- [ ] Container security scanning completed
- [ ] Regular security audits scheduled
- [ ] Monitoring and alerting for security events
- [ ] Backup and disaster recovery procedures tested

## Support

For deployment issues or questions:
1. Check the application logs: `docker-compose -f docker-compose.prod.yml logs`
2. Review monitoring dashboards in Grafana
3. Consult the troubleshooting section above
4. Contact the development team with specific error messages
