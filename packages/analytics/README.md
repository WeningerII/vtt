# @vtt/analytics

Analytics and telemetry package for the Virtual Tabletop platform.

## Overview

Provides comprehensive analytics tracking for gameplay metrics, user behavior, and performance monitoring.

## Features

- Session tracking
- Event logging
- Performance metrics
- User engagement analytics
- Custom event tracking

## Installation

```bash
npm install @vtt/analytics
```

## Usage

```typescript
import { Analytics } from '@vtt/analytics';

const analytics = Analytics.getInstance();

// Track custom event
analytics.track('combat_started', {
  players: 4,
  enemies: 6,
  difficulty: 'hard'
});

// Track page view
analytics.pageView('/campaign/123');
```

## API Reference

### Analytics

#### Methods

- `track(event, properties)` - Track custom events
- `pageView(path)` - Track page views
- `identify(userId, traits)` - Identify users
- `group(groupId, traits)` - Track group membership

## Configuration

```typescript
Analytics.configure({
  apiKey: process.env.ANALYTICS_KEY,
  environment: 'production',
  debug: false
});
```

## License

MIT
