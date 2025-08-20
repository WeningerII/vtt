import type { World } from '../World';

/**
 * The NetworkSyncSystem is responsible for building AOI deltas and
 * sending them to connected clients. This stub is intentionally
 * minimal and does not implement any networking logic.
 */
export class NetworkSyncSystem {
  update(world: World): void {
    // In a real server implementation this method would compute
    // differences between current world state and the last snapshot
    // sent to each client, filter by area of interest, and encode
    // binary deltas. For this skeleton we simply no-op.
    void world;
  }
}