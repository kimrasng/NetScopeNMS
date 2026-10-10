import dotenv from 'dotenv';
import { access, readFile, writeFile } from 'node:fs/promises';

dotenv.config({ path: '.env.test.local' });
if (!process.env.TEST_DATABASE_URL?.includes('/netpulse_qa')) throw new Error('Dedicated QA database required');
try { await access('/qa/mock-transports-enabled'); throw new Error('Disable mock redirection before live diagnosis'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const key = process.env.QA_AI_API_KEY;
const model = process.env.QA_AI_MODEL;
if (process.env.QA_AI_TYPE !== 'gemini' || !key || !model) throw new Error('Gemini QA configuration required');
const mode = process.argv[2] ?? 'native-header';
const path = `${process.env.TEST_OUTPUT_DIR ?? '/qa'}/ai-diagnose-results.json`;
let evidence;
try { evidence = JSON.parse(await readFile(path, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; evidence = { additionalGenerationBudget: 4, callsAttempted: 0, results: [] }; }
evidence.callsAttempted = Math.max(evidence.callsAttempted, Number(process.env.QA_PRIOR_AI_CALLS ?? 0));
if (evidence.callsAttempted >= 4) throw new Error('Additional generation budget exhausted');
const root = 'https://generativelanguage.googleapis.com/v1beta';
const prompt = 'Reply with exactly: OK';
const variants = {
  'native-header': { url: `${root}/models/${encodeURIComponent(model)}:generateContent`, headers: { 'x-goog-api-key': key }, body: { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 1, maxOutputTokens: 128, ...(/^gemini-3[.-]/.test(model) ? { thinkingConfig: { thinkingLevel: 'low' } } : {}) } } },
  'openai-compatible': { url: `${root}/openai/chat/completions`, headers: { Authorization: `Bearer ${key}` }, body: { model, messages: [{ role: 'user', content: prompt }], temperature: 1, max_tokens: 128, reasoning_effort: 'low' } },
  interactions: { url: `${root}/interactions`, headers: { 'x-goog-api-key': key }, body: { model, input: prompt, store: false, generation_config: { thinking_level: 'low', max_output_tokens: 128 } } },
};
const request = variants[mode];
if (!request) throw new Error('Unsupported diagnostic mode');
evidence.callsAttempted++;
await writeFile(path, JSON.stringify(evidence, null, 2));
const startedAt = Date.now();
const result = { mode, model, startedAt: new Date(startedAt).toISOString(), status: 'started' };
console.log(`Starting ${mode} generation probe (${evidence.callsAttempted}/4 additional attempts)`);
try {
  const response = await fetch(request.url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...request.headers }, body: JSON.stringify(request.body), signal: AbortSignal.timeout(60000) });
  result.httpStatus = response.status;
  result.headersAfterMs = Date.now() - startedAt;
  const body = await response.json();
  const text = mode === 'openai-compatible' ? body.choices?.[0]?.message?.content : mode === 'interactions' ? body.output_text ?? body.steps?.flatMap(step => step.content ?? []).filter(part => part.type === 'text').map(part => part.text).join('') : body.candidates?.[0]?.content?.parts?.filter(part => !part.thought).map(part => part.text ?? '').join('');
  result.status = response.ok && text?.includes('OK') ? 'passed' : 'failed';
  result.responseTextLength = text?.length ?? 0;
  result.finishReason = body.candidates?.[0]?.finishReason ?? body.choices?.[0]?.finish_reason ?? body.status;
  result.outputTokens = body.usageMetadata?.candidatesTokenCount ?? body.usage?.completion_tokens;
  if (body.error) result.error = { code: body.error.code, status: body.error.status, message: String(body.error.message ?? '').split(key).join('[REDACTED]').slice(0, 1500) };
} catch (error) {
  result.status = 'failed';
  result.errorName = error.name;
  result.errorCode = error.cause?.code;
}
result.elapsedMs = Date.now() - startedAt;
evidence.results.push(result);
evidence.updatedAt = new Date().toISOString();
await writeFile(path, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(result));
process.exitCode = result.status === 'passed' ? 0 : 1;
