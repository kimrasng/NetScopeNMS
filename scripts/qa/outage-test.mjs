import { readFile, writeFile } from 'node:fs/promises';
import postgres from 'postgres';
import Redis from 'ioredis';
import { Queue } from 'bullmq';

const out = process.env.TEST_OUTPUT_DIR ?? '/qa';
if (new URL(process.env.TEST_DATABASE_URL ?? '').pathname !== '/netpulse_qa') throw new Error('Dedicated QA database required');
const phase = process.argv[2];
if (!['prepare', 'offline', 'recover'].includes(phase)) throw new Error('Choose prepare, offline or recover');
const account = JSON.parse(await readFile(`${out}/state.json`, 'utf8'));
const db = postgres(process.env.TEST_DATABASE_URL);
const redis = new Redis(process.env.TEST_REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue('device-polling', { connection: redis });
const saved = phase === 'prepare' ? { results: [] } : JSON.parse(await readFile(`${out}/outage-state.json`, 'utf8'));
const check = (name, passed) => { saved.results.push({ name, passed: Boolean(passed) }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); };
const until = async predicate => { const deadline = Date.now() + 30000; while (Date.now() < deadline) { if (await predicate()) return true; await new Promise(resolve => setTimeout(resolve, 300)); } return false; };
async function request(path, method = 'GET', body) {
  const response = await fetch((process.env.TEST_API_URL ?? 'http://127.0.0.1:4000') + path, { method, headers: { Authorization: `Bearer ${account.admin}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.ok) throw new Error(`QA request failed: ${response.status}`);
  return response.json();
}
async function sample() {
  const timestamp = new Date();
  await queue.add(`qa-outage-${phase}`, { deviceId: saved.deviceId }, { removeOnComplete: true });
  return until(async () => (await db`select device_id from metrics where device_id=${saved.deviceId} and metric_name='ping' and timestamp>=${timestamp}`).length > 0);
}
try {
  if (phase === 'prepare') {
    try {
      const previous = JSON.parse(await readFile(`${out}/outage-state.json`, 'utf8'));
      if (previous.deviceId) await request(`/api/devices/${previous.deviceId}`, 'PUT', { pollingEnabled: false });
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    // The separate ICMP-only device isolates reachability from SNMP timeout behavior.
    const device = await request('/api/devices', 'POST', { name: 'QA Docker Outage', ip: '172.28.240.16', type: 'server', tags: ['qa-outage'], pollingEnabled: false, pollingInterval: 86400 });
    saved.deviceId = device.id;
    const channel = await request('/api/notifications/channels', 'POST', { name: 'QA Docker Outage In-App', type: 'in_app', config: {} });
    saved.channelId = channel.id;
    const rule = await request('/api/alert-rules', 'POST', { name: 'QA Docker Reachability', deviceId: device.id, metricName: 'ping', operator: '<', threshold: 1, flapThreshold: 1, channels: [channel.id] });
    saved.ruleId = rule.id;
    await request(`/api/devices/${device.id}`, 'PUT', { pollingEnabled: true });
    check('Running Linux container produces a real ICMP sample', await sample());
    check('Running Linux container is reachable and Up', (await request(`/api/devices/${device.id}`)).status === 'up');
  } else if (phase === 'offline') {
    check('Stopped Linux container produces a completed worker sample', await sample());
    check('Stopped Linux container is Down', (await request(`/api/devices/${saved.deviceId}`)).status === 'down');
    check('Real ICMP failure creates an incident and notification', await until(async () => (await db`select n.id from notifications n join incidents i on i.id=n.incident_id where i.rule_id=${saved.ruleId} and i.status='problem' and n.status='sent' and n.payload->>'event'='trigger'`).length === 1));
    await sample();
    check('Repeated ICMP failure does not duplicate the alert', (await db`select id from incidents where rule_id=${saved.ruleId} and status<>'resolved'`).length === 1 && (await db`select n.id from notifications n join incidents i on i.id=n.incident_id where i.rule_id=${saved.ruleId} and n.payload->>'event'='trigger'`).length === 1);
  } else {
    check('Restarted Linux container produces a completed worker sample', await sample());
    check('Real ICMP recovery resolves the incident and sends recovery', await until(async () => (await db`select n.id from notifications n join incidents i on i.id=n.incident_id where i.rule_id=${saved.ruleId} and i.status='resolved' and n.status='sent' and n.payload->>'event'='resolved'`).length === 1));
    await sample();
    check('Restarted Linux container returns to Up', (await request(`/api/devices/${saved.deviceId}`)).status === 'up');
  }
} catch (error) { check(`Docker outage ${phase} completed (${error.message})`, false); }
finally {
  if (phase === 'recover' && saved.deviceId) await request(`/api/devices/${saved.deviceId}`, 'PUT', { pollingEnabled: false });
  await queue.close(); redis.disconnect(); await db.end();
  await writeFile(`${out}/outage-state.json`, JSON.stringify(saved, null, 2), { mode: 0o600 });
  await writeFile(`${out}/outage-results.json`, JSON.stringify({ generatedAt: new Date().toISOString(), phase, passed: saved.results.filter(result => result.passed).length, failed: saved.results.filter(result => !result.passed).length, results: saved.results }, null, 2));
  process.exitCode = saved.results.some(result => !result.passed) ? 1 : 0;
}
