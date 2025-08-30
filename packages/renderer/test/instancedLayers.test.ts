import { describe, it, expect } from "vitest";
import { InstancedLayers } from "../src";

describe("InstancedLayers", () => {
  it("preserves legacy layer API", () => {
    const layers = new InstancedLayers();
    expect(layers.count).toBe(0);
    layers.addLayer();
    layers.addLayer();
    expect(layers.count).toBe(2);
  });

  it("batches instances by material and sprite and sorts batches", () => {
    const layers = new InstancedLayers();

    // materialB|sprite1
    layers.addInstance("matB", "spr1", [1, 0, 0, 1, 10, 20], [1, 0, 0, 1]);
    layers.addInstance("matB", "spr1", [1, 0, 0, 1, 30, 40], [0.5, 0.5, 0.5, 1]);

    // materialA|sprite2
    layers.addInstance("matA", "spr2", [1, 0, 0, 1, -5, -6]);

    // materialA|sprite1
    layers.addInstance("matA", "spr1", [1, 0, 0, 1, 0, 0]);

    expect(layers.instanceCount).toBe(4);

    const batches = layers.getBatches();
    // Sorted by material then sprite
    expect(_batches.map((b) => `${b.material}|${b.sprite}`)).toEqual([
      "matA|spr1",
      "matA|spr2",
      "matB|spr1",
    ]);

    // Validate strides and counts
    const b0 = batches[0]!;
    expect(b0.transformStride).toBe(6);
    expect(b0.count).toBe(1);

    const b2 = batches[2]!;
    expect(b2.transformStride).toBe(6);
    expect(b2.colorStride).toBe(4);
    expect(b2.count).toBe(2);

    // Packed data placement
    // First instance of matB|spr1 has tx=10, ty=20 at indices 4,5
    expect(b2.transforms[4]).toBe(10);
    expect(b2.transforms[5]).toBe(20);
    // Second instance packed next (indices 10,11)
    expect(b2.transforms[10]).toBe(30);
    expect(b2.transforms[11]).toBe(40);
  });

  it("reset clears instances and optionally layers", () => {
    const layers = new InstancedLayers();
    layers.addLayer();
    layers.addInstance("m", "s", [1, 0, 0, 1, 0, 0]);
    expect(layers.instanceCount).toBe(1);

    layers.reset();
    expect(layers.instanceCount).toBe(0);
    expect(layers.count).toBe(1); // kept by default

    layers.reset({ keepLayers: false });
    expect(layers.count).toBe(0);
  });
});
