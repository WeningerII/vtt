const EPS = 1e-4;
function approx(a, b, eps = EPS) {
  if (a === undefined && b === undefined) return true;
  if (a === undefined || b === undefined) return false;
  return Math.abs(a - b) <= eps;
}
function equalState(a, b) {
  return (
    approx(a.x, b.x) &&
    approx(a.y, b.y) &&
    approx(a.rot, b.rot) &&
    approx(a.sx, b.sx) &&
    approx(a.sy, b.sy) &&
    (a.zIndex | 0) === (b.zIndex | 0) &&
    (a.sprite ?? -1) === (b.sprite ?? -1) &&
    (a.tintR ?? -1) === (b.tintR ?? -1) &&
    (a.tintG ?? -1) === (b.tintG ?? -1) &&
    (a.tintB ?? -1) === (b.tintB ?? -1) &&
    approx(a.alpha ?? 1, b.alpha ?? 1) &&
    (a.frame ?? -1) === (b.frame ?? -1)
  );
}
function readEntityState(world, id) {
  const T = world.transforms;
  if (!T.has(id)) return null;
  const state = {
    id,
    x: T.x[id] ?? 0,
    y: T.y[id] ?? 0,
    rot: T.rot[id] ?? 0,
    sx: T.sx[id] ?? 1,
    sy: T.sy[id] ?? 1,
    zIndex: (T.zIndex[id] ?? 0) | 0,
  };
  const A = world.appearance;
  if (A.has(id)) {
    // Provide explicit defaults to satisfy exactOptionalPropertyTypes and
    // noUncheckedIndexedAccess while keeping runtime behavior stable.
    state.sprite = A.sprite[id] ?? 0;
    state.tintR = A.tintR[id] ?? 0;
    state.tintG = A.tintG[id] ?? 0;
    state.tintB = A.tintB[id] ?? 0;
    state.alpha = A.alpha[id] ?? 1;
    state.frame = A.frame[id] ?? 0;
  }
  return state;
}
/**
 * Minimal functional implementation that constructs a global snapshot and
 * computes a delta versus the previous update. AOI filtering and transport
 * is intentionally left to the caller.
 */
export class NetworkSyncSystem {
  constructor() {
    this.seq = 0;
    this.last = new Map();
  }
  /** Clear internal state; next update will produce a full create set. */
  reset() {
    this.seq = 0;
    this.last.clear();
  }
  /**
   * Build a world delta by comparing the current transform/appearance state
   * against the previous snapshot stored internally.
   */
  update(world) {
    const next = new Map();
    const created = [];
    const updated = [];
    const removed = [];
    // Collect current state for all alive entities that have transforms
    for (let id = 0; id < world.capacity; id++) {
      if (!world.isAlive(id)) continue;
      const now = readEntityState(world, id);
      if (!now) continue; // requires Transform2D
      next.set(id, now);
      const prev = this.last.get(id);
      if (!prev) {
        created.push(now);
      } else if (!equalState(prev, now)) {
        updated.push(now);
      }
    }
    // Compute removals
    for (const id of this.last.keys()) {
      if (!next.has(id)) removed.push(id);
    }
    const baseSeq = this.seq;
    this.seq = baseSeq + 1;
    this.last = next;
    return { seq: this.seq, baseSeq, created, updated, removed };
  }
  /**
   * Return a full snapshot of the last known world state.
   */
  getSnapshot() {
    return { seq: this.seq, entities: Array.from(this.last.values()) };
  }
}
//# sourceMappingURL=NetworkSyncSystem.js.map
