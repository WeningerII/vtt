# VTT API Documentation

## Overview

This document provides comprehensive documentation for the Virtual Tabletop (VTT) API, including all endpoints, request/response formats, authentication, and usage examples.

## Base URL

```
Production: https://api.vtt.example.com
Development: http://localhost:8080
```

## Authentication

The VTT API uses JWT tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### OAuth Endpoints

- **GET** `/auth/discord` - Initiate Discord OAuth
- **GET** `/auth/google` - Initiate Google OAuth  
- **POST** `/auth/logout` - Logout user
- **GET** `/auth/me` - Get current user info

## Health & Monitoring

### Health Checks

#### GET /api/health
Comprehensive health check with detailed status information.

**Response:**
```json
{
  "status": "healthy|degraded|unhealthy",
  "uptime": 12345678,
  "timestamp": 1672531200000,
  "version": "1.0.0",
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

#### GET /api/health/live
Kubernetes liveness probe (simple alive check).

#### GET /api/health/ready
Kubernetes readiness probe (service ready check).

### Metrics

#### GET /api/metrics
Application metrics in JSON format.

#### GET /api/metrics/prometheus
Prometheus-compatible metrics format.

## Characters API

### GET /characters
Get user's characters.

**Query Parameters:**
- `limit` (number, default: 50) - Number of characters to return
- `offset` (number, default: 0) - Offset for pagination

**Example Request:**
```bash
curl -H "Authorization: Bearer <token>" \
  "https://api.vtt.example.com/characters?limit=10"
