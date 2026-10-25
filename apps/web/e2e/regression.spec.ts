import { test, expect, type Page } from "@playwright/test";
test.beforeEach(async () => {
  const delay = Number(process.env.QA_BROWSER_PACE_MS ?? 0);
  if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
});
async function login(page: Page, email = "qa-admin@example.test") {
  await page.addInitScript(() => localStorage.setItem("netpulse_locale", "en"));
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("QA-local-2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/(dashboard|dashboards)/);
}
test("stored reports and historical availability are visible", async ({ page }) => {
  await login(page); await page.goto("/reports");
  await page.getByRole("button", { name: /Availability.*Daily|availability Report - daily/i }).first().click();
  await expect(page.getByRole("dialog")).toContainText("53.85%");
});
test("notification history renders persisted delivery results", async ({ page }) => {
  await login(page); await page.goto("/notifications");
  const firstResponse = page.waitForResponse(response => response.url().includes("/api/notifications/history") && response.request().method() === "GET");
  await page.getByRole("tab", { name: "History", exact: true }).click();
  const history: { pagination: { totalPages: number } } = await (await firstResponse).json();
  await expect(page.getByRole("table")).toContainText("Sent");
  for (let index = 2; index <= history.pagination.totalPages && !(await page.getByRole("table").innerText()).includes("Failed"); index++) {
    const nextResponse = page.waitForResponse(response => response.url().includes("/api/notifications/history") && new URL(response.url()).searchParams.get("page") === String(index));
    await page.getByRole("button", { name: /next page/i }).click();
    expect((await nextResponse).ok()).toBe(true);
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  }
  await expect(page.getByRole("table")).toContainText("Failed");
});
test("metric selection, anomaly rows and prediction response render", async ({ page }) => {
  await login(page); await page.goto("/metrics");
  await page.getByRole("button", { name: "Device Select a device", exact: true }).click();
  await page.getByRole("option", { name: "QA Router A (127.0.0.1)", exact: true }).click();
  await page.getByRole("button", { name: "Query", exact: true }).click();
  await page.getByRole("button", { name: "Anomaly Detection", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("99 %");
  await page.getByRole("button", { name: "Prediction", exact: true }).click();
  const response = page.waitForResponse(value => value.url().includes("/api/metrics/predict"));
  await page.getByRole("button", { name: "Run Prediction", exact: true }).click();
  expect((await response).ok()).toBe(true);
  await expect(page.getByText(/Current average|No reliable prediction|Insufficient data|No increasing trend/i).first()).toBeVisible();
});
test("dashboard widgets survive saving and reloading", async ({ page }) => {
  const name = `E2E Dashboard ${Date.now()}`;
  await login(page); await page.goto("/dashboards");
  await page.getByRole("button", { name: "Create Dashboard", exact: true }).first().click();
  await page.getByLabel("Dashboard Name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("link", { name, exact: true }).click();
  await page.getByRole("button", { name: "Edit dashboard", exact: true }).click();
  await page.getByRole("button", { name: "Add widget", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("E2E live summary");
  await page.getByRole("button", { name: "Apply widget", exact: true }).click();
  await page.getByRole("button", { name: "Save dashboard", exact: true }).click();
  await expect(page.getByText("Dashboard saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "E2E live summary", exact: true })).toBeVisible();
});
test("AI query displays data columns and result rows", async ({ page }) => {
  await login(page); await page.goto("/ai");
  await page.getByRole("textbox", { name: "Enter your question", exact: true }).fill("List devices");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByRole("table").first()).toContainText("QA Extra 01");
  await expect(page.getByRole("table").first()).toContainText("name");
});
test("viewer controls and direct administration access are restricted", async ({ page }) => {
  await login(page, "qa-viewer@example.test"); await page.goto("/devices");
  await expect(page.getByRole("button", { name: "Create device", exact: true }).first()).toBeDisabled();
  await expect(page.getByRole("table")).toContainText("QA Router A");
  await expect(page.getByRole("table")).not.toContainText("QA Switch B");
  await page.goto("/settings/users");
  await expect(page.getByText("Your current role or resource scope does not allow this page.", { exact: true })).toBeVisible();
});
