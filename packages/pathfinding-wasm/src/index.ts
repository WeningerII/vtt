/**
 * Navmesh pathfinding implementation with A* algorithm fallback
 * TODO: Replace with actual WASM Recast/Detour implementation when available
 */
export class Navmesh {
  private grid: boolean[][] = [];
  private width: number = 0;
  private height: number = 0;

  constructor(private data?: ArrayBuffer) {
    if (data) {
      this.parseNavmeshData(data);
    } else {
      // Default 100x100 grid with no obstacles
      this.initializeDefaultGrid(100, 100);
    }
  }

  private parseNavmeshData(data: ArrayBuffer): void {
    // Simple format: width(4 bytes), height(4 bytes), then width*height bytes for walkability
    const view = new DataView(data);
    this.width = view.getUint32(0, true);
    this.height = view.getUint32(4, true);
    
    this.grid = Array(this.height).fill(null).map(() => Array(this.width).fill(false));
    
    let offset = 8;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.grid[y]![x] = view.getUint8(offset++) === 1;
      }
    }
  }

  private initializeDefaultGrid(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.grid = Array(height).fill(null).map(() => Array(width).fill(true));
  }

  /**
   * Compute a path from start to goal using A* algorithm.
   */
  findPath(start: [number, number], goal: [number, number]): [number, number][] {
    const [startX, startY] = start;
    const [goalX, goalY] = goal;
    
    // Bounds checking
    if (!this.isValidPosition(startX, startY) || !this.isValidPosition(goalX, goalY)) {
      return [];
    }
    
    // If start or goal is blocked, return empty path
    if (!this.isWalkable(startX, startY) || !this.isWalkable(goalX, goalY)) {
      return [];
    }
    
    // A* algorithm implementation
    const openSet: PathNode[] = [];
    const closedSet = new Set<string>();
    const cameFrom = new Map<string, [number, number]>();
    
    const startNode: PathNode = {
      x: startX,
      y: startY,
      g: 0,
      h: this.heuristic(startX, startY, goalX, goalY),
      f: 0
    };
    startNode.f = startNode.g + startNode.h;
    openSet.push(startNode);
    
    while (openSet.length > 0) {
      // Find node with lowest f score
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift()!;
      const currentKey = `${current.x},${current.y}`;
      
      // Goal reached
      if (current.x === goalX && current.y === goalY) {
        return this.reconstructPath(cameFrom, current.x, current.y);
      }
      
      closedSet.add(currentKey);
      
      // Check neighbors
      const neighbors = this.getNeighbors(current.x, current.y);
      for (const [nx, ny] of neighbors) {
        const neighborKey = `${nx},${ny}`;
        
        if (closedSet.has(neighborKey) || !this.isWalkable(nx, ny)) {
          continue;
        }
        
        const tentativeG = current.g + this.getMovementCost(current.x, current.y, nx, ny);
        
        const existingNode = openSet.find(n => n.x === nx && n.y === ny);
        if (!existingNode) {
          const newNode: PathNode = {
            x: nx,
            y: ny,
            g: tentativeG,
            h: this.heuristic(nx, ny, goalX, goalY),
            f: 0
          };
          newNode.f = newNode.g + newNode.h;
          openSet.push(newNode);
          cameFrom.set(neighborKey, [current.x, current.y]);
        } else if (tentativeG < existingNode.g) {
          existingNode.g = tentativeG;
          existingNode.f = existingNode.g + existingNode.h;
          cameFrom.set(neighborKey, [current.x, current.y]);
        }
      }
    }
    
    // No path found
    return [];
  }
  
  private isValidPosition(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }
  
  private isWalkable(x: number, y: number): boolean {
    return this.isValidPosition(x, y) && (this.grid[y]?.[x] ?? false);
  }
  
  private heuristic(x1: number, y1: number, x2: number, y2: number): number {
    // Manhattan distance
    return Math.abs(x2 - x1) + Math.abs(y2 - y1);
  }
  
  private getNeighbors(x: number, y: number): [number, number][] {
    const neighbors: [number, number][] = [];
    
    // 8-directional movement
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) {
          continue;
        }
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (this.isValidPosition(nx, ny)) {
          neighbors.push([nx, ny]);
        }
      }
    }
    
    return neighbors;
  }
  
  private getMovementCost(x1: number, y1: number, x2: number, y2: number): number {
    // Diagonal movement costs more
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    return dx + dy === 2 ? 1.414 : 1; // √2 ≈ 1.414 for diagonal
  }
  
  private reconstructPath(cameFrom: Map<string, [number, number]>, goalX: number, goalY: number): [number, number][] {
    const path: [number, number][] = [[goalX, goalY]];
    let current = `${goalX},${goalY}`;
    
    while (cameFrom.has(current)) {
      const [x, y] = cameFrom.get(current)!;
      path.unshift([x, y]);
      current = `${x},${y}`;
    }
    
    return path;
  }
  
  /**
   * Set walkability of a position (useful for dynamic obstacles)
   */
  setWalkable(x: number, y: number, walkable: boolean): void {
    if (this.isValidPosition(x, y) && this.grid[y]) {
      this.grid[y]![x] = walkable;
    }
  }
  
  /**
   * Get the dimensions of the navmesh
   */
  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }
}

interface PathNode {
  x: number;
  y: number;
  g: number; // Distance from start
  h: number; // Heuristic (distance to goal)
  f: number; // Total cost (g + h)
}