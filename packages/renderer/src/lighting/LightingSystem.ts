import { EventEmitter } from 'events';
import { logger } from '@vtt/logging';

export interface Light {
  id: string;
  type: 'point' | 'directional' | 'spot' | 'area';
  position: { x: number; y: number; z: number };
  direction?: { x: number; y: number; z: number };
  color: { r: number; g: number; b: number };
  intensity: number;
  range: number;
  falloff: 'linear' | 'quadratic' | 'exponential';
  castsShadows: boolean;
  enabled: boolean;
  
  // Spot light specific
  innerCone?: number;
  outerCone?: number;
  
  // Area light specific
  width?: number;
  height?: number;
  
  // Animation
  flickering?: {
    enabled: boolean;
    frequency: number;
    intensity: number;
  };
  
  // Gameplay properties
  ownerId?: string;
  tokenId?: string;
  isPlayerVisible: boolean;
  isDynamic: boolean;
}

export interface LightingSettings {
  globalAmbient: { r: number; g: number; b: number };
  shadowQuality: 'low' | 'medium' | 'high' | 'ultra';
  maxShadowDistance: number;
  enableSoftShadows: boolean;
  enableVolumetricLighting: boolean;
  enableColoredLighting: boolean;
  lightBounces: number;
  exposureCompensation: number;
}

export interface ShadowCaster {
  id: string;
  type: 'token' | 'wall' | 'object';
  position: { x: number; y: number; z: number };
  bounds: { width: number; height: number; depth: number };
  castsShadows: boolean;
  receivesShadows: boolean;
  opacity: number;
}

export interface LightingZone {
  id: string;
  name: string;
  bounds: { x: number; y: number; width: number; height: number };
  ambientOverride?: { r: number; g: number; b: number };
  lightMultiplier: number;
  shadowMultiplier: number;
  fogDensity: number;
}

export class LightingSystem extends EventEmitter {
  private lights: Map<string, Light> = new Map();
  private shadowCasters: Map<string, ShadowCaster> = new Map();
  private lightingZones: Map<string, LightingZone> = new Map();
  private settings: LightingSettings;
  private lightingBuffer: Float32Array;
  private shadowMap: Map<string, ImageData> = new Map();
  private animationFrame: number | null = null;

  constructor(settings?: Partial<LightingSettings>) {
    super();
    this.setMaxListeners(100);
    
    this.settings = {
      globalAmbient: { r: 0.1, g: 0.1, b: 0.15 },
      shadowQuality: 'medium',
      maxShadowDistance: 100,
      enableSoftShadows: true,
      enableVolumetricLighting: false,
      enableColoredLighting: true,
      lightBounces: 1,
      exposureCompensation: 0,
      ...settings,
    };

    this.lightingBuffer = new Float32Array(1024 * 1024 * 4); // RGBA lighting buffer
    this.startLightingLoop();
  }

  /**
   * Add a light to the scene
   */
  addLight(light: Light): void {
    this.lights.set(light.id, light);
    this.emit('lightAdded', light);
    this.invalidateLighting();
    logger.debug(`Light added: ${light.id} (${light.type})`);
  }

  /**
   * Update an existing light
   */
  updateLight(lightId: string, updates: Partial<Light>): boolean {
    const light = this.lights.get(lightId);
    if (!light) {
      return false;
    }

    Object.assign(light, updates);
    this.emit('lightUpdated', light);
    this.invalidateLighting();
    
    return true;
  }

  /**
   * Remove a light from the scene
   */
  removeLight(lightId: string): boolean {
    const light = this.lights.get(lightId);
    if (!light) {
      return false;
    }

    this.lights.delete(lightId);
    this.shadowMap.delete(lightId);
    this.emit('lightRemoved', lightId, light);
    this.invalidateLighting();
    
    return true;
  }

  /**
   * Add a shadow caster
   */
  addShadowCaster(caster: ShadowCaster): void {
    this.shadowCasters.set(caster.id, caster);
    this.emit('shadowCasterAdded', caster);
    this.invalidateShadows();
  }

  /**
   * Remove a shadow caster
   */
  removeShadowCaster(casterId: string): boolean {
    const caster = this.shadowCasters.get(casterId);
    if (!caster) {
      return false;
    }

    this.shadowCasters.delete(casterId);
    this.emit('shadowCasterRemoved', casterId, caster);
    this.invalidateShadows();
    
    return true;
  }

  /**
   * Add a lighting zone
   */
  addLightingZone(zone: LightingZone): void {
    this.lightingZones.set(zone.id, zone);
    this.emit('lightingZoneAdded', zone);
    this.invalidateLighting();
  }

