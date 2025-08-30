export class Grid {
  constructor(width, height) {
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
  getNode(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return null;
    }
    return this.nodes[x][y];
  }
  setWalkable(x, y, walkable) {
    const node = this.getNode(x, y);
    if (node) {
      node.walkable = walkable;
    }
  }
  isWalkable(x, y) {
    const node = this.getNode(x, y);
    return node ? node.walkable : false;
  }
  getNeighbors(node, allowDiagonal = true) {
    const neighbors = [];
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
  reset() {
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
  setObstacles(obstacles) {
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
  clone() {
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
  static calculateDistance(nodeA, nodeB, heuristic) {
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
  static getMovementCost(nodeA, nodeB) {
    const dx = Math.abs(nodeA.x - nodeB.x);
    const dy = Math.abs(nodeA.y - nodeB.y);
    // Diagonal movement costs more
    if (dx === 1 && dy === 1) {
      return 14; // Approximately sqrt(2) * 10
    } else {
      return 10; // Straight movement
    }
  }
  static retracePath(startNode, endNode) {
    const path = [];
    let currentNode = endNode;
    while (currentNode !== startNode) {
      path.unshift({ x: currentNode.x, y: currentNode.y });
      currentNode = currentNode.parent;
    }
    path.unshift({ x: startNode.x, y: startNode.y });
    return path;
  }
  static findPath(grid, start, end, options = {}) {
    const startTime = performance.now();
    const opts = {
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
    const openSet = [];
    const closedSet = new Set();
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
  static smoothPath(path) {
    if (path.length <= 2) {
      return path;
    }
    const smoothed = [path[0]];
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
  constructor(grid) {
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
  generateFlowField(target) {
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
    const queue = [target];
    while (queue.length > 0) {
      const current = queue.shift();
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
  getDirection(x, y) {
    if (x < 0 || x >= this.grid.width || y < 0 || y >= this.grid.height) {
      return { x: 0, y: 0 };
    }
    return this.flowField[x][y];
  }
  getCost(x, y) {
    if (x < 0 || x >= this.grid.width || y < 0 || y >= this.grid.height) {
      return Infinity;
    }
    return this.costField[x][y];
  }
  getNeighbors(pos) {
    const neighbors = [];
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
  constructor() {
    this.grids = new Map();
    this.flowFields = new Map();
    this.pathCache = new Map();
    this.cacheTimeout = 5000; // 5 seconds
  }
  createGrid(id, width, height) {
    const grid = new Grid(width, height);
    this.grids.set(id, grid);
    return grid;
  }
  getGrid(id) {
    return this.grids.get(id) || null;
  }
  removeGrid(id) {
    this.grids.delete(id);
    this.flowFields.delete(id);
  }
  findPath(gridId, start, end, options) {
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
  createFlowField(gridId, target) {
    const grid = this.grids.get(gridId);
    if (!grid) return null;
    const flowField = new FlowField(grid);
    flowField.generateFlowField(target);
    this.flowFields.set(gridId, flowField);
    return flowField;
  }
  getFlowField(gridId) {
    return this.flowFields.get(gridId) || null;
  }
  clearCache() {
    this.pathCache.clear();
  }
  cleanupCache() {
    const now = Date.now();
    for (const [key, cached] of this.pathCache) {
      if (now - cached.timestamp >= this.cacheTimeout) {
        this.pathCache.delete(key);
      }
    }
  }
  getStats() {
    return {
      gridCount: this.grids.size,
      flowFieldCount: this.flowFields.size,
      cacheSize: this.pathCache.size,
      cacheTimeout: this.cacheTimeout,
    };
  }
  dispose() {
    this.grids.clear();
    this.flowFields.clear();
    this.pathCache.clear();
  }
}
// Utility functions
export function worldToGrid(worldPos, cellSize, gridOffset = { x: 0, y: 0 }) {
  return {
    x: Math.floor((worldPos.x - gridOffset.x) / cellSize),
    y: Math.floor((worldPos.y - gridOffset.y) / cellSize),
  };
}
export function gridToWorld(gridPos, cellSize, gridOffset = { x: 0, y: 0 }) {
  return {
    x: gridPos.x * cellSize + cellSize * 0.5 + gridOffset.x,
    y: gridPos.y * cellSize + cellSize * 0.5 + gridOffset.y,
  };
}
export function simplifyPath(path, tolerance = 1) {
  if (path.length <= 2) return path;
  const simplified = [path[0]];
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
//# sourceMappingURL=Pathfinding.js.map
