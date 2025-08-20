/**
 * A thin WebSocket client wrapper. In a real implementation this would
 * handle clock synchronisation, message framing, and binary encoding.
 */
export class Client {
    constructor(url) {
        this.socket = new WebSocket(url);
    }
    /**
     * Register a handler for messages from the server.
     */
    onMessage(cb) {
        this.socket.addEventListener('message', ev => cb(ev.data));
    }
    /**
     * Send a message to the server. Accepts any serialisable payload.
     */
    send(data) {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        this.socket.send(payload);
    }
}
//# sourceMappingURL=Client.js.map