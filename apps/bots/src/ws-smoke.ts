import WebSocket, { RawData } from 'ws';

const URL = process.env.URL ?? 'ws://localhost:8080';
const ws = new WebSocket(URL);

let gotEcho = false;

ws.on('open', () => {
  console.log('[bot] connected, sending ping');
  ws.send(JSON.stringify({ type: 'PING', t: Date.now() }));
});

ws.on('message', (data: RawData) => {
  const text = typeof data === 'string' ? data : data.toString('utf-8');
  console.log('[bot] recv:', text);
  try {
    const msg = JSON.parse(text as string);
    if (msg?.type === 'ECHO') {
      gotEcho = true;
      process.exit(0);
    }
  } catch { /* ignore parse errors */ }
});

ws.on('error', (e: Error) => console.error('[bot] error', e));

setTimeout(() => {
  if (!gotEcho) {
    console.error('[bot] timed out waiting for ECHO');
    process.exit(1);
  }
}, 2000);
