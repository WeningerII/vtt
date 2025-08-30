/**
 * Main Scene Management Orchestrator
 * Coordinates grid, layers, and fog of war systems
 */

import { GridManager, GridSettings, GridCoordinate } from './GridManager';
import { logger } from '@vtt/logging';
import { LayerManager, LayerSettings, LayerObject } from './LayerManager';
import { FogOfWarManager, FogSettings, VisionSource, ExploredArea } from './FogOfWarManager';

export interface SceneSettings {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundColor: string;
  gridSettings: GridSettings;
  fogSettings: FogSettings;
  layers?: LayerSettings[];
}

export interface SceneState {
  settings: SceneSettings;
  objects: LayerObject[];
  visionSources: VisionSource[];
  exploredAreas: ExploredArea[];
  walls: Array<{ x1: number; y1: number; x2: number; y2: number }>;
}

export class SceneManager {
  private settings: SceneSettings;
  private gridManager: GridManager;
  private layerManager: LayerManager;
  private fogManager: FogOfWarManager;
  private changeListeners: Array<(_event: SceneChangeEvent) => void> = [];

  constructor(settings: SceneSettings) {
    this.settings = settings;
    this.gridManager = new GridManager(settings.gridSettings, settings.width, settings.height);
    this.layerManager = new LayerManager();
    this.fogManager = new FogOfWarManager(settings.fogSettings, settings.width, settings.height);

    // Import custom layers if provided
    if (settings.layers) {
      settings.layers.forEach(layer => {
        this.layerManager.addLayer(layer);
      });
    }
  }

  // Grid Management Methods
  snapToGrid(x: number, y: number): GridCoordinate {
    return this.gridManager.snapToGrid(x, y);
  }

  pixelToGrid(x: number, y: number): GridCoordinate {
    return this.gridManager.pixelToGrid(x, y);
  }

  gridToPixel(gridCoord: GridCoordinate): GridCoordinate {
    return this.gridManager.gridToPixel(gridCoord);
  }

  calculateGridDistance(from: GridCoordinate, to: GridCoordinate): number {
    return this.gridManager.calculateDistance(from, to);
  }

  getCellsInRadius(center: GridCoordinate, radius: number): GridCoordinate[] {
    return this.gridManager.getCellsInRadius(center, radius);
  }

  updateGridSettings(newSettings: Partial<GridSettings>): void {
    this.gridManager.updateSettings(newSettings);
    this.settings.gridSettings = { ...this.settings.gridSettings, ...newSettings };
    this.emitChange({ type: 'grid-updated', data: newSettings });
  }

  // Layer Management Methods
  addObject(object: LayerObject): void {
    this.layerManager.addObject(object);
    this.emitChange({ type: 'object-added', data: object });
  }

  removeObject(objectId: string): void {
    const object = this.layerManager.getObject(objectId);
    this.layerManager.removeObject(objectId);
    if (object) {
      this.emitChange({ type: 'object-removed', data: { id: objectId, object } });
    }
  }

  updateObject(objectId: string, updates: Partial<LayerObject>): void {
    const oldObject = this.layerManager.getObject(objectId);
    this.layerManager.updateObject(objectId, updates);
    const newObject = this.layerManager.getObject(objectId);
    if (oldObject && newObject) {
      this.emitChange({ 
        type: 'object-updated', 
        data: { id: objectId, oldObject, newObject } 
      });
    }
  }

  getObject(objectId: string): LayerObject | undefined {
    return this.layerManager.getObject(objectId);
  }

  getObjectsInLayer(layerId: string): LayerObject[] {
    return this.layerManager.getObjectsInLayer(layerId);
  }

  getVisibleObjects(): LayerObject[] {
    return this.layerManager.getVisibleObjects();
  }

  getObjectsAtPoint(x: number, y: number): LayerObject[] {
    return this.layerManager.getObjectsAtPoint(x, y);
  }

  getObjectsInArea(x: number, y: number, width: number, height: number): LayerObject[] {
    return this.layerManager.getObjectsInArea(x, y, width, height);
  }

