export type EntityId = number;

export interface LightSource {
  type: "point" | "directional" | "spot" | "area";
  intensity: number; // 0-1
  color: [number, number, number]; // RGB
  range: number; // in grid units
  falloff: number; // how quickly light fades
  castsShadows: boolean;
  flickerRate: number; // 0 = no flicker, 1 = fast flicker
  enabled: boolean;
}

export interface SpotLightData extends LightSource {
  direction: number; // radians
  coneAngle: number; // radians
  penumbraAngle: number; // radians
}

export interface LightingData {
  lightSources: Map<string, LightSource>;
  ambientLight: [number, number, number];
  ambientIntensity: number;
  shadowsEnabled: boolean;
  dynamicLighting: boolean;
}

export class LightingStore {
  private data: Map<EntityId, LightingData> = new Map();
  private globalLighting: LightingData;
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.globalLighting = {
      lightSources: new Map(),
      ambientLight: [0.2, 0.2, 0.2],
      ambientIntensity: 0.3,
      shadowsEnabled: true,
      dynamicLighting: true,
    };
  }

  add(id: EntityId, data: Partial<LightingData> = {}): void {
    this.data.set(id, {
      lightSources: data.lightSources ?? new Map(),
      ambientLight: data.ambientLight ?? [1, 1, 1],
      ambientIntensity: data.ambientIntensity ?? 1,
      shadowsEnabled: data.shadowsEnabled ?? true,
      dynamicLighting: data.dynamicLighting ?? true,
    });
  }

  get(id: EntityId): LightingData | undefined {
    return this.data.get(id);
  }

  has(id: EntityId): boolean {
    return this.data.has(id);
  }

  remove(id: EntityId): void {
    this.data.delete(id);
  }

  addLightSource(id: EntityId, lightId: string, light: LightSource): void {
    const lighting = this.data.get(id);
    if (lighting) {
      lighting.lightSources.set(lightId, { ...light });
    }
  }

  removeLightSource(id: EntityId, lightId: string): void {
    const lighting = this.data.get(id);
    if (lighting) {
      lighting.lightSources.delete(lightId);
    }
  }

  updateLightSource(id: EntityId, lightId: string, updates: Partial<LightSource>): void {
    const lighting = this.data.get(id);
    if (lighting) {
      const light = lighting.lightSources.get(lightId);
      if (light) {
        Object.assign(light, updates);
      }
    }
  }

  toggleLight(id: EntityId, lightId: string): boolean {
    const lighting = this.data.get(id);
    if (lighting) {
      const light = lighting.lightSources.get(lightId);
      if (light) {
        light.enabled = !light.enabled;
        return light.enabled;
      }
    }
    return false;
  }

  setLightIntensity(id: EntityId, lightId: string, intensity: number): void {
    const lighting = this.data.get(id);
    if (lighting) {
      const light = lighting.lightSources.get(lightId);
      if (light) {
        light.intensity = Math.max(0, Math.min(1, intensity));
      }
    }
  }

  setAmbientLight(id: EntityId, color: [number, number, number], intensity: number): void {
    const lighting = this.data.get(id);
    if (lighting) {
      lighting.ambientLight = [...color];
      lighting.ambientIntensity = Math.max(0, Math.min(1, intensity));
    }
  }

  // Global lighting methods
  setGlobalAmbient(color: [number, number, number], intensity: number): void {
    this.globalLighting.ambientLight = [...color];
    this.globalLighting.ambientIntensity = Math.max(0, Math.min(1, intensity));
  }

  getGlobalLighting(): LightingData {
    return this.globalLighting;
  }

  addGlobalLight(lightId: string, light: LightSource): void {
    this.globalLighting.lightSources.set(lightId, { ...light });
  }

  removeGlobalLight(lightId: string): void {
    this.globalLighting.lightSources.delete(lightId);
  }

  getAllLightSources(): Array<{ entityId: EntityId | null; lightId: string; light: LightSource }> {
    const lights: Array<{ entityId: EntityId | null; lightId: string; light: LightSource }> = [];

    // Add global lights
    for (const [lightId, light] of this.globalLighting.lightSources) {
      lights.push({ entityId: null, lightId, light });
    }

    // Add entity lights
    for (const [entityId, lighting] of this.data) {
      for (const [lightId, light] of lighting.lightSources) {
        lights.push({ entityId, lightId, light });
      }
    }

    return lights;
  }

  calculateLightLevel(_x: number, _y: number): number {
    let totalIntensity = this.globalLighting.ambientIntensity;

    // Calculate contribution from all light sources
    for (const { light } of this.getAllLightSources()) {
      if (!light.enabled) continue;

      // This is a simplified calculation - in a real implementation,
      // you'd need the actual position of the light source
      const distance = 1; // Placeholder
      if (distance <= light.range) {
        const attenuation = Math.max(0, 1 - (distance / light.range) ** light.falloff);
        totalIntensity += light.intensity * attenuation;
      }
    }

    return Math.min(1, totalIntensity);
  }

  // Torch/lantern helpers
  createTorch(id: EntityId): void {
    this.addLightSource(id, "torch", {
      type: "point",
      intensity: 0.8,
      color: [1, 0.8, 0.4],
      range: 4, // 20 feet bright, 20 feet dim
      falloff: 2,
      castsShadows: true,
      flickerRate: 0.1,
      enabled: true,
    });
  }

  createLantern(id: EntityId): void {
    this.addLightSource(id, "lantern", {
      type: "point",
      intensity: 1,
      color: [1, 0.9, 0.6],
      range: 6, // 30 feet bright, 30 feet dim
      falloff: 1.5,
      castsShadows: true,
      flickerRate: 0.02,
      enabled: true,
    });
  }

  createMagicalLight(id: EntityId, color: [number, number, number] = [1, 1, 1]): void {
    this.addLightSource(id, "magical", {
      type: "point",
      intensity: 1,
      color,
      range: 4, // 20 feet bright light
      falloff: 1,
      castsShadows: false,
      flickerRate: 0,
      enabled: true,
    });
  }
}
