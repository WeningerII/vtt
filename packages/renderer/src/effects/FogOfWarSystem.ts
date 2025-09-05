import { EventEmitter } from 'events';
import { logger } from '@vtt/logging';

export interface FogOfWarSettings {
  enabled: boolean;
  explorationMode: 'reveal' | 'hide' | 'dim';
  revealRadius: number;
  fadeDistance: number;
  persistExploration: boolean;
  playerCanReveal: boolean;
  gmCanReveal: boolean;
  revealOnTokenMove: boolean;
  hideOnTokenRemove: boolean;
}

export interface FogCell {
  x: number;
  y: number;
  state: 'hidden' | 'explored' | 'visible';
  lastSeen: Date;
  revealedBy: string[];
}

export interface RevealArea {
  id: string;
  center: { x: number; y: number };
  radius: number;
  shape: 'circle' | 'square' | 'cone';
  direction?: number; // For cone shape
  angle?: number; // For cone shape
  revealerId: string;
  permanent: boolean;
  createdAt: Date;
}

export interface VisionBlocker {
  id: string;
  type: 'wall' | 'door' | 'object';
  points: Array<{ x: number; y: number }>;
  blocksVision: boolean;
  blocksMovement: boolean;
  opacity: number;
}

export class FogOfWarSystem extends EventEmitter {
  private settings: FogOfWarSettings;
  private fogGrid: Map<string, FogCell> = new Map();
  private revealAreas: Map<string, RevealArea> = new Map();
  private visionBlockers: Map<string, VisionBlocker> = new Map();
  private gridSize: number;
  private mapBounds: { width: number; height: number };
  private fogTexture: ImageData | null = null;
  private needsUpdate: boolean = true;

  constructor(
    gridSize: number = 5,
    mapBounds: { width: number; height: number },
    settings?: Partial<FogOfWarSettings>
  ) {
    super();
    this.setMaxListeners(100);
    
    this.gridSize = gridSize;
    this.mapBounds = mapBounds;
    this.settings = {
      enabled: true,
      explorationMode: 'reveal',
      revealRadius: 30,
      fadeDistance: 5,
      persistExploration: true,
      playerCanReveal: true,
      gmCanReveal: true,
      revealOnTokenMove: true,
      hideOnTokenRemove: false,
      ...settings,
    };

    this.initializeFogGrid();
  }

