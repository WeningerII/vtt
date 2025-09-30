# Environment Variables Documentation

This document lists all required and optional environment variables for the VTT platform.

## Critical Security Notice

**⚠️ NEVER commit real secrets to version control!**

- Use `.env` for local development (gitignored)
- Use secure secret management for production (e.g., AWS Secrets Manager, HashiCorp Vault)
- All production secrets MUST be set via environment - no fallback defaults

---

## Quick Start

```bash
# Copy the example file
cp .env.example .env

# Edit with your values
nano .env
```

---

## Database Configuration

### `DATABASE_URL` ⚠️ **REQUIRED**

PostgreSQL connection string.

**Format:** `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public`

**Example:**
```bash
# Development
DATABASE_URL="postgresql://dev:dev@localhost:5432/vtt?schema=public"

# Production (use secrets manager)
DATABASE_URL="postgresql://prod_user:${DB_PASSWORD}@db.example.com:5432/vtt_prod?schema=public&sslmode=require"
```

**Required for:** Database connections, Prisma ORM

---

## Redis Configuration

### `REDIS_URL` ⚠️ **REQUIRED for production**

Redis connection string for caching and session storage.

**Format:** `redis://[:PASSWORD@]HOST:PORT[/DATABASE]`

**Example:**
```bash
# Development
REDIS_URL="redis://:devpass@localhost:6379"

# Production with TLS
REDIS_URL="rediss://:${REDIS_PASSWORD}@redis.example.com:6380/0"
```

**Required for:** Rate limiting, session storage, caching

---

## Object Storage (MinIO/S3)

### `MINIO_ENDPOINT` (Optional)

MinIO server endpoint for asset storage.

**Default:** `http://localhost:9000`

**Example:**
```bash
# Development
MINIO_ENDPOINT="http://localhost:9000"

# Production S3
MINIO_ENDPOINT="https://s3.amazonaws.com"
```

### `MINIO_ROOT_USER` (Optional)

MinIO/S3 access key ID.

**Default:** `dev`

### `MINIO_ROOT_PASSWORD` (Optional)

MinIO/S3 secret access key.

**Default:** `devpass`

### `MINIO_CONSOLE` (Optional)

MinIO console UI endpoint.

**Default:** `http://localhost:9090`

---

## Server Configuration

### `PORT` (Optional)

HTTP server port.

**Default:** `8080`

**Example:**
```bash
PORT=3001
```

### `NODE_ENV` ⚠️ **REQUIRED for production**

Runtime environment.

**Values:** `development` | `production` | `test`

**Default:** `development`

**Example:**
```bash
NODE_ENV=production
```

### `API_BASE_URL` ⚠️ **REQUIRED**

Public API base URL for client requests.

**Example:**
```bash
# Development
API_BASE_URL="http://localhost:8080"

# Production
API_BASE_URL="https://api.yourvtt.com"
```

### `CLIENT_URL` ⚠️ **REQUIRED**

Frontend application URL for CORS and redirects.

**Example:**
```bash
# Development
CLIENT_URL="http://localhost:3000"

# Production
CLIENT_URL="https://yourvtt.com"
```

### `CORS_ORIGIN` ⚠️ **REQUIRED for production**

Comma-separated list of allowed CORS origins.

**Example:**
```bash
# Development (allow all)
CORS_ORIGIN="*"

# Production (restrict to known domains)
CORS_ORIGIN="https://yourvtt.com,https://www.yourvtt.com,https://app.yourvtt.com"
```

---

## Security & Authentication

### `JWT_SECRET` ⚠️ **REQUIRED - MUST SET IN PRODUCTION**

Secret key for signing JWT access tokens.

**⚠️ CRITICAL:** Generate a strong random secret (minimum 32 characters).

**Example:**
```bash
# Generate with: openssl rand -base64 48
JWT_SECRET="YOUR_SECURE_RANDOM_SECRET_HERE_MINIMUM_32_CHARS"
```

**Security Notes:**
- NEVER use the default `dev-secret-change-in-production`
- Server will throw error if not set in production
- Rotate periodically (requires user re-login)

### `REFRESH_SECRET` ⚠️ **REQUIRED - MUST SET IN PRODUCTION**

Secret key for signing JWT refresh tokens (should differ from JWT_SECRET).

**Example:**
```bash
# Generate with: openssl rand -base64 48
REFRESH_SECRET="DIFFERENT_SECURE_RANDOM_SECRET_MINIMUM_32_CHARS"
```

### `SESSION_SECRET` ⚠️ **REQUIRED - MUST SET IN PRODUCTION**

Secret for Express session cookie signing.

**Example:**
```bash
# Generate with: openssl rand -base64 48
SESSION_SECRET="ANOTHER_SECURE_RANDOM_SECRET_FOR_SESSIONS"
```

**Security Notes:**
- Used for OAuth callback session management
- Must be unique from JWT secrets
- Changing this invalidates all active sessions

---

## OAuth Providers

### Discord OAuth

#### `DISCORD_CLIENT_ID` (Optional)

Discord application client ID.

**Get from:** https://discord.com/developers/applications

**Example:**
```bash
DISCORD_CLIENT_ID="123456789012345678"
```

#### `DISCORD_CLIENT_SECRET` ⚠️ **REQUIRED if using Discord OAuth**

Discord application client secret.

**Example:**
```bash
DISCORD_CLIENT_SECRET="your-discord-client-secret-here"
```

