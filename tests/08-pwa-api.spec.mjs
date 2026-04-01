import { test, expect } from "@playwright/test";

test.describe("Bulk questions API", () => {
  test("POST /api/subject/questions returns requested questions", async ({ request }) => {
    const res = await request.post("/api/subject/questions", {
      data: { id: "010", ids: ["010-0002", "010-0003", "010-0004"] },
    });
    expect(res.ok()).toBe(true);

    const data = await res.json();
    expect(data.questions).toBeDefined();
    expect(data.questions.length).toBe(3);

    for (const q of data.questions) {
      expect(q.stemHtml).toBeDefined();
      expect(q.options).toBeDefined();
      expect(q._file).toBeDefined();
    }
  });

  test("POST /api/subject/questions returns all when no ids", async ({ request }) => {
    const res = await request.post("/api/subject/questions", {
      data: { id: "090" },
    });
    expect(res.ok()).toBe(true);

    const data = await res.json();
    expect(data.questions.length).toBeGreaterThan(0);
  });

  test("POST /api/subject/questions returns 400 for invalid subject", async ({ request }) => {
    const res = await request.post("/api/subject/questions", {
      data: { id: "invalid" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/subject/questions returns 404 for missing subject", async ({ request }) => {
    const res = await request.post("/api/subject/questions", {
      data: { id: "999" },
    });
    expect(res.status()).toBe(404);
  });

  test("handles large ID lists", async ({ request }) => {
    // Generate 100 IDs
    const ids = [];
    for (let i = 2; i <= 101; i++) {
      ids.push(`010-${String(i).padStart(4, "0")}`);
    }

    const res = await request.post("/api/subject/questions", {
      data: { id: "010", ids },
    });
    expect(res.ok()).toBe(true);

    const data = await res.json();
    expect(data.questions.length).toBe(100);
  });
});

test.describe("PWA manifest and service worker", () => {
  test("manifest.json is served", async ({ request }) => {
    const res = await request.get("/manifest.json");
    expect(res.ok()).toBe(true);

    const data = await res.json();
    expect(data.name).toContain("OpenATPL");
    expect(data.short_name).toBe("OpenATPL");
    expect(data.display).toBe("standalone");
    expect(data.icons.length).toBeGreaterThanOrEqual(4);
  });

  test("service worker is served", async ({ request }) => {
    const res = await request.get("/sw.js");
    expect(res.ok()).toBe(true);

    const text = await res.text();
    expect(text).toContain("openatpl-shell");
    expect(text).toContain("openatpl-offline");
  });

  test("PWA icons are served", async ({ request }) => {
    for (const icon of ["icon-192.png", "icon-512.png", "icon-192-maskable.png", "icon-512-maskable.png"]) {
      const res = await request.get(`/${icon}`);
      expect(res.ok()).toBe(true);
    }
  });
});