  /**
   * Calculate lighting at a specific point
   */
  calculateLightingAtPoint(x: number, y: number, z: number = 0): { r: number; g: number; b: number } {
    let totalLight = { ...this.settings.globalAmbient };

    // Check lighting zones
    const zone = this.getLightingZoneAtPoint(x, y);
    if (zone?.ambientOverride) {
      totalLight = { ...zone.ambientOverride };
    }

    // Calculate contribution from each light
    for (const light of this.lights.values()) {
      if (!light.enabled) {continue;}

      const contribution = this.calculateLightContribution(light, x, y, z);
      const shadowFactor = this.calculateShadowFactor(light, x, y, z);
      const zoneFactor = zone?.lightMultiplier || 1;

      totalLight.r += contribution.r * shadowFactor * zoneFactor;
      totalLight.g += contribution.g * shadowFactor * zoneFactor;
      totalLight.b += contribution.b * shadowFactor * zoneFactor;
    }

    // Apply exposure compensation
    const exposure = Math.pow(2, this.settings.exposureCompensation);
    totalLight.r *= exposure;
    totalLight.g *= exposure;
    totalLight.b *= exposure;

    // Clamp values
    totalLight.r = Math.min(1, Math.max(0, totalLight.r));
    totalLight.g = Math.min(1, Math.max(0, totalLight.g));
    totalLight.b = Math.min(1, Math.max(0, totalLight.b));

    return totalLight;
  }

  /**
   * Check if a point is in shadow from a specific light
   */
  isPointInShadow(lightId: string, x: number, y: number, z: number = 0): boolean {
    const light = this.lights.get(lightId);
    if (!light || !light.castsShadows) {
      return false;
    }

    return this.calculateShadowFactor(light, x, y, z) < 0.5;
  }

  /**
   * Get all lights affecting a specific area
   */
  getLightsInArea(bounds: { x: number; y: number; width: number; height: number }): Light[] {
    return Array.from(this.lights.values()).filter(light => {
      if (!light.enabled) {return false;}

      const distance = Math.sqrt(
        Math.pow(light.position.x - (bounds.x + bounds.width / 2), 2) +
        Math.pow(light.position.y - (bounds.y + bounds.height / 2), 2)
      );

      return distance <= light.range + Math.max(bounds.width, bounds.height) / 2;
    });
  }

  /**
   * Create a torch light attached to a token
   */
  createTorchLight(tokenId: string, position: { x: number; y: number; z: number }): Light {
    const torchLight: Light = {
      id: `torch_${tokenId}`,
      type: 'point',
      position,
      color: { r: 1.0, g: 0.7, b: 0.3 },
      intensity: 1.5,
      range: 20,
      falloff: 'quadratic',
      castsShadows: true,
      enabled: true,
      tokenId,
      isPlayerVisible: true,
      isDynamic: true,
      flickering: {
        enabled: true,
        frequency: 2.0,
        intensity: 0.2,
      },
    };

    this.addLight(torchLight);
    return torchLight;
  }

  /**
   * Create a lantern light
   */
  createLanternLight(tokenId: string, position: { x: number; y: number; z: number }): Light {
    const lanternLight: Light = {
      id: `lantern_${tokenId}`,
      type: 'point',
      position,
      color: { r: 1.0, g: 0.9, b: 0.7 },
      intensity: 2.0,
      range: 30,
      falloff: 'linear',
      castsShadows: true,
      enabled: true,
      tokenId,
      isPlayerVisible: true,
      isDynamic: true,
    };

    this.addLight(lanternLight);
    return lanternLight;
  }

  /**
   * Create a magical light effect
   */
  createMagicalLight(
    id: string,
    position: { x: number; y: number; z: number },
    color: { r: number; g: number; b: number },
    intensity: number = 1.0,
    range: number = 15
  ): Light {
    const magicalLight: Light = {
      id,
      type: 'point',
      position,
      color,
      intensity,
      range,
      falloff: 'exponential',
      castsShadows: false,
      enabled: true,
      isPlayerVisible: true,
      isDynamic: true,
      flickering: {
        enabled: true,
        frequency: 0.5,
        intensity: 0.1,
      },
    };

    this.addLight(magicalLight);
    return magicalLight;
  }

  /**
   * Update lighting settings
   */
  updateSettings(newSettings: Partial<LightingSettings>): void {
    Object.assign(this.settings, newSettings);
    this.emit('settingsUpdated', this.settings);
    this.invalidateLighting();
  }

  /**
   * Get current lighting settings
   */
  getSettings(): LightingSettings {
    return { ...this.settings };
  }

  /**
   * Get all lights
   */
  getAllLights(): Light[] {
    return Array.from(this.lights.values());
  }

  /**
   * Get lights visible to a specific player
   */
  getPlayerVisibleLights(playerId: string): Light[] {
    return Array.from(this.lights.values()).filter(light => 
      light.isPlayerVisible || light.ownerId === playerId
    );
  }

  private calculateLightContribution(light: Light, x: number, y: number, z: number): { r: number; g: number; b: number } {
    const dx = x - light.position.x;
    const dy = y - light.position.y;
    const dz = z - light.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance > light.range) {
      return { r: 0, g: 0, b: 0 };
    }

    // Calculate attenuation based on falloff type
    let attenuation = 1;
    const normalizedDistance = distance / light.range;

