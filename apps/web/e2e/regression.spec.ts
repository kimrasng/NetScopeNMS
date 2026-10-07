import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, email = "qa-admin@example.test") {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill("QA-local-2026!");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/(dashboard|dashboards)/);
}
test("stored reports and historical availability are visible", async ({ page }) => {
  await login(page); await page.goto("/reports");
  await page.getByRole("button", { name: "availability Report - daily", exact: true }).click();
  await page.getByRole("button", { name: "availability", exact: true }).click();
  await expect(page.getByText(/53\.846/)).toBeVisible();
});
test("notification history renders persisted delivery results", async ({ page }) => {
  await login(page); await page.goto("/notifications");
  await page.getByRole("tab", { name: "히스토리", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("Sent");
  await expect(page.getByRole("table")).toContainText("Failed");
});
test("metric selection, anomaly rows and prediction response render", async ({ page }) => {
  await login(page); await page.goto("/metrics");
  await page.getByRole("button", { name: "Device Select a device", exact: true }).click();
  await page.getByRole("option", { name: "QA Router A (127.0.0.1)", exact: true }).click();
  await page.getByRole("button", { name: "24h", exact: true }).click();
  await page.getByRole("button", { name: "조회", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("99.00");
  await page.getByRole("button", { name: "예측 실행", exact: true }).click();
  await expect(page.getByText("Current Trend", { exact: true })).toBeVisible();
});
test("dashboard widgets survive saving and reloading", async ({ page }) => {
  await login(page); await page.goto("/dashboards");
  await page.getByRole("button", { name: "대시보드 생성", exact: true }).first().click();
  await page.getByLabel("대시보드명", { exact: true }).fill("E2E Dashboard");
  await page.getByRole("button", { name: "생성", exact: true }).click();
  await page.getByRole("link", { name: "E2E Dashboard", exact: true }).click();
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
  await page.getByLabel("질문을 입력하세요", { exact: true }).fill("List devices");
  await page.getByRole("button", { name: "질문하기", exact: true }).click();
  await expect(page.getByRole("table").first()).toContainText("QA Router A");
});
test("viewer controls and direct administration access are restricted", async ({ page }) => {
  await login(page, "qa-viewer@example.test"); await page.goto("/devices");
  await expect(page.getByRole("button", { name: "디바이스 추가", exact: true }).first()).toBeDisabled();
  await expect(page.getByRole("table")).toContainText("QA Router A");
  await expect(page.getByRole("table")).not.toContainText("QA Switch B");
  await page.goto("/settings/users");
  await expect(page.getByText("Your current role or resource scope does not allow this page.", { exact: true })).toBeVisible();
});
