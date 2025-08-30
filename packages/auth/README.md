# @vtt/auth

Authentication and authorization package for the Virtual Tabletop platform.

## Overview

Handles user authentication, session management, and role-based access control.

## Features

- JWT-based authentication
- OAuth integration (Google, Discord)
- Session management
- Role-based permissions
- Password hashing and validation

## Installation

```bash
npm install @vtt/auth
```

## Usage

```typescript
import { AuthManager } from '@vtt/auth';

const auth = new AuthManager({
  jwtSecret: process.env.JWT_SECRET,
  sessionTimeout: 3600
});

// Authenticate user
const token = await auth.authenticate(email, password);

// Verify token
const user = await auth.verifyToken(token);

// Check permissions
const canEdit = auth.hasPermission(user, 'campaign.edit');
```

## API Reference

### AuthManager

#### Methods

- `authenticate(email, password)` - Authenticate user credentials
- `verifyToken(token)` - Verify JWT token
- `createSession(userId)` - Create new session
- `hasPermission(user, permission)` - Check user permissions
- `refreshToken(token)` - Refresh expired token

## Configuration

```typescript
AuthManager.configure({
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiry: '24h',
  bcryptRounds: 10,
  oauth: {
    google: { clientId: '...', clientSecret: '...' },
    discord: { clientId: '...', clientSecret: '...' }
  }
});
```

## License

MIT
