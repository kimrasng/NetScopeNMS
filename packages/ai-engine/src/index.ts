/**
 * NetPulse AI Engine - Multi-provider AI integration
 * Supports: OpenAI (GPT), Google Gemini, Anthropic Claude, Custom API
 */

// ─── Types ───────────────────────────────────────────

export type AIProviderType = "openai" | "gemini" | "claude" | "custom";

export interface AIProviderConfig {
  type: AIProviderType;
  apiKey: string;
  model?: string;
  baseUrl?: string;
  enabled: boolean;
}

export interface RcaResult {
  rootCause: string;
  confidence: number;
  affectedScope: string[];
  remediation: string[];
  urgency: "critical" | "high" | "medium" | "low";
  summary: string;
}

export interface AnomalyInterpretation {
  description: string;
  possibleCauses: string[];
  recommendation: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface AIResponse {
  text: string;
}

// ─── Provider Implementations ────────────────────────

async function callOpenAI(config: AIProviderConfig, messages: ChatMessage[]): Promise<AIResponse> {
  const model = config.model || "gpt-4o";
  const url = config.baseUrl || "https://api.openai.com/v1/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 4096 }),
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as any;
  return { text: data.choices?.[0]?.message?.content || "" };
}

async function callGemini(config: AIProviderConfig, messages: ChatMessage[]): Promise<AIResponse> {
  const model = config.model || "gemini-2.0-flash";
  const systemMsg = messages.find((m) => m.role === "system");
  const userMsgs = messages.filter((m) => m.role !== "system");
  const contents = userMsgs.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const body: any = { contents, generationConfig: { temperature: 0.3, maxOutputTokens: 4096 } };
  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  if (!res.ok) throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as any;
  return { text: data.candidates?.[0]?.content?.parts?.[0]?.text || "" };
}

async function callClaude(config: AIProviderConfig, messages: ChatMessage[]): Promise<AIResponse> {
  const model = config.model || "claude-sonnet-4-20250514";
  const systemMsg = messages.find((m) => m.role === "system");
  const nonSystemMsgs = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
  const body: any = { model, messages: nonSystemMsgs, max_tokens: 4096, temperature: 0.3 };
  if (systemMsg) body.system = systemMsg.content;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as any;
  return { text: data.content?.[0]?.text || "" };
}

async function callCustom(config: AIProviderConfig, messages: ChatMessage[]): Promise<AIResponse> {
  if (!config.baseUrl) throw new Error("Custom provider requires baseUrl");
  const res = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({ model: config.model || "default", messages, temperature: 0.3, max_tokens: 4096 }),
  });
  if (!res.ok) throw new Error(`Custom API error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as any;
  return { text: data.choices?.[0]?.message?.content || data.text || data.response || "" };
}

// ─── Router ──────────────────────────────────────────

async function callProvider(config: AIProviderConfig, messages: ChatMessage[]): Promise<AIResponse> {
  switch (config.type) {
    case "openai": return callOpenAI(config, messages);
    case "gemini": return callGemini(config, messages);
    case "claude": return callClaude(config, messages);
    case "custom": return callCustom(config, messages);
    default: throw new Error(`Unknown AI provider: ${config.type}`);
  }
}

function parseJSON<T>(text: string, fallback: T): T {
  try {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    if (match) return JSON.parse(match[1].trim());
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

// ─── AI Engine Class ─────────────────────────────────

export class AIEngine {
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  getProviderType(): AIProviderType { return this.config.type; }
  getModel(): string { return this.config.model || "default"; }

  private async call(messages: ChatMessage[]): Promise<string> {
    const result = await callProvider(this.config, messages);
    return result.text;
  }

  async generateRCA(context: {
    incident: { title: string; severity: string; metricName?: string; metricValue?: number; startedAt: string };
    device: { name: string; ip: string; type: string; location?: string };
    recentMetrics?: { time: string; metricName: string; value: number }[];
    similarIncidents?: { title: string; resolution?: string }[];
  }): Promise<RcaResult> {
    const text = await this.call([
      {
        role: "system",
        content: `You are a network operations expert. Analyze the incident and provide root cause analysis.
Return JSON only: { "rootCause": string, "confidence": 0-100, "affectedScope": string[], "remediation": string[], "urgency": "critical"|"high"|"medium"|"low", "summary": string }`,
      },
      {
        role: "user",
        content: `Incident: ${JSON.stringify(context.incident)}
Device: ${JSON.stringify(context.device)}
Recent Metrics (last 5 min): ${JSON.stringify(context.recentMetrics?.slice(0, 30) || [])}
Similar Past Incidents: ${JSON.stringify(context.similarIncidents?.slice(0, 5) || [])}`,
      },
    ]);
    return parseJSON<RcaResult>(text, {
      rootCause: text.slice(0, 500),
      confidence: 50,
      affectedScope: [context.device.name],
      remediation: ["Investigate manually"],
      urgency: (context.incident.severity as any) || "medium",
      summary: text.slice(0, 200),
    });
  }

  async interpretAnomaly(context: {
    device: { name: string; ip: string; type: string };
    metricName: string;
    currentValue: number;
    mean: number;
    stddev: number;
    recentValues?: number[];
  }): Promise<AnomalyInterpretation> {
    const text = await this.call([
      {
        role: "system",
        content: `You are a network monitoring expert. Interpret this anomaly.
Return JSON only: { "description": string, "possibleCauses": string[], "recommendation": string }`,
      },
      {
        role: "user",
        content: `Device: ${context.device.name} (${context.device.ip}, ${context.device.type})
Metric: ${context.metricName}, Current: ${context.currentValue}, Mean: ${context.mean}, StdDev: ${context.stddev}
Recent: ${JSON.stringify(context.recentValues?.slice(0, 20) || [])}`,
      },
    ]);
    return parseJSON<AnomalyInterpretation>(text, {
      description: text.slice(0, 300),
      possibleCauses: ["Unknown"],
      recommendation: "Monitor and investigate",
    });
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    return this.call(messages);
  }

  async naturalLanguageQuery(query: string, dbSchema: string): Promise<{ type: "sql" | "answer"; sql?: string; answer?: string; explanation?: string }> {
    const text = await this.call([
      {
        role: "system",
        content: `You are a database expert. Convert natural language to PostgreSQL SELECT queries.
DB Schema: ${dbSchema}
Return JSON only: { "type": "sql", "sql": "SELECT ...", "explanation": "..." } or { "type": "answer", "answer": "..." }
Only generate SELECT statements. Never modify data.`,
      },
      { role: "user", content: query },
    ]);
    return parseJSON(text, { type: "answer" as const, answer: text });
  }

  async generateReportNarrative(data: {
    period: string;
    incidentCount: number;
    resolvedCount: number;
    avgMttr: number;
    topDevices: { name: string; incidentCount: number }[];
    availability: number;
  }): Promise<string> {
    return this.call([
      { role: "system", content: "You are a network operations report writer. Write a concise, professional network health summary. Plain text only." },
      { role: "user", content: `Report data: ${JSON.stringify(data)}` },
    ]);
  }

  async testConnection(): Promise<{ ok: boolean; error?: string; model?: string }> {
    try {
      const text = await this.call([{ role: "user", content: "Reply with exactly: OK" }]);
      return { ok: text.includes("OK"), model: this.config.model || "default" };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }
}
