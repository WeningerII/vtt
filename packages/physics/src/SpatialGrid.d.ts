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
export declare class SpatialGrid {
  private cellSize;
  private grid;
  private entityBounds;
  private entityCells;
  constructor(cellSize?: number);
  /**
   * Get grid cell key for world coordinates
   */
  private getCellKey;
  /**
   * Get all cell keys that bounds overlap
   */
  private getBoundsCells;
  /**
   * Update entity position in grid
   */
  updateEntity(entityId: number, bounds: Bounds): void;
  /**
   * Remove entity from grid
   */
  removeEntity(entityId: number): void;
  /**
   * Get potential collision pairs
   */
  getPotentialCollisions(): Array<[number, number]>;
  /**
   * Query entities in region
   */
  queryRegion(bounds: Bounds): number[];
  /**
   * Query entities at point
   */
  queryPoint(x: number, y: number): number[];
  /**
   * Check if two bounds overlap
   */
  private boundsOverlap;
  /**
   * Clear all entities from grid
   */
  clear(): void;
  /**
   * Get grid statistics
   */
  getStats(): {
    totalCells: number;
    totalEntities: number;
    averageEntitiesPerCell: number;
    maxEntitiesInCell: number;
  };
}
//# sourceMappingURL=SpatialGrid.d.ts.map
