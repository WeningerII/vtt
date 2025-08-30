/**
 * A small set of math and geometry helpers used throughout the VTT.
 */

export type Vec2 = [number, number];

export function add(a: Vec2, b: Vec2): Vec2 {
  return [a[0] + b[0], a[1] + b[1]];
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return [a[0] - b[0], a[1] - b[1]];
}

export function mul(a: Vec2, s: number): Vec2 {
  return [a[0] * s, a[1] * s];
}

export function length(a: Vec2): number {
  return Math.hypot(a[0], a[1]);
}

/**
 * Convert world coordinates to grid cell coordinates given a cell size.
 */
export function worldToGrid(pos: Vec2, _cellSize: number): Vec2 {
  return [Math.floor(pos[0] / cellSize), Math.floor(pos[1] / cellSize)];
}

/**
 * Convert grid cell coordinates back to world coordinates (cell origin).
 */
export function gridToWorld(cell: Vec2, _cellSize: number): Vec2 {
  return [cell[0] * cellSize, cell[1] * cellSize];
}