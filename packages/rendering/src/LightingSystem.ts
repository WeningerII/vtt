import { logger } from "@vtt/logging";

/**
 * Advanced Lighting System
 * Handles dynamic lighting, shadows, and illumination calculations
 */

export interface LightSource {
  id: string;
  type: "point" | "directional" | "spot" | "area";
  position: { x: number; y: number; z?: number };
  color: { r: number; g: number; b: number; a: number };
  intensity: number;
  range: number;
  falloff: "linear" | "quadratic" | "constant";
  castsShadows: boolean;
  isEnabled: boolean;

  // Spot light specific
  direction?: { x: number; y: number };
  angle?: number;
  penumbra?: number;

  // Flickering/animation
  animation?: {
    type: "flicker" | "pulse" | "rotate";
    speed: number;
    amplitude: number;
  };

  // Game-specific properties
  tokenId?: string;
  spellEffect?: boolean;
  duration?: number; // ms, for temporary lights
  conditions?: string[]; // When light is active
}

export interface AmbientLight {
  color: { r: number; g: number; b: number; a: number };
  intensity: number;
  direction?: { x: number; y: number }; // For directional ambient
}

export interface LightingSettings {
  enableShadows: boolean;
  shadowQuality: "low" | "medium" | "high" | "ultra";
  enableAmbientOcclusion: boolean;
  enableVolumetricLighting: boolean;
  lightBounces: number; // Global illumination bounces
  fogOfWarOpacity: number;
  darkvisionRange: number;
  lowLightVisionRange: number;
}

export interface VisionSource {
  id: string;
  tokenId: string;
  type: "normal" | "darkvision" | "blindsight" | "tremorsense" | "truesight";
  range: number;
  angle?: number; // Cone vision
  direction?: number; // Degrees
  color?: { r: number; g: number; b: number; a: number };
}

export interface LightingResult {
  illuminationMap: Float32Array;
  shadowMap: Float32Array;
  visibilityMap: Float32Array;
  lightContributions: Map<string, Float32Array>;
}

export class LightingSystem {
  private lightSources: Map<string, LightSource> = new Map();
  private visionSources: Map<string, VisionSource> = new Map();
  private ambientLight: AmbientLight;
  private settings: LightingSettings;
  private sceneWidth: number;
  private sceneHeight: number;
  private gridSize: number;

  // Cached lighting data
  private lightingCache: Map<string, LightingResult> = new Map();
  private cacheVersion: number = 0;
  private walls: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

  private changeListeners: Array<(_event: LightingEvent) => void> = [];

  constructor(
    sceneWidth: number,
    sceneHeight: number,
    gridSize: number = 50,
    settings: Partial<LightingSettings> = {},
  ) {
    this.sceneWidth = sceneWidth;
    this.sceneHeight = sceneHeight;
    this.gridSize = gridSize;

    this.settings = {
      enableShadows: true,
      shadowQuality: "medium",
      enableAmbientOcclusion: false,
      enableVolumetricLighting: false,
      lightBounces: 1,
      fogOfWarOpacity: 0.8,
      darkvisionRange: 60,
      lowLightVisionRange: 20,
      ...settings,
    };

    this.ambientLight = {
      color: { r: 0.2, g: 0.2, b: 0.3, a: 1.0 },
      intensity: 0.1,
    };
  }

  /**
   * Add light source to scene
   */
  addLightSource(light: LightSource): void {
    this.lightSources.set(light.id, light);
    this.invalidateCache();

    this.emitEvent({
      type: "light-added",
      data: { lightId: light.id, light },
    });
  }

  /**
   * Remove light source
   */
  removeLightSource(lightId: string): void {
    const removed = this.lightSources.delete(lightId);
    if (removed) {
      this.invalidateCache();
      this.emitEvent({
        type: "light-removed",
        data: { lightId },
      });
    }
  }

  /**
   * Update light source
   */
  updateLightSource(lightId: string, updates: Partial<LightSource>): void {
    const light = this.lightSources.get(lightId);
    if (light) {
      Object.assign(light, updates);
      this.invalidateCache();

      this.emitEvent({
        type: "light-updated",
        data: { lightId, light, updates },
      });
    }
  }

  /**
   * Add vision source
   */
  addVisionSource(vision: VisionSource): void {
    this.visionSources.set(vision.id, vision);
    this.invalidateCache();

    this.emitEvent({
      type: "vision-added",
      data: { visionId: vision.id, vision },
    });
  }

