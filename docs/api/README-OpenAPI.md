# VTT OpenAPI Specification

This directory contains the comprehensive OpenAPI 3.0 specification for the VTT (Virtual Tabletop) API.

## Files

- `openapi.yaml` - Complete OpenAPI 3.0 specification with all endpoints, schemas, and examples
- `comprehensive-api-guide.md` - Human-readable API documentation with detailed examples
- `README-OpenAPI.md` - This file

## Quick Start

### View API Documentation

Start the interactive Swagger UI documentation server:

```bash
# Default port (3000)
npm run docs:api

# Custom port (8081)
npm run docs:api:port
```

Then open your browser to:
- **Documentation**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/health

### Generate Client SDKs

Use the OpenAPI specification to generate client libraries:

```bash
# JavaScript/TypeScript client
npx @openapitools/openapi-generator-cli generate \
  -i docs/api/openapi.yaml \
  -g typescript-axios \
  -o generated/typescript-client

# Python client
npx @openapitools/openapi-generator-cli generate \
  -i docs/api/openapi.yaml \
  -g python \
  -o generated/python-client

# Go client
npx @openapitools/openapi-generator-cli generate \
  -i docs/api/openapi.yaml \
  -g go \
  -o generated/go-client
```

### Validate Specification

```bash
# Install swagger-codegen-cli if not already installed
npm install -g swagger-codegen-cli

# Validate the OpenAPI spec
swagger-codegen-cli validate -i docs/api/openapi.yaml
```

## API Overview

The VTT API provides comprehensive functionality for virtual tabletop gaming:

### Core Features

- **Authentication**: OAuth2 (Discord, Google) + JWT tokens
- **Characters**: Full D&D 5e character management with progression
- **Campaigns**: Multi-player campaign creation and management
- **Monsters**: Searchable SRD monster database with custom creatures
- **Maps & Scenes**: Battle map uploads with grid detection and token management
- **AI Services**: Tactical combat decisions and rules assistance
- **Real-time**: WebSocket events for live collaboration

### Endpoints by Category

| Category | Endpoints | Description |
|----------|-----------|-------------|
| **Authentication** | `/auth/*` | OAuth login, logout, user info |
| **Health** | `/api/health/*` | System health checks and monitoring |
| **Characters** | `/characters/*` | Character CRUD, leveling, stats |
| **Campaigns** | `/campaigns/*` | Campaign management, players |
| **Monsters** | `/api/monsters/*` | Monster database and search |
| **AI Services** | `/api/combat/*`, `/api/assistant/*` | AI tactical decisions and rules help |
| **Maps** | `/maps/*` | Map uploads, scenes, tokens |

### Rate Limits

- **Authentication**: 5 requests/minute
- **General API**: 100 requests/minute  
- **AI Services**: 10 requests/minute
- **File Uploads**: 5 requests/minute

### Response Format

All API responses follow consistent patterns:

**Success Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": { ... },
    "timestamp": "2023-12-01T12:00:00.000Z",
    "requestId": "req_abc123"
  }
}
```

## Integration Examples

### JavaScript/TypeScript

```typescript
import axios from 'axios';

const client = axios.create({
  baseURL: 'https://api.vtt.example.com',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Get characters
const characters = await client.get('/characters');

// Create character
const newCharacter = await client.post('/characters', {
  name: 'Thorin Ironforge',
  class: 'Fighter',
  race: 'Dwarf',
  level: 1,
  stats: { strength: 16, dexterity: 12, ... }
});
```

### Python

```python
import requests

class VTTClient:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def get_characters(self):
        response = requests.get(
            f'{self.base_url}/characters',
            headers=self.headers
        )
        return response.json()

client = VTTClient('https://api.vtt.example.com', 'your-token')
characters = client.get_characters()
```

## Development

### Updating the Specification

1. Edit `openapi.yaml` with your changes
2. Validate the specification: `swagger-codegen-cli validate -i docs/api/openapi.yaml`
3. Test with the documentation server: `npm run docs:api`
4. Update the comprehensive guide if needed

### Server Integration

The server automatically loads the OpenAPI specification from this file:

```typescript
// apps/server/src/openapi/swagger.ts
import { readFileSync } from 'fs';
import yaml from 'js-yaml';

const spec = yaml.load(readFileSync('docs/api/openapi.yaml', 'utf8'));
```

### Adding New Endpoints

1. Add the endpoint definition to `openapi.yaml`
2. Include request/response schemas in the `components` section
3. Add appropriate tags and descriptions
4. Update the comprehensive guide with examples
5. Test the endpoint documentation

## Monitoring & Alerting

The API includes comprehensive health and metrics endpoints for monitoring:

- **Health Check**: `GET /api/health` - Detailed system status
- **Liveness**: `GET /api/health/live` - Kubernetes liveness probe
- **Readiness**: `GET /api/health/ready` - Kubernetes readiness probe  
- **Metrics**: `GET /api/metrics` - JSON application metrics
- **Prometheus**: `GET /api/metrics/prometheus` - Prometheus format

Set up alerting on these endpoints to monitor API availability and performance.

## Security

- All endpoints require JWT authentication except health checks
- Rate limiting is enforced per endpoint category
- CORS is configured for production origins
- Request validation follows OpenAPI schema definitions
- Sensitive data is excluded from error responses

## Support

For API questions or issues:
- Review the comprehensive guide: `comprehensive-api-guide.md`
- Check the interactive documentation: `npm run docs:api`
- Validate requests against the OpenAPI schema
- Monitor health endpoints for system status
