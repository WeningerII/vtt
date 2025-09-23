/**
 * A thin WebSocket client wrapper. In a real implementation this would
 * handle clock synchronisation, message framing, and binary encoding.
 */
export class Client {
  private socket: WebSocket;
  constructor(url: string) {
    this.socket = new WebSocket(url);
  }

  /**
   * Register a handler for messages from the server.
   */
  onMessage(cb: (data: string) => void): void {
    this.socket.addEventListener("message", (ev) => cb(ev.data));
  }

  /**
   * Send a message to the server. Accepts any serialisable payload.
   */
  send(data: unknown): void {
    const payload = typeof data === "string" ? data : JSON.stringify(data);
    this.socket.send(payload);
  }
}
