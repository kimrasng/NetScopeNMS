import { test, expect, type Request } from "@playwright/test";

test.beforeEach(async () => {
  const delay = Number(process.env.QA_BROWSER_PACE_MS ?? 0);
  if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
});

const routes = ["dashboard", "devices", "device-groups", "incidents", "topology", "maps", "metrics", "alert-rules", "notifications", "maintenance", "config-snapshots", "ai", "reports", "dashboards", "discovery", "settings/users", "settings/site", "settings/api-keys", "settings/audit-logs", "settings/profile", "settings/preferences"];
for (const route of routes) {
  test(`QA authenticated page ${route} loads without runtime or API errors`, async ({ page, request }, testInfo) => {
    const login = await request.post(`${process.env.TEST_API_URL ?? "http://localhost:4000"}/api/auth/login`, { data: { email: "qa-admin@example.test", password: "QA-local-2026!" } });
    expect(login.ok()).toBe(true);
    const account: { token: string } = await login.json();
    await page.addInitScript(token => localStorage.setItem("netpulse_token", token), account.token);
    const errors: string[] = [];
    const pending = new Set<Request>();
    page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) pending.add(request); });
    page.on("requestfinished", request => pending.delete(request));
    page.on("requestfailed", request => {
      pending.delete(request);
      if (new URL(request.url()).pathname.startsWith("/api/") && request.failure()?.errorText !== "net::ERR_ABORTED") errors.push(`Network failure ${new URL(request.url()).pathname}`);
    });
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => { if (response.url().includes("/api/") && response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
    await page.goto(`/${route}`);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    if (route === "dashboard") {
      await expect(page).toHaveURL(/\/dashboards\/[^/]+$/);
      await expect(page.getByText("Verified widget content", { exact: true })).toBeVisible();
    }
    if (route === "topology") await expect(page.locator(".react-flow__node").first()).toBeVisible();
    if (route === "maps") await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.locator("body")).not.toContainText("Request failed");
    // Wait for REST data and chart rendering without blocking on socket polling.
    await expect.poll(() => [...pending].map(request => new URL(request.url()).pathname), { timeout: 15000 }).toEqual([]);
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(page.getByText("Loading chart", { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
    await testInfo.attach("screen", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await testInfo.attach("rendered-text", { body: await page.locator("body").innerText(), contentType: "text/plain" });
  });
}
test("QA Docker devices are searchable and detail exposes collected data", async ({ page, request }) => {
  const login = await request.post(`${process.env.TEST_API_URL ?? "http://localhost:4000"}/api/auth/login`, { data: { email: "qa-admin@example.test", password: "QA-local-2026!" } });
  const account: { token: string } = await login.json();
  await page.addInitScript(token => localStorage.setItem("netpulse_token", token), account.token);
  await page.goto("/devices");
  const search = page.getByPlaceholder("Filter devices", { exact: true });
  await search.fill("QA-Cisco");
  await expect(page.getByRole("table")).toContainText("QA-Cisco");
  await page.getByRole("link", { name: "QA-Cisco", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("QA-Cisco");
  await page.getByRole("tab", { name: "Interfaces", exact: true }).click();
  await expect(page.locator("body")).toContainText("GigabitEthernet1/0/5");
});
