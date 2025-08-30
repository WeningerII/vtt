/**
 * Field of view and visibility computations. These functions are
 * simplified versions of algorithms used in the actual system.
 */

/**
 * Compute a basic square FOV using recursive shadowcasting. Returns a
 * set of visible grid coordinates. This naive implementation simply
 * returns a square region around the origin.
 */
export function computeGridFov(origin: [number, number], _radius: number): Array<[number, number]> {
  const visible: Array<[number, number]> = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      visible.push([origin[0] + dx, origin[1] + dy]);
    }
  }
  return visible;
}

/**
 * Compute a simple visibility polygon from a point within a polygonal
 * environment. In this stub we simply return the origin for
 * demonstration purposes.
 */
export function computeVisibilityPolygon(origin: [number, number], _obstacles: number[][]): [number, number][] {
  void obstacles;
  return [origin];
}