/**
 * Advanced Grid Management System
 * Supports multiple grid types, snap-to-grid, and grid calculations
 */

export type GridType = 'square' | 'hexagonal' | 'isometric' | 'none';

export interface GridSettings {
  type: GridType;
  size: number;
  offsetX: number;
  offsetY: number;
  color: string;
  opacity: number;
  snapToGrid: boolean;
  showGrid: boolean;
  subdivisions?: number;
  // Hexagonal specific
  hexOrientation?: 'pointy' | 'flat';
  // Isometric specific
  isoAngle?: number;
}

export interface GridCoordinate {
  x: number;
  y: number;
  col?: number;
  row?: number;
}

export interface GridBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  cols: number;
  rows: number;
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

export class GridManager {
  private settings: GridSettings;
  private bounds: GridBounds;
  private eventListeners: Map<string, ((_data: any) => void)[]> = new Map();

  constructor(settings: GridSettings, sceneWidth?: number, sceneHeight?: number) {
    this.settings = settings;
    this.bounds = this.calculateBounds(sceneWidth || 1000, sceneHeight || 1000);
  }

  private calculateBounds(width: number, height: number): GridBounds {
    const cols = Math.ceil(width / this.settings.size);
    const rows = Math.ceil(height / this.settings.size);
    
    return {
      minX: this.settings.offsetX,
      maxX: this.settings.offsetX + (cols * this.settings.size),
      minY: this.settings.offsetY,
      maxY: this.settings.offsetY + (rows * this.settings.size),
      cols,
      rows,
      minCol: 0,
      maxCol: cols,
      minRow: 0,
      maxRow: rows
    };
  }

  /**
   * Convert pixel coordinates to grid coordinates
   */
  pixelToGrid(pixelX: number, pixelY: number): GridCoordinate {
    const adjustedX = pixelX - this.settings.offsetX;
    const adjustedY = pixelY - this.settings.offsetY;

    switch (this.settings.type) {
      case 'square':
        return this.pixelToSquareGrid(adjustedX, adjustedY);
      case 'hexagonal':
        return this.pixelToHexGrid(adjustedX, adjustedY);
      case 'isometric':
        return this.pixelToIsoGrid(adjustedX, adjustedY);
      default:
        return { x: pixelX, y: pixelY };
    }
  }

  /**
   * Convert grid coordinates to pixel coordinates
   */
  gridToPixel(gridCoord: GridCoordinate): GridCoordinate {
    // Handle cases where only col/row are provided
    if (gridCoord.col !== undefined && gridCoord.row !== undefined && (!gridCoord.x || !gridCoord.y)) {
      gridCoord = { 
        x: gridCoord.col * this.settings.size, 
        y: gridCoord.row * this.settings.size, 
        col: gridCoord.col, 
        row: gridCoord.row 
      };
    }
    
    switch (this.settings.type) {
      case 'square':
        return this.squareGridToPixel(gridCoord);
      case 'hexagonal':
        return this.hexGridToPixel(gridCoord);
      case 'isometric':
        return this.isoGridToPixel(gridCoord);
      default:
        return gridCoord;
    }
  }

  /**
   * Snap pixel coordinates to grid
   */
  snapToGrid(coord: GridCoordinate): GridCoordinate;
  snapToGrid(pixelX: number, pixelY: number): GridCoordinate;
  snapToGrid(coordOrX: GridCoordinate | number, pixelY?: number): GridCoordinate {
    let x: number, y: number;
    
    if (typeof coordOrX === 'object') {
      x = coordOrX.x;
      y = coordOrX.y;
    } else {
      x = coordOrX;
      y = pixelY!;
    }
    
    if (!this.settings.snapToGrid) {
      return { x, y };
    }

    const gridCoord = this.pixelToGrid(x, y);
    return this.gridToPixel(gridCoord);
  }