#### `DISCORD_CALLBACK_URL` (Optional)

OAuth callback URL for Discord.

**Default:** `${SERVER_URL}/auth/discord/callback`

**Example:**
```bash
DISCORD_CALLBACK_URL="https://api.yourvtt.com/api/v1/auth/discord/callback"
```

### Google OAuth

#### `GOOGLE_CLIENT_ID` (Optional)

Google OAuth 2.0 client ID.

**Get from:** https://console.cloud.google.com

**Example:**
```bash
GOOGLE_CLIENT_ID="123456789012-abcdefghijklmnop.apps.googleusercontent.com"
```

#### `GOOGLE_CLIENT_SECRET` ⚠️ **REQUIRED if using Google OAuth**

Google OAuth 2.0 client secret.

**Example:**
```bash
GOOGLE_CLIENT_SECRET="your-google-client-secret-here"
```

#### `GOOGLE_CALLBACK_URL` (Optional)

OAuth callback URL for Google.

**Default:** `${SERVER_URL}/auth/google/callback`

**Example:**
```bash
GOOGLE_CALLBACK_URL="https://api.yourvtt.com/api/v1/auth/google/callback"
```

---

## AI Providers

At least one AI provider is required for character generation features.

### `OPENAI_API_KEY` (Optional)

OpenAI API key for GPT models.

**Get from:** https://platform.openai.com/api-keys

**Example:**
```bash
OPENAI_API_KEY="sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Models:** GPT-4, GPT-3.5-turbo

### `ANTHROPIC_API_KEY` (Optional)

Anthropic API key for Claude models.

**Get from:** https://console.anthropic.com

**Example:**
```bash
ANTHROPIC_API_KEY="sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Models:** Claude 3 Opus, Claude 3 Sonnet

### `GOOGLE_API_KEY` (Optional)

Google AI (Gemini) API key.

**Get from:** https://makersuite.google.com/app/apikey

**Example:**
```bash
GOOGLE_API_KEY="AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Models:** Gemini Pro, Gemini Pro Vision

### `OPENROUTER_API_KEY` (Optional)

OpenRouter API key for multi-model access.

**Get from:** https://openrouter.ai/keys

**Example:**
```bash
OPENROUTER_API_KEY="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Models:** Access to 100+ models from multiple providers

---

## Monitoring & Observability (Optional)

### `SENTRY_DSN`

Sentry error tracking DSN.

**Example:**
```bash
SENTRY_DSN="https://abc123@o123456.ingest.sentry.io/123456"
```

### `OTEL_EXPORTER_OTLP_ENDPOINT`

OpenTelemetry collector endpoint.

**Example:**
```bash
OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
```

---

## Development-Only Variables

### `DEBUG`

Enable debug logging.

**Example:**
```bash
DEBUG="vtt:*"
```

### `LOG_LEVEL`

Logging verbosity level.

**Values:** `error` | `warn` | `info` | `debug` | `trace`

**Default:** `info`

**Example:**
```bash
LOG_LEVEL=debug
```

---

## Production Deployment Checklist

Before deploying to production, ensure:

- [ ] All ⚠️ **REQUIRED** variables are set
- [ ] All secrets are randomly generated (32+ characters)
- [ ] `NODE_ENV=production` is set
- [ ] No default/development secrets are used
- [ ] CORS origins are restricted to your domains
- [ ] Database URL uses SSL (`sslmode=require`)
- [ ] Redis URL uses TLS (rediss://)
- [ ] OAuth callback URLs match your domain
- [ ] At least one AI provider key is configured
- [ ] Secrets are managed via secure secret management system
- [ ] Environment variables are set via CI/CD or container orchestration

---

## Security Best Practices

1. **Secret Generation**
   ```bash
   # Generate secure random secrets
   openssl rand -base64 48
   ```

2. **Secret Rotation**
   - Rotate secrets every 90 days
   - Use versioned secrets in secret managers
   - Implement graceful rotation (support old + new temporarily)

3. **Access Control**
   - Limit who can view production secrets
   - Use IAM roles instead of static credentials where possible
   - Audit secret access logs regularly

4. **Validation**
   - Application validates all required vars at startup
   - Fails fast if critical secrets missing in production
   - Logs warnings for optional but recommended vars

---

## Troubleshooting

### "Missing JWT_SECRET" error

**Problem:** JWT_SECRET not set in production environment

**Solution:**
```bash
# Generate and set a secure secret
export JWT_SECRET=$(openssl rand -base64 48)
```

### CORS errors in browser

**Problem:** Client URL not in CORS_ORIGIN list

**Solution:** Add your client domain to CORS_ORIGIN
```bash
CORS_ORIGIN="https://yourdomain.com,https://www.yourdomain.com"
```

### Database connection fails

**Problem:** DATABASE_URL incorrect or database not accessible

**Solution:**
1. Verify database is running
2. Check connection string format
3. Ensure network access (firewall, security groups)
4. Verify SSL settings match database requirements

### OAuth callback fails

**Problem:** OAuth callback URL mismatch

**Solution:**
1. Ensure callback URLs in `.env` match OAuth provider configuration
2. Update OAuth provider settings to match your domain
3. Use HTTPS in production

---

## Support

For questions or issues:
- Check logs: Application logs provide detailed error messages
- Review documentation: See package-specific READMEs
- Security issues: Do NOT post secrets in issues - contact maintainers directly

---

**Last Updated:** 2025-09-30
