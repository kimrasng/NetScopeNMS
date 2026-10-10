import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import postgres from 'postgres';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { pollDevice, snmpGet } from '../../packages/polling-engine/src/index.ts';

const out = process.env.TEST_OUTPUT_DIR ?? '/qa';
const base = process.env.TEST_API_URL ?? 'http://127.0.0.1:4000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname) || !process.env.TEST_DATABASE_URL?.includes('/netpulse_qa')) throw new Error('QA lab services required');
const profiles = ['cisco', 'juniper', 'arista', 'hpe', 'huawei', 'ubuntu', 'rocky'];
const address = profile => `172.28.240.${11 + profiles.indexOf(profile)}`;
const results = [];
const check = (name, passed, detail = {}) => { results.push({ name, passed: Boolean(passed), detail }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); };
const control = async (profile, path = '/health', body) => {
  const response = await fetch(`http://${address(profile)}:8080${path}`, { ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error('QA control failed');
  return response.json();
};
const until = async (predicate, timeout = 25000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await predicate()) return true; await new Promise(resolve => setTimeout(resolve, 250)); }
  return false;
};
if (process.argv.includes('--probe')) {
  for (const profile of profiles) {
    const result = await pollDevice({ id: profile, ip: address(profile), snmpCommunity: 'qa-lab', snmpVersion: 'v2c', snmpPort: 1161 });
    check(`${profile}: CPU 24%`, result.metrics.some(metric => metric.name === 'cpu' && metric.value === 24), { metrics: result.metrics });
    check(`${profile}: RAM 40%`, result.metrics.some(metric => metric.name === 'memory' && metric.value === 40));
    check(`${profile}: sparse interfaces 5/9`, result.interfaces?.map(iface => iface.ifIndex).join(',') === '5,9');
  }
  await writeFile(`${out}/${process.argv.includes('--after') ? 'vendor-probe' : 'vendor-baseline'}.json`, JSON.stringify({ generatedAt: new Date().toISOString(), results, passed: results.filter(result => result.passed).length, failed: results.filter(result => !result.passed).length }, null, 2));
  process.exit(results.some(result => !result.passed) ? 1 : 0);
}
const state = JSON.parse(await readFile(`${out}/state.json`, 'utf8'));
const db = postgres(process.env.TEST_DATABASE_URL);
const redis = new Redis(process.env.TEST_REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue('device-polling', { connection: redis });
const deliveries = [];
let rejectDelivery = false;
const receiver = http.createServer(async (req, res) => { let raw = ''; for await (const chunk of req) raw += chunk; deliveries.push(JSON.parse(raw)); res.writeHead(rejectDelivery ? 503 : 200); res.end('{}'); });
await new Promise(resolve => receiver.listen(14570, '0.0.0.0', resolve));
async function request(path, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${state.admin}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, data: await response.json() };
}
const devices = [];
try {
  // Recreate only this harness's devices in the dedicated QA database.
  const previous = (await request('/api/devices?limit=200')).data.data.filter(device => device.tags?.includes('qa-docker'));
  for (const device of previous) await request(`/api/devices/${device.id}`, 'DELETE');
  const group = (await request('/api/device-groups', 'POST', { name: 'QA Docker Multi-vendor' })).data;
  const channel = (await request('/api/notifications/channels', 'POST', { name: 'QA Docker Receiver', type: 'webhook', config: { url: 'http://127.0.0.1:14570/' } })).data;
  for (const profile of profiles) {
    await control(profile, '/state', { cpu: 24, memory: 40, revision: 1, interfaceDown: false });
    const credentials = await control(profile, '/credentials');
    const identity = await snmpGet(address(profile), 'qa-lab', ['1.3.6.1.2.1.1.1.0', '1.3.6.1.2.1.1.2.0', '1.3.6.1.2.1.1.5.0'], 1161, 'v2c');
    check(`${profile}: distinct SNMP identity`, String(identity['1.3.6.1.2.1.1.1.0']).toLowerCase().includes(profile === 'hpe' ? 'hpe' : profile));
    const created = await request('/api/devices', 'POST', { name: (await control(profile)).name, ip: address(profile), type: ['ubuntu', 'rocky'].includes(profile) ? 'server' : 'switch', groupId: group.id, tags: ['qa-docker', profile], snmpVersion: 'v2c', snmpCommunity: 'qa-lab', snmpPort: 1161, pollingEnabled: false, pollingInterval: 30, sshPort: 2222, sshUsername: credentials.username, sshPrivateKey: credentials.privateKey, sshHostFingerprint: credentials.fingerprint });
    check(`${profile}: API registration and secret masking`, created.status === 201 && created.data.sshKeyConfigured && !JSON.stringify(created.data).includes('PRIVATE KEY') && !created.data.snmpCommunity);
    const device = { ...created.data, profile }; devices.push(device);
    const snapshot = await request('/api/config-snapshots/capture', 'POST', { deviceId: device.id });
    check(`${profile}: real SSH snapshot`, snapshot.status === 201 && snapshot.data.configText.includes(device.name));
    await control(profile, '/state', { revision: 2 });
    const second = await request('/api/config-snapshots/capture', 'POST', { deviceId: device.id });
    check(`${profile}: SSH configuration diff`, second.status === 201 && second.data.diff.includes('QA revision 2'));
    await request(`/api/devices/${device.id}`, 'PUT', { pollingEnabled: true });
    const sample = await until(async () => (await db`select device_id from metrics where device_id=${device.id} and metric_name='cpu' and value=24`).length > 0);
    check(`${profile}: queued CPU collection`, sample);
    check(`${profile}: queued RAM excludes swap/disk`, (await db`select device_id from metrics where device_id=${device.id} and metric_name='memory' and value=40`).length > 0);
    check(`${profile}: persisted sparse interface identity`, (await db`select if_index from interfaces where device_id=${device.id} order by if_index`).map(row => row.if_index).join(',') === '5,9');
    await request(`/api/devices/${device.id}`, 'PUT', { snmpVersion: 'v3', snmpV3Config: { username: 'qa-v3', securityLevel: 'authPriv', authProtocol: 'SHA', authKey: 'qa-auth-only', privProtocol: 'AES', privKey: 'qa-privacy-only' } });
    const before = new Date();
    await queue.add('qa-vendor-v3', { deviceId: device.id }, { removeOnComplete: true });
    check(`${profile}: SNMPv3 SHA/AES encrypted polling`, await until(async () => (await db`select device_id from metrics where device_id=${device.id} and metric_name='cpu' and timestamp>=${before}`).length > 0));
    check(`${profile}: actual v2c/v3 packets`, (await control(profile)).versions.includes(1) && (await control(profile)).versions.includes(3));
    const rule = (await request('/api/alert-rules', 'POST', { name: `QA ${profile} CPU`, metricName: 'cpu', operator: '>', threshold: 80, deviceId: device.id, flapThreshold: 1, channels: [channel.id] })).data;
    await control(profile, '/state', { cpu: 95, interfaceDown: true });
    await queue.add('qa-vendor-fault', { deviceId: device.id }, { removeOnComplete: true });
    check(`${profile}: CPU fault creates incident and sends notification`, await until(async () => (await db`select n.id from notifications n join incidents i on n.incident_id=i.id where i.device_id=${device.id} and i.rule_id=${rule.id} and i.status='problem' and n.status='sent' and n.payload->>'event'='trigger'`).length === 1));
    check(`${profile}: interface link-down collected`, (await db`select status from interfaces where device_id=${device.id} and if_index=5`)[0]?.status === 'down');
    await control(profile, '/state', { cpu: 24, interfaceDown: false });
    await queue.add('qa-vendor-recovery', { deviceId: device.id }, { removeOnComplete: true });
    check(`${profile}: recovery resolves incident and delivers`, await until(async () => (await db`select n.id from notifications n join incidents i on n.incident_id=i.id where i.device_id=${device.id} and i.rule_id=${rule.id} and i.status='resolved' and n.status='sent' and n.payload->>'event'='resolved'`).length === 1));
    check(`${profile}: interface link-up recovered`, (await db`select status from interfaces where device_id=${device.id} and if_index=5`)[0]?.status === 'up');
    check(`${profile}: real bandwidth counters yield traffic`, await until(async () => { await queue.add('qa-bandwidth', { deviceId: device.id }, { removeOnComplete: true }); return (await db`select device_id from metrics where device_id=${device.id} and metric_name='bandwidth_in' and value>0`).length > 0; }));
    const metricApi = await request(`/api/metrics?deviceId=${device.id}&metric=cpu`);
    check(`${profile}: collected metric available through REST`, metricApi.status === 200 && metricApi.data.data.length > 0);
  }
  for (const device of devices) {
    const discovery = await request('/api/discovery/run', 'POST', { deviceId: device.id });
    const neighborIp = address(profiles[(profiles.indexOf(device.profile) + 1) % profiles.length]);
    check(`${device.profile}: LLDP/ARP discovery job`, await until(async () => (await request('/api/discovery/jobs')).data.data.some(job => job.id === discovery.data.jobId && job.state === 'completed' && job.result?.neighborsFound?.some(neighbor => neighbor.ip === neighborIp))));
  }
  check('Seven physical relationships persisted in topology', (await request('/api/topology/graph')).data.edges.filter(edge => devices.some(device => device.id === edge.sourceDeviceId)).length >= 7);
  rejectDelivery = true;
  const failed = await request(`/api/notifications/test/${channel.id}`, 'POST');
  check('Docker webhook failure is visible immediately', failed.status === 502);
  rejectDelivery = false;
  check('Docker webhook retry succeeds and persists attempts', await until(async () => (await db`select id from notifications where id=${failed.data.notificationId} and status='sent' and attempts>=2`).length === 1));
  await request(`/api/devices/${devices[5].id}`, 'PUT', { snmpVersion: 'v1' });
  await queue.add('qa-v1', { deviceId: devices[5].id }, { removeOnComplete: true });
  check('SNMPv1 wire selection works on Linux profile', await until(async () => (await control('ubuntu')).versions.includes(0)));
  for (const profile of profiles) check(`${profile}: agent protocol errors absent`, (await control(profile)).errors.length === 0);
} catch (error) { check('Multi-vendor scenario completed', false, { error: error.message }); }
finally {
  for (const device of devices) await request(`/api/devices/${device.id}`, 'PUT', { pollingEnabled: false });
  await queue.close(); redis.disconnect(); await db.end(); await new Promise(resolve => receiver.close(resolve));
  await writeFile(`${out}/vendor-state.json`, JSON.stringify({ devices }, null, 2), { mode: 0o600 });
  await writeFile(`${out}/multivendor-results.json`, JSON.stringify({ generatedAt: new Date().toISOString(), passed: results.filter(result => result.passed).length, failed: results.filter(result => !result.passed).length, deliveries: deliveries.length, results }, null, 2));
  process.exitCode = results.some(result => !result.passed) ? 1 : 0;
}
