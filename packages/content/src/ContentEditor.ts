/**
 * Visual content editor and authoring tools for VTT
 */

import { EventEmitter } from 'events';
import { AssetManager, _AssetMetadata} from './AssetManager';

export interface EditorTool {
  id: string;
  name: string;
  icon: string;
  category: 'drawing' | 'selection' | 'measurement' | 'annotation' | 'terrain' | 'lighting';
  shortcut?: string;
  cursor?: string;
}

export interface Layer {
  id: string;
  name: string;
  type: 'background' | 'terrain' | 'objects' | 'tokens' | 'effects' | 'ui' | 'fog';
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: string;
  order: number;
}

export interface DrawingElement {
  id: string;
  type: 'line' | 'rectangle' | 'circle' | 'polygon' | 'text' | 'image' | 'token';
  layerId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation: number;
  style: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    fontSize?: number;
    fontFamily?: string;
    textAlign?: string;
  };
  data?: any;
  locked: boolean;
  visible: boolean;
  created: Date;
  modified: Date;
}

export interface Scene {
  id: string;
  name: string;
  description: string;
  dimensions: { width: number; height: number };
  gridSize: number;
  gridType: 'square' | 'hex' | 'none';
  gridColor: string;
  backgroundColor: string;
  layers: Layer[];
  elements: DrawingElement[];
  lighting: {
    ambient: string;
    sources: Array<{
      id: string;
      position: { x: number; y: number };
      radius: number;
      color: string;
      intensity: number;
      shadows: boolean;
    }>;
  };
  fogOfWar: {
    enabled: boolean;
    revealedAreas: Array<{
      id: string;
      shape: 'circle' | 'polygon';
      points: Array<{ x: number; y: number }>;
    }>;
  };
  created: Date;
  modified: Date;
  version: string;
}

export interface EditorState {
  activeTool: string;
  activeLayer: string;
  selectedElements: string[];
  clipboard: DrawingElement[];
  history: Array<{
    action: string;
    timestamp: Date;
    data: any;
  }>;
  historyIndex: number;
  zoom: number;
  pan: { x: number; y: number };
  grid: {
    visible: boolean;
    snap: boolean;
    size: number;
  };
  rulers: {
    visible: boolean;
    units: 'pixels' | 'feet' | 'meters';
  };
}

export class ContentEditor extends EventEmitter {
  private assetManager: AssetManager;
  private scene!: Scene;
  private state!: EditorState;
  private tools: Map<string, EditorTool> = new Map();
  private maxHistorySize = 100;

  constructor(assetManager: AssetManager) {
    super();
    this.assetManager = assetManager;
    this.initializeDefaultTools();
    this.initializeDefaultState();
  }

  // Scene management
  createScene(name: string, width: number = 4096, height: number = 4096): Scene {
    this.scene = {
      id: this.generateId(),
      name,
      description: '',
      dimensions: { width, height },
      gridSize: 50,
      gridType: 'square',
      gridColor: '#cccccc',
      backgroundColor: '#ffffff',
      layers: this.createDefaultLayers(),
      elements: [],
      lighting: {
        ambient: '#404040',
        sources: []
      },
      fogOfWar: {
        enabled: false,
        revealedAreas: []
      },
      created: new Date(),
      modified: new Date(),
      version: '1.0.0'
    };

    this.emit('sceneCreated', this.scene);
    return this.scene;
  }

  loadScene(scene: Scene): void {
    this.scene = { ...scene };
    this.state.activeLayer = this.scene.layers[0]?.id || '';
    this.state.selectedElements = [];
    this.clearHistory();
    this.emit('sceneLoaded', this.scene);
  }

  // Layer management
  addLayer(name: string, type: Layer['type'], order?: number): Layer {
    const layer: Layer = {
      id: this.generateId(),
      name,
      type,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      order: order ?? this.scene.layers.length
    };

    if (order !== undefined) {
      this.scene.layers.splice(order, 0, layer);
      this.reorderLayers();
    } else {
      this.scene.layers.push(layer);
    }

    this.recordHistory('addLayer', { layer });
    this.emit('layerAdded', layer);
    return layer;
  }

  removeLayer(layerId: string): void {
    const layerIndex = this.scene.layers.findIndex(l => l.id === layerId);
    if (layerIndex === -1) return;

    const layer = this.scene.layers[layerIndex];
    this.scene.layers.splice(layerIndex, 1);

    // Remove all elements on this layer
    this.scene.elements = this.scene.elements.filter(e => e.layerId !== layerId);

    this.recordHistory('removeLayer', { layer, elements: this.scene.elements });
    this.emit('layerRemoved', layer);
  }

