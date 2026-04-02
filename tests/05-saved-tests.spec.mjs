import { test, expect } from "@playwright/test";

test.describe("Saved Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("created test appears on home page", async ({ page }) => {
    // Create a test
    await page.goto("/create-test");
    const numberInput = page.locator(".count-input");
    await numberInput.fill("5");
    await numberInput.press("Tab");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/tests\/\d+\/run/, { timeout: 10000 });

    // Go back home
    await page.goto("/");

    // Should show the saved test card
    await expect(page.locator(".my-test-card")).toHaveCount(1);
  });

  test("saved test card is clickable and opens test", async ({ page }) => {
    // Create a test
    await page.goto("/create-test");
    const numberInput = page.locator(".count-input");
    await numberInput.fill("3");
    await numberInput.press("Tab");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/tests\/\d+\/run/, { timeout: 10000 });

    // Go back and click the test card (uses onClick, not <a>)
    await page.goto("/");
    const card = page.locator(".my-test-card").first();
    await expect(card).toBeVisible();
    await card.click();
    await page.waitForURL(/\/tests\/\d+\/run/, { timeout: 10000 });
  });

  test("delete test removes it from list", async ({ page }) => {
    // Create a test
    await page.goto("/create-test");
    const numberInput = page.locator(".count-input");
    await numberInput.fill("1");
    await numberInput.press("Tab");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/tests\/\d+\/run/, { timeout: 10000 });

    await page.goto("/");
    await expect(page.locator(".my-test-card")).toHaveCount(1);

    // Handle confirm dialog
    page.on("dialog", (dialog) => dialog.accept());

    // Delete it
    await page.locator('button[aria-label="Delete saved test"]').click();

    // Should be gone
    await expect(page.locator(".my-test-card")).toHaveCount(0, { timeout: 5000 });
  });

  test("rename test updates display name", async ({ page }) => {
    // Create a test
    await page.goto("/create-test");
    const numberInput = page.locator(".count-input");
    await numberInput.fill("1");
    await numberInput.press("Tab");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/tests\/\d+\/run/, { timeout: 10000 });

    await page.goto("/");

    // Click rename button
    const renameButton = page.locator('.icon-button[aria-label="Rename saved test"]');
    await renameButton.click();

    // Fill new name
    const renameInput = page.locator(".rename-inline-input");
    await expect(renameInput).toBeVisible();
    await renameInput.fill("My Custom Test Name");

    // Save
    await page.locator('.icon-button[aria-label="Save test name"]').click();

    // Name should be updated
    await expect(page.locator(".test-title")).toContainText("My Custom Test Name");
  });

  test("progress persists across page reloads", async ({ page }) => {
    // Create and partially answer
    await page.goto("/create-test");
    const numberInput = page.locator(".count-input");
    await numberInput.fill("3");
    await numberInput.press("Tab");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/tests\/\d+\/run/, { timeout: 10000 });

    // Answer first question
    await expect(page.locator(".stem-loading")).not.toBeVisible({ timeout: 10000 });
    await page.locator(".option-button").first().click();
    await page.waitForTimeout(1000);

    // Reload page
    const url = page.url();
    await page.goto(url);

    // Progress should be restored — answered count should not be 0
    await expect(page.locator(".session-stat-row")).not.toContainText("0 / 3");
  });
});
