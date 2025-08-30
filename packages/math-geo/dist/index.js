/**
 * A small set of math and geometry helpers used throughout the VTT.
 */
export function add(a, b) {
    return [a[0] + b[0], a[1] + b[1]];
}
export function sub(a, b) {
    return [a[0] - b[0], a[1] - b[1]];
}
export function mul(a, s) {
    return [a[0] * s, a[1] * s];
}
export function length(a) {
    return Math.hypot(a[0], a[1]);
}
/**
 * Convert world coordinates to grid cell coordinates given a cell size.
 */
export function worldToGrid(pos, _cellSize) {
    return [Math.floor(pos[0] / cellSize), Math.floor(pos[1] / cellSize)];
}
/**
 * Convert grid cell coordinates back to world coordinates (cell origin).
 */
export function gridToWorld(cell, _cellSize) {
    return [cell[0] * cellSize, cell[1] * cellSize];
}
//# sourceMappingURL=index.js.map