  moveObjectToLayer(objectId: string, targetLayerId: string): void {
    this.layerManager.moveObjectToLayer(objectId, targetLayerId);
    this.emitChange({ 
      type: 'object-layer-changed', 
      data: { objectId, targetLayerId } 
    });
  }

  addLayer(layer: LayerSettings): void {
    this.layerManager.addLayer(layer);
    this.emitChange({ type: 'layer-added', data: layer });
  }

  removeLayer(layerId: string): void {
    const layer = this.layerManager.getLayer(layerId);
    this.layerManager.removeLayer(layerId);
    if (layer) {
      this.emitChange({ type: 'layer-removed', data: { id: layerId, layer } });
    }
  }

  updateLayer(layerId: string, updates: Partial<LayerSettings>): void {
    const oldLayer = this.layerManager.getLayer(layerId);
    this.layerManager.updateLayer(layerId, updates);
    const newLayer = this.layerManager.getLayer(layerId);
    if (oldLayer && newLayer) {
      this.emitChange({ 
        type: 'layer-updated', 
        data: { id: layerId, oldLayer, newLayer } 
      });
    }
  }

  getLayers(): LayerSettings[] {
    return this.layerManager.getLayers();
  }

  toggleLayerVisibility(layerId: string): void {
    this.layerManager.toggleLayerVisibility(layerId);
    const layer = this.layerManager.getLayer(layerId);
    if (layer) {
      this.emitChange({ type: 'layer-visibility-toggled', data: layer });
    }
  }

  // Fog of War Methods
  addVisionSource(source: VisionSource): void {
    this.fogManager.addVisionSource(source);
    this.fogManager.updateVision();
    this.emitChange({ type: 'vision-source-added', data: source });
  }

  removeVisionSource(sourceId: string): void {
    this.fogManager.removeVisionSource(sourceId);
    this.fogManager.updateVision();
    this.emitChange({ type: 'vision-source-removed', data: { id: sourceId } });
  }

  updateVisionSource(sourceId: string, updates: Partial<VisionSource>): void {
    this.fogManager.updateVisionSource(sourceId, updates);
    this.fogManager.updateVision();
    this.emitChange({ 
      type: 'vision-source-updated', 
      data: { id: sourceId, updates } 
    });
  }

  addWall(x1: number, y1: number, x2: number, y2: number): void {
    this.fogManager.addWall(x1, y1, x2, y2);
    this.fogManager.updateVision();
    this.emitChange({ type: 'wall-added', data: { x1, y1, x2, y2 } });
  }

  clearWalls(): void {
    this.fogManager.clearWalls();
    this.fogManager.updateVision();
    this.emitChange({ type: 'walls-cleared', data: {} as Record<string, unknown>});
  }

  calculateLineOfSight(fromX: number, fromY: number, toX: number, toY: number) {
    return this.fogManager.calculateLineOfSight(fromX, fromY, toX, toY);
  }

  canTokenSeeToken(fromTokenId: string, toX: number, toY: number): boolean {
    return this.fogManager.canTokenSeeToken(fromTokenId, toX, toY);
  }

  getVisibleTokens(fromTokenId: string, allTokens: Array<{ id: string; x: number; y: number }>): string[] {
    return this.fogManager.getVisibleTokens(fromTokenId, allTokens);
  }

  addExploredArea(points: Array<{ x: number; y: number }>): string {
    const areaId = this.fogManager.addExploredArea(points);
    this.emitChange({ type: 'area-explored', data: { areaId, points } });
    return areaId;
  }

  clearExploredAreas(): void {
    this.fogManager.clearExploredAreas();
    this.emitChange({ type: 'explored-areas-cleared', data: {} as Record<string, unknown>});
  }

  getFogMask() {
    return this.fogManager.getFogMask();
  }

  updateFogSettings(newSettings: Partial<FogSettings>): void {
    this.fogManager.updateSettings(newSettings);
    this.settings.fogSettings = { ...this.settings.fogSettings, ...newSettings };
    this.emitChange({ type: 'fog-settings-updated', data: newSettings });
  }

