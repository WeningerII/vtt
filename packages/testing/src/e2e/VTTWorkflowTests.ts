/**
 * End-to-End tests for complete VTT workflows
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Page, Browser, chromium } from 'playwright';
import { _TestUtils } from '../TestUtils';

describe('VTT E2E Workflow Tests', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('Session Creation and Management', () => {
    it('should create a new game session', async () => {
      await page.goto('http://localhost:3000');
      
      // Click create session button
      await page.click('[data-testid="create-session"]');
      
      // Fill session details
      await page.fill('[data-testid="session-name"]', 'Test Campaign');
      await page.selectOption('[data-testid="game-system"]', 'dnd5e');
      await page.click('[data-testid="confirm-create"]');
      
      // Should navigate to session page
      await page.waitForURL('**/session/**');
      
      // Verify session elements are present
      await expect(page.locator('[data-testid="game-canvas"]')).toBeVisible();
      await expect(page.locator('[data-testid="player-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="chat-panel"]')).toBeVisible();
    });

    it('should allow players to join session', async () => {
      const playerPage = await browser.newPage();
      
      // Get session URL from GM page
      const sessionUrl = page.url();
      
      // Player joins session
      await playerPage.goto(sessionUrl);
      await playerPage.fill('[data-testid="player-name"]', 'TestPlayer');
      await playerPage.click('[data-testid="join-session"]');
      
      // Verify player appears in both GM and player views
      await expect(page.locator('[data-testid="player-TestPlayer"]')).toBeVisible();
      await expect(playerPage.locator('[data-testid="player-controls"]')).toBeVisible();
      
      await playerPage.close();
    });
  });

  describe('Map and Token Management', () => {
    it('should upload and display battle map', async () => {
      // Click map management
      await page.click('[data-testid="map-manager"]');
      
      // Upload test image
      const fileInput = page.locator('[data-testid="map-upload"]');
      await fileInput.setInputFiles('./test-assets/test-map.jpg');
      
      // Set grid properties
      await page.fill('[data-testid="grid-size"]', '70');
      await page.click('[data-testid="apply-map"]');
      
      // Verify map is displayed
      await expect(page.locator('[data-testid="battle-map"]')).toBeVisible();
      await expect(page.locator('[data-testid="grid-overlay"]')).toBeVisible();
    });

    it('should create and move tokens', async () => {
      // Add token
      await page.click('[data-testid="add-token"]');
      await page.fill('[data-testid="token-name"]', 'Fighter');
      await page.selectOption('[data-testid="token-type"]', 'player');
      await page.click('[data-testid="create-token"]');
      
      // Verify token appears on map
      const token = page.locator('[data-testid="token-Fighter"]');
      await expect(token).toBeVisible();
      
      // Move token by dragging
      await token.dragTo(page.locator('[data-testid="game-canvas"]'), {
        targetPosition: { x: 200, y: 200 }
      });
      
      // Verify token position changed
      const tokenBox = await token.boundingBox();
      expect(tokenBox?.x).toBeCloseTo(200, 50);
      expect(tokenBox?.y).toBeCloseTo(200, 50);
    });
  });

  describe('Combat System', () => {
    it('should initiate combat encounter', async () => {
      // Add multiple tokens
      const combatants = ['Fighter', 'Rogue', 'Orc', 'Goblin'];
      
      for (const name of combatants) {
        await page.click('[data-testid="add-token"]');
        await page.fill('[data-testid="token-name"]', name);
        await page.selectOption('[data-testid="token-type"]', 
          name.includes('Orc') || name.includes('Goblin') ? 'npc' : 'player');
        await page.click('[data-testid="create-token"]');
      }
      
      // Select all tokens and start combat
      await page.keyboard.press('Control+a');
      await page.click('[data-testid="start-combat"]');
      
      // Verify combat tracker appears
      await expect(page.locator('[data-testid="combat-tracker"]')).toBeVisible();
      await expect(page.locator('[data-testid="initiative-order"]')).toBeVisible();
      
      // Check that all combatants are listed
      for (const name of combatants) {
        await expect(page.locator(`[data-testid="combatant-${name}"]`)).toBeVisible();
      }
    });

    it('should handle combat turns and actions', async () => {
      // Verify current turn is highlighted
      const currentTurn = page.locator('[data-testid="current-turn"]');
      await expect(currentTurn).toBeVisible();
      
      // Click attack action
      await page.click('[data-testid="attack-action"]');
      
      // Select target
      await page.click('[data-testid="token-Orc"]');
      
      // Roll attack
      await page.click('[data-testid="roll-attack"]');
      
      // Verify dice roll modal appears
      await expect(page.locator('[data-testid="dice-roll-result"]')).toBeVisible();
      
      // Confirm attack
      await page.click('[data-testid="confirm-attack"]');
      
      // Verify combat log entry
      const combatLog = page.locator('[data-testid="combat-log"]');
      await expect(combatLog).toContainText('attacks');
      
      // End turn
      await page.click('[data-testid="end-turn"]');
      
      // Verify turn advanced
      const newCurrentTurn = page.locator('[data-testid="current-turn"]');
      const newTurnText = await newCurrentTurn.textContent();
      expect(newTurnText).not.toBe(await currentTurn.textContent());
    });
  });

  describe('Spell System Integration', () => {
    it('should cast spells and track spell slots', async () => {
      // Select caster token
      await page.click('[data-testid="token-Wizard"]');
      
      // Open spell panel
      await page.click('[data-testid="spells-panel"]');
      
      // Verify spell slots are displayed
      await expect(page.locator('[data-testid="spell-slots-1"]')).toBeVisible();
      
      // Cast a spell
      await page.click('[data-testid="spell-magic-missile"]');
      await page.click('[data-testid="token-Orc"]'); // Target
      await page.click('[data-testid="cast-spell"]');
      
      // Verify spell slot is consumed
      const usedSlots = page.locator('[data-testid="used-spell-slots-1"]');
      await expect(usedSlots).toContainText('1');
      
      // Verify damage is applied
      const orcToken = page.locator('[data-testid="token-Orc"]');
      await expect(orcToken.locator('[data-testid="damage-indicator"]')).toBeVisible();
    });
  });

  describe('Chat and Communication', () => {
    it('should send and receive chat messages', async () => {
      const chatInput = page.locator('[data-testid="chat-input"]');
      const chatMessages = page.locator('[data-testid="chat-messages"]');
      
      // Send IC message
      await chatInput.fill('I search for traps.');
      await page.keyboard.press('Enter');
      
      // Verify message appears
      await expect(chatMessages).toContainText('I search for traps.');
      
      // Send OOC message
      await chatInput.fill('((Can we take a short break?))');
      await page.keyboard.press('Enter');
      
      // Verify OOC styling
      await expect(page.locator('[data-testid="ooc-message"]')).toContainText('Can we take a short break?');
    });

    it('should handle dice rolls in chat', async () => {
      const chatInput = page.locator('[data-testid="chat-input"]');
      
      // Roll dice in chat
      await chatInput.fill('/roll 1d20+5');
      await page.keyboard.press('Enter');
      
      // Verify dice roll result appears
      await expect(page.locator('[data-testid="dice-roll-chat"]')).toBeVisible();
      await expect(page.locator('[data-testid="dice-roll-total"]')).toBeVisible();
    });
  });

  describe('GM Tools', () => {
    it('should manage fog of war', async () => {
      // Enable fog of war
      await page.click('[data-testid="fog-of-war-toggle"]');
      
      // Verify fog overlay appears
      await expect(page.locator('[data-testid="fog-overlay"]')).toBeVisible();
      
      // Use reveal tool
      await page.click('[data-testid="reveal-tool"]');
      await page.click('[data-testid="game-canvas"]', { position: { x: 300, y: 300 } });
      
      // Verify area is revealed
      const revealedArea = page.locator('[data-testid="revealed-area"]');
      await expect(revealedArea).toBeVisible();
    });

    it('should control music and ambient sounds', async () => {
      // Open audio panel
      await page.click('[data-testid="audio-panel"]');
      
      // Play background music
      await page.click('[data-testid="play-tavern-music"]');
      
      // Verify audio controls
      await expect(page.locator('[data-testid="volume-slider"]')).toBeVisible();
      await expect(page.locator('[data-testid="pause-button"]')).toBeVisible();
      
      // Add sound effect
      await page.click('[data-testid="sound-effect-sword"]');
      
      // Verify sound played (check for audio element)
      await page.waitForFunction(() => {
        const audio = document.querySelector('audio[data-testid="sound-effect"]');
        return audio && !audio.paused;
      });
    });
  });

  describe('Performance and Stability', () => {
    it('should handle many tokens without performance degradation', async () => {
      const startTime = Date.now();
      
      // Add 50 tokens
      for (let i = 0; i < 50; i++) {
        await page.click('[data-testid="add-token"]');
        await page.fill('[data-testid="token-name"]', `Token${i}`);
        await page.click('[data-testid="create-token"]');
      }
      
      const endTime = Date.now();
      const timePerToken = (endTime - startTime) / 50;
      
      // Should take less than 100ms per token
      expect(timePerToken).toBeLessThan(100);
      
      // Canvas should still be responsive
      const canvas = page.locator('[data-testid="game-canvas"]');
      await canvas.click({ position: { x: 100, y: 100 } });
      
      // Should respond quickly
      await expect(canvas).toBeFocused({ timeout: 1000 });
    });

    it('should maintain real-time sync with multiple clients', async () => {
      const player1 = await browser.newPage();
      const player2 = await browser.newPage();
      
      const sessionUrl = page.url();
      
      // Both players join
      await player1.goto(sessionUrl);
      await player1.fill('[data-testid="player-name"]', 'Player1');
      await player1.click('[data-testid="join-session"]');
      
      await player2.goto(sessionUrl);
      await player2.fill('[data-testid="player-name"]', 'Player2');
      await player2.click('[data-testid="join-session"]');
      
      // GM moves a token
      await page.locator('[data-testid="token-Fighter"]').dragTo(
        page.locator('[data-testid="game-canvas"]'), 
        { targetPosition: { x: 400, y: 400 } }
      );
      
      // Both players should see the movement
      await expect(player1.locator('[data-testid="token-Fighter"]')).toBeVisible();
      await expect(player2.locator('[data-testid="token-Fighter"]')).toBeVisible();
      
      const p1TokenBox = await player1.locator('[data-testid="token-Fighter"]').boundingBox();
      const p2TokenBox = await player2.locator('[data-testid="token-Fighter"]').boundingBox();
      
      expect(p1TokenBox?.x).toBeCloseTo(p2TokenBox?.x || 0, 10);
      expect(p1TokenBox?.y).toBeCloseTo(p2TokenBox?.y || 0, 10);
      
      await player1.close();
      await player2.close();
    });
  });

  describe('Data Persistence', () => {
    it('should save and restore session state', async () => {
      // Make changes to session
      await page.click('[data-testid="add-token"]');
      await page.fill('[data-testid="token-name"]', 'PersistentToken');
      await page.click('[data-testid="create-token"]');
      
      // Save session
      await page.click('[data-testid="save-session"]');
      await page.waitForSelector('[data-testid="save-success"]');
      
      // Reload page
      await page.reload();
      
      // Verify token is still there
      await expect(page.locator('[data-testid="token-PersistentToken"]')).toBeVisible();
    });
  });
});
