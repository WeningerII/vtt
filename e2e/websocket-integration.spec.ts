import { test, expect } from '@playwright/test';
import { factory } from './utils/factories';
import { authUtils } from './utils/auth';
import { testDb } from './utils/database';

test.describe('WebSocket Integration Tests', () => {
  test.beforeEach(async () => {
    await testDb.reset();
  });

  test('WebSocket connection establishment and health', async ({ page }) => {
    const gameSession = await factory.createMinimalGameSession();
    const { gm  } = gameSession.users;

    await authUtils.mockAuthentication(page, gm);

    let wsConnected = false;
    const wsMessages: any[] = [];

    // Monitor WebSocket connections
    page.on('websocket', ws => {
      console.log(`WebSocket connected: ${ws.url()}`);
      wsConnected = true;

      ws.on('framereceived', event => {
        try {
          const data = JSON.parse(event.payload as string);
          wsMessages.push(data);
          console.log('WS Received:', data);
        } catch (_e) {
          console.log('WS Received (raw):', event.payload);
        }
      });

      ws.on('framesent', event => {
        try {
          const data = JSON.parse(event.payload as string);
          console.log('WS Sent:', data);
        } catch (_e) {
          console.log('WS Sent (raw):', event.payload);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket disconnected');
        wsConnected = false;
      });
    });

    await page.goto(`/scenes/${gameSession.scene.id}`);
    await authUtils.waitForAuthReady(page);

    // Wait for WebSocket connection
    await page.waitForTimeout(3000);
    expect(wsConnected).toBe(true);

    // Test heartbeat/ping messages
    await page.waitForTimeout(5000);
    const heartbeats = wsMessages.filter(msg => msg.type === 'ping' || msg.type === 'heartbeat');
    expect(heartbeats.length).toBeGreaterThan(0);
  });

  test('Real-time token movement synchronization', async ({ browser }) => {
    const gameSession = await factory.createCompleteGameSession();
    const { gm,  player1  } = gameSession.users;

    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // Track WebSocket messages for both users
      const gmMessages: any[] = [];
      const playerMessages: any[] = [];

      gmPage.on('websocket', ws => {
        ws.on('framereceived', event => {
          try {
            const data = JSON.parse(event.payload as string);
            gmMessages.push(data);
          } catch (_e) {}
        });
      });

      playerPage.on('websocket', ws => {
        ws.on('framereceived', event => {
          try {
            const data = JSON.parse(event.payload as string);
            playerMessages.push(data);
          } catch (_e) {}
        });
      });

      await authUtils.mockAuthentication(gmPage, gm);
      await authUtils.mockAuthentication(playerPage, player1);

      const sceneUrl = `/scenes/${gameSession.scene.id}`;
      await Promise.all([
        gmPage.goto(sceneUrl),
        playerPage.goto(sceneUrl),
      ]);

      await Promise.all([
        authUtils.waitForAuthReady(gmPage),
        authUtils.waitForAuthReady(playerPage),
      ]);

      // Wait for initial sync
      await gmPage.waitForTimeout(2000);

      // GM moves a token
      const _initialX = 100;
      const _initialY = 100;
      const newX = 300;
      const newY = 250;

      const gmToken = gmPage.locator('[data-testid="token"]').first();
      await gmToken.hover();
      await gmPage.mouse.down();
      await gmPage.mouse.move(newX, newY);
      await gmPage.mouse.up();

      // Wait for WebSocket message propagation
      await gmPage.waitForTimeout(1000);

      // Verify player received token movement message
      const tokenMoveMessages = playerMessages.filter(msg => 
        msg.type === 'token_moved' || 
        msg.type === 'scene_update' ||
        (msg.event === 'token_update' && msg.data?.position)
      );
      expect(tokenMoveMessages.length).toBeGreaterThan(0);

      // Verify token position updated on player's screen
      const playerToken = playerPage.locator('[data-testid="token"]').first();
      await expect(playerToken).toHaveAttribute('data-x', newX.toString());
      await expect(playerToken).toHaveAttribute('data-y', newY.toString());

    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('Chat message real-time delivery', async ({ browser }) => {
    const gameSession = await factory.createCompleteGameSession();
    const { gm,  player1,  player2  } = gameSession.users;

    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);

    const [gmPage, player1Page, player2Page] = await Promise.all([
      contexts[0].newPage(),
      contexts[1].newPage(),
      contexts[2].newPage(),
    ]);

    try {
      // Setup authentication
      await Promise.all([
        authUtils.mockAuthentication(gmPage, gm),
        authUtils.mockAuthentication(player1Page, player1),
        authUtils.mockAuthentication(player2Page, player2),
      ]);

      // Navigate to scene
      const sceneUrl = `/scenes/${gameSession.scene.id}`;
      await Promise.all([
        gmPage.goto(sceneUrl),
        player1Page.goto(sceneUrl),
        player2Page.goto(sceneUrl),
      ]);

      await Promise.all([
        authUtils.waitForAuthReady(gmPage),
        authUtils.waitForAuthReady(player1Page),
        authUtils.waitForAuthReady(player2Page),
      ]);

      // Wait for WebSocket connections
      await gmPage.waitForTimeout(2000);

      // GM sends a message
      const gmMessage = 'GM: Roll for initiative!';
      await gmPage.fill('[data-testid="chat-input"]', gmMessage);
      await gmPage.press('[data-testid="chat-input"]', 'Enter');

      // Wait for message propagation
      await gmPage.waitForTimeout(1000);

      // Verify all players received the message
      await Promise.all([
        expect(player1Page.locator('[data-testid="chat-message"]').last()).toContainText(gmMessage),
        expect(player2Page.locator('[data-testid="chat-message"]').last()).toContainText(gmMessage),
      ]);

      // Player 1 responds
      const player1Message = 'Player 1: Rolling!';
      await player1Page.fill('[data-testid="chat-input"]', player1Message);
      await player1Page.press('[data-testid="chat-input"]', 'Enter');

      await player1Page.waitForTimeout(1000);

      // Verify GM and Player 2 see Player 1's message
      await Promise.all([
        expect(gmPage.locator('[data-testid="chat-message"]').last()).toContainText(player1Message),
        expect(player2Page.locator('[data-testid="chat-message"]').last()).toContainText(player1Message),
      ]);

      // Test message ordering
      const gmMessages = await gmPage.locator('[data-testid="chat-message"]').allTextContents();
      expect(gmMessages[gmMessages.length - 2]).toContain('GM: Roll for initiative!');
      expect(gmMessages[gmMessages.length - 1]).toContain('Player 1: Rolling!');

    } finally {
      await Promise.all(contexts.map(ctx => ctx.close()));
    }
  });

  test('Initiative tracker real-time synchronization', async ({ browser }) => {
    const gameSession = await factory.createCompleteGameSession();
    const { gm,  player1  } = gameSession.users;

    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      await authUtils.mockAuthentication(gmPage, gm);
      await authUtils.mockAuthentication(playerPage, player1);

      const sceneUrl = `/scenes/${gameSession.scene.id}`;
      await Promise.all([
        gmPage.goto(sceneUrl),
        playerPage.goto(sceneUrl),
      ]);

      await Promise.all([
        authUtils.waitForAuthReady(gmPage),
        authUtils.waitForAuthReady(playerPage),
      ]);

      // Wait for initial sync
      await gmPage.waitForTimeout(2000);

      // GM opens initiative tracker
      await gmPage.click('[data-testid="initiative-tracker-button"]');
      await expect(gmPage.locator('[data-testid="initiative-tracker"]')).toBeVisible();

      // Start encounter
      await gmPage.click('[data-testid="start-encounter"]');
      
      // Wait for sync
      await gmPage.waitForTimeout(1000);

      // Verify player sees encounter started
      await expect(playerPage.locator('[data-testid="encounter-active"]')).toBeVisible();

      // GM advances turn
      await gmPage.click('[data-testid="next-turn"]');
      
      await gmPage.waitForTimeout(1000);

      // Verify turn advancement synced to player
      await expect(playerPage.locator('[data-testid="current-turn-indicator"]')).toBeVisible();

      // GM updates initiative order
      await gmPage.dragAndDrop(
        '[data-testid="initiative-item"]:first-child',
        '[data-testid="initiative-item"]:last-child'
      );

      await gmPage.waitForTimeout(1000);

      // Verify initiative order updated for player
      const playerInitiativeOrder = await playerPage.locator('[data-testid="initiative-item"]').allTextContents();
      const gmInitiativeOrder = await gmPage.locator('[data-testid="initiative-item"]').allTextContents();
      expect(playerInitiativeOrder).toEqual(gmInitiativeOrder);

    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('Connection resilience and reconnection', async ({ page }) => {
    const gameSession = await factory.createMinimalGameSession();
    const { gm  } = gameSession.users;

    await authUtils.mockAuthentication(page, gm);

    let wsConnections = 0;
    const _wsDisconnections = 0;

    page.on('websocket', ws => {
      wsConnections++;
      
      ws.on('close', () => {
        wsDisconnections++;
      });
    });

    await page.goto(`/scenes/${gameSession.scene.id}`);
    await authUtils.waitForAuthReady(page);

    // Wait for initial connection
    await page.waitForTimeout(2000);
    expect(wsConnections).toBe(1);

    // Simulate network interruption
    await page.context().setOffline(true);
    await page.waitForTimeout(2000);

    // Restore network
    await page.context().setOffline(false);
    await page.waitForTimeout(5000);

    // Verify reconnection occurred
    expect(wsConnections).toBeGreaterThan(1);

    // Test functionality after reconnection
    const token = page.locator('[data-testid="token"]').first();
    await token.hover();
    await page.mouse.down();
    await page.mouse.move(400, 400);
    await page.mouse.up();

    // Verify token movement works after reconnection
    await expect(token).toHaveAttribute('data-x', '400');
  });

  test('WebSocket message queuing during disconnection', async ({ page }) => {
    const gameSession = await factory.createMinimalGameSession();
    const { gm  } = gameSession.users;

    await authUtils.mockAuthentication(page, gm);

    const sentMessages: any[] = [];
    
    page.on('websocket', ws => {
      ws.on('framesent', event => {
        try {
          const data = JSON.parse(event.payload as string);
          sentMessages.push(data);
        } catch (_e) {}
      });
    });

    await page.goto(`/scenes/${gameSession.scene.id}`);
    await authUtils.waitForAuthReady(page);
    await page.waitForTimeout(2000);

    // Go offline
    await page.context().setOffline(true);

    // Perform actions while offline
    const token = page.locator('[data-testid="token"]').first();
    await token.hover();
    await page.mouse.down();
    await page.mouse.move(500, 500);
    await page.mouse.up();

    // Send chat message while offline
    await page.fill('[data-testid="chat-input"]', 'Offline message');
    await page.press('[data-testid="chat-input"]', 'Enter');

    // Verify offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();

    const messagesBeforeReconnect = sentMessages.length;

    // Reconnect
    await page.context().setOffline(false);
    await page.waitForTimeout(3000);

    // Verify queued messages were sent after reconnection
    expect(sentMessages.length).toBeGreaterThan(messagesBeforeReconnect);

    // Verify actions were applied
    await expect(token).toHaveAttribute('data-x', '500');
    await expect(page.locator('[data-testid="chat-message"]').last()).toContainText('Offline message');
  });

  test('WebSocket performance under load', async ({ page }) => {
    const gameSession = await factory.createMinimalGameSession();
    const { gm  } = gameSession.users;

    // Create many tokens for stress testing
    for (let i = 0; i < 20; i++) {
      const actor = await factory.createActor(gm.id, gameSession.campaign.id, {
        name: `Load Test Actor ${i}`,
      });
      await factory.createToken(gameSession.scene.id, actor.id, {
        name: `Load Token ${i}`,
        x: i * 30,
        y: i * 30,
      });
    }

    await authUtils.mockAuthentication(page, gm);

    const wsMessages: any[] = [];
    const messageLatencies: number[] = [];

    page.on('websocket', ws => {
      ws.on('framesent', event => {
        const timestamp = Date.now();
        try {
          const data = JSON.parse(event.payload as string);
          data._sentAt = timestamp;
        } catch (_e) {}
      });

      ws.on('framereceived', event => {
        const receivedAt = Date.now();
        try {
          const data = JSON.parse(event.payload as string);
          wsMessages.push(data);
          
          if (data._sentAt) {
            messageLatencies.push(receivedAt - data._sentAt);
          }
        } catch (_e) {}
      });
    });

    await page.goto(`/scenes/${gameSession.scene.id}`);
    await authUtils.waitForAuthReady(page);
    await page.waitForTimeout(3000);

    // Perform rapid token movements
    const tokens = page.locator('[data-testid="token"]');
    const tokenCount = await tokens.count();

    const startTime = Date.now();
    
    for (let i = 0; i < Math.min(tokenCount, 10); i++) {
      const token = tokens.nth(i);
      await token.hover();
      await page.mouse.down();
      await page.mouse.move(200 + i * 20, 200 + i * 20);
      await page.mouse.up();
      await page.waitForTimeout(100); // Small delay between moves
    }

    const totalTime = Date.now() - startTime;

    // Verify reasonable performance
    expect(totalTime).toBeLessThan(5000); // Should complete in under 5 seconds

    // Check message latencies
    if (messageLatencies.length > 0) {
      const avgLatency = messageLatencies.reduce((_a, _b) => a + b, 0) / messageLatencies.length;
      expect(avgLatency).toBeLessThan(500); // Average latency under 500ms
    }

    // Verify no message loss
    const tokenMoveMessages = wsMessages.filter(msg => 
      msg.type === 'token_moved' || 
      msg.type === 'scene_update'
    );
    expect(tokenMoveMessages.length).toBeGreaterThan(0);
  });

  test('WebSocket authentication and authorization', async ({ page }) => {
    const gameSession = await factory.createMinimalGameSession();
    const { player  } = gameSession.users;

    // Test unauthenticated WebSocket connection
    await page.goto(`/scenes/${gameSession.scene.id}`);
    
    let wsConnected = false;
    let wsRejected = false;

    page.on('websocket', ws => {
      wsConnected = true;
      
      ws.on('close', (code) => {
        if (code === 1008 || code === 1011) { // Unauthorized codes
          wsRejected = true;
        }
      });
    });

    await page.waitForTimeout(3000);

    // Should either not connect or be rejected due to lack of auth
    expect(wsConnected === false || wsRejected === true).toBe(true);

    // Now authenticate and try again
    await authUtils.mockAuthentication(page, player);
    await page.reload();
    await authUtils.waitForAuthReady(page);

    wsConnected = false;
    wsRejected = false;

    await page.waitForTimeout(3000);

    // Should successfully connect with authentication
    expect(wsConnected).toBe(true);
    expect(wsRejected).toBe(false);
  });
});