  /**
   * Reveal area around a position
   */
  revealArea(
    center: { x: number; y: number },
    radius: number,
    revealerId: string,
    options?: {
      shape?: 'circle' | 'square' | 'cone';
      direction?: number;
      angle?: number;
      permanent?: boolean;
    }
  ): string {
    const revealArea: RevealArea = {
      id: `reveal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      center,
      radius,
      shape: options?.shape || 'circle',
      direction: options?.direction ?? 0,
      angle: options?.angle ?? 0,
      revealerId,
      permanent: false,
      createdAt: new Date(),
    };

    this.revealAreas.set(revealArea.id, revealArea);
    this.updateFogForRevealArea(revealArea);
    
    this.emit('areaRevealed', revealArea);
    logger.debug(`Area revealed: ${revealArea.id} by ${revealerId}`);
    
    return revealArea.id;
  }

  /**
   * Hide area (return to fog)
   */
  hideArea(center: { x: number; y: number }, radius: number, hiderId: string): void {
    const affectedCells = this.getCellsInRadius(center, radius);
    
    for (const cell of affectedCells) {
      if (cell.state === 'visible') {
        cell.state = this.settings.persistExploration ? 'explored' : 'hidden';
        cell.revealedBy = cell.revealedBy.filter(id => id !== hiderId);
      }
    }

    this.needsUpdate = true;
    this.emit('areaHidden', center, radius, hiderId);
  }

  /**
   * Update fog based on token position
   */
  updateTokenVision(tokenId: string, position: { x: number; y: number }, visionRange: number): void {
    if (!this.settings.enabled || !this.settings.revealOnTokenMove) {
      return;
    }

    // Remove previous reveal area for this token
    const existingAreas = Array.from(this.revealAreas.values()).filter(area => area.revealerId === tokenId);
    existingAreas.forEach(area => {
      if (!area.permanent) {
        this.revealAreas.delete(area.id);
      }
    });

    // Create new reveal area
    this.revealArea(position, visionRange, tokenId, { permanent: false });
  }

  /**
   * Add vision blocker (walls, doors, etc.)
   */
  addVisionBlocker(blocker: VisionBlocker): void {
    this.visionBlockers.set(blocker.id, blocker);
    this.recalculateAllVision();
    this.emit('visionBlockerAdded', blocker);
  }

  /**
   * Remove vision blocker
   */
  removeVisionBlocker(blockerId: string): boolean {
    const blocker = this.visionBlockers.get(blockerId);
    if (!blocker) {
      return false;
    }

    this.visionBlockers.delete(blockerId);
    this.recalculateAllVision();
    this.emit('visionBlockerRemoved', blockerId, blocker);
    
    return true;
  }

  /**
   * Check if a line of sight exists between two points
   */
  hasLineOfSight(from: { x: number; y: number }, to: { x: number; y: number }): boolean {
    const line = this.getLinePoints(from, to);
    
    for (const blocker of this.visionBlockers.values()) {
      if (!blocker.blocksVision) {continue;}
      
      if (this.lineIntersectsPolygon(line, blocker.points)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get fog state at a specific position
   */
  getFogStateAt(x: number, y: number): 'hidden' | 'explored' | 'visible' {
    const cellKey = this.getCellKey(x, y);
    const cell = this.fogGrid.get(cellKey);
    return cell?.state || 'hidden';
  }

  /**
   * Get all visible areas for a player
   */
  getVisibleAreas(playerId: string): RevealArea[] {
    return Array.from(this.revealAreas.values()).filter(area => 
      area.revealerId === playerId || this.settings.gmCanReveal
    );
  }

  /**
   * Clear all fog (reveal entire map)
   */
  clearAllFog(revealerId: string): void {
    for (const cell of this.fogGrid.values()) {
      cell.state = 'visible';
      cell.lastSeen = new Date();
      if (!cell.revealedBy.includes(revealerId)) {
        cell.revealedBy.push(revealerId);
      }
    }

    this.needsUpdate = true;
    this.emit('allFogCleared', revealerId);
  }

  /**
   * Reset all fog (hide entire map)
   */
  resetAllFog(): void {
    for (const cell of this.fogGrid.values()) {
      cell.state = 'hidden';
      cell.revealedBy = [];
    }

    this.revealAreas.clear();
    this.needsUpdate = true;
    this.emit('allFogReset');
  }

  /**
   * Update fog of war settings
   */
  updateSettings(newSettings: Partial<FogOfWarSettings>): void {
    const oldEnabled = this.settings.enabled;
    Object.assign(this.settings, newSettings);
    
    if (oldEnabled !== this.settings.enabled) {
      if (this.settings.enabled) {
        this.recalculateAllVision();
      } else {
        this.clearAllFog('system');
      }
    }

    this.emit('settingsUpdated', this.settings);
  }

  /**
   * Get current fog of war settings
   */
  getSettings(): FogOfWarSettings {
    return { ...this.settings };
  }

  /**
   * Generate fog texture for rendering
   */
  generateFogTexture(): ImageData {
    if (!this.needsUpdate && this.fogTexture) {
      return this.fogTexture;
    }

    const width = Math.ceil(this.mapBounds.width / this.gridSize);
    const height = Math.ceil(this.mapBounds.height / this.gridSize);
    const imageData = new ImageData(width, height);
    const data = imageData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const worldX = x * this.gridSize;
        const worldY = y * this.gridSize;
        const cellKey = this.getCellKey(worldX, worldY);
        const cell = this.fogGrid.get(cellKey);
        const pixelIndex = (y * width + x) * 4;

        if (!cell || cell.state === 'hidden') {
          // Fully opaque black for hidden areas
          data[pixelIndex] = 0;     // R
          data[pixelIndex + 1] = 0; // G
          data[pixelIndex + 2] = 0; // B
          data[pixelIndex + 3] = 255; // A
        } else if (cell.state === 'explored') {
          // Semi-transparent for explored areas
          data[pixelIndex] = 0;     // R
          data[pixelIndex + 1] = 0; // G
          data[pixelIndex + 2] = 0; // B
          data[pixelIndex + 3] = 128; // A
        } else {
          // Fully transparent for visible areas
          data[pixelIndex] = 0;     // R
          data[pixelIndex + 1] = 0; // G
          data[pixelIndex + 2] = 0; // B
          data[pixelIndex + 3] = 0; // A
        }
      }
    }

    this.fogTexture = imageData;
    this.needsUpdate = false;
    
    return imageData;
  }

  /**
   * Export fog state for saving
   */
  exportFogState(): {
    settings: FogOfWarSettings;
    fogGrid: Array<{ key: string; cell: FogCell }>;
    revealAreas: RevealArea[];
    visionBlockers: VisionBlocker[];
  } {
    return {
      settings: this.settings,
      fogGrid: Array.from(this.fogGrid.entries()).map(([key, cell]) => ({ key, cell })),
      revealAreas: Array.from(this.revealAreas.values()),
      visionBlockers: Array.from(this.visionBlockers.values()),
    };
  }

  /**
   * Import fog state from save
   */
  importFogState(state: {
    settings: FogOfWarSettings;
    fogGrid: Array<{ key: string; cell: FogCell }>;
    revealAreas: RevealArea[];
    visionBlockers: VisionBlocker[];
  }): void {
    this.settings = state.settings;
    
    this.fogGrid.clear();
    state.fogGrid.forEach(({ key, cell }) => {
      this.fogGrid.set(key, cell);
    });

    this.revealAreas.clear();
    state.revealAreas.forEach(area => {
      this.revealAreas.set(area.id, area);
    });

    this.visionBlockers.clear();
    state.visionBlockers.forEach(blocker => {
      this.visionBlockers.set(blocker.id, blocker);
    });

    this.needsUpdate = true;
    this.emit('fogStateImported');
  }

  private initializeFogGrid(): void {
    const cellsX = Math.ceil(this.mapBounds.width / this.gridSize);
    const cellsY = Math.ceil(this.mapBounds.height / this.gridSize);

    for (let x = 0; x < cellsX; x++) {
      for (let y = 0; y < cellsY; y++) {
        const worldX = x * this.gridSize;
        const worldY = y * this.gridSize;
        const cellKey = this.getCellKey(worldX, worldY);
        
        this.fogGrid.set(cellKey, {
          x: worldX,
          y: worldY,
          state: 'hidden',
          lastSeen: new Date(),
          revealedBy: [],
        });
      }
    }

    logger.info(`Initialized fog grid: ${cellsX}x${cellsY} cells`);
  }

  private updateFogForRevealArea(revealArea: RevealArea): void {
    const affectedCells = this.getCellsInShape(revealArea);
    
    for (const cell of affectedCells) {
      // Check line of sight
      if (!this.hasLineOfSight(revealArea.center, { x: cell.x, y: cell.y })) {
        continue;
      }

      cell.state = 'visible';
      cell.lastSeen = new Date();
      
      if (!cell.revealedBy.includes(revealArea.revealerId)) {
        cell.revealedBy.push(revealArea.revealerId);
      }
    }

    this.needsUpdate = true;
  }

  private getCellsInShape(revealArea: RevealArea): FogCell[] {
    switch (revealArea.shape) {
      case 'circle':
        return this.getCellsInRadius(revealArea.center, revealArea.radius);
      case 'square':
        return this.getCellsInSquare(revealArea.center, revealArea.radius);
      case 'cone':
        return this.getCellsInCone(revealArea.center, revealArea.radius, revealArea.direction!, revealArea.angle!);
      default:
        return this.getCellsInRadius(revealArea.center, revealArea.radius);
    }
  }

  private getCellsInRadius(center: { x: number; y: number }, radius: number): FogCell[] {
    const cells: FogCell[] = [];
    const minX = Math.max(0, center.x - radius);
    const maxX = Math.min(this.mapBounds.width, center.x + radius);
    const minY = Math.max(0, center.y - radius);
    const maxY = Math.min(this.mapBounds.height, center.y + radius);

    for (let x = minX; x <= maxX; x += this.gridSize) {
      for (let y = minY; y <= maxY; y += this.gridSize) {
        const distance = Math.sqrt(Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2));
        if (distance <= radius) {
          const cellKey = this.getCellKey(x, y);
          const cell = this.fogGrid.get(cellKey);
          if (cell) {
            cells.push(cell);
          }
        }
      }
    }

    return cells;
  }

  private getCellsInSquare(center: { x: number; y: number }, size: number): FogCell[] {
    const cells: FogCell[] = [];
    const halfSize = size / 2;
    const minX = Math.max(0, center.x - halfSize);
    const maxX = Math.min(this.mapBounds.width, center.x + halfSize);
    const minY = Math.max(0, center.y - halfSize);
    const maxY = Math.min(this.mapBounds.height, center.y + halfSize);

    for (let x = minX; x <= maxX; x += this.gridSize) {
      for (let y = minY; y <= maxY; y += this.gridSize) {
        const cellKey = this.getCellKey(x, y);
        const cell = this.fogGrid.get(cellKey);
        if (cell) {
          cells.push(cell);
        }
      }
    }

    return cells;
  }

  private getCellsInCone(
    center: { x: number; y: number },
    radius: number,
    direction: number,
    angle: number
  ): FogCell[] {
    const cells: FogCell[] = [];
    const halfAngle = angle / 2;

    for (let x = center.x - radius; x <= center.x + radius; x += this.gridSize) {
      for (let y = center.y - radius; y <= center.y + radius; y += this.gridSize) {
        const distance = Math.sqrt(Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2));
        if (distance > radius) {continue;}

        const cellAngle = Math.atan2(y - center.y, x - center.x);
        const angleDiff = Math.abs(this.normalizeAngle(cellAngle - direction));
        
        if (angleDiff <= halfAngle) {
          const cellKey = this.getCellKey(x, y);
          const cell = this.fogGrid.get(cellKey);
          if (cell) {
            cells.push(cell);
          }
        }
      }
    }

    return cells;
  }

  private recalculateAllVision(): void {
    // Reset all cells to explored if they were visible
    for (const cell of this.fogGrid.values()) {
      if (cell.state === 'visible') {
        cell.state = this.settings.persistExploration ? 'explored' : 'hidden';
      }
    }

    // Reapply all reveal areas
    for (const revealArea of this.revealAreas.values()) {
      this.updateFogForRevealArea(revealArea);
    }
  }

  private getLinePoints(from: { x: number; y: number }, to: { x: number; y: number }): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [];
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    const sx = from.x < to.x ? 1 : -1;
    const sy = from.y < to.y ? 1 : -1;
    let err = dx - dy;

    let x = from.x;
    let y = from.y;

    while (true) {
      points.push({ x, y });

      if (x === to.x && y === to.y) {break;}

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    return points;
  }

  private lineIntersectsPolygon(line: Array<{ x: number; y: number }>, polygon: Array<{ x: number; y: number }>): boolean {
    // Simplified polygon intersection check
    for (let i = 0; i < polygon.length; i++) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % polygon.length];
      
      const lastPoint = line[line.length - 1];
      if (line[0] && lastPoint && p1 && p2 && this.lineSegmentsIntersect(line[0], lastPoint, p1, p2)) {
        return true;
      }
    }
    return false;
  }

  private lineSegmentsIntersect(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    p4: { x: number; y: number }
  ): boolean {
    const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (denom === 0) {return false;}

    const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
    const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) {angle -= 2 * Math.PI;}
    while (angle < -Math.PI) {angle += 2 * Math.PI;}
    return angle;
  }

  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.gridSize) * this.gridSize;
    const cellY = Math.floor(y / this.gridSize) * this.gridSize;
    return `${cellX},${cellY}`;
  }

  private generateRevealId(): string {
    return `reveal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
