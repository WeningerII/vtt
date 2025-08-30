# @vtt/core

Core functionality and shared utilities for the Virtual Tabletop platform.

## Overview

Foundation package providing core types, utilities, and shared functionality used across all VTT packages.

## Features

- Core type definitions
- Shared utilities
- Event system
- Base classes
- Common interfaces

## Installation

```bash
npm install @vtt/core
```

## Usage

```typescript
import { EventEmitter, BaseEntity, Utils } from '@vtt/core';

// Use event emitter
const emitter = new EventEmitter();
emitter.on('update', (data) => console.log(data));

// Extend base entity
class Character extends BaseEntity {
  constructor(data) {
    super(data);
  }
}
```

## API Reference

### EventEmitter
- `on(event, handler)` - Subscribe to events
- `emit(event, data)` - Emit events
- `off(event, handler)` - Unsubscribe

### BaseEntity
- Base class for all game entities
- Provides ID generation and timestamps

### Utils
- Common utility functions
- Data validation helpers

## License

MIT
