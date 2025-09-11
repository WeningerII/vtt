import { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';
import { VTTWebSocketServer } from '../../apps/server/src/websocket/websocket-server';
import { PrismaClient } from '@prisma/client';
import { authManager } from '../../apps/server/src/routes/auth';

describe('WebSocket Combat Integration', () => {
  let server: any;
  let vttServer: VTTWebSocketServer;
  let prisma: PrismaClient;
  let ws: WebSocket;
  let userId: string;
  let token: string;
  let encounterId: string;
  let gameSessionId: string;
  let campaignId: string;
  let tokenId: string;
  let actorId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    // Create test data
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        username: 'testuser',
        displayName: 'Test User',
        passwordHash: 'hash',
      }
    });
    userId = user.id;

    const campaign = await prisma.campaign.create({
      data: {
        name: 'Test Campaign',
        members: {
          create: {
            userId,
            role: 'GM',
            status: 'active'
          }
        }
      }
    });
    campaignId = campaign.id;

    const gameSession = await prisma.gameSession.create({
      data: {
        name: 'Test Session',
        campaignId,
        status: 'ACTIVE'
      }
    });
    gameSessionId = gameSession.id;

    const testToken = await prisma.token.create({
      data: {
        name: 'Test Token',
        type: 'PC',
        gameSessionId,
        x: 0,
        y: 0,
        metadata: { ownerUserId: userId }
      }
    });
    tokenId = testToken.id;

    const encounter = await prisma.encounter.create({
      data: {
        name: 'Test Encounter',
        gameSessionId,
        status: 'PLANNED'
      }
    });
    encounterId = encounter.id;
    
    await prisma.encounterToken.create({
      data: {
        encounterId,
        tokenId,
        initiative: 10
      }
    });
    actorId = `actor_${tokenId}`;

    // Generate auth token
    const authResult = await authManager.register({
      email: 'test2@example.com',
      username: 'testuser2',
      displayName: 'Test User 2',
      password: 'password123'
    });
    token = authResult.tokens.accessToken;

    // Mock server
    server = { on: jest.fn() };
    vttServer = new VTTWebSocketServer(server, prisma);
  });

  afterAll(async () => {
    await prisma.encounterToken.deleteMany();
    await prisma.encounter.deleteMany();
    await prisma.token.deleteMany();
    await prisma.gameSession.deleteMany();
    await prisma.campaignMember.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    ws = new WebSocket('ws://localhost:8080/ws');
    await new Promise(resolve => {
      ws.on('open', resolve);
    });
  });

  afterEach(() => {
    ws.close();
  });

  describe('Combat Subscription', () => {
    it('should subscribe to encounter updates', async () => {
      const messages: any[] = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Authenticate
      ws.send(JSON.stringify({ type: 'AUTHENTICATE', token }));
      await delay(100);

      // Subscribe to encounter
      ws.send(JSON.stringify({
        type: 'SUBSCRIBE_ENCOUNTER',
        payload: { encounterId }
      }));
      await delay(100);

      const subResponse = messages.find(m => m.type === 'ENCOUNTER_SUBSCRIBED');
      expect(subResponse).toBeDefined();
      expect(subResponse.payload.encounter.id).toBe(encounterId);
    });

    it('should handle legacy COMBAT_SUBSCRIBE alias', async () => {
      const messages: any[] = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      ws.send(JSON.stringify({ type: 'AUTHENTICATE', token }));
      await delay(100);

      ws.send(JSON.stringify({
        type: 'COMBAT_SUBSCRIBE',
        payload: { encounterId }
      }));
      await delay(100);

      const subResponse = messages.find(m => m.type === 'ENCOUNTER_SUBSCRIBED');
      expect(subResponse).toBeDefined();
    });
  });

  describe('Combat Actions', () => {
    beforeEach(async () => {
      ws.send(JSON.stringify({ type: 'AUTHENTICATE', token }));
      await delay(100);
    });

    it('should start encounter', async () => {
      const messages: any[] = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      ws.send(JSON.stringify({
        type: 'START_ENCOUNTER',
        payload: { encounterId }
      }));
      await delay(200);

      const startResponse = messages.find(m => m.type === 'ENCOUNTER_STARTED');
      expect(startResponse).toBeDefined();
    });

    it('should advance turn', async () => {
      const messages: any[] = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      ws.send(JSON.stringify({
        type: 'NEXT_TURN',
        payload: { encounterId }
      }));
      await delay(200);

      const turnResponse = messages.find(m => m.type === 'TURN_ADVANCED');
      expect(turnResponse).toBeDefined();
      expect(turnResponse.payload).toHaveProperty('currentTurn');
      expect(turnResponse.payload).toHaveProperty('currentRound');
    });

    it('should update actor health', async () => {
      const messages: any[] = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      ws.send(JSON.stringify({
        type: 'UPDATE_ACTOR_HEALTH',
        payload: {
          encounterId,
          actorId,
          health: { current: 15, max: 20 }
        }
      }));
      await delay(200);

      const healthResponse = messages.find(m => m.type === 'HEALTH_UPDATE_SUCCESS');
      expect(healthResponse).toBeDefined();
      expect(healthResponse.payload.actorId).toBe(actorId);
    });

    it('should apply condition', async () => {
      const messages: any[] = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      ws.send(JSON.stringify({
        type: 'APPLY_CONDITION',
        payload: {
          encounterId,
          actorId,
          condition: { name: 'Stunned', duration: 2 }
        }
      }));
      await delay(200);

      const conditionResponse = messages.find(m => m.type === 'CONDITION_APPLIED');
      expect(conditionResponse).toBeDefined();
      expect(conditionResponse.payload.condition.name).toBe('Stunned');
    });
  });

  describe('Tactical Decisions', () => {
    it('should request tactical decision for NPC', async () => {
      const messages: any[] = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      ws.send(JSON.stringify({ type: 'AUTHENTICATE', token }));
      await delay(100);

      ws.send(JSON.stringify({
        type: 'REQUEST_TACTICAL_DECISION',
        payload: { encounterId, actorId },
        requestId: 'req-123'
      }));
      await delay(500);

      const decisionResponse = messages.find(m => m.type === 'TACTICAL_DECISION');
      expect(decisionResponse).toBeDefined();
      expect(decisionResponse.payload.requestId).toBe('req-123');
      expect(decisionResponse.payload).toHaveProperty('action');
      expect(decisionResponse.payload).toHaveProperty('reasoning');
      expect(decisionResponse.payload).toHaveProperty('confidence');
    });
  });

  describe('Token Movement', () => {
    it('should move token with proper authorization', async () => {
      const messages: any[] = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      ws.send(JSON.stringify({ type: 'AUTHENTICATE', token }));
      await delay(100);

      ws.send(JSON.stringify({ 
        type: 'JOIN_SESSION', 
        sessionId: gameSessionId 
      }));
      await delay(100);

      ws.send(JSON.stringify({
        type: 'MOVE_TOKEN',
        payload: {
          tokenId,
          x: 100,
          y: 200,
          rotation: 45
        }
      }));
      await delay(200);

      const moveResponse = messages.find(m => m.type === 'TOKEN_MOVED');
      expect(moveResponse).toBeDefined();
      expect(moveResponse.x).toBe(100);
      expect(moveResponse.y).toBe(200);
      expect(moveResponse.rotation).toBe(45);
    });

    it('should reject unauthorized token movement', async () => {
      // Create another user's token
      const otherToken = await prisma.token.create({
        data: {
          name: 'Other Token',
          type: 'NPC',
          gameSessionId,
          x: 0,
          y: 0,
          metadata: { ownerUserId: 'other-user-id' }
        }
      });

      const messages: any[] = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      ws.send(JSON.stringify({ type: 'AUTHENTICATE', token }));
      await delay(100);

      ws.send(JSON.stringify({
        type: 'MOVE_TOKEN',
        payload: {
          tokenId: otherToken.id,
          x: 100,
          y: 200
        }
      }));
      await delay(200);

      const errorResponse = messages.find(m => m.type === 'ERROR');
      expect(errorResponse).toBeDefined();
      expect(errorResponse.error).toContain('Unauthorized');

      await prisma.token.delete({ where: { id: otherToken.id } });
    });
  });

  describe('Broadcasting', () => {
    it('should broadcast combat events to all subscribed clients', async () => {
      const ws2 = new WebSocket('ws://localhost:8080/ws');
      await new Promise(resolve => ws2.on('open', resolve));

      const messages1: any[] = [];
      const messages2: any[] = [];
      
      ws.on('message', (data) => {
        messages1.push(JSON.parse(data.toString()));
      });
      
      ws2.on('message', (data) => {
        messages2.push(JSON.parse(data.toString()));
      });

      // Authenticate both clients
      ws.send(JSON.stringify({ type: 'AUTHENTICATE', token }));
      ws2.send(JSON.stringify({ type: 'AUTHENTICATE', token }));
      await delay(100);

      // Subscribe both to same encounter
      ws.send(JSON.stringify({
        type: 'SUBSCRIBE_ENCOUNTER',
        payload: { encounterId }
      }));
      ws2.send(JSON.stringify({
        type: 'SUBSCRIBE_ENCOUNTER',
        payload: { encounterId }
      }));
      await delay(100);

      // One client advances turn
      ws.send(JSON.stringify({
        type: 'NEXT_TURN',
        payload: { encounterId }
      }));
      await delay(200);

      // Both should receive the broadcast
      const turnMsg1 = messages1.find(m => m.type === 'TURN_ADVANCED');
      const turnMsg2 = messages2.find(m => m.type === 'TURN_ADVANCED');
      
      expect(turnMsg1).toBeDefined();
      expect(turnMsg2).toBeDefined();
      expect(turnMsg1.payload.currentTurn).toBe(turnMsg2.payload.currentTurn);

      ws2.close();
    });
  });
});

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