  private pixelToSquareGrid(x: number, y: number): GridCoordinate {
    const col = Math.floor(x / this.settings.size);
    const row = Math.floor(y / this.settings.size);
    
    return {
      x: col * this.settings.size + this.settings.offsetX,
      y: row * this.settings.size + this.settings.offsetY,
      col,
      row
    };
  }

  private squareGridToPixel(gridCoord: GridCoordinate): GridCoordinate {
    const col = gridCoord.col ?? Math.floor(gridCoord.x / this.settings.size);
    const row = gridCoord.row ?? Math.floor(gridCoord.y / this.settings.size);
    
    return {
      x: col * this.settings.size + this.settings.offsetX + this.settings.size / 2,
      y: row * this.settings.size + this.settings.offsetY + this.settings.size / 2,
      col,
      row
    };
  }

  private pixelToHexGrid(x: number, y: number): GridCoordinate {
    const size = this.settings.size;
    const isPointy = this.settings.hexOrientation === 'pointy';
    
    if (isPointy) {
      const q = (Math.sqrt(3)/3 * x - 1/3 * y) / size;
      const r = (2/3 * y) / size;
      return this.hexRoundingToPixel(q, r);
    } else {
      const q = (2/3 * x) / size;
      const r = (-1/3 * x + Math.sqrt(3)/3 * y) / size;
      return this.hexRoundingToPixel(q, r);
    }
  }

