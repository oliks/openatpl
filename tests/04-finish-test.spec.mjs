import { test, expect } from "@playwright/test";

async function createAndAnswerAll(page, questionCount = 1) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/create-test");

  const numberInput = page.locator(".count-input");
  await numberInput.fill(String(questionCount));
  await numberInput.press("Tab");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/tests\/\d+\/run/, { timeout: 10000 });

  // Answer all questions
  for (let i = 0; i < questionCount; i++) {
    // Wait for question to load
    await expect(page.locator(".stem-loading")).not.toBeVisible({ timeout: 10000 });

    // Click first option
    await page.locator(".option-button").first().click();

    // Wait for auto-advance or navigate manually
    if (i < questionCount - 1) {
      await page.waitForTimeout(800);
      const chip = await page.locator(".chip").first().textContent();
      // If didn't auto-advance (wrong answer), click next
      if (chip.includes(`Question ${i + 1}`)) {
        await page.locator('.nav-arrow[aria-label="Next question"]').click();
      }
    }
  }
}

test.describe("Finish Test", () => {
  test("finish button enables after all questions answered", async ({ page }) => {
    await createAndAnswerAll(page, 1);

    const finishButton = page.locator("button", { hasText: "Finish Test" });
    await expect(finishButton).not.toBeDisabled({ timeout: 5000 });
  });

  test("clicking finish shows result screen", async ({ page }) => {
    await createAndAnswerAll(page, 1);

    const finishButton = page.locator("button", { hasText: "Finish Test" });
    await expect(finishButton).not.toBeDisabled({ timeout: 5000 });
    await finishButton.click();

    // Should show pass/fail screen
    const heading = page.locator(".finish-heading");
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text === "Pass" || text === "Fail").toBe(true);
  });

  test("finish screen has close button", async ({ page }) => {
    await createAndAnswerAll(page, 1);

    await page.locator("button", { hasText: "Finish Test" }).click();
    await expect(page.locator(".finish-heading")).toBeVisible({ timeout: 5000 });

    // Close button should exist
    const closeButton = page.locator(".finish-screen .icon-button");
    await expect(closeButton).toBeVisible();
    await closeButton.click();

    // Finish screen should close
    await expect(page.locator(".finish-heading")).not.toBeVisible();
  });
});
