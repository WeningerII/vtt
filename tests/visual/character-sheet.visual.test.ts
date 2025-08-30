/**
 * Visual regression tests for Character Sheet component
 */
import { test, expect } from "@playwright/test";

test.describe("Character Sheet Visual Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/character-sheet");
    await page.waitForLoadState("networkidle");
  });

  test("character sheet default state", async ({ page }) => {
    await expect(page).toHaveScreenshot("character-sheet-default.png");
  });

  test("character sheet with filled data", async ({ page }) => {
    // Fill in character data
    await page.fill('[data-testid="character-name"]', "Aragorn");
    await page.selectOption('[data-testid="character-class"]', "ranger");
    await page.fill('[data-testid="character-level"]', "5");

    // Set ability scores
    await page.fill('[data-testid="strength-score"]', "16");
    await page.fill('[data-testid="dexterity-score"]', "18");
    await page.fill('[data-testid="constitution-score"]', "14");
    await page.fill('[data-testid="intelligence-score"]', "12");
    await page.fill('[data-testid="wisdom-score"]', "15");
    await page.fill('[data-testid="charisma-score"]', "13");

    await expect(page).toHaveScreenshot("character-sheet-filled.png");
  });

  test("character sheet spell slots section", async ({ page }) => {
    // Navigate to spells tab
    await page.click('[data-testid="spells-tab"]');
    await page.waitForTimeout(500); // Allow animation to complete

    await expect(page.locator('[data-testid="spell-slots-section"]')).toHaveScreenshot(
      "spell-slots-section.png",
    );
  });

  test("character sheet inventory section", async ({ page }) => {
    await page.click('[data-testid="inventory-tab"]');
    await page.waitForTimeout(500);

    // Add some items
    await page.click('[data-testid="add-item-button"]');
    await page.fill('[data-testid="item-name-input"]', "Longsword");
    await page.fill('[data-testid="item-quantity-input"]', "1");
    await page.click('[data-testid="save-item-button"]');

    await expect(page.locator('[data-testid="inventory-section"]')).toHaveScreenshot(
      "inventory-section.png",
    );
  });

  test("character sheet responsive mobile view", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("character-sheet-mobile.png");
  });

  test("character sheet dark theme", async ({ page }) => {
    await page.click('[data-testid="theme-toggle"]');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("character-sheet-dark-theme.png");
  });
});
