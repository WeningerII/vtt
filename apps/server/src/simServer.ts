import { WebSocketServer, WebSocket } from 'ws';
import { World, MovementSystem } from '@vtt/core-ecs';

type Client = { ws: WebSocket; id: string; cx: number; cy: number; spanX: number; spanY: number; };

const w = new World(10_000);
const N = 6000;
const BOUNDS = 2000;
const ids: number[] = [];

for (let i = 0; i < N; i++) {
  const e = w.create();
  const x = (Math.random()*2 - 1) * BOUNDS;
  const y = (Math.random()*2 - 1) * BOUNDS;
  const hue = (i*13) % 360;
  const color = `hsl(${hue} 70% 60%)`;

  w.transforms.add(e, { x, y });
  const vx = (Math.random()*2 - 1) * 40;
  const vy = (Math.random()*2 - 1) * 40;
  w.movement.add(e, { vx, vy, maxSpeed: 40 });
  w.appearance.add(e, { size: 10, tintR: 1, tintG: 1, tintB: 1, alpha: 1, color });
  ids.push(e);
}

const clients = new Set<Client>();

function aoiFilter(c: Client, id: number) {
  const halfX = c.spanX * 0.6, halfY = c.spanY * 0.6;
  const x = w.transforms.x[id], y = w.transforms.y[id];
  return x >= c.cx - halfX && x <= c.cx + halfX && y >= c.cy - halfY && y <= c.cy + halfY;
}

function tick(dt: number) {
  MovementSystem(w, dt);
  for (const id of ids) {
    const x = w.transforms.x[id], y = w.transforms.y[id];
    if (x < -BOUNDS || x > BOUNDS) w.movement.vx[id] = -w.movement.vx[id];
    if (y < -BOUNDS || y > BOUNDS) w.movement.vy[id] = -w.movement.vy[id];
  }
  const now = Date.now();
  for (const c of clients) {
    if (c.ws.readyState !== c.ws.OPEN) continue;
    const visible = [];
    let sent = 0;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (!aoiFilter(c, id)) continue;
      visible.push({
        id,
        x: +w.transforms.x[id].toFixed(2),
        y: +w.transforms.y[id].toFixed(2),
        size: (w.appearance?.size?.[id]) ?? 10,
        color: w.appearance.color[id] || 'hsl(200 70% 60%)',
      });
      if (++sent >= 2500) break;
    }
    c.ws.send(JSON.stringify({ type: 'SNAPSHOT', t: now, ents: visible }));
  }
}

const PORT = Number(process.env.PORT ?? 8080);
const wss = new WebSocketServer({ port: PORT });
console.log(`[sim] WS listening on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  const id = Math.random().toString(36).slice(2, 8);
  const client: Client = { ws, id, cx: 0, cy: 0, spanX: 1000, spanY: 1000 };
  clients.add(client);
  console.log(`[sim] client ${id} connected`);
  ws.send(JSON.stringify({ type: 'HELLO', tickRate: 10 }));

  ws.on('message', (buf) => {
    try {
      const m = JSON.parse(String(buf));
      if (m.type === 'CAMERA') {
        client.cx = m.cx ?? client.cx;
        client.cy = m.cy ?? client.cy;
        client.spanX = m.spanX ?? client.spanX;
        client.spanY = m.spanY ?? client.spanY;
      }
    } catch {}
  });
  ws.on('close', () => { clients.delete(client); console.log(`[sim] client ${id} disconnected`); });
});

let acc = 0, last = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = (now - last) / 1000; last = now;
  acc += dt;
  const step = 1/10;
  while (acc >= step) { tick(step); acc -= step; }
}, 10);
