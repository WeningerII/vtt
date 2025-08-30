import { test, expect } from '@playwright/test';
import { factory } from './utils/factories';
import { authUtils } from './utils/auth';
import { testDb } from './utils/database';

test.describe('Complete User Journeys', () => {
  test.beforeEach(async () => {
    // Reset database state before each test
    await testDb.reset();
  });

  test('GM creates campaign and manages game session', async ({ page, _request}) => {
    // Setup test data
    const gameSession = await factory.createCompleteGameSession();
    const { gm, _player1,  _player2  } = gameSession.users;

    // Mock authentication for GM
    await authUtils.mockAuthentication(page, gm);
    
    // Navigate to campaigns page
    await page.goto('/campaigns');
    await authUtils.waitForAuthReady(page);

    // Verify campaign is visible
    await expect(page.locator(`text=${gameSession.campaign.name}`)).toBeVisible();

    // Enter campaign
    await page.click(`[data-testid="campaign-${gameSession.campaign.id}"]`);
    await page.waitForURL(`/campaigns/${gameSession.campaign.id}`);

    // Navigate to scenes
    await page.click('[data-testid="scenes-tab"]');
    await expect(page.locator(`text=${gameSession.scene.name}`)).toBeVisible();

    // Launch scene
    await page.click(`[data-testid="launch-scene-${gameSession.scene.id}"]`);
    await page.waitForURL(`/scenes/${gameSession.scene.id}`);

    // Verify scene canvas loads
    await expect(page.locator('canvas')).toBeVisible();
    
    // Verify tokens are visible
    await expect(page.locator('[data-testid="token"]')).toHaveCount(3);

    // Test token movement
    const firstToken = page.locator('[data-testid="token"]').first();
    await firstToken.hover();
    await page.mouse.down();
    await page.mouse.move(300, 300);
    await page.mouse.up();

    // Verify token moved
    await expect(firstToken).toHaveAttribute('data-x', '300');
    await expect(firstToken).toHaveAttribute('data-y', '300');

    // Open initiative tracker
    await page.click('[data-testid="initiative-tracker-button"]');
    await expect(page.locator('[data-testid="initiative-tracker"]')).toBeVisible();

    // Start encounter
    await page.click('[data-testid="start-encounter"]');
    await expect(page.locator('[data-testid="current-turn"]')).toBeVisible();

    // Advance turn
    await page.click('[data-testid="next-turn"]');
    await expect(page.locator('[data-testid="turn-indicator"]')).toContainText('Turn 2');
  });

  test('Player joins campaign and participates in session', async ({ page, _request}) => {
    // Setup test data
    const gameSession = await factory.createMinimalGameSession();
    const { player  } = gameSession.users;

    // Mock authentication for player
    await authUtils.mockAuthentication(page, player);
    
    // Navigate to campaigns
    await page.goto('/campaigns');
    await authUtils.waitForAuthReady(page);

    // Join campaign
    await expect(page.locator(`text=${gameSession.campaign.name}`)).toBeVisible();
    await page.click(`[data-testid="join-campaign-${gameSession.campaign.id}"]`);

    // Navigate to active scene
    await page.click(`[data-testid="active-scene-${gameSession.scene.id}"]`);
    await page.waitForURL(`/scenes/${gameSession.scene.id}`);

    // Verify player can see their token
    await expect(page.locator('[data-testid="player-token"]')).toBeVisible();

    // Test character sheet access
    await page.click('[data-testid="character-sheet-button"]');
    await expect(page.locator('[data-testid="character-sheet"]')).toBeVisible();

    // Update character HP
    await page.fill('[data-testid="current-hp-input"]', '20');
    await page.click('[data-testid="save-character"]');
    await expect(page.locator('[data-testid="hp-display"]')).toContainText('20/25');

    // Test dice rolling
    await page.click('[data-testid="dice-roller"]');
    await page.click('[data-testid="roll-d20"]');
    await expect(page.locator('[data-testid="dice-result"]')).toBeVisible();

    // Test chat functionality
    await page.fill('[data-testid="chat-input"]', 'Hello from player!');
    await page.press('[data-testid="chat-input"]', 'Enter');
    await expect(page.locator('[data-testid="chat-message"]').last()).toContainText('Hello from player!');
  });

  test('Multi-user real-time collaboration', async ({ browser }) => {
    // Setup test data
    const gameSession = await factory.createCompleteGameSession();
    const { gm,  player1,  player2  } = gameSession.users;

    // Create multiple browser contexts
    const gmContext = await browser.newContext();
    const player1Context = await browser.newContext();
    const player2Context = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const player1Page = await player1Context.newPage();
    const player2Page = await player2Context.newPage();

    try {
      // Setup authentication for each user
      await authUtils.mockAuthentication(gmPage, gm);
      await authUtils.mockAuthentication(player1Page, player1);
      await authUtils.mockAuthentication(player2Page, player2);

      // Navigate all users to the same scene
      const sceneUrl = `/scenes/${gameSession.scene.id}`;
      await Promise.all([
        gmPage.goto(sceneUrl),
        player1Page.goto(sceneUrl),
        player2Page.goto(sceneUrl),
      ]);

      // Wait for all pages to load
      await Promise.all([
        authUtils.waitForAuthReady(gmPage),
        authUtils.waitForAuthReady(player1Page),
        authUtils.waitForAuthReady(player2Page),
      ]);

      // Verify all users can see tokens
      await Promise.all([
        expect(gmPage.locator('[data-testid="token"]')).toHaveCount(3),
        expect(player1Page.locator('[data-testid="token"]')).toHaveCount(3),
        expect(player2Page.locator('[data-testid="token"]')).toHaveCount(3),
      ]);

      // GM moves a token
      const gmToken = gmPage.locator('[data-testid="token"]').first();
      await gmToken.hover();
      await gmPage.mouse.down();
      await gmPage.mouse.move(400, 400);
      await gmPage.mouse.up();

      // Wait for real-time update
      await gmPage.waitForTimeout(1000);

      // Verify players see the token movement
      await Promise.all([
        expect(player1Page.locator('[data-testid="token"]').first()).toHaveAttribute('data-x', '400'),
        expect(player2Page.locator('[data-testid="token"]').first()).toHaveAttribute('data-x', '400'),
      ]);

      // Test chat synchronization
      await player1Page.fill('[data-testid="chat-input"]', 'Player 1 message');
      await player1Page.press('[data-testid="chat-input"]', 'Enter');

      // Wait for message to propagate
      await player1Page.waitForTimeout(500);

      // Verify all users see the message
      await Promise.all([
        expect(gmPage.locator('[data-testid="chat-message"]').last()).toContainText('Player 1 message'),
        expect(player2Page.locator('[data-testid="chat-message"]').last()).toContainText('Player 1 message'),
      ]);

      // Test initiative tracker synchronization
      await gmPage.click('[data-testid="initiative-tracker-button"]');
      await gmPage.click('[data-testid="start-encounter"]');

      // Wait for encounter state to sync
      await gmPage.waitForTimeout(1000);

      // Verify all users see encounter started
      await Promise.all([
        expect(player1Page.locator('[data-testid="encounter-active"]')).toBeVisible(),
        expect(player2Page.locator('[data-testid="encounter-active"]')).toBeVisible(),
      ]);

    } finally {
      // Cleanup contexts
      await gmContext.close();
      await player1Context.close();
      await player2Context.close();
    }
  });

  test('Asset upload and management workflow', async ({ page, _request}) => {
    // Setup test data
    const gameSession = await factory.createMinimalGameSession();
    const { gm  } = gameSession.users;

    // Mock authentication
    await authUtils.mockAuthentication(page, gm);
    
    // Navigate to asset library
    await page.goto('/assets');
    await authUtils.waitForAuthReady(page);

    // Test file upload
    const fileInput = page.locator('[data-testid="file-upload-input"]');
    
    // Create a test file
    const testImageBuffer = Buffer.from('fake-image-data');
    await fileInput.setInputFiles({
      name: 'test-map.png',
      mimeType: 'image/png',
      buffer: testImageBuffer,
    });

    // Verify upload progress
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-complete"]')).toBeVisible({ timeout: 10000 });

    // Verify asset appears in library
    await expect(page.locator('[data-testid="asset-item"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="asset-name"]')).toContainText('test-map.png');

    // Test asset preview
    await page.click('[data-testid="asset-item"]');
    await expect(page.locator('[data-testid="asset-preview"]')).toBeVisible();

    // Test adding asset to scene
    await page.click('[data-testid="add-to-scene"]');
    await page.selectOption('[data-testid="scene-select"]', gameSession.scene.id);
    await page.click('[data-testid="confirm-add"]');

    // Navigate to scene to verify asset was added
    await page.goto(`/scenes/${gameSession.scene.id}`);
    await expect(page.locator('[data-testid="scene-asset"]')).toBeVisible();

    // Test asset deletion
    await page.goto('/assets');
    await page.click('[data-testid="asset-menu"]');
    await page.click('[data-testid="delete-asset"]');
    await page.click('[data-testid="confirm-delete"]');

    // Verify asset is removed
    await expect(page.locator('[data-testid="asset-item"]')).toHaveCount(0);
  });

  test('Error handling and recovery scenarios', async ({ page, _request}) => {
    // Setup test data
    const gameSession = await factory.createMinimalGameSession();
    const { player  } = gameSession.users;

    // Mock authentication
    await authUtils.mockAuthentication(page, player);

    // Test network disconnection scenario
    await page.goto(`/scenes/${gameSession.scene.id}`);
    await authUtils.waitForAuthReady(page);

    // Simulate network offline
    await page.context().setOffline(true);

    // Attempt to move token (should show offline indicator)
    const token = page.locator('[data-testid="token"]').first();
    await token.hover();
    await page.mouse.down();
    await page.mouse.move(500, 500);
    await page.mouse.up();

    // Verify offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();

    // Restore network
    await page.context().setOffline(false);

    // Verify reconnection
    await expect(page.locator('[data-testid="online-indicator"]')).toBeVisible({ timeout: 10000 });

    // Test invalid scene access
    await page.goto('/scenes/invalid-scene-id');
    await expect(page.locator('[data-testid="scene-not-found"]')).toBeVisible();

    // Test unauthorized access
    await page.goto('/admin/dashboard');
    await expect(page.locator('[data-testid="unauthorized"]')).toBeVisible();
  });

  test('Performance under load', async ({ page, _request}) => {
    // Create a scene with many tokens
    const gameSession = await factory.createMinimalGameSession();
    const { gm  } = gameSession.users;

    // Create 50 tokens for stress testing
    const tokens = [];
    for (let i = 0; i < 50; i++) {
      const actor = await factory.createActor(gm.id, gameSession.campaign.id, {
        name: `Test Actor ${i}`,
      });
      const token = await factory.createToken(gameSession.scene.id, actor.id, {
        name: `Token ${i}`,
        x: (i % 10) * 50,
        y: Math.floor(i / 10) * 50,
      });
      tokens.push(token);
    }

    // Mock authentication
    await authUtils.mockAuthentication(page, gm);

    // Measure page load time
    const startTime = Date.now();
    await page.goto(`/scenes/${gameSession.scene.id}`);
    await authUtils.waitForAuthReady(page);
    
    // Wait for all tokens to render
    await expect(page.locator('[data-testid="token"]')).toHaveCount(51); // 50 + 1 original
    const loadTime = Date.now() - startTime;

    // Verify reasonable load time (under 5 seconds)
    expect(loadTime).toBeLessThan(5000);

    // Test smooth token movement with many tokens
    const moveStartTime = Date.now();
    const firstToken = page.locator('[data-testid="token"]').first();
    await firstToken.hover();
    await page.mouse.down();
    await page.mouse.move(600, 600);
    await page.mouse.up();
    const moveTime = Date.now() - moveStartTime;

    // Verify responsive interaction (under 1 second)
    expect(moveTime).toBeLessThan(1000);

    // Check for console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Perform multiple rapid actions
    for (let i = 0; i < 10; i++) {
      await page.click('[data-testid="zoom-in"]');
      await page.waitForTimeout(100);
    }

    // Verify no critical errors
    const criticalErrors = errors.filter(error => 
      error.includes('memory') || 
      error.includes('crash') || 
      error.includes('fatal')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
