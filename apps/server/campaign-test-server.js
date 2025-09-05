/**
 * Standalone campaign test server - bypasses all workspace dependencies
 * Tests ONLY the campaign button functionality we implemented
 */

import http from 'http';
import { PrismaClient } from '@prisma/client';

const PORT = 8081;
const prisma = new PrismaClient();

// Simple request body parser
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// Mock auth - returns user ID 'test-user'
function mockAuth(req) {
  return { id: 'test-user', email: 'test@example.com', displayName: 'Test User' };
}

// Campaign endpoints we built
const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const user = mockAuth(req);

  try {
    // GET /campaigns/:id/players
    if (req.method === 'GET' && path.match(/^\/campaigns\/[^\/]+\/players$/)) {
      const campaignId = path.split('/')[2];
      
      const members = await prisma.campaignMember.findMany({
        where: { campaignId },
        include: { user: true },
      });

      const players = members.map(member => ({
        id: member.id,
        userId: member.userId,
        email: member.user.email,
        displayName: member.user.displayName,
        role: member.role,
        status: member.status,
        joinedAt: member.joinedAt,
        invitedAt: member.invitedAt,
        invitedBy: member.invitedBy,
      }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ players }));
      return;
    }

    // POST /campaigns/:id/players (invite by email)
    if (req.method === 'POST' && path.match(/^\/campaigns\/[^\/]+\/players$/)) {
      const campaignId = path.split('/')[2];
      const body = await parseBody(req);
      
      // Find or create user
      let invitedUser = await prisma.user.findUnique({ where: { email: body.email } });
      if (!invitedUser) {
        invitedUser = await prisma.user.create({
          data: {
            email: body.email,
            username: body.email.split('@')[0] + '_' + Date.now(),
            displayName: body.email.split('@')[0],
            passwordHash: '',
            role: 'player',
          },
        });
      }

      // Create membership
      const member = await prisma.campaignMember.create({
        data: {
          userId: invitedUser.id,
          campaignId,
          role: body.role || 'player',
          status: 'invited',
          invitedAt: new Date(),
          invitedBy: user.id,
        },
        include: { user: true },
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true,
        player: {
          id: member.id,
          userId: member.userId,
          email: member.user.email,
          displayName: member.user.displayName,
          role: member.role,
          status: member.status,
        }
      }));
      return;
    }

    // GET /campaigns/:id/settings
    if (req.method === 'GET' && path.match(/^\/campaigns\/[^\/]+\/settings$/)) {
      const campaignId = path.split('/')[2];
      
      let settings = await prisma.campaignSettings.findUnique({
        where: { campaignId },
      });

      if (!settings) {
        settings = await prisma.campaignSettings.create({
          data: {
            campaignId,
            isPublic: false,
            allowSpectators: true,
            maxPlayers: 6,
            autoAcceptInvites: false,
            requireApproval: true,
            sessionTimeout: 240,
          },
        });
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ settings }));
      return;
    }

    // PUT /campaigns/:id/settings
    if (req.method === 'PUT' && path.match(/^\/campaigns\/[^\/]+\/settings$/)) {
      const campaignId = path.split('/')[2];
      const body = await parseBody(req);
      
      const settings = await prisma.campaignSettings.upsert({
        where: { campaignId },
        update: { ...body, updatedAt: new Date() },
        create: {
          campaignId,
          isPublic: body.isPublic ?? false,
          allowSpectators: body.allowSpectators ?? true,
          maxPlayers: body.maxPlayers ?? 6,
          autoAcceptInvites: body.autoAcceptInvites ?? false,
          requireApproval: body.requireApproval ?? true,
          sessionTimeout: body.sessionTimeout ?? 240,
        },
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, settings }));
      return;
    }

    // Health check
    if (path === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', message: 'Campaign test server running' }));
      return;
    }

    // Not found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));

  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', details: error.message }));
  }
});

server.listen(PORT, () => {
  console.log(`🧪 Campaign Test Server running on http://localhost:${PORT}`);
  console.log('Testing endpoints:');
  console.log(`  GET    /campaigns/test-id/players`);
  console.log(`  POST   /campaigns/test-id/players`);
  console.log(`  GET    /campaigns/test-id/settings`);
  console.log(`  PUT    /campaigns/test-id/settings`);
  console.log(`  GET    /health`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down campaign test server...');
  server.close(() => process.exit(0));
});