  /**
   * Remove vision source
   */
  removeVisionSource(visionId: string): void {
    const removed = this.visionSources.delete(visionId);
    if (removed) {
      this.invalidateCache();
      this.emitEvent({
        type: "vision-removed",
        data: { visionId },
      });
    }
  }

  /**
   * Set walls for shadow casting
   */
  setWalls(walls: Array<{ x1: number; y1: number; x2: number; y2: number }>): void {
    this.walls = [...walls];
    this.invalidateCache();

    this.emitEvent({
      type: "walls-updated",
      data: { wallCount: walls.length },
    });
  }

  /**
   * Calculate lighting for entire scene
   */
  calculateLighting(): LightingResult {
    const cacheKey = `lighting-${this.cacheVersion}`;

    if (this.lightingCache.has(cacheKey)) {
      return this.lightingCache.get(cacheKey)!;
    }

    const result = this.performLightingCalculation();
    this.lightingCache.set(cacheKey, result);

    // Clear old cache entries
    if (this.lightingCache.size > 5) {
      const oldestKey = this.lightingCache.keys().next().value;
      if (oldestKey) {
        this.lightingCache.delete(oldestKey);
      }
    }

    return result;
  }

  private performLightingCalculation(): LightingResult {
    const mapSize =
      Math.ceil(this.sceneWidth / this.gridSize) * Math.ceil(this.sceneHeight / this.gridSize);

    const illuminationMap = new Float32Array(mapSize);
    const shadowMap = new Float32Array(mapSize);
    const visibilityMap = new Float32Array(mapSize);
    const lightContributions = new Map<string, Float32Array>();

    // Initialize with ambient light
    illuminationMap.fill(this.ambientLight.intensity);

    // Calculate contribution from each light source
    for (const [lightId, light] of this.lightSources.entries()) {
      if (!light.isEnabled) continue;

      const contribution = this.calculateLightContribution(light);
      lightContributions.set(lightId, contribution);

      // Add to main illumination map
      for (let i = 0; i < mapSize; i++) {
        illuminationMap[i] = Math.min(1.0, (illuminationMap[i] ?? 0) + (contribution[i] ?? 0));
      }
    }

    // Calculate shadows
    if (this.settings.enableShadows) {
      this.calculateShadows(shadowMap, illuminationMap);
    }

    // Calculate visibility based on vision sources
    this.calculateVisibility(visibilityMap, illuminationMap);

    return {
      illuminationMap,
      shadowMap,
      visibilityMap,
      lightContributions,
    };
  }

