# VTT Platform API Documentation

Welcome to the Virtual Tabletop (VTT) Platform API documentation. This comprehensive API enables you to build immersive tabletop gaming experiences with robust user management, content creation, and real-time collaboration features.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [API Reference](#api-reference)
4. [SDKs & Libraries](#sdks--libraries)
5. [Examples](#examples)
6. [Rate Limits](#rate-limits)
7. [Support](#support)

## Getting Started

### Base URL
```
Production: https://api.vtt-platform.com/v1
Staging: https://staging-api.vtt-platform.com/v1
```

### API Versioning
The VTT API uses URL path versioning. The current version is `v1`. Breaking changes will be introduced in new versions.

### Content Types
- **Request**: `application/json`
- **Response**: `application/json`
- **File Uploads**: `multipart/form-data`

### Status Codes
| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request |
| `401` | Unauthorized |
| `403` | Forbidden |
| `404` | Not Found |
| `429` | Too Many Requests |
| `500` | Internal Server Error |

## Authentication

The VTT API uses JSON Web Tokens (JWT) for authentication. All authenticated endpoints require a valid session token.

### Getting a Token
```http
POST /auth/login
Content-Type: application/json

{
  "identifier": "user@example.com",
  "password": "your_password"
}
```

### Using the Token
Include the token in the `Authorization` header:
```http
Authorization: Bearer YOUR_SESSION_TOKEN
```

Or use the session cookie (automatically set on login):
```http
Cookie: sessionToken=YOUR_SESSION_TOKEN
```

## API Reference

### Core Services

- **[User Management](./user-management.md)** - Authentication, user profiles, and account management
- **[Billing & Subscriptions](./billing.md)** - Payment processing, subscription management, and usage tracking
- **[Notifications](./notifications.md)** - Email, push, and in-app notifications
- **[Content Management](./content.md)** - Campaign creation, asset management, and publishing
- **[Real-time Collaboration](./realtime.md)** - WebSocket connections for live gaming sessions

### Data Models

- **[User Model](./models/user.md)** - User account structure and properties
- **[Campaign Model](./models/campaign.md)** - Campaign data structure
- **[Asset Model](./models/asset.md)** - Digital asset metadata and storage
- **[Subscription Model](./models/subscription.md)** - Billing and subscription details

## SDKs & Libraries

### Official SDKs

- **JavaScript/TypeScript** - `@vtt-platform/js-sdk`
- **React Components** - `@vtt-platform/react-components`
- **Unity** - `VTTPlatform.Unity` (Asset Store)

### Community Libraries

- **Python** - `vtt-platform-py`
- **C#** - `VTTPlatform.NET`
- **PHP** - `vtt-platform/php-sdk`

## Examples

### Quick Start with JavaScript
```javascript
import { VTTClient } from '@vtt-platform/js-sdk';

const client = new VTTClient({
  apiKey: 'your-api-key',
  baseURL: 'https://api.vtt-platform.com/v1'
});

// Authenticate
await client.auth.login('user@example.com', 'password');

// Create a campaign
const campaign = await client.campaigns.create({
  name: 'Lost Mine of Phandelver',
  system: 'dnd5e',
  description: 'A D&D 5e starter adventure'
});

// Upload an asset
const asset = await client.assets.upload({
  file: mapImageFile,
  type: 'map',
  name: 'Goblin Ambush Map'
});
```

### React Integration
```jsx
import { VTTProvider, useCampaign } from '@vtt-platform/react-components';

function App() {
  return (
    <VTTProvider apiKey="your-api-key">
      <CampaignView campaignId="camp_123" />
    </VTTProvider>
  );
}

function CampaignView({ campaignId }) {
  const { campaign, loading } = useCampaign(campaignId);
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      <h1>{campaign.name}</h1>
      <p>{campaign.description}</p>
    </div>
  );
}
```

## Rate Limits

The VTT API implements rate limiting to ensure fair usage:

| Plan | Requests per Hour | Burst Limit |
|------|-------------------|-------------|
| Free | 1,000 | 50 |
| Basic | 10,000 | 200 |
| Premium | 50,000 | 500 |
| Enterprise | 500,000 | 2,000 |

Rate limit headers are included in all responses:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1609459200
```

## Webhooks

Configure webhooks to receive real-time notifications about events:

### Supported Events
- `user.created`
- `user.updated`
- `subscription.created`
- `subscription.updated`
- `campaign.created`
- `session.started`
- `session.ended`

### Webhook Payload
```json
{
  "id": "evt_1234567890",
  "type": "user.created",
  "created": 1609459200,
  "data": {
    "user": {
      "id": "user_123",
      "email": "new@example.com"
    }
  }
}
```

## Error Handling

All API errors return a consistent format:

```json
{
  "error": "validation_failed",
  "message": "The request data is invalid",
  "details": [
    {
      "field": "email",
      "code": "invalid_email",
      "message": "Please provide a valid email address"
    }
  ]
}
```

### Common Error Codes
- `authentication_required` - Missing or invalid authentication token
- `insufficient_permissions` - User lacks required permissions
- `validation_failed` - Request data validation errors
- `rate_limit_exceeded` - Too many requests
- `resource_not_found` - Requested resource doesn't exist
- `subscription_required` - Feature requires active subscription

## Support

### Getting Help
- **Documentation**: https://docs.vtt-platform.com
- **Community Forum**: https://community.vtt-platform.com
- **Discord Server**: https://discord.gg/vtt-platform
- **Support Email**: api-support@vtt-platform.com

### Reporting Issues
- **Bug Reports**: https://github.com/vtt-platform/api/issues
- **Feature Requests**: https://feedback.vtt-platform.com
- **Security Issues**: security@vtt-platform.com

### Status & Updates
- **API Status**: https://status.vtt-platform.com
- **Changelog**: https://docs.vtt-platform.com/changelog
- **Twitter**: @VTTPlatformAPI

---

**Last Updated**: December 2024  
**API Version**: v1.0.0
