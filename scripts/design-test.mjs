import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

// Reuse disposable fixtures from integration-test.mjs; never use production services.
const base = process.env.TEST_API_URL ?? "http://127.0.0.1:4000";
const output = process.env.TEST_OUTPUT_DIR;
if (!output || !["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw new Error("Provide local TEST_API_URL and disposable TEST_OUTPUT_DIR");
const state = JSON.parse(await readFile(`${output}/state.json`, "utf8"));
const results = [];
async function request(path, method = "GET", body, token = state.admin) {
  const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
}
function check(name, test) {
  try { test(); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, passed: false, reason: error.message }); console.log(`FAIL ${name}: ${error.message}`); }
}
const active = await request("/api/incidents?status=active");
check("Active incident filter includes problems and acknowledged incidents", () => { assert.equal(active.status, 200); assert.ok(active.data.data.some(item => item.status === "problem")); assert.ok(active.data.data.some(item => item.status === "acknowledged")); assert.ok(active.data.data.every(item => item.status !== "resolved")); });
const incident = await request(`/api/incidents/${state.incidentB.id}`);
check("Incident detail includes a readable acknowledgement actor", () => assert.equal(incident.data.acknowledgedByName, "QA Administrator"));
const eventIncident = await request(`/api/incidents/${state.incidentA.id}`);
check("Incident event actor names are attached to detail results", () => assert.ok(eventIncident.data.events.some(event => event.createdByName === "QA Administrator")));
const reports = await request("/api/reports");
check("Report list includes generated-by names", () => assert.ok(reports.data.data.some(report => report.generatedByName === "QA Administrator")));
const audit = await request("/api/audit-logs?limit=50");
check("Audit entries include readable user names", () => assert.ok(audit.data.data.some(log => log.userName === "QA Administrator")));
const auditOptions = await request("/api/audit-logs/options");
check("Audit filter options contain actual action and resource values", () => { assert.equal(auditOptions.status, 200); assert.ok(auditOptions.data.actions.includes(audit.data.data[0].action)); assert.ok(auditOptions.data.resources.includes(audit.data.data[0].resource)); assert.ok(auditOptions.data.users.some(user => user.name === "QA Administrator")); });
const filteredAudit = await request(`/api/audit-logs?action=${encodeURIComponent(audit.data.data[0].action)}&resource=${encodeURIComponent(audit.data.data[0].resource)}`);
check("Selected audit action and resource filters return matching entries", () => { assert.ok(filteredAudit.data.data.length > 0); assert.ok(filteredAudit.data.data.every(log => log.action === audit.data.data[0].action && log.resource === audit.data.data[0].resource)); });
const futureAudit = await request("/api/audit-logs?from=2099-01-01T00%3A00%3A00Z&to=2099-01-02T00%3A00%3A00Z");
check("Audit date range filters exclude observations outside the range", () => assert.equal(futureAudit.data.pagination.total, 0));
const privateAuditOptions = await request("/api/audit-logs/options", "GET", undefined, state.viewer.token);
check("Audit filter metadata remains restricted to administrators", () => assert.equal(privateAuditOptions.status, 403));
const restrictedReports = await request("/api/reports", "GET", undefined, state.viewer.token);
check("Report name enrichment preserves resource scope", () => assert.ok(restrictedReports.data.data.every(report => !report.content.deviceIds.includes(state.b.id))));
const grid = { colSpan: 6, boardColumnSpan: 2, rowSpan: 5, columnOffset: { 1: 0, 2: 0, 4: 2 }, order: 1 };
const created = await request("/api/dashboards", "POST", { name: "QA Design Layout", isShared: true, widgets: [{ widgetType: "metric", config: { deviceId: state.a.id, metric: "cpu" }, gridPosition: grid }, { widgetType: "text", config: { title: "Notes", text: "Layout fixture" }, gridPosition: { order: 0, colSpan: 6 } }] });
check("Dashboard accepts responsive Board layout metadata", () => assert.equal(created.status, 201));
if (created.status === 201) {
  try {
    const dashboard = await request(`/api/dashboards/${created.data.id}`);
    check("Dashboard respects persisted widget ordering", () => assert.equal(dashboard.data.widgets[0].widgetType, "text"));
    check("Dashboard retains dimensions and breakpoint offsets", () => assert.deepEqual(dashboard.data.widgets[1].gridPosition, grid));
    const updatedGrid = { ...grid, rowSpan: 3, columnOffset: { 4: 0 } };
    const update = await request(`/api/dashboards/${created.data.id}`, "PUT", { widgets: [{ widgetType: "metric", config: { deviceId: state.a.id, metric: "cpu" }, gridPosition: updatedGrid }] });
    check("Dashboard accepts resized layout updates", () => assert.equal(update.status, 200));
    const reloaded = await request(`/api/dashboards/${created.data.id}`);
    check("Resized layout persists after a fresh request", () => assert.deepEqual(reloaded.data.widgets[0].gridPosition, updatedGrid));
    const denied = await request(`/api/dashboards/${created.data.id}`, "PUT", { name: "Viewer edit" }, state.viewer.token);
    check("Shared dashboard viewer cannot save owner changes", () => assert.equal(denied.status, 404));
    const invalid = await request(`/api/dashboards/${created.data.id}`, "PUT", { widgets: [{ widgetType: "text", config: {}, gridPosition: { boardColumnSpan: 99 } }] });
    check("Out-of-range Board dimensions are rejected", () => assert.equal(invalid.status, 400));
    const unauthorized = await request("/api/dashboards", "POST", { name: "Denied metric", widgets: [{ widgetType: "metric", config: { deviceId: state.b.id, metric: "cpu" } }] }, state.viewer.token);
    check("Layout changes preserve metric device access checks", () => assert.ok([403, 404].includes(unauthorized.status)));
  } finally { await request(`/api/dashboards/${created.data.id}`, "DELETE"); }
}
for (const type of ["availability", "performance", "alert_summary"]) {
  const report = await request("/api/reports/generate", "POST", { type, period: "daily", deviceIds: [state.a.id] });
  check(`Typed ${type} report retains observed data`, () => { assert.equal(report.status, 201); assert.deepEqual(report.data.content.deviceIds, [state.a.id]); assert.equal(report.data.type, type); });
}
const ai = await request("/api/ai/query", "POST", { query: "List devices" });
check("AI query still returns typed result rows", () => { assert.equal(ai.status, 200); assert.equal(ai.data.type, "data"); assert.ok(ai.data.columns.includes("name")); });
const chat = await request("/api/ai/chat", "POST", { message: "What should I check?", incidentId: state.incidentA.id });
check("Incident assistance still responds through the mock provider", () => { assert.equal(chat.status, 200); assert.ok(chat.data.response); });
const jobs = await request("/api/discovery/jobs");
check("Discovery history remains a structured job collection", () => { assert.equal(jobs.status, 200); assert.ok(Array.isArray(jobs.data.data)); });
const channel = await request(`/api/notifications/test/${state.okChannel.id}`, "POST");
check("Configured mock notification can be tested", () => assert.equal(channel.status, 200));
await writeFile(`${output}/design-results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify({ passed: results.filter(result => result.passed).length, failed: results.filter(result => !result.passed).length }));
if (results.some(result => !result.passed)) process.exitCode = 1;
