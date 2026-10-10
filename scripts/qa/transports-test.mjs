import http from 'node:http';
import net from 'node:net';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import postgres from 'postgres';
import Redis from 'ioredis';
import { Queue } from 'bullmq';

const out = process.env.TEST_OUTPUT_DIR ?? '/qa';
if (!process.env.TEST_DATABASE_URL?.includes('/netpulse_qa') || !process.env.QA_TRANSPORT_MOCK_URL) throw new Error('QA-only API with transport redirect required');
const state = JSON.parse(await readFile(`${out}/state.json`, 'utf8'));
const db = postgres(process.env.TEST_DATABASE_URL);
const redis = new Redis(process.env.TEST_REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue('metric-events', { connection: redis });
const results = [], received = [], smtpMessages = [];
let rejectHttp = false;
const check = (name, passed) => { results.push({ name, passed: Boolean(passed) }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); };
const until = async predicate => { const deadline = Date.now() + 20000; while (Date.now() < deadline) { if (await predicate()) return true; await new Promise(resolve => setTimeout(resolve, 200)); } return false; };
const server = http.createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  let body; try { body = JSON.parse(raw || '{}'); } catch { body = Object.fromEntries(new URLSearchParams(raw)); }
  received.push({ path: req.url, body });
  res.setHeader('Content-Type', 'application/json');
  if (rejectHttp) { res.writeHead(503); res.end('{"error":"Intentional QA rejection"}'); return; }
  if (/openai|anthropic|googleapis|\/custom/.test(req.url)) {
    const prompts = JSON.stringify(body);
    const text = prompts.includes('database expert') ? JSON.stringify({ type: 'sql', sql: 'SELECT id, name, status FROM devices ORDER BY name', explanation: 'QA SQL' }) : prompts.includes('root cause analysis') ? JSON.stringify({ rootCause: 'QA CPU saturation', confidence: 90, affectedScope: ['QA Router A'], remediation: ['Inspect load'], urgency: 'high', summary: 'QA structured RCA' }) : prompts.includes('report writer') ? 'QA health report narrative' : 'OK QA provider response';
    const response = req.url.includes('googleapis') ? { candidates: [{ content: { parts: [{ text }] } }] } : req.url.includes('anthropic') ? { content: [{ type: 'text', text }] } : { choices: [{ message: { content: text } }] };
    res.end(JSON.stringify(response)); return;
  }
  res.end(JSON.stringify({ ok: true, result: { message_id: received.length }, status: 'success' }));
});
await new Promise(resolve => server.listen(14572, '127.0.0.1', resolve));
const smtp = net.createServer(socket => {
  let buffer = '', message = '', inData = false;
  socket.on('error', () => {}); socket.write('220 QA SMTP ready\r\n');
  socket.on('data', chunk => {
    buffer += chunk;
    while (buffer.includes('\r\n')) {
      const position = buffer.indexOf('\r\n'), line = buffer.slice(0, position); buffer = buffer.slice(position + 2);
      if (inData) { if (line === '.') { smtpMessages.push(message); message = ''; inData = false; socket.write('250 Accepted\r\n'); } else message += line + '\r\n'; continue; }
      if (/^EHLO|^HELO/.test(line)) socket.write('250-QA\r\n250 AUTH PLAIN\r\n');
      else if (/^AUTH/.test(line)) socket.write('235 Authenticated\r\n');
      else if (/^DATA/.test(line)) { inData = true; socket.write('354 End with dot\r\n'); }
      else if (/^QUIT/.test(line)) socket.end('221 Bye\r\n');
      else socket.write('250 OK\r\n');
    }
  });
});
await new Promise(resolve => smtp.listen(12525, '127.0.0.1', resolve));
await writeFile('/qa/mock-transports-enabled', 'QA-only local substitutes', { mode: 0o600 });
const providers = [], channels = [];
let transportDeviceId;
async function request(path, method = 'GET', body) {
  const response = await fetch((process.env.TEST_API_URL ?? 'http://127.0.0.1:4000') + path, { method, headers: { Authorization: `Bearer ${state.admin}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, data: await response.json() };
}
try {
  for (const type of ['openai', 'gemini', 'claude', 'custom']) {
    const provider = await request('/api/ai/providers', 'POST', { name: `QA HTTP ${type}`, type, apiKey: 'qa-synthetic-only', model: 'qa-model', baseUrl: type === 'custom' ? 'http://127.0.0.1:14572/custom' : undefined, isDefault: true });
    providers.push(provider.data.id);
    check(`${type}: provider API registration`, provider.status === 201);
    check(`${type}: connection test through real local HTTP`, (await request(`/api/ai/providers/${provider.data.id}/test`, 'POST')).data.ok === true);
    const query = await request('/api/ai/query', 'POST', { query: 'List devices' });
    check(`${type}: SQL query executes and returns rows`, query.status === 200 && query.data.data?.length > 0);
    check(`${type}: incident RCA is persisted`, (await request(`/api/ai/rca/${state.incidentA.id}`, 'POST')).data.rca?.summary === 'QA structured RCA');
    check(`${type}: incident chat responds`, (await request('/api/ai/chat', 'POST', { incidentId: state.incidentA.id, message: 'Explain the CPU fault' })).status === 200);
    const report = await request('/api/reports/generate', 'POST', { type: 'ai_narrative', period: 'daily' });
    check(`${type}: AI report narrative stored`, report.status === 201 && Boolean(report.data.aiSummary));
    rejectHttp = true;
    check(`${type}: provider 503 is reported as failed connection`, (await request(`/api/ai/providers/${provider.data.id}/test`, 'POST')).data.ok === false);
    rejectHttp = false;
  }
  await request(`/api/ai/providers/${state.provider.id}`, 'PUT', { isDefault: true });
  const inputs = [
    { type: 'telegram', config: { botToken: 'qa-synthetic-bot', chatId: 'qa-synthetic-chat' } },
    { type: 'discord', config: { webhookUrl: 'http://127.0.0.1:14572/discord' } },
    { type: 'slack', config: { webhookUrl: 'http://127.0.0.1:14572/slack' } },
    { type: 'sms', config: { twilio: { sid: 'qa-synthetic', token: 'qa-synthetic', from: '+10000000000' }, to: '+10000000001' } },
    { type: 'pagerduty', config: { routingKey: 'qa-synthetic' } },
    { type: 'webhook', config: { url: 'http://127.0.0.1:14572/webhook', headers: { 'X-QA': 'qa-header' } } },
    { type: 'email', config: { smtp: { host: '127.0.0.1', port: 12525, user: 'qa@example.test', pass: 'qa-synthetic' }, to: 'recipient@example.test' } },
    { type: 'in_app', config: {} },
  ];
  for (const input of inputs) {
    const created = await request('/api/notifications/channels', 'POST', { ...input, name: `QA Transport ${input.type}` });
    channels.push(created.data.id);
    check(`${input.type}: channel registered`, created.status === 201);
    const sent = await request(`/api/notifications/test/${created.data.id}`, 'POST');
    check(`${input.type}: test transport delivered and persisted`, sent.status === 200 && (await db`select id from notifications where id=${sent.data.notificationId} and status='sent'`).length === 1);
    if (!['email', 'in_app'].includes(input.type)) {
      rejectHttp = true;
      const failed = await request(`/api/notifications/test/${created.data.id}`, 'POST');
      check(`${input.type}: HTTP rejection records error and pending retry`, failed.status === 502 && (await db`select id from notifications where id=${failed.data.notificationId} and status='pending' and attempts=1 and error is not null`).length === 1);
      rejectHttp = false;
      check(`${input.type}: outbox retry recovers`, await until(async () => (await db`select id from notifications where id=${failed.data.notificationId} and status='sent' and attempts>=2`).length === 1));
    }
  }
  const device = (await request('/api/devices', 'POST', { name: 'QA_Transport_[Device] <A&B>', ip: '172.28.240.17', pollingEnabled: true, pollingInterval: 86400 })).data;
  transportDeviceId = device.id;
  const rule = (await request('/api/alert-rules', 'POST', { name: 'QA All Transports CPU', deviceId: device.id, metricName: 'qa_transport_cpu', operator: '>', threshold: 80, flapThreshold: 1, channels })).data;
  await queue.add('qa-all-transports-trigger', { deviceId: device.id, metricName: 'qa_transport_cpu', value: 95, timestamp: new Date().toISOString() });
  check('All eight channels receive a threshold trigger', await until(async () => Number((await db`select count(*) as count from notifications n join incidents i on i.id=n.incident_id where i.rule_id=${rule.id} and n.status='sent' and n.payload->>'event'='trigger'`)[0].count) === 8));
  await queue.add('qa-all-transports-recover', { deviceId: device.id, metricName: 'qa_transport_cpu', value: 20, timestamp: new Date().toISOString() });
  check('All eight channels receive threshold recovery', await until(async () => Number((await db`select count(*) as count from notifications n join incidents i on i.id=n.incident_id where i.rule_id=${rule.id} and n.status='sent' and n.payload->>'event'='resolved'`)[0].count) === 8));
  check('Telegram receives escaped HTML and recovery label', received.some(entry => entry.path.includes('telegram') && entry.body.parse_mode === 'HTML' && entry.body.text.includes('Recovery') && entry.body.text.includes('&lt;A&amp;B&gt;')));
  check('PagerDuty recovery uses resolve with stable incident deduplication', received.some(entry => entry.path.includes('pagerduty') && entry.body.event_action === 'resolve' && entry.body.dedup_key));
  check('Authenticated local SMTP receives test, trigger and recovery', smtpMessages.length === 3);
} catch (error) { results.push({ name: 'Transport scenario completed', passed: false, error: error.message }); console.error('FAIL Transport scenario:', error.message); }
finally {
  rejectHttp = false;
  if (transportDeviceId) await request(`/api/devices/${transportDeviceId}`, 'PUT', { pollingEnabled: false });
  for (const id of channels) await request(`/api/notifications/channels/${id}`, 'PUT', { enabled: false });
  for (const id of providers) await request(`/api/ai/providers/${id}`, 'DELETE');
  await request(`/api/ai/providers/${state.provider.id}`, 'PUT', { isDefault: true });
  await unlink('/qa/mock-transports-enabled');
  await queue.close(); redis.disconnect(); await db.end();
  await new Promise(resolve => server.close(resolve)); await new Promise(resolve => smtp.close(resolve));
  await writeFile(`${out}/transport-results.json`, JSON.stringify({ generatedAt: new Date().toISOString(), scope: 'Local HTTP and SMTP substitutes; no live vendors contacted', passed: results.filter(result => result.passed).length, failed: results.filter(result => !result.passed).length, httpRequests: received.length, smtpMessages: smtpMessages.length, results }, null, 2));
  process.exitCode = results.some(result => !result.passed) ? 1 : 0;
}
