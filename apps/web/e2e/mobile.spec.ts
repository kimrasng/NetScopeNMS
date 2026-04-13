import { test, expect } from "@playwright/test";

test.describe("Mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("login page has no horizontal scroll at 375px", async ({ page }) => {
    await page.goto("/auth/login");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test("dashboard page has no horizontal scroll at 375px", async ({ page }) => {
    await page.goto("/dashboard");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test("root page has no horizontal scroll at 375px", async ({ page }) => {
    await page.goto("/");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
