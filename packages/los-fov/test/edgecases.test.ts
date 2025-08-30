import { describe, it, expect } from "vitest";
import { computeVisibilityPolygon } from "../src";

describe("computeVisibilityPolygon edge cases", () => {
  it("returns origin when there are no obstacles", () => {
    const origin: [number, number] = [2, 3];
    const poly = computeVisibilityPolygon(origin, []);
    expect(poly).toEqual([origin]);
  });

  it("ignores zero-length segments", () => {
    const origin: [number, number] = [0, 0];
    const obstacles = [
      [1, 1, 1, 1], // zero-length
      [2, 2, 2, 2], // zero-length
    ];
    const poly = computeVisibilityPolygon(origin, obstacles);
    expect(poly).toEqual([origin]);
  });
});
