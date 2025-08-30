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
  weight: number; // For weighted A*
}

export interface PathfindingResult {
  path: Vector2[];
  found: boolean;
  iterations: number;
  executionTime: number;
  nodesExplored: number;
}

export class Grid {
  public width: number;
  public height: number;
  private nodes: PathfindingNode[][];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.nodes = [];

    // Initialize grid
    for (let x = 0; x < width; x++) {
      this.nodes[x] = [];
      for (let y = 0; y < height; y++) {
        this.nodes[x][y] = {
          x,
          y,
          walkable: true,
          gCost: 0,
          hCost: 0,
          fCost: 0,
          parent: null,
        };
      }
    }
  }

  public getNode(x: number, y: number): PathfindingNode | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return null;
    }
    return this.nodes[x][y];
  }

  public setWalkable(x: number, y: number, walkable: boolean): void {
    const node = this.getNode(x, y);
    if (node) {
      node.walkable = walkable;
    }
  }

  public isWalkable(x: number, y: number): boolean {
    const node = this.getNode(x, y);
    return node ? node.walkable : false;
  }

  public getNeighbors(node: PathfindingNode, allowDiagonal: boolean = true): PathfindingNode[] {
    const neighbors: PathfindingNode[] = [];

    // Direct neighbors (4-directional)
    const directions = [
      { x: 0, y: -1 }, // North
      { x: 1, y: 0 }, // East
      { x: 0, y: 1 }, // South
      { x: -1, y: 0 }, // West
    ];

    for (const dir of directions) {
      const neighbor = this.getNode(node.x + dir.x, node.y + dir.y);
      if (neighbor && neighbor.walkable) {
        neighbors.push(neighbor);
      }
    }

    // Diagonal neighbors
    if (allowDiagonal) {
      const diagonalDirections = [
        { x: -1, y: -1 }, // Northwest
        { x: 1, y: -1 }, // Northeast
        { x: 1, y: 1 }, // Southeast
        { x: -1, y: 1 }, // Southwest
      ];

      for (const dir of diagonalDirections) {
        const neighbor = this.getNode(node.x + dir.x, node.y + dir.y);
        if (neighbor && neighbor.walkable) {
          // Check if diagonal movement is blocked by adjacent walls
          const horizontal = this.getNode(node.x + dir.x, node.y);
          const vertical = this.getNode(node.x, node.y + dir.y);

          if (horizontal?.walkable && vertical?.walkable) {
            neighbors.push(neighbor);
          }
        }
      }
    }

    return neighbors;
  }

  public reset(): void {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const node = this.nodes[x][y];
        node.gCost = 0;
        node.hCost = 0;
        node.fCost = 0;
        node.parent = null;
      }
    }
  }

  public setObstacles(obstacles: Vector2[]): void {
    // Reset all to walkable first
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        this.nodes[x][y].walkable = true;
      }
    }

    // Set obstacles
    for (const obstacle of obstacles) {
      this.setWalkable(obstacle.x, obstacle.y, false);
    }
  }

  public clone(): Grid {
    const newGrid = new Grid(this.width, this.height);

    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        newGrid.nodes[x][y].walkable = this.nodes[x][y].walkable;
      }
    }

    return newGrid;
  }
}

export class AStar {
  private static calculateDistance(
    nodeA: PathfindingNode,
    nodeB: PathfindingNode,
    heuristic: string,
  ): number {
    const dx = Math.abs(nodeA.x - nodeB.x);
    const dy = Math.abs(nodeA.y - nodeB.y);

    switch (heuristic) {
      case "manhattan":
        return dx + dy;
      case "euclidean":
        return Math.sqrt(dx * dx + dy * dy);
      case "diagonal":
        return Math.max(dx, dy) + (Math.sqrt(2) - 1) * Math.min(dx, dy);
      default:
        return dx + dy;
    }
  }

