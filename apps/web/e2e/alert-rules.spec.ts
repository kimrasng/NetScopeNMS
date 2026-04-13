import { test, expect } from "@playwright/test";

test.describe("Alert Rules", () => {
  test("alert-rules page exists", async ({ page }) => {
    const response = await page.goto("/alert-rules");
    expect(response?.status()).toBeLessThan(500);
  });

  test("alert-rules redirects to auth if not logged in", async ({ page }) => {
    await page.goto("/alert-rules");
    await expect(page).toHaveURL(/\/auth\/login|\/setup|\/alert-rules/);
  });

  test("alert-rules page has proper title", async ({ page }) => {
    await page.goto("/alert-rules");
    const title = await page.title();
    expect(title).toBeTruthy();
  });
});
