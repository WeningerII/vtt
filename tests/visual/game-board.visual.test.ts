/**
 * Visual regression tests for Game Board component
 */
import { test, expect } from '@playwright/test';

test.describe('Game Board Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/game-board');
    await page.waitForLoadState('networkidle');
  });

  test('empty game board', async ({ page }) => {
    await expect(page).toHaveScreenshot('game-board-empty.png');
  });

  test('game board with map loaded', async ({ page }) => {
    // Load a test map
    await page.click('[data-testid="load-map-button"]');
    await page.selectOption('[data-testid="map-selector"]', 'tavern');
    await page.click('[data-testid="confirm-load-button"]');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('game-board-with-map.png');
  });

  test('game board with tokens', async ({ page }) => {
    // Load map and add tokens
    await page.click('[data-testid="load-map-button"]');
    await page.selectOption('[data-testid="map-selector"]', 'dungeon');
    await page.click('[data-testid="confirm-load-button"]');
    await page.waitForTimeout(500);

    // Add player token
    await page.click('[data-testid="add-token-button"]');
    await page.click('[data-testid="map-canvas"]', { position: { x: 200, y: 150 } });
    
    // Add enemy token
    await page.selectOption('[data-testid="token-type-selector"]', 'enemy');
    await page.click('[data-testid="map-canvas"]', { position: { x: 400, y: 300 } });

    await expect(page).toHaveScreenshot('game-board-with-tokens.png');
  });

  test('game board grid overlay', async ({ page }) => {
    await page.click('[data-testid="toggle-grid-button"]');
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('game-board-grid-overlay.png');
  });

  test('game board measurement tool', async ({ page }) => {
    await page.click('[data-testid="measurement-tool-button"]');
    
    // Draw measurement line
    await page.mouse.move(100, 100);
    await page.mouse.down();
    await page.mouse.move(300, 200);
    await page.mouse.up();

    await expect(page).toHaveScreenshot('game-board-measurement.png');
  });

  test('game board fog of war', async ({ page }) => {
    await page.click('[data-testid="load-map-button"]');
    await page.selectOption('[data-testid="map-selector"]', 'cave');
    await page.click('[data-testid="confirm-load-button"]');
    await page.waitForTimeout(500);

    await page.click('[data-testid="fog-of-war-button"]');
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('game-board-fog-of-war.png');
  });
});

test.describe('Game Board Mobile Tests', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('mobile game board layout', async ({ page }) => {
    await page.goto('/game-board');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('game-board-mobile.png');
  });

  test('mobile token placement', async ({ page }) => {
    await page.goto('/game-board');
    await page.waitForLoadState('networkidle');

    // Load map
    await page.click('[data-testid="load-map-button"]');
    await page.selectOption('[data-testid="map-selector"]', 'forest');
    await page.click('[data-testid="confirm-load-button"]');
    await page.waitForTimeout(500);

    // Add token via touch
    await page.click('[data-testid="add-token-button"]');
    await page.tap('[data-testid="map-canvas"]', { position: { x: 150, y: 200 } });

    await expect(page).toHaveScreenshot('game-board-mobile-with-token.png');
  });
});
