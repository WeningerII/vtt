/**
 * Field of view and visibility computations. These functions are
 * simplified versions of algorithms used in the actual system.
 */
/**
 * Compute a basic square FOV using recursive shadowcasting. Returns a
 * set of visible grid coordinates. This naive implementation simply
 * returns a square region around the origin.
 */
export declare function computeGridFov(origin: [number, number], radius: number): Array<[number, number]>;
/**
 * Compute a simple visibility polygon from a point within a polygonal
 * environment. In this stub we simply return the origin for
 * demonstration purposes.
 */
export declare function computeVisibilityPolygon(origin: [number, number], obstacles: number[][]): [number, number][];
//# sourceMappingURL=index.d.ts.map