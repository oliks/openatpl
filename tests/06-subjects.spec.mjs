import { test, expect } from "@playwright/test";

const SUBJECTS = [
  { id: "010", name: "Air Law" },
  { id: "021", name: "Airframe" },
  { id: "022", name: "Instrumentation" },
  { id: "031", name: "Mass and Balance" },
  { id: "032", name: "Performance" },
  { id: "033", name: "Flight Planning" },
  { id: "040", name: "Human Performance" },
  { id: "050", name: "Meteorology" },
  { id: "061", name: "General Navigation" },
  { id: "062", name: "Radio Navigation" },
  { id: "070", name: "Operational Procedures" },
  { id: "081", name: "Principles of Flight" },
  { id: "090", name: "Communications" },
];

test.describe("All subjects load correctly", () => {
  for (const subject of SUBJECTS) {
    test(`${subject.id} - ${subject.name} loads and serves questions`, async ({ page }) => {
      await page.goto("/");
      await page.evaluate(() => localStorage.clear());
      await page.goto("/create-test");

      // Select subject
      const select = page.locator("select").first();
      await select.selectOption(subject.id);

      // Set count to 1
      const numberInput = page.locator(".count-input");
      await numberInput.fill("1");
      await numberInput.press("Tab");

      // Create test
      await page.locator('button[type="submit"]').click();
      await page.waitForURL(/\/tests\/\d+\/run/, { timeout: 10000 });

      // Verify question loads
      await expect(page.locator(".chip").first()).toContainText("Question 1 / 1");
      await expect(page.locator(".stem-loading")).not.toBeVisible({ timeout: 10000 });
      await expect(page.locator(".stem")).toBeVisible();

      // Verify options are present
      const options = page.locator(".option-button");
      const count = await options.count();
      expect(count).toBeGreaterThanOrEqual(2);

      // Answer the question
      await options.first().click();

      // Should show correct/wrong
      const hasResult = await page.locator(".option-correct, .option-wrong").count();
      expect(hasResult).toBeGreaterThan(0);
    });
  }
});

test.describe("Subject API", () => {
  for (const subject of SUBJECTS) {
    test(`/api/subject?id=${subject.id} returns entries`, async ({ request }) => {
      const res = await request.get(`/api/subject?id=${subject.id}`);
      expect(res.ok()).toBe(true);

      const data = await res.json();
      expect(data.entries).toBeDefined();
      expect(Array.isArray(data.entries)).toBe(true);
      expect(data.entries.length).toBeGreaterThan(0);

      // Each entry should have id and hasAttachment
      const first = data.entries[0];
      expect(first.id).toBeDefined();
      expect(typeof first.hasAttachment).toBe("boolean");
    });
  }

  test("returns 400 for invalid subject", async ({ request }) => {
    const res = await request.get("/api/subject?id=invalid");
    expect(res.status()).toBe(400);
  });

  test("returns 404 for nonexistent subject", async ({ request }) => {
    const res = await request.get("/api/subject?id=999");
    expect(res.status()).toBe(404);
  });
});

test.describe("Question API", () => {
  test("returns question data", async ({ request }) => {
    const res = await request.get("/api/question?subject=010&file=questions/0002.json");
    expect(res.ok()).toBe(true);

    const data = await res.json();
    expect(data.stemHtml).toBeDefined();
    expect(data.options).toBeDefined();
    expect(data.correctOption).toBeDefined();
  });

  test("rejects path traversal", async ({ request }) => {
    const res = await request.get("/api/question?subject=010&file=../../package.json");
    expect(res.status()).toBe(400);
  });

  test("returns 404 for missing question", async ({ request }) => {
    const res = await request.get("/api/question?subject=010&file=questions/9999.json");
    expect(res.status()).toBe(404);
  });
});
