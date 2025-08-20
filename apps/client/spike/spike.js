const canvas = document.getElementById('main');
const dpr = Math.max(1, window.devicePixelRatio || 1);
const worker = new Worker('./renderer.worker.js', { type: 'module' });
const off = canvas.transferControlToOffscreen();

let W = innerWidth, H = innerHeight;
// camera in MAIN (mirrored in worker); used to send AOI to server
let tx = W * 0.5, ty = H * 0.5, zoom = 1;

function initWorker() {
  worker.postMessage({ type: 'INIT', canvas: off, w: W, h: H, dpr }, [off]);
}

function resize() {
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W; canvas.height = H; // CSS size
  worker.postMessage({ type: 'RESIZE', w: W, h: H, dpr });
  sendCamera();
}
window.addEventListener('resize', resize);

// Picking results from worker
worker.onmessage = (e) => {
  const { type, id } = e.data || {};
  if (type === 'PICK_RESULT') console.log('Picked id:', id);
};

// Pan (drag)
let dragging = false, lastX = 0, lastY = 0;
canvas.addEventListener('mousedown', (ev) => { dragging = true; lastX = ev.clientX; lastY = ev.clientY; });
window.addEventListener('mouseup',   () => { dragging = false; });
window.addEventListener('mousemove', (ev) => {
  if (!dragging) return;
  const dx = ev.clientX - lastX, dy = ev.clientY - lastY;
  lastX = ev.clientX; lastY = ev.clientY;
  tx += dx; ty += dy;                          // update main camera
  worker.postMessage({ type: 'CAMERA_PAN', dx, dy }); // update worker camera
  sendCamera();
});

// Zoom (wheel at cursor)
canvas.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  const amount = -ev.deltaY / 400;              // smooth zoom
  const prev = zoom;
  const next = Math.max(0.1, Math.min(8, zoom * Math.exp(amount)));
  if (next !== prev) {
    const x = ev.clientX, y = ev.clientY;
    const wx = (x - tx) / prev;
    const wy = (y - ty) / prev;
    zoom = next;
    tx = x - wx * zoom;
    ty = y - wy * zoom;
    worker.postMessage({ type: 'CAMERA_ZOOM', amount, x, y });
    sendCamera();
  }
}, { passive: false });

// Click to pick
canvas.addEventListener('click', (ev) => {
  worker.postMessage({ type: 'PICK_AT', x: ev.clientX, y: ev.clientY });
});

// ---- WebSocket ----
const ws = new WebSocket('ws://localhost:8080');
ws.onopen = () => { sendCamera(); };
ws.onmessage = (ev) => {
  try {
    const m = JSON.parse(ev.data);
    if (m.type === 'SNAPSHOT') {
      worker.postMessage({ type: 'SET_ENTS', ents: m.ents });
    }
  } catch {}
};

function sendCamera() {
  // compute world-space camera center & extents for AOI
  const cx = (W * 0.5 - tx) / zoom;
  const cy = (H * 0.5 - ty) / zoom;
  const spanX = W / zoom;
  const spanY = H / zoom;
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'CAMERA', cx, cy, spanX, spanY }));
  }
}

initWorker();
resize();
