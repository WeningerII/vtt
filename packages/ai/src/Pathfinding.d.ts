export interface Vector2 {
  x: number;
  y: number;
}
export interface PathfindingNode {
  x: number;
  y: number;
  walkable: boolean;
  gCost: number;
  hCost: number;
  fCost: number;
  parent: PathfindingNode | null;
}
export interface PathfindingOptions {
  heuristic: "manhattan" | "euclidean" | "diagonal";
  allowDiagonal: boolean;
  maxIterations: number;
  weight: number;
}
export interface PathfindingResult {
  path: Vector2[];
  found: boolean;
  iterations: number;
  executionTime: number;
  nodesExplored: number;
}
export declare class Grid {
  width: number;
  height: number;
  private nodes;
  constructor(width: number, height: number);
  getNode(x: number, y: number): PathfindingNode | null;
  setWalkable(x: number, y: number, walkable: boolean): void;
  isWalkable(x: number, y: number): boolean;
  getNeighbors(node: PathfindingNode, allowDiagonal?: boolean): PathfindingNode[];
  reset(): void;
  setObstacles(obstacles: Vector2[]): void;
  clone(): Grid;
}
export declare class AStar {
  private static calculateDistance;
  private static getMovementCost;
  private static retracePath;
  static findPath(
    grid: Grid,
    start: Vector2,
    end: Vector2,
    options?: Partial<PathfindingOptions>,
  ): PathfindingResult;
  static smoothPath(path: Vector2[]): Vector2[];
}
export declare class FlowField {
  private grid;
  private flowField;
  private costField;
  constructor(grid: Grid);
  generateFlowField(target: Vector2): void;
  getDirection(x: number, y: number): Vector2;
  getCost(x: number, y: number): number;
  private getNeighbors;
}
export declare class PathfindingManager {
  private grids;
  private flowFields;
  private pathCache;
  private cacheTimeout;
  createGrid(id: string, width: number, height: number): Grid;
  getGrid(id: string): Grid | null;
  removeGrid(id: string): void;
  findPath(
    gridId: string,
    start: Vector2,
    end: Vector2,
    options?: Partial<PathfindingOptions>,
  ): PathfindingResult;
  createFlowField(gridId: string, target: Vector2): FlowField | null;
  getFlowField(gridId: string): FlowField | null;
  clearCache(): void;
  cleanupCache(): void;
  getStats(): {
    gridCount: number;
    flowFieldCount: number;
    cacheSize: number;
    cacheTimeout: number;
  };
  dispose(): void;
}
export declare function worldToGrid(
  _worldPos: Vector2,
  _cellSize: number,
  _gridOffset?: Vector2,
): Vector2;
export declare function gridToWorld(
  _gridPos: Vector2,
  _cellSize: number,
  _gridOffset?: Vector2,
): Vector2;
export declare function simplifyPath(_path: Vector2[], _tolerance?: number): Vector2[];
//# sourceMappingURL=Pathfinding.d.ts.map
