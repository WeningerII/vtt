/**
 * A naive broadphase that simply returns all pairs. Real
 * implementations would use spatial hashing or BVH to reduce pair
 * counts.
 */
export declare class Broadphase {
  private objects;
  add(obj: unknown): void;
  query(): Array<[unknown, unknown]>;
}
//# sourceMappingURL=Broadphase.d.ts.map
