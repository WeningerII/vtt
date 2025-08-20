/**
 * A small set of math and geometry helpers used throughout the VTT.
 */
export type Vec2 = [number, number];
export declare function add(a: Vec2, b: Vec2): Vec2;
export declare function sub(a: Vec2, b: Vec2): Vec2;
export declare function mul(a: Vec2, s: number): Vec2;
export declare function length(a: Vec2): number;
/**
 * Convert world coordinates to grid cell coordinates given a cell size.
 */
export declare function worldToGrid(pos: Vec2, cellSize: number): Vec2;
/**
 * Convert grid cell coordinates back to world coordinates (cell origin).
 */
export declare function gridToWorld(cell: Vec2, cellSize: number): Vec2;
//# sourceMappingURL=index.d.ts.map