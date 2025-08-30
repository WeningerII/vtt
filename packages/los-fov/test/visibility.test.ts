import { describe, it, expect } from "vitest";
import { computeVisibilityPolygon } from "../src";

describe("computeVisibilityPolygon", () => {
  it("returns a reasonable polygon inside a convex box", () => {
    const origin: [number, number] = [0, 0];
    const s = 1;
    const obstacles = [
      [-s, -s, s, -s],
      [s, -s, s, s],
      [s, s, -s, s],
      [-s, s, -s, -s],
    ];
    const poly = computeVisibilityPolygon(origin, obstacles);

    expect(poly.length).toBeGreaterThanOrEqual(4);
    for (const [x, y] of poly) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }

    const near = (ax: number, ay: number, tol = 1e-2) =>
      poly.some(([x, y]) => Math.hypot(x - ax, y - ay) < tol);
    // The visibility from center of a square will include the four corners
    expect(near(1, 1)).toBe(true);
    expect(near(-1, 1)).toBe(true);
    expect(near(-1, -1)).toBe(true);
    expect(near(1, -1)).toBe(true);
  });
});