  private static getMovementCost(nodeA: PathfindingNode, nodeB: PathfindingNode): number {
    const dx = Math.abs(nodeA.x - nodeB.x);
    const dy = Math.abs(nodeA.y - nodeB.y);

    // Diagonal movement costs more
    if (dx === 1 && dy === 1) {
      return 14; // Approximately sqrt(2) * 10
    } else {
      return 10; // Straight movement
    }
  }

  private static retracePath(startNode: PathfindingNode, endNode: PathfindingNode): Vector2[] {
    const path: Vector2[] = [];
    let currentNode = endNode;

    while (currentNode !== startNode) {
      path.unshift({ x: currentNode.x, y: currentNode.y });
      currentNode = currentNode.parent!;
    }

    path.unshift({ x: startNode.x, y: startNode.y });
    return path;
  }

  public static findPath(
    grid: Grid,
    start: Vector2,
    end: Vector2,
    options: Partial<PathfindingOptions> = {},
  ): PathfindingResult {
    const startTime = performance.now();
    const opts: PathfindingOptions = {
      heuristic: "euclidean",
      allowDiagonal: true,
      maxIterations: 1000,
      weight: 1,
      ...options,
    };

    const startNode = grid.getNode(start.x, start.y);
    const endNode = grid.getNode(end.x, end.y);

    if (!startNode || !endNode || !startNode.walkable || !endNode.walkable) {
      return {
        path: [],
        found: false,
        iterations: 0,
        executionTime: performance.now() - startTime,
        nodesExplored: 0,
      };
    }

    grid.reset();

    const openSet: PathfindingNode[] = [];
    const closedSet = new Set<PathfindingNode>();
    let iterations = 0;
    let nodesExplored = 0;

    openSet.push(startNode);

    while (openSet.length > 0 && iterations < opts.maxIterations) {
      iterations++;

      // Find node with lowest fCost
      let currentNode = openSet[0];
      let currentIndex = 0;

      for (let i = 1; i < openSet.length; i++) {
        if (
          openSet[i].fCost < currentNode.fCost ||
          (openSet[i].fCost === currentNode.fCost && openSet[i].hCost < currentNode.hCost)
        ) {
          currentNode = openSet[i];
          currentIndex = i;
        }
      }

      // Move current node from open to closed set
      openSet.splice(currentIndex, 1);
      closedSet.add(currentNode);

      // Check if we reached the target
      if (currentNode === endNode) {
        const path = this.retracePath(startNode, endNode);
        return {
          path,
          found: true,
          iterations,
          executionTime: performance.now() - startTime,
          nodesExplored,
        };
      }

      // Check neighbors
      const neighbors = grid.getNeighbors(currentNode, opts.allowDiagonal);

      for (const neighbor of neighbors) {
        if (closedSet.has(neighbor)) {
          continue;
        }

        nodesExplored++;

        const newMovementCostToNeighbor =
          currentNode.gCost + this.getMovementCost(currentNode, neighbor);

        if (newMovementCostToNeighbor < neighbor.gCost || !openSet.includes(neighbor)) {
          neighbor.gCost = newMovementCostToNeighbor;
          neighbor.hCost = this.calculateDistance(neighbor, endNode, opts.heuristic) * opts.weight;
          neighbor.fCost = neighbor.gCost + neighbor.hCost;
          neighbor.parent = currentNode;

          if (!openSet.includes(neighbor)) {
            openSet.push(neighbor);
          }
        }
      }
    }

    // No path found
    return {
      path: [],
      found: false,
      iterations,
      executionTime: performance.now() - startTime,
      nodesExplored,
    };
  }

  public static smoothPath(path: Vector2[]): Vector2[] {
    if (path.length <= 2) {
      return path;
    }

    const smoothed: Vector2[] = [path[0]];

    for (let i = 2; i < path.length; i++) {
      const current = path[i];
      const previous = smoothed[smoothed.length - 1];

      // Check if we can skip the intermediate point
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      const intermediate = path[i - 1];

      // If the intermediate point is on the direct line, we can skip it
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
        continue;
      }

      smoothed.push(intermediate);
    }

