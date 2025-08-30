import type { World, EntityId } from "../World";
/**
 * A compact representation of the network-visible state for an entity.
 * Only includes data necessary for clients to render and interpolate.
 */
export interface NetEntityState {
    id: EntityId;
    x: number;
    y: number;
    rot: number;
    sx: number;
    sy: number;
    zIndex: number;
    sprite?: number;
    tintR?: number;
    tintG?: number;
    tintB?: number;
    alpha?: number;
    frame?: number;
}
export interface Snapshot {
    seq: number;
    entities: NetEntityState[];
}
export interface Delta {
    seq: number;
    baseSeq: number;
    created: NetEntityState[];
    updated: NetEntityState[];
    removed: EntityId[];
}
/**
 * Minimal functional implementation that constructs a global snapshot and
 * computes a delta versus the previous update. AOI filtering and transport
 * is intentionally left to the caller.
 */
export declare class NetworkSyncSystem {
    private seq;
    private last;
    /** Clear internal state; next update will produce a full create set. */
    reset(): void;
    /**
     * Build a world delta by comparing the current transform/appearance state
     * against the previous snapshot stored internally.
     */
    update(world: World): Delta;
    /**
     * Return a full snapshot of the last known world state.
     */
    getSnapshot(): Snapshot;
}
//# sourceMappingURL=NetworkSyncSystem.d.ts.map