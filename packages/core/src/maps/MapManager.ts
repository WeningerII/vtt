import { EventEmitter } from 'events';
import { logger } from '@vtt/logging';

export interface MapLayer {
  id: string;
  name: string;
  type: 'background' | 'grid' | 'tokens' | 'effects' | 'fog' | 'lighting';
  visible: boolean;
  locked: boolean;
  opacity: number;
  zIndex: number;
  data: any;
}

export interface GridSettings {
  type: 'square' | 'hex' | 'none';
  size: number;
  color: string;
  opacity: number;
  snapToGrid: boolean;
  showGrid: boolean;
  offset: { x: number; y: number };
}

export interface MapSettings {
  width: number;
  height: number;
  scale: number;
  backgroundColor: string;
  grid: GridSettings;
  lighting: {
    enabled: boolean;
    ambientLight: number;
    globalIllumination: boolean;
  };
  fogOfWar: {
    enabled: boolean;
    exploredAreas: Array<{ x: number; y: number; radius: number }>;
    revealedAreas: Array<{ x: number; y: number; width: number; height: number }>;
  };
}

export interface Map {
  id: string;
  name: string;
  description?: string;
  settings: MapSettings;
  layers: MapLayer[];
  backgroundImage?: string;
  thumbnailUrl?: string;
  ownerId: string;
  campaignId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
}

