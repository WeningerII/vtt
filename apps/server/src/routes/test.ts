import { Router } from '../router/router';
import { WebSocketManager } from '../websocket/manager';

// Simple test route to verify WebSocket integration
export function setupTestRoutes(router: Router, wsManager: WebSocketManager) {
  router.get('/api/test/websocket-status', (ctx) => {
    const stats = {
      totalClients: wsManager.getClientCount(),
      serverTime: new Date().toISOString(),
      status: 'connected'
    };
    
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify(stats));
  });

  router.post('/api/test/broadcast-message', async (ctx) => {
    try {
      const body = await new Promise<string>((resolve, reject) => {
        let data = '';
        ctx.req.on('data', (chunk) => (data += chunk));
        ctx.req.on('end', () => resolve(data));
        ctx.req.on('error', reject);
      });

      const { message,  type  } = JSON.parse(body);
      
      wsManager.broadcast({
        type: type || 'ECHO',
        payload: message
      });
      
      ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ success: true, message: 'Message broadcasted' }));
    } catch (_error) {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Invalid request body' }));
    }
  });
}