  // Drawing tools
  setActiveTool(toolId: string): void {
    if (!this.tools.has(toolId)) return;
    
    this.state.activeTool = toolId;
    this.emit('toolChanged', toolId);
  }

  // Element creation
  addElement(element: Omit<DrawingElement, 'id' | 'created' | 'modified'>): DrawingElement {
    const newElement: DrawingElement = {
      ...element,
      id: this.generateId(),
      created: new Date(),
      modified: new Date()
    };

    this.scene.elements.push(newElement);
    this.recordHistory('addElement', { element: newElement });
    this.emit('elementAdded', newElement);
    return newElement;
  }

  updateElement(elementId: string, updates: Partial<DrawingElement>): void {
    const element = this.scene.elements.find(e => e.id === elementId);
    if (!element) return;

    const oldElement = { ...element };
    Object.assign(element, updates, { modified: new Date() });

    this.recordHistory('updateElement', { elementId, oldElement, newElement: element });
    this.emit('elementUpdated', element);
  }

  removeElement(elementId: string): void {
    const elementIndex = this.scene.elements.findIndex(e => e.id === elementId);
    if (elementIndex === -1) return;

    const element = this.scene.elements[elementIndex];
    this.scene.elements.splice(elementIndex, 1);

    this.recordHistory('removeElement', { element });
    this.emit('elementRemoved', element);
  }

  // Selection management
  selectElement(elementId: string, addToSelection = false): void {
    if (!addToSelection) {
      this.state.selectedElements = [elementId];
    } else if (!this.state.selectedElements.includes(elementId)) {
      this.state.selectedElements.push(elementId);
    }
    
    this.emit('selectionChanged', this.state.selectedElements);
  }

  selectElements(elementIds: string[]): void {
    this.state.selectedElements = [...elementIds];
    this.emit('selectionChanged', this.state.selectedElements);
  }

  clearSelection(): void {
    this.state.selectedElements = [];
    this.emit('selectionChanged', this.state.selectedElements);
  }

  // Transform operations
  moveElements(elementIds: string[], deltaX: number, deltaY: number): void {
    const elements = this.scene.elements.filter(e => elementIds.includes(e.id));
    
    elements.forEach(element => {
      element.position.x += deltaX;
      element.position.y += deltaY;
      element.modified = new Date();
    });

    this.recordHistory('moveElements', { elementIds, deltaX, deltaY });
    this.emit('elementsTransformed', elements);
  }

  rotateElements(elementIds: string[], angle: number): void {
    const elements = this.scene.elements.filter(e => elementIds.includes(e.id));
    
    elements.forEach(element => {
      element.rotation += angle;
      element.modified = new Date();
    });

    this.recordHistory('rotateElements', { elementIds, angle });
    this.emit('elementsTransformed', elements);
  }

  scaleElements(elementIds: string[], scaleX: number, scaleY: number): void {
    const elements = this.scene.elements.filter(e => elementIds.includes(e.id));
    
    elements.forEach(element => {
      element.size.width *= scaleX;
      element.size.height *= scaleY;
      element.modified = new Date();
    });

    this.recordHistory('scaleElements', { elementIds, scaleX, scaleY });
    this.emit('elementsTransformed', elements);
  }

  // History management
  undo(): void {
    if (this.state.historyIndex > 0) {
      this.state.historyIndex--;
      const action = this.state.history[this.state.historyIndex];
      this.revertAction(action);
      this.emit('undone', action);
    }
  }

  redo(): void {
    if (this.state.historyIndex < this.state.history.length) {
      const action = this.state.history[this.state.historyIndex];
      this.applyAction(action);
      this.state.historyIndex++;
      this.emit('redone', action);
    }
  }

  // Grid and snapping
  snapToGrid(point: { x: number; y: number }): { x: number; y: number } {
    if (!this.state.grid.snap) return point;

    const gridSize = this.state.grid.size;
    return {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize
    };
  }

  // Asset integration
  async placeAsset(assetId: string, position: { x: number; y: number }): Promise<DrawingElement> {
    const asset = this.assetManager.getAsset(assetId);
    if (!asset) {
      throw new Error(`Asset not found: ${assetId}`);
    }

    const element = this.addElement({
      type: 'image',
      layerId: this.state.activeLayer,
      position: this.snapToGrid(position),
      size: asset.dimensions || { width: 100, height: 100 },
      rotation: 0,
      style: { opacity: 1 },
      data: { assetId },
      locked: false,
      visible: true
    });

    return element;
  }

  // Export and serialization
  exportScene(): Scene {
    return {
      ...this.scene,
      modified: new Date()
    };
  }

