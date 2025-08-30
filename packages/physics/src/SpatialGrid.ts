/**
 * Spatial grid for efficient collision detection
 */

export interface GridCell {
  x: number;
  y: number;
  entities: Set<number>;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class SpatialGrid {
  private cellSize: number;
  private grid: Map<string, GridCell> = new Map();
  private entityBounds: Map<number, Bounds> = new Map();
  private entityCells: Map<number, string[]> = new Map();

  constructor(cellSize: number = 100) {
    this.cellSize = cellSize;
  }

  /**
   * Get grid cell key for world coordinates
   */
  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  /**
   * Get all cell keys that bounds overlap
   */
  private getBoundsCells(bounds: Bounds): string[] {
    const cells: string[] = [];
    const minCellX = Math.floor(bounds.minX / this.cellSize);
    const minCellY = Math.floor(bounds.minY / this.cellSize);
    const maxCellX = Math.floor(bounds.maxX / this.cellSize);
    const maxCellY = Math.floor(bounds.maxY / this.cellSize);

    for (let x = minCellX; x <= maxCellX; x++) {
      for (let y = minCellY; y <= maxCellY; y++) {
        cells.push(`${x},${y}`);
      }
    }

    return cells;
  }

  /**
   * Update entity position in grid
   */
  updateEntity(entityId: number, bounds: Bounds): void {
    // Remove from old cells
    this.removeEntity(entityId);

    // Add to new cells
    const cellKeys = this.getBoundsCells(bounds);
    this.entityCells.set(entityId, cellKeys);
    this.entityBounds.set(entityId, bounds);

    for (const key of cellKeys) {
      let cell = this.grid.get(key);
      if (!cell) {
        const [x, y] = key.split(",").map(Number);
        cell = { x, y, entities: new Set() };
        this.grid.set(key, cell);
      }
      cell.entities.add(entityId);
    }
  }

  /**
   * Remove entity from grid
   */
  removeEntity(entityId: number): void {
    const oldCells = this.entityCells.get(entityId);
    if (oldCells) {
      for (const key of oldCells) {
        const cell = this.grid.get(key);
        if (cell) {
          cell.entities.delete(entityId);
          // Clean up empty cells
          if (cell.entities.size === 0) {
            this.grid.delete(key);
          }
        }
      }
    }

    this.entityCells.delete(entityId);
    this.entityBounds.delete(entityId);
  }

  /**
   * Get potential collision pairs
   */
  getPotentialCollisions(): Array<[number, number]> {
    const pairs: Array<[number, number]> = [];
    const processed = new Set<string>();

    for (const cell of this.grid.values()) {
      const entities = Array.from(cell.entities);

      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const a = entities[i];
          const b = entities[j];
          const pairKey = a < b ? `${a},${b}` : `${b},${a}`;

          if (!processed.has(pairKey)) {
            pairs.push([a, b]);
            processed.add(pairKey);
          }
        }
      }
    }

    return pairs;
  }

  /**
   * Query entities in region
   */
  queryRegion(bounds: Bounds): number[] {
    const entities = new Set<number>();
    const cellKeys = this.getBoundsCells(bounds);

    for (const key of cellKeys) {
      const cell = this.grid.get(key);
      if (cell) {
        for (const entityId of cell.entities) {
          const entityBounds = this.entityBounds.get(entityId);
          if (entityBounds && this.boundsOverlap(bounds, entityBounds)) {
            entities.add(entityId);
          }
        }
      }
    }

    return Array.from(entities);
  }

  /**
   * Query entities at point
   */
  queryPoint(x: number, y: number): number[] {
    const key = this.getCellKey(x, y);
    const cell = this.grid.get(key);

    if (!cell) return [];

    const entities: number[] = [];
    for (const entityId of cell.entities) {
      const bounds = this.entityBounds.get(entityId);
      if (bounds && x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) {
        entities.push(entityId);
      }
    }

    return entities;
  }

  /**
   * Check if two bounds overlap
   */
  private boundsOverlap(a: Bounds, b: Bounds): boolean {
    return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
  }

  /**
   * Clear all entities from grid
   */
  clear(): void {
    this.grid.clear();
    this.entityBounds.clear();
    this.entityCells.clear();
  }

  /**
   * Get grid statistics
   */
  getStats(): {
    totalCells: number;
    totalEntities: number;
    averageEntitiesPerCell: number;
    maxEntitiesInCell: number;
  } {
    let totalEntities = 0;
    let maxEntitiesInCell = 0;

    for (const cell of this.grid.values()) {
      totalEntities += cell.entities.size;
      maxEntitiesInCell = Math.max(maxEntitiesInCell, cell.entities.size);
    }

    return {
      totalCells: this.grid.size,
      totalEntities: this.entityBounds.size,
      averageEntitiesPerCell: this.grid.size > 0 ? totalEntities / this.grid.size : 0,
      maxEntitiesInCell,
    };
  }
}
