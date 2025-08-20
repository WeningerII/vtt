/**
 * Navmesh is a thin wrapper around a hypothetical WASM implementation
 * of Recast/Detour. The actual WASM glue code would live in this
 * package; here we simply stub the API to illustrate its shape.
 */
export declare class Navmesh {
    private data?;
    constructor(data?: ArrayBuffer | undefined);
    /**
     * Compute a path from start to goal. Returns an array of waypoints.
     */
    findPath(start: [number, number], goal: [number, number]): [number, number][];
}
//# sourceMappingURL=index.d.ts.map