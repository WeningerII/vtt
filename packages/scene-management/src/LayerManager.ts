/**
 * Scene Layer Management System
 * Manages different layers in a VTT scene (background, objects, tokens, effects, UI)
 */

export type LayerType =
  | "background"
  | "terrain"
  | "objects"
  | "tokens"
  | "effects"
  | "lighting"
  | "fog"
  | "ui";

export interface LayerSettings {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  opacity: number;
  zIndex: number;
  blendMode?: "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten";
}

export interface LayerObject {
  id: string;
  layerId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  visible: boolean;
  data: any;
}

export class LayerManager {
  private layers: Map<string, LayerSettings> = new Map();
  private objects: Map<string, LayerObject> = new Map();
  private layerOrder: string[] = [];

  constructor() {
    this.initializeDefaultLayers();
  }

  private initializeDefaultLayers(): void {
    const defaultLayers: LayerSettings[] = [
      {
        id: "background",
        name: "Background",
        type: "background",
        visible: true,
        locked: false,
        opacity: 1.0,
        zIndex: 0,
      },
      {
        id: "terrain",
        name: "Terrain",
        type: "terrain",
        visible: true,
        locked: false,
        opacity: 1.0,
        zIndex: 100,
      },
      {
        id: "objects",
        name: "Objects",
        type: "objects",
        visible: true,
        locked: false,
        opacity: 1.0,
        zIndex: 200,
      },
      {
        id: "tokens",
        name: "Tokens",
        type: "tokens",
        visible: true,
        locked: false,
        opacity: 1.0,
        zIndex: 300,
      },
      {
        id: "effects",
        name: "Effects",
        type: "effects",
        visible: true,
        locked: false,
        opacity: 1.0,
        zIndex: 400,
      },
      {
        id: "lighting",
        name: "Lighting",
        type: "lighting",
        visible: true,
        locked: false,
        opacity: 1.0,
        zIndex: 500,
      },
      {
        id: "fog",
        name: "Fog of War",
        type: "fog",
        visible: true,
        locked: false,
        opacity: 1.0,
        zIndex: 600,
      },
      {
        id: "ui",
        name: "UI",
        type: "ui",
        visible: true,
        locked: false,
        opacity: 1.0,
        zIndex: 1000,
      },
    ];

    defaultLayers.forEach((layer) => {
      this.layers.set(layer.id, layer);
      this.layerOrder.push(layer.id);
    });
  }

  /**
   * Add a new layer
   */
  addLayer(layer: LayerSettings): void {
    this.layers.set(layer.id, layer);

    // Insert at appropriate position based on zIndex
    const insertIndex = this.layerOrder.findIndex((layerId) => {
      const existingLayer = this.layers.get(layerId);
      return existingLayer && existingLayer.zIndex > layer.zIndex;
    });

    if (insertIndex === -1) {
      this.layerOrder.push(layer.id);
    } else {
      this.layerOrder.splice(insertIndex, 0, layer.id);
    }
  }

  /**
   * Remove a layer and all its objects
   */
  removeLayer(layerId: string): void {
    if (!this.layers.has(layerId)) {
      throw new Error(`Layer ${layerId} does not exist`);
    }

    // Remove all objects in this layer
    const objectsToRemove = Array.from(this.objects.values())
      .filter((obj) => obj.layerId === layerId)
      .map((obj) => obj.id);

    objectsToRemove.forEach((objId) => this.objects.delete(objId));

    // Remove layer
    this.layers.delete(layerId);
    this.layerOrder = this.layerOrder.filter((id) => id !== layerId);
  }

  /**
   * Update layer settings
   */
  updateLayer(layerId: string, updates: Partial<LayerSettings>): void {
    const layer = this.layers.get(layerId);
    if (!layer) {
      throw new Error(`Layer ${layerId} does not exist`);
    }

    const updatedLayer = { ...layer, ...updates, id: layerId };
    this.layers.set(layerId, updatedLayer);

    // If zIndex changed, reorder layers
    if (updates.zIndex !== undefined && updates.zIndex !== layer.zIndex) {
      this.reorderLayers();
    }
  }

  private reorderLayers(): void {
    this.layerOrder.sort((a, b) => {
      const layerA = this.layers.get(a);
      const layerB = this.layers.get(b);
      return (layerA?.zIndex ?? 0) - (layerB?.zIndex ?? 0);
    });
  }

  /**
   * Get layer by ID
   */
  getLayer(layerId: string): LayerSettings | undefined {
    return this.layers.get(layerId);
  }

  /**
   * Get all layers in order
   */
  getLayers(): LayerSettings[] {
    return this.layerOrder
      .map((id) => this.layers.get(id))
      .filter((layer): layer is LayerSettings => layer !== undefined);
  }

