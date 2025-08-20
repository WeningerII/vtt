import type { Client } from './Client';
/**
 * ServerRoom manages a collection of connected clients and
 * orchestrates game ticks. In the production server this would run
 * authoritative simulation and build snapshots. Here we merely hold
 * clients and broadcast messages.
 */
export declare class ServerRoom {
    private clients;
    join(client: Client): void;
    leave(client: Client): void;
    /**
     * Broadcast a message to all connected clients. In a real
     * implementation this would filter by area of interest and send
     * binary deltas.
     */
    broadcast(data: any): void;
}
//# sourceMappingURL=ServerRoom.d.ts.map