```

**Response:**
```json
{
  "characters": [
    {
      "id": "char_123",
      "name": "Thorin Ironforge",
      "level": 5,
      "class": "Fighter",
      "race": "Dwarf",
      "hitPoints": {
        "current": 45,
        "maximum": 50,
        "temporary": 0
      },
      "armorClass": 18,
      "stats": {
        "strength": 16,
        "dexterity": 12,
        "constitution": 15,
        "intelligence": 10,
        "wisdom": 13,
        "charisma": 8
      },
      "createdAt": "2023-01-01T00:00:00.000Z"
    }
  ],
  "total": 3,
  "limit": 10,
  "offset": 0
}
```

### POST /characters
Create a new character.

**Request Body:**
```json
{
  "name": "Thorin Ironforge",
  "level": 1,
  "class": "Fighter",
  "race": "Dwarf",
  "stats": {
    "strength": 16,
    "dexterity": 12,
    "constitution": 15,
    "intelligence": 10,
    "wisdom": 13,
    "charisma": 8
  },
  "hitPoints": {
    "maximum": 12
  },
  "armorClass": 16
}
```

### GET /characters/{id}
Get specific character details.

### PUT /characters/{id}
Update character information.

### DELETE /characters/{id}
Delete a character.

### POST /characters/{id}/level-up
Level up a character.

**Request Body:**
```json
{
  "hitPointIncrease": 8,
  "newSpells": ["fireball", "lightning_bolt"],
  "statIncrease": {
    "strength": 1
  }
}
```

## Campaigns API

### GET /campaigns
List user's campaigns.

**Response:**
```json
{
  "campaigns": [
    {
      "id": "camp_456",
      "name": "Curse of Strahd",
      "description": "Gothic horror in Barovia",
      "isActive": true,
      "playerCount": 4,
      "gmId": "user_789",
      "activeSceneId": "scene_101",
      "createdAt": "2023-01-01T00:00:00.000Z"
    }
  ]
}
```

### POST /campaigns
Create a new campaign.

**Request Body:**
```json
{
  "name": "Curse of Strahd",
  "description": "Gothic horror in Barovia",
  "maxPlayers": 6,
  "isPrivate": false
}
```

### GET /campaigns/{id}
Get campaign details with scenes and players.

### POST /campaigns/{id}/players
Add player to campaign.

### POST /campaigns/{id}/characters
Add character to campaign.

## Monsters API

### GET /api/monsters
Search and list monsters.

**Query Parameters:**
- `q` (string) - Search query for monster name
- `tags` (string) - Comma-separated tags to filter by
- `limit` (number, default: 50) - Results per page
- `offset` (number, default: 0) - Pagination offset

**Example Request:**
```bash
curl "https://api.vtt.example.com/api/monsters?q=dragon&tags=large,fire&limit=10"
```

**Response:**
```json
{
  "items": [
    {
      "id": "monster_123",
      "stableId": "adult-red-dragon",
      "name": "Adult Red Dragon",
      "statblock": {
        "armorClass": 19,
        "hitPoints": 256,
        "speed": "40 ft., climb 40 ft., fly 80 ft.",
        "stats": {
          "STR": 27,
          "DEX": 10,
          "CON": 25,
          "INT": 16,
          "WIS": 13,
          "CHA": 21
        },
        "challengeRating": "17",
        "actions": [
          {
            "name": "Fire Breath",
            "description": "The dragon exhales fire in a 60-foot cone..."
          }
        ]
      },
      "tags": ["dragon", "large", "fire"]
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

### GET /api/monsters/{id}
Get specific monster details.

### POST /api/monsters
Create custom monster.

### PUT /api/monsters/{id}
Update monster.

### DELETE /api/monsters/{id}
Delete monster.

### POST /api/monsters/seed
Seed database with SRD monsters (admin only).

## Maps & Scenes API

### POST /maps/upload
Upload a map image.

**Request:** Multipart form data with image file.

**Response:**
```json
{
  "mapId": "map_789",
  "url": "https://cdn.vtt.example.com/maps/map_789.jpg",
  "width": 1920,
  "height": 1080,
  "gridDetected": true
}
```

### POST /maps/scenes
Create a new scene.

**Request Body:**
```json
{
  "name": "Goblin Ambush",
  "mapId": "map_789",
  "gridSettings": {
    "type": "square",
    "size": 70,
    "offsetX": 0,
    "offsetY": 0
  },
  "campaignId": "camp_456"
}
```

### GET /maps/scenes/{id}
Get scene details with tokens and map.

### POST /maps/scenes/{id}/tokens
Add token to scene.

**Request Body:**
```json
{
  "name": "Goblin Warrior",
  "x": 350,
  "y": 420,
  "width": 1,
  "height": 1,
  "color": 0xff0000,
  "characterId": "char_123"
}
```

### PUT /maps/scenes/{id}/tokens/{tokenId}/move
Move token on scene.

**Request Body:**
```json
{
  "x": 420,
  "y": 350,
  "animate": true
}
```

## AI Services API

### POST /api/combat/tactical-decision
Get AI tactical decision for combat.

**Request Body:**
```json
{
  "character": {
    "name": "Thorin",
    "level": 5,
    "class": "Fighter",
    "hitPoints": {"current": 45, "maximum": 50},
    "armorClass": 18,
    "spellSlots": {"1": 0, "2": 0}
  },
  "allies": [
    {
      "name": "Gandalf",
      "class": "Wizard",
      "position": {"x": 10, "y": 15}
    }
  ],
  "enemies": [
    {
      "name": "Orc Warrior",
      "hitPoints": {"current": 20, "maximum": 20},
      "position": {"x": 5, "y": 10}
    }
  ],
  "battlefield": {
    "terrain": "forest",
    "weather": "clear",
    "lighting": "daylight"
  },
  "objectives": ["Defeat enemies", "Protect ally"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recommendation": "Move to flank the orc and use Action Surge for extra attack",
    "reasoning": "Positioning advantage will grant +2 to hit, and Action Surge maximizes damage output",
    "movement": {"x": 8, "y": 12},
    "actions": [
      {
        "type": "move",
        "target": {"x": 8, "y": 12}
      },
      {
        "type": "attack",
        "target": "Orc Warrior",
        "weapon": "longsword"
      },
      {
        "type": "feature",
        "name": "Action Surge"
      }
    ],
    "riskLevel": "medium",
    "expectedOutcome": "75% chance to defeat orc this turn"
  }
}
```

### POST /api/assistant/query
Query the AI assistant for rules and guidance.

**Request Body:**
```json
{
  "query": "How does grappling work in D&D 5e?",
  "context": {
    "system": "dnd5e",
    "playerLevel": "beginner"
  }
}
```

### POST /api/genesis/generate
Generate character using AI.

**Request Body:**
```json
{
  "prompt": "A dwarven cleric of the forge domain",
  "level": 3,
  "preferences": {
    "backgroundType": "heroic",
    "personalityTraits": ["brave", "loyal"],
    "equipment": "standard"
  }
}
```

## WebSocket Events

### Connection
Connect to: `ws://localhost:8080` or `wss://api.vtt.example.com`

### Events

#### Client → Server

**authenticate**
```json
{
  "userId": "user_123",
  "campaignId": "camp_456"
}
```

**join_scene**
```json
{
  "sceneId": "scene_789"
}
```

**move_token**
```json
{
  "tokenId": "token_123",
  "x": 350,
  "y": 420,
  "animate": true
}
```

**send_message**
```json
{
  "text": "I cast fireball at the goblins!",
  "type": "action"
}
```

#### Server → Client

**scene_joined**
```json
{
  "scene": {
    "id": "scene_789",
    "name": "Goblin Ambush",
    "tokens": [...],
    "gridSettings": {...}
  }
}
```

**token_moved**
```json
{
  "tokenId": "token_123",
  "x": 350,
  "y": 420,
  "userId": "user_456"
}
```

**new_message**
```json
{
  "text": "Roll for initiative!",
  "author": "GM",
  "timestamp": "2023-12-01T12:00:00.000Z",
  "type": "system"
}
```

## Error Handling

### Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "characterId",
      "issue": "Character not found"
    },
    "timestamp": "2023-12-01T12:00:00.000Z",
    "requestId": "req_abc123"
  }
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (resource already exists)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

### Common Error Codes
- `AUTHENTICATION_REQUIRED` - User not authenticated
- `VALIDATION_ERROR` - Request validation failed
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `PERMISSION_DENIED` - User lacks required permissions
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `CAMPAIGN_FULL` - Campaign at maximum capacity
- `CHARACTER_IN_COMBAT` - Cannot modify character during combat

## Rate Limiting

### Limits by Endpoint Type
- **Authentication**: 5 requests per minute
- **General API**: 100 requests per minute
- **AI Services**: 10 requests per minute
- **File Uploads**: 5 requests per minute

### Rate Limit Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1672531260
X-RateLimit-RetryAfter: 60
```

## SDKs & Libraries

### JavaScript/TypeScript
```bash
npm install @vtt/api-client
```

```javascript
import { VTTClient } from '@vtt/api-client';

const client = new VTTClient({
  baseURL: 'https://api.vtt.example.com',
  apiKey: 'your-api-key'
});

// Get characters
const characters = await client.characters.list();

// Create character
const newCharacter = await client.characters.create({
  name: 'Thorin',
  class: 'Fighter',
  level: 1
});
```

### Python
```bash
pip install vtt-api-client
```

```python
from vtt_client import VTTClient

client = VTTClient(
    base_url='https://api.vtt.example.com',
    api_key='your-api-key'
)

# Get monsters
monsters = client.monsters.search(query='dragon', limit=10)
```

## Changelog

### v1.2.0 (Latest)
- Added comprehensive health checks and metrics
- Enhanced error boundaries and user feedback
- Improved caching for better performance
- Added database query optimizations

### v1.1.0
- Added AI tactical decision endpoint
- Improved WebSocket connection handling
- Enhanced character creation workflow

### v1.0.0
- Initial API release
- Core VTT functionality
- OAuth authentication
