import {
  AnyClientMessage,
  AnyClientMessageSchema,
  AnyServerMessage,
  AnyServerMessageSchema,
  PingMessageSchema,
} from "@vtt/core-schemas";

export type WSState = "disconnected" | "connecting" | "open";

export type WSClientOptions = {
  pingIntervalMs?: number;
  autoReconnect?: boolean;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  flushChunk?: number;
};

export class WSClient {
  private ws: WebSocket | null = null;
  private url: string;
  private opts: Required<WSClientOptions>;
  private state: WSState = "disconnected";
  private listeners = new Set<(_m: AnyServerMessage) => void>();
  private stateListeners = new Set<(s: WSState) => void>();
  private queue: AnyClientMessage[] = [];
  private backoff = 0;
  private pingTimer: any = null;
  private reconnectTimer: any = null;

  constructor(url: string, opts: WSClientOptions = {}) {
    this.url = url;
    this.opts = {
      pingIntervalMs: opts.pingIntervalMs ?? 15000,
      autoReconnect: opts.autoReconnect ?? false,
      reconnectBaseMs: opts.reconnectBaseMs ?? 500,
      reconnectMaxMs: opts.reconnectMaxMs ?? 10000,
      flushChunk: opts.flushChunk ?? 32,
    };
  }

  onMessage(cb: (m: AnyServerMessage) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  onState(cb: (s: WSState) => void) {
    this.stateListeners.add(cb);
    return () => this.stateListeners.delete(cb);
  }

  getState() {
    return this.state;
  }

  connect() {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    )
      {return;}
    this.setState("connecting");
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.setState("open");
      this.backoff = 0;
      this.startPing();
      this.flush();
    });

    ws.addEventListener("message", (ev) => {
      let msg: unknown;
      try {
        msg = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data));
      } catch {
        return; // ignore non-JSON
      }
      const parsed = AnyServerMessageSchema.safeParse(msg);
      if (!parsed.success) {return;}
      for (const cb of Array.from(this.listeners)) {cb(parsed.data);}
    });

    const onCloseOrError = (event?: CloseEvent | Event) => {
      this.stopPing();
      if (this.ws === ws) {this.ws = null;}
      this.setState("disconnected");
      
      // Only auto-reconnect if enabled and not a policy violation
      if (this.opts.autoReconnect && 
          (!event || !(event as CloseEvent).code || (event as CloseEvent).code !== 1008)) {
        this.scheduleReconnect();
      } else if ((event as CloseEvent)?.code === 1008) {
        console.warn("WebSocket connection closed by server policy - not attempting reconnect");
      }
    };
    ws.addEventListener("close", onCloseOrError);
    ws.addEventListener("error", (event) => {
      console.error("WebSocket connection to", this.url, "failed:", event);
      onCloseOrError(event);
    });
  }

  close() {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState("disconnected");
  }

  send(msg: AnyClientMessage) {
    const parsed = AnyClientMessageSchema.safeParse(msg);
    if (!parsed.success) {return false;}
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.ws.bufferedAmount < 1_000_000) {
      this.ws.send(JSON.stringify(parsed.data));
      return true;
    }
    this.queue.push(parsed.data);
    return false;
  }

  private flush() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {return;}
    for (let i = 0; i < this.opts.flushChunk && this.queue.length > 0; i++) {
      const m = this.queue.shift()!;
      if (!AnyClientMessageSchema.safeParse(m).success) {continue;}
      this.ws.send(JSON.stringify(m));
    }
    if (this.queue.length > 0) {setTimeout(() => this.flush(), 0);}
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      const ping = PingMessageSchema.parse({ type: "PING", t: Date.now() });
      this.send(ping);
    }, this.opts.pingIntervalMs);
  }
  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {return;}
    const delay = this.nextBackoff();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
  private nextBackoff() {
    this.backoff =
      this.backoff === 0
        ? this.opts.reconnectBaseMs
        : Math.min(this.opts.reconnectMaxMs, Math.floor(this.backoff * 1.8 + Math.random() * 200));
    return this.backoff;
  }

  private setState(s: WSState) {
    if (this.state === s) {return;}
    this.state = s;
    for (const cb of Array.from(this.stateListeners)) {cb(s);}
  }
}
