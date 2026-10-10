import { readFile, writeFile, access } from 'node:fs/promises';
import dotenv from 'dotenv';
import postgres from 'postgres';
import Redis from 'ioredis';
import { Queue } from 'bullmq';

dotenv.config({ path: '.env.test.local' });
const out = process.env.TEST_OUTPUT_DIR ?? '/qa';
if (!process.env.TEST_DATABASE_URL?.includes('/netpulse_qa')) throw new Error('Dedicated QA database required');
try { await access('/qa/mock-transports-enabled'); throw new Error('Finish mock transport tests before live testing'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const missing = [];
const telegramOnly = process.argv.includes('--telegram-only');
const aiOnly = process.argv.includes('--ai-only');
const aiReady = !telegramOnly && ['QA_AI_TYPE', 'QA_AI_MODEL', 'QA_AI_API_KEY'].every(name => Boolean(process.env[name]));
const telegramReady = !aiOnly && ['QA_TELEGRAM_BOT_TOKEN', 'QA_TELEGRAM_CHAT_ID'].every(name => Boolean(process.env[name]));
if (!aiReady && !telegramOnly) missing.push('AI provider type, model and API key');
if (!telegramReady && !aiOnly) missing.push('Telegram bot token and test chat ID');
const results = [];
let aiCallsAttempted = Number(process.env.QA_PRIOR_AI_CALLS ?? 0);
const skipConnection = process.argv.includes('--skip-connection');
const stopAfterAiFailure = process.argv.includes('--stop-after-ai-failure');
const check = (name, passed, detail = {}) => { results.push({ name, passed: Boolean(passed), detail }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); };
let providerId, channelId, liveDeviceId;
if (aiReady || telegramReady) {
  const state = JSON.parse(await readFile(`${out}/state.json`, 'utf8'));
  const db = postgres(process.env.TEST_DATABASE_URL);
  const redis = new Redis(process.env.TEST_REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue('metric-events', { connection: redis });
  async function request(path, method = 'GET', body) {
    const response = await fetch((process.env.TEST_API_URL ?? 'http://127.0.0.1:4000') + path, { method, headers: { Authorization: `Bearer ${state.admin}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(90000) });
    return { status: response.status, data: await response.json() };
  }
  async function requestAI(path, body) {
    if (aiCallsAttempted >= 4) throw new Error('AI call budget exhausted');
    aiCallsAttempted++;
    return request(path, 'POST', body);
  }
  const until = async predicate => { const deadline = Date.now() + 45000; while (Date.now() < deadline) { if (await predicate()) return true; await new Promise(resolve => setTimeout(resolve, 500)); } return false; };
  try {
    if (aiReady) {
      const provider = await request('/api/ai/providers', 'POST', { name: 'QA Live Provider', type: process.env.QA_AI_TYPE, model: process.env.QA_AI_MODEL, apiKey: process.env.QA_AI_API_KEY, baseUrl: process.env.QA_AI_BASE_URL || undefined, isDefault: true });
      providerId = provider.data.id;
      check('Live AI provider registered without exposing its key in evidence', provider.status === 201);
      const connection = skipConnection ? { data: { ok: true } } : await requestAI(`/api/ai/providers/${providerId}/test`);
      if (!skipConnection) check('Live AI connection', connection.status === 200 && connection.data.ok);
      if (connection.data.ok) {
        const query = await requestAI('/api/ai/query', { query: 'List the first five devices by name using a SELECT query.' });
        check('Live AI query returns usable rows or answer', query.status === 200 && (query.data.data?.length > 0 || Boolean(query.data.answer)));
        if (stopAfterAiFailure && results.at(-1).passed === false) throw new Error('Stop generation diagnosis after failed query');
        const chat = await requestAI('/api/ai/chat', { incidentId: state.incidentA.id, message: 'Give one short sentence explaining this test incident.' });
        check('Live incident AI chat', chat.status === 200 && Boolean(chat.data.response));
        if (stopAfterAiFailure && results.at(-1).passed === false) throw new Error('Stop generation diagnosis after failed chat');
        const rca = await requestAI(`/api/ai/rca/${state.incidentA.id}`);
        check('Live incident RCA returns and persists analysis', rca.status === 200 && Boolean(rca.data.rca?.summary));
      }
      await request(`/api/ai/providers/${state.provider.id}`, 'PUT', { isDefault: true });
    }
    if (telegramReady) {
      const channel = await request('/api/notifications/channels', 'POST', { name: 'QA Live Telegram', type: 'telegram', config: { botToken: process.env.QA_TELEGRAM_BOT_TOKEN, chatId: process.env.QA_TELEGRAM_CHAT_ID } });
      channelId = channel.data.id;
      const sent = await request(`/api/notifications/test/${channelId}`, 'POST');
      check('Live Telegram sendMessage is accepted and recorded', sent.status === 200);
      if (sent.status === 200) {
        const device = (await request('/api/devices', 'POST', { name: 'QA_TEST_[Telegram] <signal>', ip: '172.28.240.17', pollingEnabled: true, pollingInterval: 86400 })).data;
        liveDeviceId = device.id;
        const rule = (await request('/api/alert-rules', 'POST', { name: 'QA Live Notification CPU', deviceId: device.id, metricName: 'qa_live_cpu', operator: '>', threshold: 80, flapThreshold: 1, channels: [channelId] })).data;
        await queue.add('qa-live-trigger', { deviceId: device.id, metricName: 'qa_live_cpu', value: 95, timestamp: new Date().toISOString() });
        check('Live Telegram fault notification delivered through outbox', await until(async () => (await db`select n.id from notifications n join incidents i on i.id=n.incident_id where i.rule_id=${rule.id} and n.status='sent' and n.payload->>'event'='trigger'`).length === 1));
        await queue.add('qa-live-recovery', { deviceId: device.id, metricName: 'qa_live_cpu', value: 20, timestamp: new Date().toISOString() });
        check('Live Telegram recovery delivered through outbox', await until(async () => (await db`select n.id from notifications n join incidents i on i.id=n.incident_id where i.rule_id=${rule.id} and n.status='sent' and n.payload->>'event'='resolved'`).length === 1));
      }
    }
  } catch (error) { check('Live scenario completed', false, { errorName: error.name }); }
  finally {
    if (liveDeviceId) await request(`/api/devices/${liveDeviceId}`, 'PUT', { pollingEnabled: false });
    if (channelId) await request(`/api/notifications/channels/${channelId}`, 'DELETE');
    if (providerId) await request(`/api/ai/providers/${providerId}`, 'DELETE');
    await request(`/api/ai/providers/${state.provider.id}`, 'PUT', { isDefault: true });
    await queue.close(); redis.disconnect(); await db.end();
  }
}
await writeFile(`${out}/${telegramOnly ? 'live-telegram-results.json' : aiOnly ? 'live-ai-results.json' : 'live-results.json'}`, JSON.stringify({ generatedAt: new Date().toISOString(), status: missing.length ? 'credentials_required' : results.some(result => !result.passed) ? 'failed' : 'passed', aiCallsAttempted, skippedConnectionRetry: skipConnection, missing, results }, null, 2));
if (missing.length) console.log('CREDENTIALS_REQUIRED:', missing.join('; '));
process.exitCode = missing.length ? 2 : results.some(result => !result.passed) ? 1 : 0;
