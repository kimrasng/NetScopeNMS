import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AIEngine } from "../index.js";
import type { AIProviderConfig, RcaResult } from "../index.js";

function makeConfig(overrides: Partial<AIProviderConfig> = {}): AIProviderConfig {
  return {
    type: "openai",
    apiKey: "test-key",
    model: "gpt-4o",
    enabled: true,
    ...overrides,
  };
}

describe("AIEngine", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("parseJSON via generateRCA", () => {
    const rcaContext = {
      incident: { title: "High CPU", severity: "critical", metricName: "cpu", metricValue: 95, startedAt: "2024-01-01T00:00:00Z" },
      device: { name: "router-1", ip: "10.0.0.1", type: "router" },
    };

    it("parses plain JSON response", async () => {
      const jsonResponse: RcaResult = {
        rootCause: "CPU overload due to routing loop",
        confidence: 85,
        affectedScope: ["router-1", "switch-2"],
        remediation: ["Restart OSPF process", "Check routing table"],
        urgency: "critical",
        summary: "Routing loop causing CPU spike",
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(jsonResponse) } }],
        }),
      });

      const engine = new AIEngine(makeConfig());
      const result = await engine.generateRCA(rcaContext);

      expect(result.rootCause).toBe("CPU overload due to routing loop");
      expect(result.confidence).toBe(85);
      expect(result.affectedScope).toEqual(["router-1", "switch-2"]);
      expect(result.remediation).toHaveLength(2);
      expect(result.urgency).toBe("critical");
    });

    it("parses JSON from markdown code block", async () => {
      const markdown = '```json\n{"rootCause":"Memory leak","confidence":70,"affectedScope":["server-1"],"remediation":["Restart service"],"urgency":"high","summary":"Memory leak detected"}\n```';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: markdown } }],
        }),
      });

      const engine = new AIEngine(makeConfig());
      const result = await engine.generateRCA(rcaContext);

      expect(result.rootCause).toBe("Memory leak");
      expect(result.confidence).toBe(70);
      expect(result.urgency).toBe("high");
    });

    it("parses JSON from code block without json tag", async () => {
      const markdown = '```\n{"rootCause":"Disk full","confidence":90,"affectedScope":["db-1"],"remediation":["Clear logs"],"urgency":"critical","summary":"Disk full"}\n```';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: markdown } }],
        }),
      });

      const engine = new AIEngine(makeConfig());
      const result = await engine.generateRCA(rcaContext);

      expect(result.rootCause).toBe("Disk full");
      expect(result.confidence).toBe(90);
    });

    it("returns fallback when response is not valid JSON", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "I cannot determine the root cause from the given data." } }],
        }),
      });

      const engine = new AIEngine(makeConfig());
      const result = await engine.generateRCA(rcaContext);

      expect(result.rootCause).toContain("cannot determine");
      expect(result.confidence).toBe(50);
      expect(result.remediation).toEqual(["Investigate manually"]);
    });
  });

  describe("callProvider routing", () => {
    it("routes to OpenAI provider", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "OK" } }] }),
      });

      const engine = new AIEngine(makeConfig({ type: "openai" }));
      const result = await engine.testConnection();

      expect(result.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledOnce();
      const callUrl = fetchMock.mock.calls[0][0];
      expect(callUrl).toBe("https://api.openai.com/v1/chat/completions");
    });

    it("routes to Gemini provider", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "OK" }] } }],
        }),
      });

      const engine = new AIEngine(makeConfig({ type: "gemini", model: "gemini-2.0-flash" }));
      const result = await engine.testConnection();

      expect(result.ok).toBe(true);
      const callUrl = fetchMock.mock.calls[0][0] as string;
      expect(callUrl).toContain("generativelanguage.googleapis.com");
      expect(callUrl).toContain("gemini-2.0-flash");
    });

    it("routes to Claude provider", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: "OK" }],
        }),
      });

      const engine = new AIEngine(makeConfig({ type: "claude" }));
      const result = await engine.testConnection();

      expect(result.ok).toBe(true);
      const callUrl = fetchMock.mock.calls[0][0] as string;
      expect(callUrl).toBe("https://api.anthropic.com/v1/messages");
    });

    it("routes to custom provider with baseUrl", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "OK" } }] }),
      });

      const engine = new AIEngine(makeConfig({ type: "custom", baseUrl: "http://localhost:11434/v1/chat/completions" }));
      const result = await engine.testConnection();

      expect(result.ok).toBe(true);
      const callUrl = fetchMock.mock.calls[0][0] as string;
      expect(callUrl).toBe("http://localhost:11434/v1/chat/completions");
    });

    it("throws for custom provider without baseUrl", async () => {
      const engine = new AIEngine(makeConfig({ type: "custom", baseUrl: undefined }));
      const result = await engine.testConnection();

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Custom provider requires baseUrl");
    });

    it("throws for unknown provider type", async () => {
      const engine = new AIEngine(makeConfig({ type: "unknown" as any }));
      const result = await engine.testConnection();

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Unknown AI provider");
    });
  });

  describe("testConnection", () => {
    it("returns ok:true when response contains OK", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "OK" } }] }),
      });

      const engine = new AIEngine(makeConfig());
      const result = await engine.testConnection();

      expect(result.ok).toBe(true);
      expect(result.model).toBe("gpt-4o");
    });

    it("returns ok:false when response does not contain OK", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "Hello!" } }] }),
      });

      const engine = new AIEngine(makeConfig());
      const result = await engine.testConnection();

      expect(result.ok).toBe(false);
      expect(result.model).toBe("gpt-4o");
    });

    it("returns ok:false with error on API failure", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      const engine = new AIEngine(makeConfig());
      const result = await engine.testConnection();

      expect(result.ok).toBe(false);
      expect(result.error).toContain("OpenAI API error: 401");
    });

    it("returns ok:false with error on network failure", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network error"));

      const engine = new AIEngine(makeConfig());
      const result = await engine.testConnection();

      expect(result.ok).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("uses default model name when model not specified", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "OK" } }] }),
      });

      const engine = new AIEngine(makeConfig({ model: undefined }));
      const result = await engine.testConnection();

      expect(result.model).toBe("default");
    });
  });

  describe("generateRCA prompt structure", () => {
    it("sends correct system and user messages", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"rootCause":"test","confidence":50,"affectedScope":[],"remediation":[],"urgency":"low","summary":"test"}' } }],
        }),
      });

      const engine = new AIEngine(makeConfig());
      await engine.generateRCA({
        incident: { title: "Test", severity: "low", startedAt: "2024-01-01" },
        device: { name: "dev-1", ip: "1.2.3.4", type: "switch" },
        recentMetrics: [{ time: "12:00", metricName: "cpu", value: 50 }],
        similarIncidents: [{ title: "Past incident", resolution: "Restarted" }],
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe("system");
      expect(body.messages[0].content).toContain("root cause analysis");
      expect(body.messages[1].role).toBe("user");
      expect(body.messages[1].content).toContain("dev-1");
      expect(body.messages[1].content).toContain("1.2.3.4");
    });
  });

  describe("OpenAI request format", () => {
    it("sends correct Authorization header", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "OK" } }] }),
      });

      const engine = new AIEngine(makeConfig({ apiKey: "sk-test-123" }));
      await engine.testConnection();

      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers.Authorization).toBe("Bearer sk-test-123");
    });
  });

  describe("Claude request format", () => {
    it("sends x-api-key and anthropic-version headers", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ text: "OK" }] }),
      });

      const engine = new AIEngine(makeConfig({ type: "claude", apiKey: "sk-ant-test" }));
      await engine.testConnection();

      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers["x-api-key"]).toBe("sk-ant-test");
      expect(headers["anthropic-version"]).toBe("2023-06-01");
    });
  });
});