  /**
   * Get layers by type
   */
  getLayersByType(type: LayerType): LayerSettings[] {
    return Array.from(this.layers.values()).filter((layer) => layer.type === type);
  }

  /**
   * Add object to layer
   */
  addObject(object: LayerObject): void {
    if (!this.layers.has(object.layerId)) {
      throw new Error(`Layer ${object.layerId} does not exist`);
    }

    this.objects.set(object.id, object);
  }

  /**
   * Remove object from layer
   */
  removeObject(objectId: string): void {
    this.objects.delete(objectId);
  }

  /**
   * Update object
   */
  updateObject(objectId: string, updates: Partial<LayerObject>): void {
    const object = this.objects.get(objectId);
    if (!object) {
      throw new Error(`Object ${objectId} does not exist`);
    }

    const updatedObject = { ...object, ...updates, id: objectId };
    this.objects.set(objectId, updatedObject);
  }

  /**
   * Get object by ID
   */
  getObject(objectId: string): LayerObject | undefined {
    return this.objects.get(objectId);
  }

  /**
   * Get all objects in a layer
   */
  getObjectsInLayer(layerId: string): LayerObject[] {
    return Array.from(this.objects.values()).filter((obj) => obj.layerId === layerId);
  }

  /**
   * Get all visible objects in rendering order
   */
  getVisibleObjects(): LayerObject[] {
    const visibleObjects: LayerObject[] = [];

    for (const layerId of this.layerOrder) {
      const layer = this.layers.get(layerId);
      if (!layer || !layer.visible) {continue;}

      const layerObjects = this.getObjectsInLayer(layerId).filter((obj) => obj.visible);

      visibleObjects.push(...layerObjects);
    }

    return visibleObjects;
  }

  /**
   * Move object to different layer
   */
  moveObjectToLayer(objectId: string, targetLayerId: string): void {
    if (!this.layers.has(targetLayerId)) {
      throw new Error(`Target layer ${targetLayerId} does not exist`);
    }

    const object = this.objects.get(objectId);
    if (!object) {
      throw new Error(`Object ${objectId} does not exist`);
    }

    this.updateObject(objectId, { layerId: targetLayerId });
  }

  /**
   * Toggle layer visibility
   */
  toggleLayerVisibility(layerId: string): void {
    const layer = this.layers.get(layerId);
    if (!layer) {
      throw new Error(`Layer ${layerId} does not exist`);
    }

    this.updateLayer(layerId, { visible: !layer.visible });
  }

  /**
   * Lock/unlock layer
   */
  toggleLayerLock(layerId: string): void {
    const layer = this.layers.get(layerId);
    if (!layer) {
      throw new Error(`Layer ${layerId} does not exist`);
    }

    this.updateLayer(layerId, { locked: !layer.locked });
  }

  /**
   * Get objects at specific coordinates
   */
  getObjectsAtPoint(x: number, y: number): LayerObject[] {
    return this.getVisibleObjects().filter((obj) => {
      return x >= obj.x && x <= obj.x + obj.width && y >= obj.y && y <= obj.y + obj.height;
    });
  }

  /**
   * Get objects in rectangular area
   */
  getObjectsInArea(x: number, y: number, width: number, height: number): LayerObject[] {
    return this.getVisibleObjects().filter((obj) => {
      return !(
        obj.x > x + width ||
        obj.x + obj.width < x ||
        obj.y > y + height ||
        obj.y + obj.height < y
      );
    });
  }

  /**
   * Clear all objects from a layer
   */
  clearLayer(layerId: string): void {
    const objectsToRemove = Array.from(this.objects.values())
      .filter((obj) => obj.layerId === layerId)
      .map((obj) => obj.id);

    objectsToRemove.forEach((objId) => this.objects.delete(objId));
  }

  /**
   * Export layer configuration
   */
  exportLayers(): { layers: LayerSettings[]; objects: LayerObject[] } {
    return {
      layers: this.getLayers(),
      objects: Array.from(this.objects.values()),
    };
  }

  /**
   * Import layer configuration
   */
  importLayers(data: { layers: LayerSettings[]; objects: LayerObject[] }): void {
    // Clear existing data
    this.layers.clear();
    this.objects.clear();
    this.layerOrder = [];

    // Import layers
    data.layers.forEach((layer) => {
      this.layers.set(layer.id, layer);
      this.layerOrder.push(layer.id);
    });

    // Import objects
    data.objects.forEach((object) => {
      this.objects.set(object.id, object);
    });

    // Reorder layers by zIndex
    this.reorderLayers();
  }
}
