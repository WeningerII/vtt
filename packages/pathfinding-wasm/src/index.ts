/**
 * Navmesh is a thin wrapper around a hypothetical WASM implementation
 * of Recast/Detour. The actual WASM glue code would live in this
 * package; here we simply stub the API to illustrate its shape.
 */
export class Navmesh {
  constructor(private data?: ArrayBuffer) {}
  /**
   * Compute a path from start to goal. Returns an array of waypoints.
   */
  findPath(start: [number, number], goal: [number, number]): [number, number][] {
    // Placeholder implementation returns the direct line between points.
    return [start, goal];
  }
}