    smoothed.push(path[path.length - 1]);
    return smoothed;
  }
}

// Flow Field Pathfinding
export class FlowField {
  private grid: Grid;
  private flowField: Vector2[][];
  private costField: number[][];

  constructor(grid: Grid) {
    this.grid = grid;
    this.flowField = [];
    this.costField = [];

    // Initialize fields
    for (let x = 0; x < grid.width; x++) {
      this.flowField[x] = [];
      this.costField[x] = [];
      for (let y = 0; y < grid.height; y++) {
        this.flowField[x][y] = { x: 0, y: 0 };
        this.costField[x][y] = Infinity;
      }
    }
  }

  public generateFlowField(target: Vector2): void {
    // Reset cost field
    for (let x = 0; x < this.grid.width; x++) {
      for (let y = 0; y < this.grid.height; y++) {
        this.costField[x][y] = this.grid.isWalkable(x, y) ? Infinity : -1;
      }
    }

    // Set target cost to 0
    if (this.grid.isWalkable(target.x, target.y)) {
      this.costField[target.x][target.y] = 0;
    }

    // Dijkstra's algorithm to generate cost field
    const queue: Vector2[] = [target];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentCost = this.costField[current.x][current.y];

      const neighbors = this.getNeighbors(current);

      for (const neighbor of neighbors) {
        if (this.costField[neighbor.x][neighbor.y] === -1) continue; // Unwalkable

        const newCost = currentCost + 1;

        if (newCost < this.costField[neighbor.x][neighbor.y]) {
          this.costField[neighbor.x][neighbor.y] = newCost;
          queue.push(neighbor);
        }
      }
    }

    // Generate flow field from cost field
    for (let x = 0; x < this.grid.width; x++) {
      for (let y = 0; y < this.grid.height; y++) {
        if (this.costField[x][y] === -1 || this.costField[x][y] === Infinity) {
          this.flowField[x][y] = { x: 0, y: 0 };
          continue;
        }

        let bestDirection = { x: 0, y: 0 };
        let bestCost = this.costField[x][y];

        const neighbors = this.getNeighbors({ x, y });

        for (const neighbor of neighbors) {
          if (this.costField[neighbor.x][neighbor.y] < bestCost) {
            bestCost = this.costField[neighbor.x][neighbor.y];
            bestDirection = {
              x: neighbor.x - x,
              y: neighbor.y - y,
            };
          }
        }

        // Normalize direction
        const length = Math.sqrt(
          bestDirection.x * bestDirection.x + bestDirection.y * bestDirection.y,
        );
        if (length > 0) {
          bestDirection.x /= length;
          bestDirection.y /= length;
        }

        this.flowField[x][y] = bestDirection;
      }
    }
  }

  public getDirection(x: number, y: number): Vector2 {
    if (x < 0 || x >= this.grid.width || y < 0 || y >= this.grid.height) {
      return { x: 0, y: 0 };
    }

    return this.flowField[x][y];
  }

  public getCost(x: number, y: number): number {
    if (x < 0 || x >= this.grid.width || y < 0 || y >= this.grid.height) {
      return Infinity;
    }

    return this.costField[x][y];
  }

  private getNeighbors(pos: Vector2): Vector2[] {
    const neighbors: Vector2[] = [];
    const directions = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ];

    for (const dir of directions) {
      const nx = pos.x + dir.x;
      const ny = pos.y + dir.y;

      if (nx >= 0 && nx < this.grid.width && ny >= 0 && ny < this.grid.height) {
        neighbors.push({ x: nx, y: ny });
      }
    }

    return neighbors;
  }
}