    switch (light.falloff) {
      case 'linear':
        attenuation = Math.max(0, 1 - normalizedDistance);
        break;
      case 'quadratic':
        attenuation = Math.max(0, 1 - normalizedDistance * normalizedDistance);
        break;
      case 'exponential':
        attenuation = Math.exp(-normalizedDistance * 3);
        break;
    }

    // Apply spot light cone for spot lights
    if (light.type === 'spot' && light.direction && light.innerCone && light.outerCone) {
      const lightDir = {
        x: light.direction.x,
        y: light.direction.y,
        z: light.direction.z,
      };
      const toPoint = { x: dx, y: dy, z: dz };
      const dotProduct = (lightDir.x * toPoint.x + lightDir.y * toPoint.y + lightDir.z * toPoint.z) / distance;
      const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
      
      if (angle > light.outerCone) {
        return { r: 0, g: 0, b: 0 };
      } else if (angle > light.innerCone) {
        const coneAttenuation = (light.outerCone - angle) / (light.outerCone - light.innerCone);
        attenuation *= coneAttenuation;
      }
    }

    // Apply flickering if enabled
    let flickerMultiplier = 1;
    if (light.flickering?.enabled) {
      const time = Date.now() / 1000;
      const flicker = Math.sin(time * light.flickering.frequency * Math.PI * 2) * light.flickering.intensity;
      flickerMultiplier = 1 + flicker;
    }

    const finalIntensity = light.intensity * attenuation * flickerMultiplier;

    return {
      r: light.color.r * finalIntensity,
      g: light.color.g * finalIntensity,
      b: light.color.b * finalIntensity,
    };
  }

  private calculateShadowFactor(light: Light, x: number, y: number, z: number): number {
    if (!light.castsShadows) {
      return 1.0;
    }

    // Simplified shadow calculation - would use proper shadow mapping in production
    for (const caster of this.shadowCasters.values()) {
      if (!caster.castsShadows) {continue;}

      if (this.isPointInShadowOfCaster(light, caster, x, y, z)) {
        return 0.2; // 20% light in shadow
      }
    }

    return 1.0;
  }

  private isPointInShadowOfCaster(light: Light, caster: ShadowCaster, x: number, y: number, z: number): boolean {
    // Simple 2D shadow casting - check if point is behind caster relative to light
    const lightToCaster = {
      x: caster.position.x - light.position.x,
      y: caster.position.y - light.position.y,
    };
    const lightToPoint = {
      x: x - light.position.x,
      y: y - light.position.y,
    };

    // Check if point is in the shadow cone behind the caster
    const casterDistance = Math.sqrt(lightToCaster.x * lightToCaster.x + lightToCaster.y * lightToCaster.y);
    const pointDistance = Math.sqrt(lightToPoint.x * lightToPoint.x + lightToPoint.y * lightToPoint.y);

    if (pointDistance <= casterDistance) {
      return false; // Point is closer to light than caster
    }

    // Check if point is within shadow cone
    const shadowDirection = {
      x: lightToCaster.x / casterDistance,
      y: lightToCaster.y / casterDistance,
    };

    const casterToPoint = {
      x: x - caster.position.x,
      y: y - caster.position.y,
    };

    const projectionLength = casterToPoint.x * shadowDirection.x + casterToPoint.y * shadowDirection.y;
    
    if (projectionLength < 0) {
      return false; // Point is not behind caster
    }

    const projectionPoint = {
      x: caster.position.x + shadowDirection.x * projectionLength,
      y: caster.position.y + shadowDirection.y * projectionLength,
    };

    const distanceFromShadowLine = Math.sqrt(
      Math.pow(x - projectionPoint.x, 2) + Math.pow(y - projectionPoint.y, 2)
    );

    const shadowWidth = caster.bounds.width / 2 + (projectionLength * 0.1); // Shadow expands with distance
    
    return distanceFromShadowLine <= shadowWidth;
  }

  private getLightingZoneAtPoint(x: number, y: number): LightingZone | undefined {
    for (const zone of this.lightingZones.values()) {
      if (x >= zone.bounds.x && x <= zone.bounds.x + zone.bounds.width &&
          y >= zone.bounds.y && y <= zone.bounds.y + zone.bounds.height) {
        return zone;
      }
    }
    return undefined;
  }

  private invalidateLighting(): void {
    this.emit('lightingInvalidated');
  }

  private invalidateShadows(): void {
    this.shadowMap.clear();
    this.emit('shadowsInvalidated');
  }

  private startLightingLoop(): void {
    const updateLighting = () => {
      // Update flickering lights
      let needsUpdate = false;
      for (const light of this.lights.values()) {
        if (light.flickering?.enabled) {
          needsUpdate = true;
          break;
        }
      }

      if (needsUpdate) {
        this.emit('lightingUpdated');
      }

      this.animationFrame = requestAnimationFrame(updateLighting);
    };

    this.animationFrame = requestAnimationFrame(updateLighting);
  }

  destroy(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    this.lights.clear();
    this.shadowCasters.clear();
    this.lightingZones.clear();
    this.shadowMap.clear();
  }
}
