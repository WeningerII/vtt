import { describe, it, expect } from "vitest";
import { InstancedLayers } from "../src";

describe("InstancedLayers edge cases", () => {
  it("returns no batches when there are no instances", () => {
    const layers = new InstancedLayers();
    expect(layers.instanceCount).toBe(0);
    expect(layers.getBatches()).toEqual([]);
  });

  it("allows mixing instances with and without color in a batch; missing colors remain zeroes", () => {
    const layers = new InstancedLayers();
    // First has color, defines color stride = 4
    layers.addInstance("mat", "spr", [1, 0, 0, 1, 0, 0], [0.1, 0.2, 0.3, 0.4]);
    // Second without color
    layers.addInstance("mat", "spr", [1, 0, 0, 1, 5, 6]);

    const [batch] = layers.getBatches();
    expect(batch).toBeTruthy();
    expect(batch.colorStride).toBe(4);
    expect(batch.colors).toBeInstanceOf(Float32Array);
    // First color as set
    expect(batch!.colors![0]).toBeCloseTo(0.1, 6);
    expect(batch!.colors![1]).toBeCloseTo(0.2, 6);
    expect(batch!.colors![2]).toBeCloseTo(0.3, 6);
    expect(batch!.colors![3]).toBeCloseTo(0.4, 6);
    // Second color defaults to zeros
    const offset = 4; // second instance start
    expect(batch!.colors![offset + 0]).toBeCloseTo(0, 6);
    expect(batch!.colors![offset + 1]).toBeCloseTo(0, 6);
    expect(batch!.colors![offset + 2]).toBeCloseTo(0, 6);
    expect(batch!.colors![offset + 3]).toBeCloseTo(0, 6);
  });

  it("throws if a later instance has a larger transform array than the first in the same batch", () => {
    const layers = new InstancedLayers();
    // First defines transform stride = 6
    layers.addInstance("m", "s", [1, 0, 0, 1, 0, 0]);
    // Second, erroneously larger stride (8)
    layers.addInstance("m", "s", [1, 0, 0, 1, 0, 0, 7, 8]);

    // Packing will try to set 8 values into a slot sized for 6, which should throw
    expect(() => layers.getBatches()).toThrow();
  });
});
