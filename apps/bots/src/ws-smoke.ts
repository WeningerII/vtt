import WS from "ws";
import { logger } from "@vtt/logging";

const URL = process.env.URL ?? "ws://localhost:8080";
const ws = new WS(URL);

let gotEcho = false;

ws.on("open", () => {
  logger.info("[bot] connected, sending ping");
  ws.send(JSON.stringify({ type: "PING", t: Date.now() }));
});

ws.on("message", (_data: WS.RawData) => {
  const text = typeof _data === "string" ? _data : _data.toString("utf-8");
  logger.info("[bot] recv:", { message: text });
  try {
    const msg = JSON.parse(text);
    if (msg?.type === "ECHO") {
      gotEcho = true;
      process.exit(0);
    }
  } catch {
    /* ignore parse errors */
  }
});

ws.on("error", (_e: Error) => logger.error("[bot] error", { error: _e }));

setTimeout(() => {
  if (!gotEcho) {
    logger.error("[bot] timed out waiting for ECHO");
    process.exit(1);
  }
}, 2000);