  private hexGridToPixel(gridCoord: GridCoordinate): GridCoordinate {
    const size = this.settings.size;
    const q = gridCoord.col ?? 0;
    const r = gridCoord.row ?? 0;
    const isPointy = this.settings.hexOrientation === 'pointy';
    
    if (isPointy) {
      const x = size * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r);
      const y = size * (3/2 * r);
      return { x: x + this.settings.offsetX, y: y + this.settings.offsetY, col: q, row: r };
    } else {
      const x = size * (3/2 * q);
      const y = size * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r);
      return { x: x + this.settings.offsetX, y: y + this.settings.offsetY, col: q, row: r };
    }
  }

  private hexRoundingToPixel(q: number, r: number): GridCoordinate {
    const s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    const rs = Math.round(s);
    
    const qDiff = Math.abs(rq - q);
    const rDiff = Math.abs(rr - r);
    const sDiff = Math.abs(rs - s);
    
    if (qDiff > rDiff && qDiff > sDiff) {
      rq = -rr - rs;
    } else if (rDiff > sDiff) {
      rr = -rq - rs;
    }
    
    return this.hexGridToPixel({ x: 0, y: 0, col: rq, row: rr });
  }

  private pixelToIsoGrid(x: number, y: number): GridCoordinate {
    const size = this.settings.size;
    const angle = this.settings.isoAngle ?? 30;
    const angleRad = (angle * Math.PI) / 180;
    
    const isoX = (x / (size * Math.cos(angleRad)) + y / (size * Math.sin(angleRad))) / 2;
    const isoY = (y / (size * Math.sin(angleRad)) - x / (size * Math.cos(angleRad))) / 2;
    
    const col = Math.floor(isoX);
    const row = Math.floor(isoY);
    
    return {
      x: col * size * Math.cos(angleRad) + this.settings.offsetX,
      y: row * size * Math.sin(angleRad) + this.settings.offsetY,
      col,
      row
    };
  }

  private isoGridToPixel(gridCoord: GridCoordinate): GridCoordinate {
    const size = this.settings.size;
    const angle = this.settings.isoAngle ?? 30;
    const angleRad = (angle * Math.PI) / 180;
    const col = gridCoord.col ?? 0;
    const row = gridCoord.row ?? 0;
    
    const x = (col - row) * size * Math.cos(angleRad);
    const y = (col + row) * size * Math.sin(angleRad);
    
    return {
      x: x + this.settings.offsetX,
      y: y + this.settings.offsetY,
      col,
      row
    };
  }

  /**
   * Calculate distance between two grid positions
   */
  calculateDistance(from: GridCoordinate, to: GridCoordinate): number {
    switch (this.settings.type) {
      case 'square':
        return this.calculateSquareDistance(from, to);
      case 'hexagonal':
        return this.calculateHexDistance(from, to);
      default: {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        return Math.sqrt(dx * dx + dy * dy);
      }
    }
  }

  private calculateSquareDistance(from: GridCoordinate, to: GridCoordinate): number {
    const fromGrid = this.pixelToGrid(from.x, from.y);
    const toGrid = this.pixelToGrid(to.x, to.y);
    
    return Math.max(
      Math.abs((toGrid.col ?? 0) - (fromGrid.col ?? 0)),
      Math.abs((toGrid.row ?? 0) - (fromGrid.row ?? 0))
    );
  }

  private calculateHexDistance(from: GridCoordinate, to: GridCoordinate): number {
    const fromHex = this.pixelToGrid(from.x, from.y);
    const toHex = this.pixelToGrid(to.x, to.y);
    
    const q1 = fromHex.col ?? 0;
    const r1 = fromHex.row ?? 0;
    const q2 = toHex.col ?? 0;
    const r2 = toHex.row ?? 0;
    
    return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
  }

  /**
   * Get all grid cells within a radius
   */
  getCellsInRadius(center: GridCoordinate, radius: number): GridCoordinate[] {
    const cells: GridCoordinate[] = [];
    const centerGrid = this.pixelToGrid(center.x, center.y);
    
    for (let col = -radius; col <= radius; col++) {
      for (let row = -radius; row <= radius; row++) {
        const testCoord = {
          x: 0, y: 0,
          col: (centerGrid.col ?? 0) + col,
          row: (centerGrid.row ?? 0) + row
        };
        
        const testPixel = this.gridToPixel(testCoord);
        const distance = this.calculateDistance(center, testPixel);
        
        if (distance <= radius) {
          cells.push(testPixel);
        }
      }
    }
    
    return cells;
  }


  /**
   * Get current grid settings
   */
  getSettings(): GridSettings {
    return { ...this.settings };
  }

  /**
   * Get grid bounds
   */
  getBounds(): GridBounds {
    return { ...this.bounds };
  }

  /**
   * Get grid bounds (alternative method name for compatibility)
   */
  getGridBounds(): GridBounds;
  getGridBounds(viewport?: { x: number; y: number; width: number; height: number }): GridBounds;
  getGridBounds(viewport?: { x: number; y: number; width: number; height: number }): GridBounds {
    // Ignore viewport parameter for now, just return standard bounds
    return this.getBounds();
  }

  /**
   * Convert world coordinates to grid coordinates (alternative method name)
   */
  worldToGrid(coord: GridCoordinate): GridCoordinate;
  worldToGrid(x: number, y: number): GridCoordinate;
  worldToGrid(coordOrX: GridCoordinate | number, y?: number): GridCoordinate {
    if (typeof coordOrX === 'object') {
      return this.pixelToGrid(coordOrX.x, coordOrX.y);
    }
    return this.pixelToGrid(coordOrX, y!);
  }

  /**
   * Convert grid coordinates to world coordinates (alternative method name)
   */
  gridToWorld(gridCoord: GridCoordinate): GridCoordinate {
    return this.gridToPixel(gridCoord);
  }

  /**
   * Convert world coordinates to isometric coordinates
   */
  worldToIsometric(worldCoord: GridCoordinate): GridCoordinate {
    const _size = this.settings.size;
    const angle = this.settings.isoAngle ?? 30;
    const angleRad = (angle * Math.PI) / 180;
    
    const isoX = (worldCoord.x * Math.cos(angleRad) - worldCoord.y * Math.sin(angleRad));
    const isoY = (worldCoord.x * Math.sin(angleRad) + worldCoord.y * Math.cos(angleRad));
    
    return { x: isoX, y: isoY };
  }

  /**
   * Convert isometric coordinates to world coordinates
   */
  isometricToWorld(isoCoord: GridCoordinate): GridCoordinate {
    const angle = this.settings.isoAngle ?? 30;
    const angleRad = (angle * Math.PI) / 180;
    
    const worldX = (isoCoord.x * Math.cos(angleRad) + isoCoord.y * Math.sin(angleRad));
    const worldY = (-isoCoord.x * Math.sin(angleRad) + isoCoord.y * Math.cos(angleRad));
    
    return { x: worldX, y: worldY };
  }

  /**
   * Get grid lines for rendering
   */
  getGridLines(viewport: { x: number; y: number; width: number; height: number }) {
    const horizontal: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    const vertical: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    
    const startX = Math.floor((viewport.x - this.settings.offsetX) / this.settings.size) * this.settings.size + this.settings.offsetX;
    const endX = viewport.x + viewport.width;
    const startY = Math.floor((viewport.y - this.settings.offsetY) / this.settings.size) * this.settings.size + this.settings.offsetY;
    const endY = viewport.y + viewport.height;
    
    // Vertical lines  
    for (let x = startX; x <= endX; x += this.settings.size) {
      vertical.push({
        x1: x, y1: viewport.y,
        x2: x, y2: viewport.y + viewport.height
      });
    }
    
    // Horizontal lines
    for (let y = startY; y <= endY; y += this.settings.size) {
      horizontal.push({
        x1: viewport.x, y1: y,
        x2: viewport.x + viewport.width, y2: y
      });
    }
    
    return { horizontal, vertical };
  }

  /**
   * Get hexagonal grid points for rendering
   */
  getHexGridPoints(viewport: { x: number; y: number; width: number; height: number }): Array<{ x: number; y: number; center: { x: number; y: number }; points: Array<{ x: number; y: number }> }> {
    const hexagons: Array<{ x: number; y: number; center: { x: number; y: number }; points: Array<{ x: number; y: number }> }> = [];
    const size = this.settings.size;
    const isPointy = this.settings.hexOrientation === 'pointy';
    
    // Calculate grid range based on viewport
    const cols = Math.ceil(viewport.width / size) + 2;
    const rows = Math.ceil(viewport.height / size) + 2;
    
    for (let col = -1; col < cols; col++) {
      for (let row = -1; row < rows; row++) {
        const center = this.hexGridToPixel({ x: 0, y: 0, col, row });
        
        // Check if hex is in viewport
        if (center.x < viewport.x - size || center.x > viewport.x + viewport.width + size ||
            center.y < viewport.y - size || center.y > viewport.y + viewport.height + size) {
          continue;
        }
        
        const points: Array<{ x: number; y: number }> = [];
        for (let i = 0; i < 6; i++) {
          const angle = (isPointy ? (60 * i) : (60 * i + 30)) * Math.PI / 180;
          points.push({
            x: center.x + size * Math.cos(angle),
            y: center.y + size * Math.sin(angle)
          });
        }
        
        hexagons.push({ x: center.x, y: center.y, center: { x: center.x, y: center.y }, points });
      }
    }
    
    return hexagons;
  }

  /**
   * Calculate grid distance (alias for calculateDistance)
   */
  calculateGridDistance(from: GridCoordinate, to: GridCoordinate): number {
    return this.calculateDistance(from, to);
  }

  /**
   * Calculate area of a polygon in grid units
   */
  calculateGridArea(polygon: Array<{ x: number; y: number }>): number {
    if (polygon.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      const currentPoint = polygon[i];
      const nextPoint = polygon[j];
      if (currentPoint && nextPoint) {
        area += currentPoint.x * nextPoint.y;
        area -= nextPoint.x * currentPoint.y;
      }
    }
    
    return Math.abs(area) / 2 / (this.settings.size * this.settings.size);
  }

  /**
   * Measure path length in grid units
   */
  measurePath(path: Array<{ x: number; y: number }>): number {
    if (path.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < path.length; i++) {
      const prevPoint = path[i - 1];
      const currPoint = path[i];
      if (prevPoint && currPoint) {
        totalDistance += this.calculateDistance(prevPoint, currPoint);
      }
    }
    
    return totalDistance;
  }

  /**
   * Get all cells within bounds
   */
  getCellsInBounds(bounds: { x: number; y: number; width: number; height: number }): GridCoordinate[] {
    const cells: GridCoordinate[] = [];
    
    const startCol = Math.floor((bounds.x - this.settings.offsetX) / this.settings.size);
    const endCol = Math.ceil((bounds.x + bounds.width - this.settings.offsetX) / this.settings.size);
    const startRow = Math.floor((bounds.y - this.settings.offsetY) / this.settings.size);
    const endRow = Math.ceil((bounds.y + bounds.height - this.settings.offsetY) / this.settings.size);
    
    for (let col = startCol; col < endCol; col++) {
      for (let row = startRow; row < endRow; row++) {
        const gridCoord = { x: 0, y: 0, col, row };
        const pixelCoord = this.gridToPixel(gridCoord);
        cells.push(pixelCoord);
      }
    }
    
    return cells;
  }

  /**
   * Get line of sight cells between two points
   */
  getLineOfSightCells(start: GridCoordinate, end: GridCoordinate): GridCoordinate[] {
    const cells: GridCoordinate[] = [];
    const startGrid = this.pixelToGrid(start.x, start.y);
    const endGrid = this.pixelToGrid(end.x, end.y);
    
    const dx = Math.abs((endGrid.col ?? 0) - (startGrid.col ?? 0));
    const dy = Math.abs((endGrid.row ?? 0) - (startGrid.row ?? 0));
    const steps = Math.max(dx, dy);
    
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const col = Math.round((startGrid.col ?? 0) * (1 - t) + (endGrid.col ?? 0) * t);
      const row = Math.round((startGrid.row ?? 0) * (1 - t) + (endGrid.row ?? 0) * t);
      
      const gridCoord = { x: 0, y: 0, col, row };
      const pixelCoord = this.gridToPixel(gridCoord);
      cells.push(pixelCoord);
    }
    
    return cells;
  }

  /**
   * Convert hexagonal coordinates to world coordinates
   */
  hexToWorld(hexCoord: { q: number; r: number; s: number }): GridCoordinate {
    const gridCoord = { x: 0, y: 0, col: hexCoord.q, row: hexCoord.r };
    return this.hexGridToPixel(gridCoord);
  }

  /**
   * Convert world coordinates to hexagonal coordinates
   */
  worldToHex(coord: GridCoordinate): { q: number; r: number; s: number } {
    const hexGrid = this.pixelToGrid(coord.x, coord.y);
    const q = hexGrid.col ?? 0;
    const r = hexGrid.row ?? 0;
    const s = -q - r;
    return { q, r, s };
  }

  /**
   * Calculate distance between hexagonal coordinates
   */
  hexDistance(hex1: { q: number; r: number; s: number }, hex2: { q: number; r: number; s: number }): number {
    return (Math.abs(hex1.q - hex2.q) + Math.abs(hex1.q + hex1.r - hex2.q - hex2.r) + Math.abs(hex1.r - hex2.r)) / 2;
  }

  /**
   * Get hexagonal neighbors
   */
  getHexNeighbors(center: { q: number; r: number; s: number }): Array<{ q: number; r: number; s: number }> {
    const directions = [
      { q: 1, r: 0, s: -1 }, { q: 1, r: -1, s: 0 }, { q: 0, r: -1, s: 1 },
      { q: -1, r: 0, s: 1 }, { q: -1, r: 1, s: 0 }, { q: 0, r: 1, s: -1 }
    ];
    
    return directions.map(dir => ({
      q: center.q + dir.q,
      r: center.r + dir.r,
      s: center.s + dir.s
    }));
  }

  /**
   * Event system - add event listener
   */
  on(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Event system - remove event listener
   */
  off(event: string, callback: (data: any) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Event system - emit event
   */
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  /**
   * Update grid settings (main implementation)
   */
  updateSettings(newSettings: Partial<GridSettings>): void {
    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...newSettings };
    this.emit('settingsChanged', { old: oldSettings, new: this.settings });
  }
}
