# @vtt/renderer

High-performance WebGL/Canvas rendering engine for the Virtual Tabletop platform.

## Overview

The renderer package provides a comprehensive 3D/2D rendering solution optimized for tabletop gaming scenarios. It handles map rendering, token management, lighting effects, fog of war, and real-time visual effects.

## Installation

```bash
npm install @vtt/renderer
```

## Usage

```typescript
import { WebGLRenderer, Scene, Camera, Token, Map } from '@vtt/renderer';

// Initialize renderer
const renderer = new WebGLRenderer({
  canvas: document.getElementById('game-canvas'),
  width: 1920,
  height: 1080,
  antialias: true
});

// Create scene
const scene = new Scene();
const camera = new Camera({
  position: [0, 0, 10],
  target: [0, 0, 0]
});

// Add map
const map = new Map({
  texture: 'path/to/map.jpg',
  gridSize: 32,
  gridType: 'square'
});
scene.add(map);

// Add tokens
const token = new Token({
  texture: 'path/to/character.png',
  position: [100, 100],
  size: 32
});
scene.add(token);

// Render loop
function animate() {
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
```

## API Reference

### WebGLRenderer

Main rendering class that manages the WebGL context and rendering pipeline.

#### Constructor Options
- `canvas: HTMLCanvasElement` - Target canvas element
- `width: number` - Render width in pixels
- `height: number` - Render height in pixels
- `antialias?: boolean` - Enable antialiasing (default: true)
- `alpha?: boolean` - Enable alpha channel (default: false)

#### Methods
- `render(scene: Scene, camera: Camera): void` - Render the scene
- `setSize(width: number, height: number): void` - Update renderer size
- `dispose(): void` - Clean up resources

### Scene

Container for all renderable objects in the game world.

#### Methods
- `add(object: RenderObject): void` - Add object to scene
- `remove(object: RenderObject): void` - Remove object from scene
- `getObjects(): RenderObject[]` - Get all objects in scene
- `clear(): void` - Remove all objects

### Camera

Controls the view perspective and projection.

#### Properties
- `position: [number, number, number]` - Camera position in world space
- `target: [number, number, number]` - Look-at target
- `zoom: number` - Zoom level (default: 1.0)
- `rotation: number` - Camera rotation in radians

#### Methods
- `setPosition(x: number, y: number, z?: number): void`
- `setTarget(x: number, y: number, z?: number): void`
- `setZoom(zoom: number): void`
- `screenToWorld(screenX: number, screenY: number): [number, number]`
- `worldToScreen(worldX: number, worldY: number): [number, number]`

### Token

Represents a character, NPC, or object token on the map.

#### Constructor Options
- `texture: string | HTMLImageElement` - Token image
- `position: [number, number]` - World position
- `size: number` - Token size in pixels
- `rotation?: number` - Rotation in radians
- `visible?: boolean` - Visibility state (default: true)
- `selected?: boolean` - Selection state (default: false)

#### Methods
- `setPosition(x: number, y: number): void`
- `setRotation(rotation: number): void`
- `setVisible(visible: boolean): void`
- `setSelected(selected: boolean): void`
- `getBounds(): { x: number, y: number, width: number, height: number }`

### Map

Represents the game map background and grid system.

#### Constructor Options
- `texture: string | HTMLImageElement` - Map background image
- `gridSize: number` - Grid cell size in pixels
- `gridType: 'square' | 'hex'` - Grid type
- `gridColor?: string` - Grid line color (default: '#000000')
- `gridOpacity?: number` - Grid opacity (default: 0.3)

#### Methods
- `setTexture(texture: string | HTMLImageElement): void`
- `setGridSize(size: number): void`
- `setGridVisible(visible: boolean): void`
- `snapToGrid(x: number, y: number): [number, number]`

### Lighting

Advanced lighting system for dynamic illumination effects.

```typescript
import { Light, LightType } from '@vtt/renderer';

// Point light (torch, candle)
const torch = new Light({
  type: LightType.Point,
  position: [100, 100],
  color: [1.0, 0.8, 0.4],
  intensity: 1.0,
  radius: 150
});

// Directional light (sunlight)
const sunlight = new Light({
  type: LightType.Directional,
  direction: [-0.5, -0.5, -1.0],
  color: [1.0, 1.0, 0.9],
  intensity: 0.8
});

scene.addLight(torch);
scene.addLight(sunlight);
```

### Fog of War

Dynamic fog of war system for exploration mechanics.

```typescript
import { FogOfWar } from '@vtt/renderer';

const fog = new FogOfWar({
  mapWidth: 2048,
  mapHeight: 2048,
  cellSize: 32
});

// Reveal area around token
fog.reveal(tokenX, tokenY, visionRadius);

// Add to scene
scene.setFogOfWar(fog);
```

## Performance Features

- **Viewport Culling**: Only renders objects visible in the camera view
- **Texture Atlasing**: Combines multiple textures for efficient GPU usage
- **Instanced Rendering**: Efficiently renders multiple similar objects
- **Level of Detail (LOD)**: Reduces detail for distant objects
- **Occlusion Culling**: Skips rendering of occluded objects

## Shader System

Custom shader support for advanced visual effects:

```typescript
import { ShaderMaterial } from '@vtt/renderer';

const glowShader = new ShaderMaterial({
  vertexShader: `
    attribute vec2 position;
    attribute vec2 uv;
    varying vec2 vUv;
    
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D texture;
    uniform float glowIntensity;
    varying vec2 vUv;
    
    void main() {
      vec4 color = texture2D(texture, vUv);
      gl_FragColor = color + vec4(glowIntensity);
    }
  `,
  uniforms: {
    glowIntensity: 0.5
  }
});
```

## Events

The renderer emits events for interaction handling:

```typescript
renderer.on('click', (event) => {
  const worldPos = camera.screenToWorld(event.clientX, event.clientY);
  console.log('Clicked at world position:', worldPos);
});

renderer.on('tokenHover', (token) => {
  console.log('Hovering over token:', token.id);
});
```

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test

# Watch mode for development
npm run dev

# Generate documentation
npm run docs
```

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

Requires WebGL 1.0 support.

## License

MIT
