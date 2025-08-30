import WebSocket, { RawData } from 'ws';
import { logger } from '@vtt/logging';

const URL = process.env.URL ?? 'ws://localhost:8080';
const ws = new WebSocket(URL);

let gotEcho = false;

ws.on('open', () => {
  logger.info('[bot] connected, sending ping');
  ws.send(JSON.stringify({ type: 'PING', t: Date.now() }));
});

ws.on('message', (_data: RawData) => {
  const text = typeof data === 'string' ? data : data.toString('utf-8');
  logger.info('[bot] recv:', text);
  try {
    const msg = JSON.parse(text as string);
    if (msg?.type === 'ECHO') {
      gotEcho = true;
      process.exit(0);
    }
  } catch { /* ignore parse errors */ }
});

ws.on('error', (_e: Error) => logger.error('[bot] error', e));

setTimeout(() => {
  if (!gotEcho) {
    logger.error('[bot] timed out waiting for ECHO');
    process.exit(1);
  }
}, 2000);
