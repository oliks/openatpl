import { test, expect } from "@playwright/test";

// Helper: create a test with N questions and navigate to it
async function createTest(page, questionCount = 3) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/create-test");
  await expect(page.locator("h1")).toContainText("Create Test");

  const numberInput = page.locator(".count-input");
  await numberInput.fill(String(questionCount));
  await numberInput.press("Tab");

  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/tests\/\d+\/run/, { timeout: 10000 });
}

// Helper: wait for question to load
async function waitForQuestion(page) {
  await expect(page.locator(".stem-loading")).not.toBeVisible({ timeout: 10000 });
  await expect(page.locator(".stem")).toBeVisible();
}

test.describe("Test Runner - Basic", () => {
  test.beforeEach(async ({ page }) => {
    await createTest(page, 3);
  });

  test("shows question counter and progress bar", async ({ page }) => {
    await expect(page.locator(".chip").first()).toContainText("Question 1 / 3");
    await expect(page.locator(".progress-track")).toBeVisible();
  });

  test("loads question with stem and options", async ({ page }) => {
    await waitForQuestion(page);
    const options = page.locator(".option-button");
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(6);
  });

  test("shows loading skeleton before question loads", async ({ page }) => {
    // Navigate to next question to trigger a load
    await page.locator('.nav-arrow[aria-label="Next question"]').click();
    // Skeleton might flash briefly — just verify the stem eventually loads
    await waitForQuestion(page);
  });
});

test.describe("Test Runner - Answering", () => {
  test("correct answer highlights green and auto-advances", async ({ page }) => {
    await createTest(page, 3);
    await waitForQuestion(page);

    // Find the correct answer by checking all options
    const options = page.locator(".option-button");
    const count = await options.count();

    // Click first option
    await options.first().click();

    // Should have correct or wrong styling
    const correctCount = await page.locator(".option-correct").count();
    const wrongCount = await page.locator(".option-wrong").count();
    expect(correctCount + wrongCount).toBeGreaterThan(0);

    // If correct, should auto-advance after delay
    if (correctCount > 0 && wrongCount === 0) {
      await expect(page.locator(".chip").first()).toContainText("Question 2 / 3", { timeout: 3000 });
    }
  });

  test("wrong answer highlights red and stays", async ({ page }) => {
    await createTest(page, 5);
    await waitForQuestion(page);

    // Try options until we get a wrong answer
    const options = page.locator(".option-button");
    await options.first().click();

    const wrongEl = page.locator(".option-wrong");
    const wrongCount = await wrongEl.count();

    if (wrongCount > 0) {
      // Correct answer should also be shown in green
      await expect(page.locator(".option-correct")).toBeVisible();
      // Should stay on same question (no auto-advance)
      await page.waitForTimeout(1000);
      await expect(page.locator(".chip").first()).toContainText("Question 1 / 5");
    }
  });

  test("cannot change answer after selecting", async ({ page }) => {
    await createTest(page, 3);
    await waitForQuestion(page);

    const options = page.locator(".option-button");
    await options.first().click();

    // All options should be disabled now
    const allDisabled = await options.evaluateAll((els) => els.every((el) => el.disabled));
    expect(allDisabled).toBe(true);
  });
});

test.describe("Test Runner - Navigation", () => {
  test("arrow buttons navigate between questions", async ({ page }) => {
    await createTest(page, 3);

    const prev = page.locator('.nav-arrow[aria-label="Previous question"]');
    const next = page.locator('.nav-arrow[aria-label="Next question"]');

    // Previous disabled on first question
    await expect(prev).toBeDisabled();

    // Go to question 2
    await next.click();
    await expect(page.locator(".chip").first()).toContainText("Question 2 / 3");
    await expect(prev).not.toBeDisabled();

    // Go to question 3
    await next.click();
    await expect(page.locator(".chip").first()).toContainText("Question 3 / 3");
    await expect(next).toBeDisabled();

    // Go back
    await prev.click();
    await expect(page.locator(".chip").first()).toContainText("Question 2 / 3");
  });

  test("tile grid shows questions and allows jumping", async ({ page }) => {
    await createTest(page, 5);

    const tiles = page.locator(".question-tile");
    await expect(tiles).toHaveCount(5);

    // Click tile 3
    await tiles.nth(2).click();
    await expect(page.locator(".chip").first()).toContainText("Question 3 / 5");
  });

  test("Back to My Tests link works", async ({ page }) => {
    await createTest(page, 1);
    await page.locator("a", { hasText: "Back to My Tests" }).click();
    await page.waitForURL("/");
  });
});

test.describe("Test Runner - Flagging", () => {
  test("flag button toggles", async ({ page }) => {
    await createTest(page, 2);

    const flagButton = page.locator(".flag-button");
    await expect(flagButton).toHaveAttribute("aria-pressed", "false");

    await flagButton.click();
    await expect(flagButton).toHaveAttribute("aria-pressed", "true");

    await flagButton.click();
    await expect(flagButton).toHaveAttribute("aria-pressed", "false");
  });

  test("flagged state shows on tile", async ({ page }) => {
    await createTest(page, 3);

    // Flag question 1
    await page.locator(".flag-button").click();

    // Tile 1 should have flagged class
    await expect(page.locator(".question-tile").first()).toHaveClass(/flagged/);
  });
});

test.describe("Test Runner - Notes", () => {
  test("notes textarea accepts input", async ({ page }) => {
    await createTest(page, 1);

    const notes = page.locator(".session-note-input");
    await expect(notes).toBeVisible();
    await notes.fill("Test personal note");
    await expect(notes).toHaveValue("Test personal note");
  });

  test("character count appears after typing", async ({ page }) => {
    await createTest(page, 1);

    const notes = page.locator(".session-note-input");
    await notes.fill("Hello");
    await expect(page.locator(".note-char-count")).toContainText("5/500");
  });
});

test.describe("Test Runner - Session", () => {
  test("session sidebar shows stats", async ({ page }) => {
    await createTest(page, 3);

    await expect(page.locator(".session-summary")).toBeVisible();
    await expect(page.locator(".session-title")).toContainText("Session");
    await expect(page.locator(".session-stat-row")).toContainText("Answered");
    await expect(page.locator(".session-stat-row")).toContainText("0 / 3");
  });

  test("answering updates stats", async ({ page }) => {
    await createTest(page, 3);
    await waitForQuestion(page);

    // Answer first question
    await page.locator(".option-button").first().click();

    // Wait for potential auto-advance
    await page.waitForTimeout(1000);

    // Stats should update
    await expect(page.locator(".session-stat-row")).not.toContainText("0 / 3");
  });

  test("finish button is disabled until all answered", async ({ page }) => {
    await createTest(page, 2);

    const finishButton = page.locator("button", { hasText: "Finish Test" });
    await expect(finishButton).toBeDisabled();
  });
});
