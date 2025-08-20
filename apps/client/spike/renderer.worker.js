let canvas, ctx, idCanvas, idCtx;
let W = 0, H = 0, dpr = 1;
let tx = 0, ty = 0, zoom = 1;
let ents = []; // {x,y,size,color,idColor:[r,g,b]}

function idToRGB(id) {
  const n = id >>> 0;
  return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255];
}
function rgbToId(r,g,b){ return (r | (g<<8) | (b<<16)) >>> 0; }

function draw() {
  if (!ctx) return;

  // Clear
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = '#0f1216';
  ctx.fillRect(0,0,W,H);

  idCtx.setTransform(1,0,0,1,0,0);
  idCtx.clearRect(0,0,W,H);

  // Apply camera
  ctx.setTransform(zoom,0,0,zoom,tx,ty);
  idCtx.setTransform(zoom,0,0,zoom,tx,ty);

  // Draw ents + id buffer
  for (let i=0;i<ents.length;i++) {
    const e = ents[i];
    const s = e.size || 10;
    // color buffer
    ctx.fillStyle = e.color || '#66aaff';
    ctx.fillRect(e.x - s/2, e.y - s/2, s, s);
    // id buffer
    const [r,g,b] = e.idColor;
    idCtx.fillStyle = `rgb(${r},${g},${b})`;
    idCtx.fillRect(e.x - s/2, e.y - s/2, s, s);
  }

  requestAnimationFrame(draw);
}

onmessage = (ev) => {
  const m = ev.data || {};
  if (m.type === 'INIT') {
    canvas = m.canvas;
    W = m.w; H = m.h; dpr = m.dpr || 1;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;

    idCanvas = new OffscreenCanvas(canvas.width, canvas.height);
    idCtx = idCanvas.getContext('2d', { willReadFrequently: true });
    idCtx.imageSmoothingEnabled = false;

    tx = W * 0.5; ty = H * 0.5; zoom = 1;
    requestAnimationFrame(draw);
  } else if (m.type === 'RESIZE') {
    W = m.w; H = m.h; dpr = m.dpr || dpr;
    const w = Math.floor(W * dpr), h = Math.floor(H * dpr);
    canvas.width = w; canvas.height = h;
    idCanvas.width = w; idCanvas.height = h;
  } else if (m.type === 'CAMERA_PAN') {
    tx += m.dx; ty += m.dy;
  } else if (m.type === 'CAMERA_ZOOM') {
    const prev = zoom;
    const next = Math.max(0.1, Math.min(8, zoom * Math.exp(m.amount)));
    if (next !== prev) {
      const x = m.x, y = m.y;
      const wx = (x - tx) / prev;
      const wy = (y - ty) / prev;
      zoom = next;
      tx = x - wx * zoom;
      ty = y - wy * zoom;
    }
  } else if (m.type === 'SET_ENTS') {
    const input = m.ents || [];
    ents = new Array(input.length);
    for (let i=0;i<input.length;i++) {
      const s = input[i];
      ents[i] = {
        x: s.x, y: s.y, size: s.size ?? 10,
        color: s.color ?? '#66aaff',
        idColor: idToRGB((s.id|0) + 1),
      };
    }
  } else if (m.type === 'PICK_AT') {
    const x = Math.floor(m.x * dpr), y = Math.floor(m.y * dpr);
    const px = idCtx.getImageData(x, y, 1, 1).data;
    const id = rgbToId(px[0], px[1], px[2]) - 1;
    postMessage({ type: 'PICK_RESULT', id: id > 0 ? id : 0 });
  }
};
