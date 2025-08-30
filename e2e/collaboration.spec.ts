import { test, expect } from "@playwright/test";
import { factory } from "./utils/factories";
import { authUtils } from "./utils/auth";
import { testDb } from "./utils/database";

test.describe("Real-time Collaboration Scenarios", () => {
  test.beforeEach(async () => {
    await testDb.reset();
  });

  test("Concurrent token editing with conflict resolution", async ({ browser }) => {
    const gameSession = await factory.createCompleteGameSession();
    const { gm, player1, player2 } = gameSession.users;

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
      await Promise.all([
        authUtils.mockAuthentication(gmPage, gm),
        authUtils.mockAuthentication(player1Page, player1),
        authUtils.mockAuthentication(player2Page, player2),
      ]);

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

      await gmPage.waitForTimeout(2000);

      // Both GM and Player1 try to move the same token simultaneously
      const gmToken = gmPage.locator('[data-testid="token"]').first();
      const player1Token = player1Page.locator('[data-testid="token"]').first();

      // Start concurrent moves
      await Promise.all([
        _(async () => {
          await gmToken.hover();
          await gmPage.mouse.down();
          await gmPage.mouse.move(300, 300);
          await gmPage.mouse.up();
        })(),
        (async () => {
          await player1Token.hover();
          await player1Page.mouse.down();
          await player1Page.mouse.move(400, 400);
          await player1Page.mouse.up();
        })(),
      ]);

      await gmPage.waitForTimeout(2000);

      // Verify conflict resolution - one move should win
      const finalPositions = await Promise.all([
        gmToken.getAttribute("data-x"),
        player1Token.getAttribute("data-x"),
        player2Page.locator('[data-testid="token"]').first().getAttribute("data-x"),
      ]);

      // All clients should show the same final position
      expect(finalPositions[0]).toBe(finalPositions[1]);
      expect(finalPositions[1]).toBe(finalPositions[2]);

      // Position should be either 300 or 400 (one of the attempted moves)
      expect(["300", "400"]).toContain(finalPositions[0]);
    } finally {
      await Promise.all(contexts.map((ctx) => ctx.close()));
    }
  });

  test("Shared scene state synchronization", async ({ browser }) => {
    const gameSession = await factory.createCompleteGameSession();
    const { gm, player1 } = gameSession.users;

    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      await authUtils.mockAuthentication(gmPage, gm);
      await authUtils.mockAuthentication(playerPage, player1);

      const sceneUrl = `/scenes/${gameSession.scene.id}`;
      await Promise.all([gmPage.goto(sceneUrl), playerPage.goto(sceneUrl)]);

      await Promise.all([
        authUtils.waitForAuthReady(gmPage),
        authUtils.waitForAuthReady(playerPage),
      ]);

      await gmPage.waitForTimeout(2000);

      // GM changes scene lighting
      await gmPage.click('[data-testid="scene-settings"]');
      await gmPage.click('[data-testid="lighting-tab"]');
      await gmPage.check('[data-testid="global-illumination"]');
      await gmPage.click('[data-testid="apply-settings"]');

      await gmPage.waitForTimeout(1000);

      // Verify lighting change synced to player
      await expect(playerPage.locator('[data-testid="scene-illuminated"]')).toBeVisible();

      // GM adds fog of war
      await gmPage.click('[data-testid="fog-of-war-tool"]');
      await gmPage.mouse.move(200, 200);
      await gmPage.mouse.down();
      await gmPage.mouse.move(400, 400);
      await gmPage.mouse.up();

      await gmPage.waitForTimeout(1000);

      // Verify fog appears for player
      await expect(playerPage.locator('[data-testid="fog-overlay"]')).toBeVisible();

      // GM reveals area
      await gmPage.click('[data-testid="reveal-tool"]');
      await gmPage.mouse.move(300, 300);
      await gmPage.mouse.down();
      await gmPage.mouse.move(350, 350);
      await gmPage.mouse.up();

      await gmPage.waitForTimeout(1000);

      // Verify revealed area synced
      const revealedArea = playerPage.locator('[data-testid="revealed-area"]');
      await expect(revealedArea).toBeVisible();
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test("Multi-user dice rolling and results sharing", async ({ browser }) => {
    const gameSession = await factory.createCompleteGameSession();
    const { gm, player1, player2 } = gameSession.users;

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
      await Promise.all([
        authUtils.mockAuthentication(gmPage, gm),
        authUtils.mockAuthentication(player1Page, player1),
        authUtils.mockAuthentication(player2Page, player2),
      ]);

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

      await gmPage.waitForTimeout(2000);

      // Player 1 rolls dice
      await player1Page.click('[data-testid="dice-roller"]');
      await player1Page.click('[data-testid="roll-d20"]');

      await player1Page.waitForTimeout(1000);

      // Verify all users see the dice result
      const diceResultText = await player1Page.locator('[data-testid="dice-result"]').textContent();

      await Promise.all([
        expect(gmPage.locator('[data-testid="chat-message"]').last()).toContainText(
          diceResultText || "",
        ),
        expect(player2Page.locator('[data-testid="chat-message"]').last()).toContainText(
          diceResultText || "",
        ),
      ]);

      // GM rolls multiple dice
      await gmPage.click('[data-testid="dice-roller"]');
      await gmPage.selectOption('[data-testid="dice-count"]', "3");
      await gmPage.selectOption('[data-testid="dice-type"]', "d6");
      await gmPage.click('[data-testid="roll-dice"]');

      await gmPage.waitForTimeout(1000);

      // Verify multi-dice result appears for all users
      await Promise.all([
        expect(player1Page.locator('[data-testid="dice-total"]')).toBeVisible(),
        expect(player2Page.locator('[data-testid="dice-total"]')).toBeVisible(),
      ]);

      // Test advantage/disadvantage rolls
      await player2Page.click('[data-testid="dice-roller"]');
      await player2Page.check('[data-testid="advantage-roll"]');
      await player2Page.click('[data-testid="roll-d20"]');

      await player2Page.waitForTimeout(1000);

      // Verify advantage roll format appears for all users
      const _advantageRoll = await player2Page
        .locator('[data-testid="advantage-result"]')
        .textContent();
      await Promise.all([
        expect(gmPage.locator('[data-testid="chat-message"]').last()).toContainText("Advantage"),
        expect(player1Page.locator('[data-testid="chat-message"]').last()).toContainText(
          "Advantage",
        ),
      ]);
    } finally {
      await Promise.all(contexts.map((ctx) => ctx.close()));
    }
  });

  test("Collaborative map drawing and annotations", async ({ browser }) => {
    const gameSession = await factory.createCompleteGameSession();
    const { gm, player1 } = gameSession.users;

    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      await authUtils.mockAuthentication(gmPage, gm);
      await authUtils.mockAuthentication(playerPage, player1);

      const sceneUrl = `/scenes/${gameSession.scene.id}`;
      await Promise.all([gmPage.goto(sceneUrl), playerPage.goto(sceneUrl)]);

      await Promise.all([
        authUtils.waitForAuthReady(gmPage),
        authUtils.waitForAuthReady(playerPage),
      ]);

      await gmPage.waitForTimeout(2000);

      // GM draws on the map
      await gmPage.click('[data-testid="drawing-tool"]');
      await gmPage.selectOption('[data-testid="brush-color"]', "#ff0000");
      await gmPage.selectOption('[data-testid="brush-size"]', "3");

      // Draw a line
      await gmPage.mouse.move(100, 100);
      await gmPage.mouse.down();
      await gmPage.mouse.move(200, 200);
      await gmPage.mouse.up();

      await gmPage.waitForTimeout(1000);

      // Verify drawing appears for player
      await expect(playerPage.locator('[data-testid="drawing-stroke"]')).toBeVisible();

      // Player adds annotation
      await playerPage.click('[data-testid="annotation-tool"]');
      await playerPage.mouse.move(150, 150);
      await playerPage.mouse.down();
      await playerPage.mouse.up();
      await playerPage.fill('[data-testid="annotation-text"]', "Important location");
      await playerPage.click('[data-testid="save-annotation"]');

      await playerPage.waitForTimeout(1000);

      // Verify annotation appears for GM
      await expect(gmPage.locator('[data-testid="annotation"]')).toContainText(
        "Important location",
      );

      // GM erases part of drawing
      await gmPage.click('[data-testid="eraser-tool"]');
      await gmPage.mouse.move(120, 120);
      await gmPage.mouse.down();
      await gmPage.mouse.move(140, 140);
      await gmPage.mouse.up();

      await gmPage.waitForTimeout(1000);

      // Verify eraser effect synced to player
      const drawingStrokes = await playerPage.locator('[data-testid="drawing-stroke"]').count();
      expect(drawingStrokes).toBeGreaterThan(0); // Some drawing should remain
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test("Session persistence and late-joining users", async ({ browser }) => {
    const gameSession = await factory.createCompleteGameSession();
    const { gm, player1, player2 } = gameSession.users;

    // Start with GM and Player 1
    const gmContext = await browser.newContext();
    const player1Context = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const player1Page = await player1Context.newPage();

    try {
      await authUtils.mockAuthentication(gmPage, gm);
      await authUtils.mockAuthentication(player1Page, player1);

      const sceneUrl = `/scenes/${gameSession.scene.id}`;
      await Promise.all([gmPage.goto(sceneUrl), player1Page.goto(sceneUrl)]);

      await Promise.all([
        authUtils.waitForAuthReady(gmPage),
        authUtils.waitForAuthReady(player1Page),
      ]);

      await gmPage.waitForTimeout(2000);

      // GM and Player 1 perform various actions
      // Move tokens
      const gmToken = gmPage.locator('[data-testid="token"]').first();
      await gmToken.hover();
      await gmPage.mouse.down();
      await gmPage.mouse.move(250, 250);
      await gmPage.mouse.up();

      // Send chat messages
      await player1Page.fill('[data-testid="chat-input"]', "Early message");
      await player1Page.press('[data-testid="chat-input"]', "Enter");

      // Start encounter
      await gmPage.click('[data-testid="initiative-tracker-button"]');
      await gmPage.click('[data-testid="start-encounter"]');

      await gmPage.waitForTimeout(2000);

      // Now Player 2 joins late
      const player2Context = await browser.newContext();
      const player2Page = await player2Context.newPage();

      await authUtils.mockAuthentication(player2Page, player2);
      await player2Page.goto(sceneUrl);
      await authUtils.waitForAuthReady(player2Page);

      await player2Page.waitForTimeout(3000);

      // Verify Player 2 sees current state
      // Token should be in moved position
      await expect(player2Page.locator('[data-testid="token"]').first()).toHaveAttribute(
        "data-x",
        "250",
      );

      // Chat history should be visible
      await expect(player2Page.locator('[data-testid="chat-message"]')).toContainText(
        "Early message",
      );

      // Encounter should be active
      await expect(player2Page.locator('[data-testid="encounter-active"]')).toBeVisible();

      // Player 2 can immediately participate
      await player2Page.fill('[data-testid="chat-input"]', "Late joiner message");
      await player2Page.press('[data-testid="chat-input"]', "Enter");

      await player2Page.waitForTimeout(1000);

      // Verify all users see Player 2's message
      await Promise.all([
        expect(gmPage.locator('[data-testid="chat-message"]').last()).toContainText(
          "Late joiner message",
        ),
        expect(player1Page.locator('[data-testid="chat-message"]').last()).toContainText(
          "Late joiner message",
        ),
      ]);

      await player2Context.close();
    } finally {
      await gmContext.close();
      await player1Context.close();
    }
  });

  test("Bandwidth optimization and message batching", async ({ browser }) => {
    const gameSession = await factory.createMinimalGameSession();
    const { gm } = gameSession.users;

    // Create many tokens for stress testing
    for (let i = 0; i < 30; i++) {
      const actor = await factory.createActor(gm.id, gameSession.campaign.id, {
        name: `Stress Actor ${i}`,
      });
      await factory.createToken(gameSession.scene.id, actor.id, {
        name: `Stress Token ${i}`,
        x: i * 20,
        y: i * 20,
      });
    }

    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      let messageCount = 0;
      let totalMessageSize = 0;

      playerPage.on("websocket", (ws) => {
        ws.on("framereceived", (event) => {
          messageCount++;
          totalMessageSize += (event.payload as string).length;
        });
      });

      await authUtils.mockAuthentication(gmPage, gm);
      await authUtils.mockAuthentication(playerPage, player1);

      const sceneUrl = `/scenes/${gameSession.scene.id}`;
      await Promise.all([gmPage.goto(sceneUrl), playerPage.goto(sceneUrl)]);

      await Promise.all([
        authUtils.waitForAuthReady(gmPage),
        authUtils.waitForAuthReady(playerPage),
      ]);

      await gmPage.waitForTimeout(3000);

      const initialMessageCount = messageCount;

      // Perform rapid token movements
      const tokens = gmPage.locator('[data-testid="token"]');
      const tokenCount = await tokens.count();

      for (let i = 0; i < Math.min(tokenCount, 10); i++) {
        const token = tokens.nth(i);
        await token.hover();
        await gmPage.mouse.down();
        await gmPage.mouse.move(300 + i * 10, 300 + i * 10);
        await gmPage.mouse.up();
        await gmPage.waitForTimeout(50); // Rapid movements
      }

      await gmPage.waitForTimeout(2000);

      const finalMessageCount = messageCount;
      const movementMessages = finalMessageCount - initialMessageCount;

      // Verify message batching - should be fewer messages than individual moves
      expect(movementMessages).toBeLessThan(tokenCount);

      // Verify reasonable bandwidth usage
      const avgMessageSize = totalMessageSize / messageCount;
      expect(avgMessageSize).toBeLessThan(1024); // Average message under 1KB
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test("Cross-platform compatibility", async ({ browser }) => {
    const gameSession = await factory.createCompleteGameSession();
    const { gm, player1 } = gameSession.users;

    // Simulate different devices/browsers
    const desktopContext = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    });

    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 667 },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15",
    });

    const desktopPage = await desktopContext.newPage();
    const mobilePage = await mobileContext.newPage();

    try {
      await authUtils.mockAuthentication(desktopPage, gm);
      await authUtils.mockAuthentication(mobilePage, player1);

      const sceneUrl = `/scenes/${gameSession.scene.id}`;
      await Promise.all([desktopPage.goto(sceneUrl), mobilePage.goto(sceneUrl)]);

      await Promise.all([
        authUtils.waitForAuthReady(desktopPage),
        authUtils.waitForAuthReady(mobilePage),
      ]);

      await desktopPage.waitForTimeout(2000);

      // Desktop user moves token
      const desktopToken = desktopPage.locator('[data-testid="token"]').first();
      await desktopToken.hover();
      await desktopPage.mouse.down();
      await desktopPage.mouse.move(350, 350);
      await desktopPage.mouse.up();

      await desktopPage.waitForTimeout(1000);

      // Verify mobile user sees the movement
      await expect(mobilePage.locator('[data-testid="token"]').first()).toHaveAttribute(
        "data-x",
        "350",
      );

      // Mobile user sends chat (touch interaction)
      await mobilePage.tap('[data-testid="chat-input"]');
      await mobilePage.fill('[data-testid="chat-input"]', "Mobile message");
      await mobilePage.tap('[data-testid="send-chat"]');

      await mobilePage.waitForTimeout(1000);

      // Verify desktop user sees mobile message
      await expect(desktopPage.locator('[data-testid="chat-message"]').last()).toContainText(
        "Mobile message",
      );

      // Test responsive UI elements
      await expect(mobilePage.locator('[data-testid="mobile-menu"]')).toBeVisible();
      await expect(desktopPage.locator('[data-testid="desktop-sidebar"]')).toBeVisible();
    } finally {
      await desktopContext.close();
      await mobileContext.close();
    }
  });
});
