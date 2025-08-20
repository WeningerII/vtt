/**
 * Navmesh is a thin wrapper around a hypothetical WASM implementation
 * of Recast/Detour. The actual WASM glue code would live in this
 * package; here we simply stub the API to illustrate its shape.
 */
export class Navmesh {
    constructor(data) {
        this.data = data;
    }
    /**
     * Compute a path from start to goal. Returns an array of waypoints.
     */
    findPath(start, goal) {
        // Placeholder implementation returns the direct line between points.
        return [start, goal];
    }
}
//# sourceMappingURL=index.js.map