  exportAsImage(_format: 'png' | 'jpg' | 'webp' = 'png'): Promise<Buffer> {
    // Would render scene to image format
    throw new Error('Not implemented');
  }

  // Private methods
  private initializeDefaultTools(): void {
    const tools: EditorTool[] = [
      { id: 'select', name: 'Select', icon: 'cursor', category: 'selection', shortcut: 'v' },
      { id: 'pan', name: 'Pan', icon: 'hand', category: 'selection', shortcut: 'space' },
      { id: 'brush', name: 'Brush', icon: 'brush', category: 'drawing', shortcut: 'b' },
      { id: 'eraser', name: 'Eraser', icon: 'eraser', category: 'drawing', shortcut: 'e' },
      { id: 'line', name: 'Line', icon: 'line', category: 'drawing', shortcut: 'l' },
      { id: 'rectangle', name: 'Rectangle', icon: 'square', category: 'drawing', shortcut: 'r' },
      { id: 'circle', name: 'Circle', icon: 'circle', category: 'drawing', shortcut: 'c' },
      { id: 'polygon', name: 'Polygon', icon: 'polygon', category: 'drawing', shortcut: 'p' },
      { id: 'text', name: 'Text', icon: 'text', category: 'annotation', shortcut: 't' },
      { id: 'measure', name: 'Measure', icon: 'ruler', category: 'measurement', shortcut: 'm' },
      { id: 'light', name: 'Light', icon: 'lightbulb', category: 'lighting', shortcut: 'shift+l' },
      { id: 'fog', name: 'Fog of War', icon: 'eye-off', category: 'lighting', shortcut: 'f' },
      { id: 'terrain', name: 'Terrain', icon: 'mountain', category: 'terrain', shortcut: 'shift+t' }
    ];

    tools.forEach(tool => this.tools.set(tool.id, tool));
  }

  private initializeDefaultState(): void {
    this.state = {
      activeTool: 'select',
      activeLayer: '',
      selectedElements: [],
      clipboard: [],
      history: [],
      historyIndex: 0,
      zoom: 1,
      pan: { x: 0, y: 0 },
      grid: {
        visible: true,
        snap: true,
        size: 50
      },
      rulers: {
        visible: true,
        units: 'feet'
      }
    };
  }

  private createDefaultLayers(): Layer[] {
    return [
      {
        id: this.generateId(),
        name: 'Background',
        type: 'background',
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: 'normal',
        order: 0
      },
      {
        id: this.generateId(),
        name: 'Terrain',
        type: 'terrain',
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: 'normal',
        order: 1
      },
      {
        id: this.generateId(),
        name: 'Objects',
        type: 'objects',
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: 'normal',
        order: 2
      },
      {
        id: this.generateId(),
        name: 'Tokens',
        type: 'tokens',
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: 'normal',
        order: 3
      },
      {
        id: this.generateId(),
        name: 'Effects',
        type: 'effects',
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: 'normal',
        order: 4
      }
    ];
  }

  private recordHistory(action: string, data: any): void {
    // Remove any redo history when adding new action
    this.state.history = this.state.history.slice(0, this.state.historyIndex);

    this.state.history.push({
      action,
      timestamp: new Date(),
      data
    });

    this.state.historyIndex = this.state.history.length;

    // Limit history size
    if (this.state.history.length > this.maxHistorySize) {
      this.state.history.shift();
      this.state.historyIndex--;
    }
  }

  private clearHistory(): void {
    this.state.history = [];
    this.state.historyIndex = 0;
  }

  private revertAction(action: any): void {
    // Implement action reversal logic
    switch (action.action) {
      case 'addElement':
        this.scene.elements = this.scene.elements.filter(e => e.id !== action.data.element.id);
        break;
      case 'removeElement':
        this.scene.elements.push(action.data.element);
        break;
      case 'updateElement': {
        const element = this.scene.elements.find(e => e.id === action.data.elementId);
        if (element) {
          Object.assign(element, action.data.oldElement);
        }
    }
        break;
      // Add more action reversals as needed
    }
  }

  private applyAction(_action: any): void {
    // Implement action application logic for redo
    // Similar to revertAction but applies the action forward
  }

  private reorderLayers(): void {
    this.scene.layers.forEach((_layer, __index) => {
      layer.order = index;
    });
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  // Getters
  getScene(): Scene {
    return this.scene;
  }

  getState(): EditorState {
    return this.state;
  }

  getTools(): EditorTool[] {
    return Array.from(this.tools.values());
  }

  getSelectedElements(): DrawingElement[] {
    return this.scene.elements.filter(e => this.state.selectedElements.includes(e.id));
  }
}