// Pathfinding Manager
export class PathfindingManager {
  private grids = new Map<string, Grid>();
  private flowFields = new Map<string, FlowField>();
  private pathCache = new Map<string, { path: Vector2[]; timestamp: number }>();
  private cacheTimeout = 5000; // 5 seconds

  public createGrid(id: string, width: number, height: number): Grid {
    const grid = new Grid(width, height);
    this.grids.set(id, grid);
    return grid;
  }

  public getGrid(id: string): Grid | null {
    return this.grids.get(id) || null;
  }

  public removeGrid(id: string): void {
    this.grids.delete(id);
    this.flowFields.delete(id);
  }

  public findPath(
    gridId: string,
    start: Vector2,
    end: Vector2,
    options?: Partial<PathfindingOptions>,
  ): PathfindingResult {
    const grid = this.grids.get(gridId);
    if (!grid) {
      return {
        path: [],
        found: false,
        iterations: 0,
        executionTime: 0,
        nodesExplored: 0,
      };
    }

    // Check cache
    const cacheKey = `${gridId}:${start.x},${start.y}:${end.x},${end.y}`;
    const cached = this.pathCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return {
        path: cached.path,
        found: cached.path.length > 0,
        iterations: 0,
        executionTime: 0,
        nodesExplored: 0,
      };
    }

    // Find path
    const result = AStar.findPath(grid, start, end, options);

    // Cache result
    if (result.found) {
      this.pathCache.set(cacheKey, {
        path: result.path,
        timestamp: Date.now(),
      });
    }

    return result;
  }

  public createFlowField(gridId: string, target: Vector2): FlowField | null {
    const grid = this.grids.get(gridId);
    if (!grid) return null;

    const flowField = new FlowField(grid);
    flowField.generateFlowField(target);
    this.flowFields.set(gridId, flowField);

    return flowField;
  }

  public getFlowField(gridId: string): FlowField | null {
    return this.flowFields.get(gridId) || null;
  }

  public clearCache(): void {
    this.pathCache.clear();
  }

  public cleanupCache(): void {
    const now = Date.now();

    for (const [key, cached] of this.pathCache) {
      if (now - cached.timestamp >= this.cacheTimeout) {
        this.pathCache.delete(key);
      }
    }
  }

  public getStats() {
    return {
      gridCount: this.grids.size,
      flowFieldCount: this.flowFields.size,
      cacheSize: this.pathCache.size,
      cacheTimeout: this.cacheTimeout,
    };
  }

  public dispose(): void {
    this.grids.clear();
    this.flowFields.clear();
    this.pathCache.clear();
  }
}

// Utility functions
export function worldToGrid(
  worldPos: Vector2,
  _cellSize: number,
  gridOffset: Vector2 = { x: 0, _y: 0 },
): Vector2 {
  return {
    x: Math.floor((worldPos.x - gridOffset.x) / cellSize),
    y: Math.floor((worldPos.y - gridOffset.y) / cellSize),
  };
}

export function gridToWorld(
  gridPos: Vector2,
  _cellSize: number,
  gridOffset: Vector2 = { x: 0, _y: 0 },
): Vector2 {
  return {
    x: gridPos.x * cellSize + cellSize * 0.5 + gridOffset.x,
    y: gridPos.y * cellSize + cellSize * 0.5 + gridOffset.y,
  };
}

export function simplifyPath(path: Vector2[], _tolerance: number = 1): Vector2[] {
  if (path.length <= 2) return path;

  const simplified: Vector2[] = [path[0]];

  for (let i = 1; i < path.length - 1; i++) {
    const prev = simplified[simplified.length - 1];
    const current = path[i];
    const next = path[i + 1];

    // Calculate cross product to determine if points are collinear
    const crossProduct =
      (next.x - prev.x) * (current.y - prev.y) - (next.y - prev.y) * (current.x - prev.x);

    if (Math.abs(crossProduct) > tolerance) {
      simplified.push(current);
    }
  }

  simplified.push(path[path.length - 1]);
  return simplified;
}
