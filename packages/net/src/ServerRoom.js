/**
 * ServerRoom manages a collection of connected clients and
 * orchestrates game ticks. In the production server this would run
 * authoritative simulation and build snapshots. Here we merely hold
 * clients and broadcast messages.
 */
export class ServerRoom {
    constructor() {
        this.clients = new Set();
    }
    join(client) {
        this.clients.add(client);
    }
    leave(client) {
        this.clients.delete(client);
    }
    /**
     * Broadcast a message to all connected clients. In a real
     * implementation this would filter by area of interest and send
     * binary deltas.
     */
    broadcast(data) {
        for (const client of this.clients) {
            client.send(data);
        }
    }
}
//# sourceMappingURL=ServerRoom.js.map