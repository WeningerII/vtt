import { PrismaClient  } from '@prisma/client';
import http from 'http';
import { Server  } from 'socket.io';

const prisma = new PrismaClient();
const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Simple test data creation and VTT socket handling
async function createTestData() {
  try {
    // Create a test user
    const testUser = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {},
      create: {
        email: 'test@example.com',
        username: 'testuser',
        displayName: 'Test User'
      }
    });

    // Create a test campaign
    const testCampaign = await prisma.campaign.upsert({
      where: { id: 'test-campaign' },
      update: {},
      create: {
        id: 'test-campaign',
        name: 'Test Campaign',
        description: 'A test campaign for VTT functionality',
        gameSystem: 'dnd5e'
      }
    });

    // Create campaign membership
    await prisma.campaignMember.upsert({
      where: {
        userId_campaignId: {
          userId: testUser.id,
          campaignId: testCampaign.id
        }
      },
      update: {},
      create: {
        userId: testUser.id,
        campaignId: testCampaign.id,
        role: 'GM',
        isActive: true
      }
    });

    // Create a test scene
    const testScene = await prisma.scene.upsert({
      where: { id: 'test-scene' },
      update: {},
      create: {
        id: 'test-scene',
        name: 'Test Scene',
        campaignId: testCampaign.id,
        width: 1000,
        height: 800,
        gridSize: 50,
        gridType: 'square',
        gridSettings: JSON.stringify({
          size: 50,
          type: 'square',
          color: '#000000',
          opacity: 0.3
        }),
        lightingSettings: JSON.stringify({
          enabled: true,
          globalLight: false,
          ambientLight: 0.2
        }),
        fogSettings: JSON.stringify({
          enabled: false,
          exploredAreas: []
        })
      }
    });

    // Create test tokens
    await prisma.token.upsert({
      where: { id: 'test-token-1' },
      update: {},
      create: {
        id: 'test-token-1',
        name: 'Hero Token',
        sceneId: testScene.id,
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        imageUrl: '/assets/tokens/hero.png',
        tokenType: 'character',
        layer: 'tokens',
        isVisible: true,
        properties: JSON.stringify({
          hp: { current: 25, max: 25 },
          ac: 15,
          initiative: 2
        })
      }
    });

    await prisma.token.upsert({
      where: { id: 'test-token-2' },
      update: {},
      create: {
        id: 'test-token-2',
        name: 'Goblin Token',
        sceneId: testScene.id,
        x: 300,
        y: 200,
        width: 50,
        height: 50,
        imageUrl: '/assets/tokens/goblin.png',
        tokenType: 'npc',
        layer: 'tokens',
        isVisible: true,
        properties: JSON.stringify({
          hp: { current: 7, max: 7 },
          ac: 13,
          initiative: 0
        })
      }
    });

    console.log('✅ Test data created successfully');
    console.log(`User ID: ${testUser.id}`);
    console.log(`Campaign ID: ${testCampaign.id}`);
    console.log(`Scene ID: ${testScene.id}`);
    
    return { user: testUser, campaign: testCampaign, scene: testScene };
  } catch (error) {
    console.error('❌ Error creating test data:', error);
    throw error;
  }
}

// Socket.IO event handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on('authenticate', async (data) => {
    try {
      const { userId, campaignId } = data;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const membership = await prisma.campaignMember.findUnique({
        where: {
          userId_campaignId: { userId, campaignId }
        }
      });

      if (user && membership) {
        socket.userId = userId;
        socket.campaignId = campaignId;
        socket.userRole = membership.role;
        socket.emit('authenticated', { user, role: membership.role });
        console.log(`✅ User ${user.username} authenticated for campaign ${campaignId}`);
      } else {
        socket.emit('auth_error', { message: 'Invalid credentials' });
      }
    } catch (error) {
      console.error('Auth error:', error);
      socket.emit('auth_error', { message: 'Authentication failed' });
    }
  });

  socket.on('join_scene', async (data) => {
    try {
      const { sceneId } = data;
      const scene = await prisma.scene.findUnique({
        where: { id: sceneId },
        include: { tokens: true }
      });

      if (scene && scene.campaignId === socket.campaignId) {
        socket.join(`scene-${sceneId}`);
        socket.emit('scene_joined', { scene });
        console.log(`👥 User joined scene ${sceneId}`);
      } else {
        socket.emit('error', { message: 'Scene not found or access denied' });
      }
    } catch (error) {
      console.error('Join scene error:', error);
      socket.emit('error', { message: 'Failed to join scene' });
    }
  });

  socket.on('move_token', async (data) => {
    try {
      const { tokenId, x, y } = data;
      
      // Update token position in database
      await prisma.token.update({
        where: { id: tokenId },
        data: { x, y }
      });

      // Get the token's scene to broadcast to the correct room
      const token = await prisma.token.findUnique({
        where: { id: tokenId },
        include: { scene: true }
      });

      if (token) {
        // Broadcast to all users in the scene
        socket.to(`scene-${token.sceneId}`).emit('token_moved', {
          tokenId,
          x,
          y,
          movedBy: socket.userId
        });
        
        console.log(`🎯 Token ${tokenId} moved to (${x}, ${y})`);
      }
    } catch (error) {
      console.error('Move token error:', error);
      socket.emit('error', { message: 'Failed to move token' });
    }
  });

  socket.on('send_message', (data) => {
    const { message, channel = 'general' } = data;
    socket.to(`campaign-${socket.campaignId}`).emit('message_received', {
      message,
      channel,
      author: socket.userId,
      timestamp: new Date().toISOString()
    });
    console.log(`💬 Message sent to campaign ${socket.campaignId}: ${message}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

async function startServer() {
  try {
    await createTestData();
    
    server.listen(8080, () => {
      console.log('🚀 VTT Test Server running on http://localhost:8080');
      console.log('📝 Test credentials:');
      console.log('  - Email: test@example.com');
      console.log('  - Campaign ID: test-campaign');
      console.log('  - Scene ID: test-scene');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  console.log('🔄 Shutting down server...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