  // Scene State Management
  getSceneState(): SceneState {
    const fogData = this.fogManager.exportFogData();
    const layerData = this.layerManager.exportLayers();
    
    return {
      settings: { ...this.settings },
      objects: layerData.objects,
      visionSources: fogData.visionSources,
      exploredAreas: fogData.exploredAreas,
      walls: fogData.walls
    };
  }

  loadSceneState(state: SceneState): void {
    this.settings = state.settings;
    
    // Update grid manager
    this.gridManager = new GridManager(state.settings.gridSettings, state.settings.width, state.settings.height);
    
    // Update layer manager
    this.layerManager.importLayers({
      layers: this.layerManager.getLayers(), // Keep current layers
      objects: state.objects
    });
    
    // Update fog manager
    this.fogManager.importFogData({
      settings: state.settings.fogSettings,
      visionSources: state.visionSources,
      exploredAreas: state.exploredAreas,
      walls: state.walls
    });

    this.emitChange({ type: 'scene-loaded', data: state });
  }

  updateSceneSettings(updates: Partial<SceneSettings>): void {
    this.settings = { ...this.settings, ...updates };
    
    // Update sub-managers if relevant settings changed
    if (updates.gridSettings) {
      this.gridManager = new GridManager(this.settings.gridSettings, this.settings.width, this.settings.height);
    }
    
    if (updates.fogSettings) {
      this.fogManager.updateSettings(updates.fogSettings);
    }

    this.emitChange({ type: 'scene-settings-updated', data: updates });
  }

  getSceneSettings(): SceneSettings {
    return { ...this.settings };
  }

  // Event System
  addChangeListener(_listener: (event: SceneChangeEvent) => void): void {
    this.changeListeners.push(_listener);
  }

  removeChangeListener(_listener: (event: SceneChangeEvent) => void): void {
    const index = this.changeListeners.indexOf(_listener);
    if (index > -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  private emitChange(event: SceneChangeEvent): void {
    this.changeListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Scene change listener error:', error);
      }
    });
  }

  // Utility Methods
  getSceneBounds(): { width: number; height: number } {
    return {
      width: this.settings.width,
      height: this.settings.height
    };
  }

  isPointInScene(x: number, y: number): boolean {
    return x >= 0 && x < this.settings.width && y >= 0 && y < this.settings.height;
  }

  clampToScene(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.max(0, Math.min(this.settings.width - 1, x)),
      y: Math.max(0, Math.min(this.settings.height - 1, y))
    };
  }

  // Cleanup
  dispose(): void {
    this.changeListeners = [];
  }
}

// Event Types
export type SceneChangeEvent = 
  | { type: 'grid-updated'; data: Partial<GridSettings> }
  | { type: 'object-added'; data: LayerObject }
  | { type: 'object-removed'; data: { id: string; object?: LayerObject } }
  | { type: 'object-updated'; data: { id: string; oldObject?: LayerObject; newObject?: LayerObject } }
  | { type: 'object-layer-changed'; data: { objectId: string; targetLayerId: string } }
  | { type: 'layer-added'; data: LayerSettings }
  | { type: 'layer-removed'; data: { id: string; layer?: LayerSettings } }
  | { type: 'layer-updated'; data: { id: string; oldLayer?: LayerSettings; newLayer?: LayerSettings } }
  | { type: 'layer-visibility-toggled'; data?: LayerSettings }
  | { type: 'vision-source-added'; data: VisionSource }
  | { type: 'vision-source-removed'; data: { id: string } }
  | { type: 'vision-source-updated'; data: { id: string; updates: Partial<VisionSource> } }
  | { type: 'wall-added'; data: { x1: number; y1: number; x2: number; y2: number } }
  | { type: 'walls-cleared'; data: Record<string, unknown>}
  | { type: 'area-explored'; data: { areaId: string; points: Array<{ x: number; y: number }> } }
  | { type: 'explored-areas-cleared'; data: Record<string, unknown>}
  | { type: 'fog-settings-updated'; data: Partial<FogSettings> }
  | { type: 'scene-loaded'; data: SceneState }
  | { type: 'scene-settings-updated'; data: Partial<SceneSettings> };
