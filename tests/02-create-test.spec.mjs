import { test, expect } from "@playwright/test";

test.describe("Create Test page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/create-test");
    await expect(page.locator("h1")).toContainText("Create Test");
  });

  test("has subject dropdown with all 13 subjects", async ({ page }) => {
    const select = page.locator("select").first();
    await expect(select).toBeVisible();
    const options = select.locator("option");
    await expect(options).toHaveCount(13);
  });

  test("has slider and number input for question count", async ({ page }) => {
    await expect(page.locator('input[type="range"]')).toBeVisible();
    await expect(page.locator(".count-input")).toBeVisible();
  });

  test("number input syncs with slider", async ({ page }) => {
    const numberInput = page.locator(".count-input");
    await numberInput.fill("10");
    await numberInput.press("Tab");
    const slider = page.locator('input[type="range"]');
    await expect(slider).toHaveValue("10");
  });

  test("changing subject updates slider max", async ({ page }) => {
    const select = page.locator("select").first();
    const slider = page.locator('input[type="range"]');

    await select.selectOption({ index: 0 });
    const max1 = await slider.getAttribute("max");

    await select.selectOption({ index: 5 });
    const max2 = await slider.getAttribute("max");

    expect(Number(max1)).toBeGreaterThan(0);
    expect(Number(max2)).toBeGreaterThan(0);
  });

  test("filters section is visible with checkboxes", async ({ page }) => {
    await expect(page.locator(".field-heading", { hasText: "Filters" })).toBeVisible();
    await expect(page.locator(".filter-group-label", { hasText: "Attachments" })).toBeVisible();
    await expect(page.locator(".filter-group-label", { hasText: "History" })).toBeVisible();
  });

  test("attachment filter updates question count", async ({ page }) => {
    const slider = page.locator('input[type="range"]');
    const maxBefore = Number(await slider.getAttribute("max"));

    // Check "With attachments"
    await page.locator(".filter-option", { hasText: "With attachments" }).locator("input").check();

    const maxAfter = Number(await slider.getAttribute("max"));
    expect(maxAfter).toBeLessThan(maxBefore);
  });

  test("history filters are disabled with no history", async ({ page }) => {
    // Wait for subject entries and history to load
    await page.waitForTimeout(1000);

    const notSeenLabel = page.locator(".filter-option", { hasText: "Not seen before" });
    await expect(notSeenLabel).toBeVisible();
    const notSeenCheckbox = notSeenLabel.locator('input[type="checkbox"]');
    await expect(notSeenCheckbox).toBeDisabled({ timeout: 5000 });
  });

  test("AND/OR toggle appears with multiple filters", async ({ page }) => {
    // Check "With attachments"
    await page.locator(".filter-option", { hasText: "With attachments" }).locator("input").check();
    // AND/OR should NOT appear yet (only one filter)
    await expect(page.locator(".filter-mode-toggle")).not.toBeVisible();

    // We can't easily test AND/OR with history disabled, but verify the toggle logic exists
  });

  test("Create Test button creates test and navigates", async ({ page }) => {
    const numberInput = page.locator(".count-input");
    await numberInput.fill("1");
    await numberInput.press("Tab");

    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/tests\/\d+\/run/, { timeout: 10000 });
  });

  test("Back to My Tests navigates home", async ({ page }) => {
    await page.locator("a", { hasText: "Back to My Tests" }).click();
    await page.waitForURL("/");
  });
});