export class MapManager extends EventEmitter {
  private maps = new Map<string, Map>();
  private activeMapId: string | null = null;
  private viewport: ViewportState = { x: 0, y: 0, zoom: 1, rotation: 0 };
  private panState: {
    isPanning: boolean;
    startPosition?: { x: number; y: number };
    startViewport?: { x: number; y: number };
  } = { isPanning: false };

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  /**
   * Create a new map
   */
  createMap(mapData: Omit<Map, 'id' | 'createdAt' | 'updatedAt'>): Map {
    const map: Map = {
      ...mapData,
      id: this.generateMapId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.maps.set(map.id, map);
    this.emit('mapCreated', map);
    logger.info(`Map created: ${map.id} (${map.name})`);
    
    return map;
  }

  /**
   * Update an existing map
   */
  updateMap(mapId: string, changes: Partial<Omit<Map, 'id' | 'createdAt'>>, userId: string): boolean {
    const map = this.maps.get(mapId);
    if (!map) {
      logger.warn(`Attempted to update non-existent map: ${mapId}`);
      return false;
    }

    if (map.ownerId !== userId) {
      logger.warn(`User ${userId} attempted to update map ${mapId} without permission`);
      return false;
    }

    const updatedMap: Map = {
      ...map,
      ...changes,
      updatedAt: new Date(),
    };

    this.maps.set(mapId, updatedMap);
    this.emit('mapUpdated', updatedMap);
    logger.debug(`Map updated: ${mapId}`);
    
    return true;
  }

  /**
   * Delete a map
   */
  deleteMap(mapId: string, userId: string): boolean {
    const map = this.maps.get(mapId);
    if (!map) {
      return false;
    }

    if (map.ownerId !== userId) {
      logger.warn(`User ${userId} attempted to delete map ${mapId} without permission`);
      return false;
    }

    this.maps.delete(mapId);
    if (this.activeMapId === mapId) {
      this.activeMapId = null;
    }
    
    this.emit('mapDeleted', mapId, map);
    logger.info(`Map deleted: ${mapId}`);
    
    return true;
  }

  /**
   * Get a map by ID
   */
  getMap(mapId: string): Map | undefined {
    return this.maps.get(mapId);
  }

  /**
   * Get all maps for a campaign
   */
  getCampaignMaps(campaignId: string): Map[] {
    return (Array.from(this.maps.values()) as Map[]).filter(map => map.campaignId === campaignId);
  }

  /**
   * Set the active map
   */
  setActiveMap(mapId: string, userId: string): boolean {
    const map = this.maps.get(mapId);
    if (!map) {
      return false;
    }

    // Deactivate current active map
    if (this.activeMapId) {
      const currentMap = this.maps.get(this.activeMapId);
      if (currentMap) {
        currentMap.isActive = false;
        this.emit('mapDeactivated', this.activeMapId);
      }
    }

    // Activate new map
    map.isActive = true;
    this.activeMapId = mapId;
    this.emit('mapActivated', mapId, userId);
    logger.info(`Map activated: ${mapId}`);
    
    return true;
  }

  /**
   * Get the active map
   */
  getActiveMap(): Map | null {
    return this.activeMapId ? this.maps.get(this.activeMapId) || null : null;
  }

  /**
   * Update viewport (pan/zoom)
   */
  updateViewport(viewport: Partial<ViewportState>, userId: string): void {
    this.viewport = { ...this.viewport, ...viewport };
    this.emit('viewportChanged', this.viewport, userId);
  }

  /**
   * Get current viewport
   */
  getViewport(): ViewportState {
    return { ...this.viewport };
  }

  /**
   * Start panning
   */
  startPan(position: { x: number; y: number }): void {
    this.panState = {
      isPanning: true,
      startPosition: position,
      startViewport: { x: this.viewport.x, y: this.viewport.y },
    };
  }

  /**
   * Update pan position
   */
  updatePan(position: { x: number; y: number }, userId: string): void {
    if (!this.panState.isPanning || !this.panState.startPosition || !this.panState.startViewport) {
      return;
    }

    const deltaX = position.x - this.panState.startPosition.x;
    const deltaY = position.y - this.panState.startPosition.y;

    this.updateViewport({
      x: this.panState.startViewport.x - deltaX / this.viewport.zoom,
      y: this.panState.startViewport.y - deltaY / this.viewport.zoom,
    }, userId);
  }

  /**
   * End panning
   */
  endPan(): void {
    this.panState = { isPanning: false };
  }

  /**
   * Zoom to fit map
   */
  zoomToFit(containerWidth: number, containerHeight: number, userId: string): void {
    const activeMap = this.getActiveMap();
    if (!activeMap) {return;}

    const scaleX = containerWidth / activeMap.settings.width;
    const scaleY = containerHeight / activeMap.settings.height;
    const zoom = Math.min(scaleX, scaleY) * 0.9; // 90% to add padding

    this.updateViewport({
      x: 0,
      y: 0,
      zoom,
    }, userId);
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX / this.viewport.zoom) + this.viewport.x,
      y: (screenY / this.viewport.zoom) + this.viewport.y,
    };
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: (worldX - this.viewport.x) * this.viewport.zoom,
      y: (worldY - this.viewport.y) * this.viewport.zoom,
    };
  }

  /**
   * Snap position to grid
   */
  snapToGrid(position: { x: number; y: number }): { x: number; y: number } {
    const activeMap = this.getActiveMap();
    if (!activeMap || !activeMap.settings.grid.snapToGrid) {
      return position;
    }

    const grid = activeMap.settings.grid;
    const gridSize = grid.size;

    return {
      x: Math.round((position.x - grid.offset.x) / gridSize) * gridSize + grid.offset.x,
      y: Math.round((position.y - grid.offset.y) / gridSize) * gridSize + grid.offset.y,
    };
  }

  /**
   * Add a layer to the active map
   */
  addLayer(layer: Omit<MapLayer, 'id'>, userId: string): string | null {
    const activeMap = this.getActiveMap();
    if (!activeMap || activeMap.ownerId !== userId) {
      return null;
    }

    const newLayer: MapLayer = {
      ...layer,
      id: this.generateLayerId(),
    };

    activeMap.layers.push(newLayer);
    activeMap.layers.sort((a, b) => a.zIndex - b.zIndex);
    
    this.emit('layerAdded', newLayer, activeMap.id);
    logger.debug(`Layer added to map ${activeMap.id}: ${newLayer.id}`);
    
    return newLayer.id;
  }

  /**
   * Update a layer
   */
  updateLayer(layerId: string, changes: Partial<Omit<MapLayer, 'id'>>, userId: string): boolean {
    const activeMap = this.getActiveMap();
    if (!activeMap || activeMap.ownerId !== userId) {
      return false;
    }

    const layerIndex = activeMap.layers.findIndex(layer => layer.id === layerId);
    if (layerIndex === -1) {
      return false;
    }

    activeMap.layers[layerIndex] = { ...activeMap.layers[layerIndex]!, ...changes } as MapLayer;
    
    if (changes.zIndex !== undefined) {
      activeMap.layers.sort((a, b) => a.zIndex - b.zIndex);
    }
    
    this.emit('layerUpdated', activeMap.layers[layerIndex], activeMap.id);
    return true;
  }

  /**
   * Remove a layer
   */
  removeLayer(layerId: string, userId: string): boolean {
    const activeMap = this.getActiveMap();
    if (!activeMap || activeMap.ownerId !== userId) {
      return false;
    }

    const layerIndex = activeMap.layers.findIndex(layer => layer.id === layerId);
    if (layerIndex === -1) {
      return false;
    }

    const removedLayer = activeMap.layers.splice(layerIndex, 1)[0];
    this.emit('layerRemoved', removedLayer, activeMap.id);
    
    return true;
  }

  /**
   * Update fog of war
   */
  updateFogOfWar(exploredAreas: Array<{ x: number; y: number; radius: number }>, userId: string): boolean {
    const activeMap = this.getActiveMap();
    if (!activeMap) {
      return false;
    }

    activeMap.settings.fogOfWar.exploredAreas = exploredAreas;
    this.emit('fogOfWarUpdated', exploredAreas, activeMap.id);
    
    return true;
  }

  /**
   * Reveal area in fog of war
   */
  revealArea(area: { x: number; y: number; width: number; height: number }, userId: string): boolean {
    const activeMap = this.getActiveMap();
    if (!activeMap) {
      return false;
    }

    activeMap.settings.fogOfWar.revealedAreas.push(area);
    this.emit('areaRevealed', area, activeMap.id);
    
    return true;
  }

  private generateMapId(): string {
    return `map_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateLayerId(): string {
    return `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
