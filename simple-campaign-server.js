/**
 * Simple campaign test server - minimal implementation
 */
const http = require('http');
const PORT = 8082;

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  // Mock responses for testing
  if (req.method === 'GET' && url.pathname.includes('/players')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      players: [
        { id: 'p1', userId: 'u1', email: 'gm@test.com', displayName: 'Game Master', role: 'gm', status: 'active' },
        { id: 'p2', userId: 'u2', email: 'player@test.com', displayName: 'Test Player', role: 'player', status: 'active' }
      ]
    }));
    return;
  }

  if (req.method === 'POST' && url.pathname.includes('/players')) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        player: { id: 'new', email: 'invited@test.com', role: 'player', status: 'invited' }
      }));
    });
    return;
  }

  if (req.method === 'GET' && url.pathname.includes('/settings')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      settings: {
        isPublic: false,
        allowSpectators: true,
        maxPlayers: 6,
        autoAcceptInvites: false,
        requireApproval: true,
        sessionTimeout: 240
      }
    }));
    return;
  }

  if (req.method === 'PUT' && url.pathname.includes('/settings')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`✅ Simple test server running on http://localhost:${PORT}`);
});
