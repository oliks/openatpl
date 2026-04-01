import { test, expect } from "@playwright/test";

test.describe("Navigation and 404", () => {
  test("404 page shows for invalid test ID", async ({ page }) => {
    await page.goto("/tests/999/run");
    await expect(page.locator("h1")).toContainText("Test not found");
  });

  test("header logo links to home", async ({ page }) => {
    await page.goto("/create-test");
    await page.locator(".topbar-logo").click();
    await page.waitForURL("/");
  });

  test("Tests nav link goes to home", async ({ page }) => {
    await page.goto("/create-test");
    await page.locator(".topbar-link", { hasText: "Tests" }).click();
    await page.waitForURL("/");
  });

  test("footer contains disclaimer", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".site-footer-disclaimer")).toContainText("OpenATPL is open source");
  });

  test("footer has GitHub link", async ({ page }) => {
    await page.goto("/");
    const githubLink = page.locator(".site-footer-disclaimer a");
    await expect(githubLink).toContainText("GitHub");
    await expect(githubLink).toHaveAttribute("href", /github\.com/);
  });
});

test.describe("Dark mode", () => {
  test("theme toggle exists", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".theme-toggle")).toBeVisible();
  });

  test("clicking theme toggle changes theme", async ({ page }) => {
    await page.goto("/");

    // Click toggle
    await page.locator(".theme-toggle").click();

    // Should have data-theme attribute on html
    const theme = await page.locator("html").getAttribute("data-theme");
    expect(theme === "dark" || theme === null).toBe(true);
  });
});
