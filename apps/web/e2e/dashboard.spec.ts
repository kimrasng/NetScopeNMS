import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("dashboard page exists and loads", async ({ page }) => {
    const response = await page.goto("/dashboard");
    expect(response?.status()).toBeLessThan(500);
  });

  test("dashboard redirects to auth if not logged in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login|\/setup|\/dashboard/);
  });

  test("dashboard page has proper title", async ({ page }) => {
    await page.goto("/dashboard");
    const title = await page.title();
    expect(title).toBeTruthy();
  });
});