  private calculateLightContribution(light: LightSource): Float32Array {
    const mapWidth = Math.ceil(this.sceneWidth / this.gridSize);
    const mapHeight = Math.ceil(this.sceneHeight / this.gridSize);
    const contribution = new Float32Array(mapWidth * mapHeight);

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const worldX = x * this.gridSize + this.gridSize / 2;
        const worldY = y * this.gridSize + this.gridSize / 2;

        const intensity = this.calculateLightIntensityAt(light, worldX, worldY);
        contribution[y * mapWidth + x] = intensity;
      }
    }

    return contribution;
  }

  private calculateLightIntensityAt(light: LightSource, x: number, y: number): number {
    const dx = x - light.position.x;
    const dy = y - light.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Check if point is within light range
    if (distance > light.range) return 0;

    // Calculate base intensity based on falloff
    let intensity = light.intensity;

    switch (light.falloff) {
      case "linear":
        intensity *= Math.max(0, 1 - distance / light.range);
        break;
      case "quadratic":
        intensity *= Math.max(0, 1 - Math.pow(distance / light.range, 2));
        break;
      case "constant":
        intensity *= distance <= light.range ? 1 : 0;
        break;
    }

    // Apply spot light cone
    if (light.type === "spot" && light.direction && light.angle) {
      const lightAngle = Math.atan2(light.direction.y, light.direction.x);
      const pointAngle = Math.atan2(dy, dx);
      let angleDiff = Math.abs(lightAngle - pointAngle);

      // Normalize angle difference
      if (angleDiff > Math.PI) {
        angleDiff = 2 * Math.PI - angleDiff;
      }

      const halfCone = (light.angle * Math.PI) / 180 / 2;

      if (angleDiff > halfCone) {
        return 0; // Outside cone
      }

      // Apply penumbra (soft edge)
      if (light.penumbra && light.penumbra > 0) {
        const penumbraAngle = halfCone * light.penumbra;
        if (angleDiff > halfCone - penumbraAngle) {
          const falloff = 1 - (angleDiff - (halfCone - penumbraAngle)) / penumbraAngle;
          intensity *= falloff;
        }
      }
    }

    // Check for wall occlusion
    if (this.settings.enableShadows && this.isOccluded(light.position, { x, y })) {
      intensity *= 0.1; // Heavily shadowed but not completely dark
    }

    return Math.max(0, Math.min(1, intensity));
  }

  private calculateShadows(shadowMap: Float32Array, _illuminationMap: Float32Array): void {
    const mapWidth = Math.ceil(this.sceneWidth / this.gridSize);
    const mapHeight = Math.ceil(this.sceneHeight / this.gridSize);

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const index = y * mapWidth + x;
        let shadowIntensity = 0;

        // Check shadows from each light source
        for (const light of this.lightSources.values()) {
          if (!light.castsShadows || !light.isEnabled) continue;

          const worldX = x * this.gridSize + this.gridSize / 2;
          const worldY = y * this.gridSize + this.gridSize / 2;

          if (this.isOccluded(light.position, { x: worldX, y: worldY })) {
            shadowIntensity += 0.3; // Accumulate shadow intensity
          }
        }

        shadowMap[index] = Math.min(1, shadowIntensity);
      }
    }
  }

  private calculateVisibility(visibilityMap: Float32Array, illuminationMap: Float32Array): void {
    const mapWidth = Math.ceil(this.sceneWidth / this.gridSize);
    const mapHeight = Math.ceil(this.sceneHeight / this.gridSize);

    // Initialize all points as invisible
    visibilityMap.fill(0);

    for (const vision of this.visionSources.values()) {
      this.calculateVisionContribution(vision, visibilityMap, illuminationMap, mapWidth, mapHeight);
    }
  }

  private calculateVisionContribution(
    vision: VisionSource,
    visibilityMap: Float32Array,
    illuminationMap: Float32Array,
    mapWidth: number,
    mapHeight: number,
  ): void {
    // This would need token position - simplified for now
    const visionX = this.sceneWidth / 2; // Placeholder
    const visionY = this.sceneHeight / 2; // Placeholder

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const worldX = x * this.gridSize + this.gridSize / 2;
        const worldY = y * this.gridSize + this.gridSize / 2;

        const distance = Math.sqrt(Math.pow(worldX - visionX, 2) + Math.pow(worldY - visionY, 2));

        const index = y * mapWidth + x;

        // Check if within vision range
        if (distance <= vision.range) {
          switch (vision.type) {
            case "normal":
              // Requires light to see
              if ((illuminationMap[index] ?? 0) > 0.1) {
                visibilityMap[index] = Math.max(visibilityMap[index] ?? 0, 1);
              }
              break;

            case "darkvision":
              // Can see in darkness within range
              visibilityMap[index] = Math.max(visibilityMap[index] ?? 0, 0.7);
              break;

            case "blindsight":
            case "tremorsense":
              // Sees regardless of light
              if (!this.isOccluded({ x: visionX, y: visionY }, { x: worldX, y: worldY })) {
                visibilityMap[index] = Math.max(visibilityMap[index] ?? 0, 1);
              }
              break;

            case "truesight":
              // Sees through illusions and invisibility
              visibilityMap[index] = Math.max(visibilityMap[index] ?? 0, 1);
              break;
          }
        }
      }
    }
  }

  private isOccluded(from: { x: number; y: number }, to: { x: number; y: number }): boolean {
    // Simple line-of-sight check using ray casting
    for (const wall of this.walls) {
      if (this.lineIntersectsWall(from, to, wall)) {
        return true;
      }
    }
    return false;
  }

  private lineIntersectsWall(
    from: { x: number; y: number },
    to: { x: number; y: number },
    wall: { x1: number; y1: number; x2: number; y2: number },
  ): boolean {
    // Line-line intersection algorithm
    const x1 = from.x,
      y1 = from.y;
    const x2 = to.x,
      y2 = to.y;
    const x3 = wall.x1,
      y3 = wall.y1;
    const x4 = wall.x2,
      y4 = wall.y2;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return false; // Parallel lines

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  /**
   * Update light animations
   */
  updateAnimations(deltaTime: number): void {
    let hasAnimations = false;

    for (const light of this.lightSources.values()) {
      if (light.animation) {
        hasAnimations = true;
        this.updateLightAnimation(light, deltaTime);
      }
    }

    if (hasAnimations) {
      this.invalidateCache();
    }
  }

  private updateLightAnimation(light: LightSource, _deltaTime: number): void {
    if (!light.animation) return;

    const time = Date.now() / 1000;

    switch (light.animation.type) {
      case "flicker":
        {
          const flicker = Math.sin(time * light.animation.speed * 10) * light.animation.amplitude;
          light.intensity = Math.max(0, light.intensity + flicker);
        }
        break;

      case "pulse":
        {
          const pulse = Math.sin(time * light.animation.speed) * light.animation.amplitude;
          light.intensity = Math.max(0, light.intensity + pulse);
        }
        break;

      case "rotate":
        if (light.direction) {
          const rotation = time * light.animation.speed;
          light.direction.x = Math.cos(rotation);
          light.direction.y = Math.sin(rotation);
        }
        break;
    }
  }

  /**
   * Get light intensity at specific point
   */
  getLightIntensityAt(x: number, y: number): number {
    const result = this.calculateLighting();
    const mapWidth = Math.ceil(this.sceneWidth / this.gridSize);

    const gridX = Math.floor(x / this.gridSize);
    const gridY = Math.floor(y / this.gridSize);
    const index = gridY * mapWidth + gridX;

    return result.illuminationMap[index] || 0;
  }

  /**
   * Check if point is visible
   */
  isPointVisible(x: number, y: number, visionId?: string): boolean {
    const result = this.calculateLighting();
    const mapWidth = Math.ceil(this.sceneWidth / this.gridSize);

    const gridX = Math.floor(x / this.gridSize);
    const gridY = Math.floor(y / this.gridSize);
    const index = gridY * mapWidth + gridX;

    return (result.visibilityMap[index] ?? 0) > 0;
  }

  private invalidateCache(): void {
    this.cacheVersion++;
    this.lightingCache.clear();
  }

  /**
   * Export lighting data
   */
  exportLightingData(): {
    lightSources: LightSource[];
    visionSources: VisionSource[];
    ambientLight: AmbientLight;
    settings: LightingSettings;
  } {
    return {
      lightSources: Array.from(this.lightSources.values()),
      visionSources: Array.from(this.visionSources.values()),
      ambientLight: { ...this.ambientLight },
      settings: { ...this.settings },
    };
  }

  /**
   * Import lighting data
   */
  importLightingData(data: {
    lightSources?: LightSource[];
    visionSources?: VisionSource[];
    ambientLight?: AmbientLight;
    settings?: Partial<LightingSettings>;
  }): void {
    if (data.lightSources) {
      this.lightSources.clear();
      data.lightSources.forEach((light) => this.lightSources.set(light.id, light));
    }

    if (data.visionSources) {
      this.visionSources.clear();
      data.visionSources.forEach((vision) => this.visionSources.set(vision.id, vision));
    }

    if (data.ambientLight) {
      this.ambientLight = { ...data.ambientLight };
    }

    if (data.settings) {
      this.settings = { ...this.settings, ...data.settings };
    }

    this.invalidateCache();

    this.emitEvent({
      type: "lighting-imported",
      data: { lightCount: this.lightSources.size, visionCount: this.visionSources.size },
    });
  }

  // Event System
  addEventListener(_listener: (event: LightingEvent) => void): void {
    this.changeListeners.push(listener);
  }

  removeEventListener(_listener: (event: LightingEvent) => void): void {
    const index = this.changeListeners.indexOf(listener);
    if (index > -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  private emitEvent(event: LightingEvent): void {
    this.changeListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        logger.error("Lighting event listener error:", error);
      }
    });
  }
}

// Event Types
export type LightingEvent =
  | { type: "light-added"; data: { lightId: string; light: LightSource } }
  | { type: "light-removed"; data: { lightId: string } }
  | {
      type: "light-updated";
      data: { lightId: string; light: LightSource; updates: Partial<LightSource> };
    }
  | { type: "vision-added"; data: { visionId: string; vision: VisionSource } }
  | { type: "vision-removed"; data: { visionId: string } }
  | { type: "walls-updated"; data: { wallCount: number } }
  | { type: "lighting-imported"; data: { lightCount: number; visionCount: number } };
