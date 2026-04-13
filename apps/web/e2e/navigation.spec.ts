import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("redirects unauthenticated user to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth\/login|\/setup/);
  });

  test("login page renders form fields", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.locator('input[type="email"], input[name="email"], input[placeholder*="mail"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("login page has submit button", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login")')).toBeVisible();
  });
});
