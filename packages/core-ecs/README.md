# @vtt/core-ecs

Entity Component System (ECS) architecture for the VTT project, providing high-performance entity management and component systems optimized for tabletop gaming scenarios.

## Installation

```bash
npm install @vtt/core-ecs
```

## Usage

```typescript
import { World, Transform2DStore, VisionStore } from '@vtt/core-ecs';

// Create a world with 1000 entity capacity
const world = new World(1000);

// Create entities
const playerId = world.create();
const npcId = world.create();

// Add components
world.transforms.add(playerId, { x: 10, y: 20, rot: 0 });
world.vision.add(playerId, { 
  sightRange: 6, 
  darkvisionRange: 12,
  truesightRange: 8 
});

// Query entities
const allEntities = world.getEntities();
const entitiesWithTransforms = world.getEntitiesWithComponents('transforms');
```

## API Reference

### World Class

The `World` class is the central hub for entity and component management.

#### Methods

- `create(): EntityId` - Creates a new entity and returns its ID
- `destroy(entityId: EntityId): void` - Destroys an entity and removes all its components
- `isAlive(entityId: EntityId): boolean` - Checks if an entity exists and is alive
- `getEntities(): EntityId[]` - Returns array of all alive entity IDs
- `iterAllEntities(): IterableIterator<EntityId>` - Iterator for all alive entities
- `getEntitiesWithComponents(...stores: string[]): EntityId[]` - Returns entities with specified components

### Transform2DStore

Manages 2D spatial transform data for entities.

#### Interface: Transform2DData

```typescript
interface Transform2DData {
  x: number;      // X position
  y: number;      // Y position  
  rot: number;    // Rotation in radians
  sx: number;     // X scale factor
  sy: number;     // Y scale factor
  zIndex: number; // Z-index for layering
}
```

#### Methods

- `get(entityId: EntityId): Transform2DData | null` - Get complete transform data
- `getPosition(entityId: EntityId): {x: number, y: number} | null` - Get position only
- `getRotation(entityId: EntityId): number | null` - Get rotation only
- `getScale(entityId: EntityId): {sx: number, sy: number} | null` - Get scale only

### VisionStore

Manages vision and visibility mechanics with D&D 5e compliance.

#### Interface: VisionData

```typescript
interface VisionData {
  // Vision ranges
  sightRange: number;
  darkvisionRange: number;
  blindsightRange: number;
  truesightRange: number;
  
  // Vision states
  isInvisible: boolean;
  isEthereal: boolean;
  isBlinded: boolean;
  hasDevilsSight: boolean;
  hasMagicalDarkness: boolean;
  
  // Immunities
  immuneToBlindness: boolean;
  immuneToInvisibilityDetection: boolean;
  
  // Additional properties...
}
```

#### Methods

- `canSeeEntity(observerId: EntityId, targetId: EntityId, distance: number, lightLevel: number): boolean`
  - Advanced visibility calculation supporting invisibility, ethereal plane, blindness, and magical sight
- `setSightRange(entityId: EntityId, range: number): void`
- `setDarkvision(entityId: EntityId, range: number): void`
- `setBlindsight(entityId: EntityId, range: number): void`
- `setTruesight(entityId: EntityId, range: number): void`

## Architecture Patterns

### Entity Management

Entities are simple numeric IDs managed by the World class. The ECS follows a data-oriented design where:

- **Entities** are just IDs (numbers)
- **Components** are data stored in specialized stores
- **Systems** operate on entities with specific component combinations

### Component Stores

Each component type has its own store class that manages:
- Component data arrays indexed by entity ID
- Add/remove operations
- Existence checks
- Specialized query methods

### Vision System Integration

The vision system implements complex D&D 5e visibility rules:

1. **Light-based vision**: Normal sight affected by light levels
2. **Darkvision**: See in darkness as dim light
3. **Blindsight**: Perceive without relying on sight
4. **Truesight**: See through illusions, invisibility, and ethereal plane
5. **Devil's Sight**: See normally in magical darkness

### Performance Considerations

- Entity IDs are reused after destruction for memory efficiency
- Component data stored in typed arrays where possible
- Batch operations supported for bulk entity processing
- Optimized iteration patterns for system updates

## Features

- **Type-safe TypeScript implementation** with comprehensive interfaces
- **D&D 5e compliant vision mechanics** including invisibility and ethereal plane
- **High-performance entity management** with ID reuse and efficient storage
- **Modular component architecture** allowing easy extension
- **Comprehensive test coverage** ensuring reliability
- **Backward compatibility** maintained for existing code

## Migration Guide

### From Legacy ECS

If upgrading from a previous ECS implementation:

1. **World.getEntities()** replaces manual entity tracking
2. **Transform2DStore.get()** provides complete transform data access
3. **Enhanced VisionData** includes new visibility state properties
4. **VisionStore.canSeeEntity()** centralizes visibility logic

### Breaking Changes

- None - all changes are additive and maintain backward compatibility

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test

# Watch mode
npm run dev
```

## License

MIT
