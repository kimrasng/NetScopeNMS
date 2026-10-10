import { createServer } from "node:http";
import { it, expect } from "vitest";
import { AIEngine } from "../index.js";

it("cancels a real HTTP provider that accepts a request but never responds", async () => {
  let received = false;
  const server = createServer(request => { received = true; request.resume(); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test address");
    const engine = new AIEngine({ type: "custom", apiKey: "qa-local-only", baseUrl: `http://127.0.0.1:${address.port}`, enabled: true, timeoutMs: 250 });
    const result = await engine.testConnection();
    expect(received).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/timeout|aborted/i);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

it("allows a real HTTP provider to complete within its deadline", async () => {
  const server = createServer((request, response) => {
    request.resume();
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ choices: [{ message: { content: "OK" } }] }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test address");
    const engine = new AIEngine({ type: "custom", apiKey: "qa-local-only", baseUrl: `http://127.0.0.1:${address.port}`, enabled: true, timeoutMs: 2000 });
    expect((await engine.testConnection()).ok).toBe(true);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
