/**
 * A thin WebSocket client wrapper. In a real implementation this would
 * handle clock synchronisation, message framing, and binary encoding.
 */
export declare class Client {
  private socket;
  constructor(url: string);
  /**
   * Register a handler for messages from the server.
   */
  onMessage(_cb: (data: any) => void): void;
  /**
   * Send a message to the server. Accepts any serialisable payload.
   */
  send(data: any): void;
}
//# sourceMappingURL=Client.d.ts.map
