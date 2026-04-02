import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("renders hero section with title and tagline", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("EASA 2020 ECQB Bank Practice");
    await expect(page.locator(".hero-tagline")).toContainText("For Pilots, By Pilots");
    await expect(page.locator(".eyebrow")).toContainText("Open Source ATPL Bank");
  });

  test("header has logo and navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".topbar-logo-icon")).toBeVisible();
    await expect(page.locator(".topbar-logo")).toContainText("OpenATPL");
    await expect(page.locator(".topbar-link")).toContainText("Tests");
  });

  test("Create Test and GitHub buttons are visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".hero-actions a", { hasText: "Create Test" })).toBeVisible();
    await expect(page.locator(".hero-actions a", { hasText: "Get on GitHub" })).toBeVisible();
  });

  test("shows empty state when no saved tests", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator(".hero-actions a", { hasText: "Create Test" })).toBeVisible();
  });
});
