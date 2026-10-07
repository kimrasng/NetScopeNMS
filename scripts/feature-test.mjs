import { readFile, writeFile, mkdir } from 'node:fs/promises';
const base = process.env.TEST_API_URL ?? 'http://127.0.0.1:4000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Feature regression requires a local disposable QA API');
const out = process.env.TEST_OUTPUT_DIR ?? '/tmp/netpulse-integration';
const state = JSON.parse(await readFile(out + '/state.json', 'utf8'));
const results = [];
async function request(path, method = 'GET', body, token = state.admin) {
  const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
}
function check(name, passed) { results.push({ name, passed: Boolean(passed) }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); }
try {
  const created = await request('/api/device-groups', 'POST', { name: 'QA CRUD Group', description: 'QA initial' });
  check('Device group creation is available in the running API', created.status === 201);
  const group = created.data;
  check('Restricted group lists exclude unrelated groups', !(await request('/api/device-groups', 'GET', undefined, state.viewer.token)).data.data.some(item => item.id === group.id));
  check('Operator cannot create global groups', (await request('/api/device-groups', 'POST', { name: 'QA denied group' }, state.operator.token)).status === 403);
  check('Group edits persist', (await request(`/api/device-groups/${group.id}`, 'PUT', { description: 'QA edited' })).data.description === 'QA edited');
  check('Group cannot be its own parent', (await request(`/api/device-groups/${group.id}`, 'PUT', { parentId: group.id })).status === 400);
  check('Device group assignment persists', (await request(`/api/devices/${state.b.id}`, 'PUT', { groupId: group.id })).data.groupId === group.id);
  await request(`/api/devices/${state.b.id}`, 'PUT', { groupId: null });
  check('Bodyless group deletion works', (await request(`/api/device-groups/${group.id}`, 'DELETE')).status === 200);
  check('Deleting a missing group returns 404', (await request(`/api/device-groups/${group.id}`, 'DELETE')).status === 404);
  const graph = await request('/api/topology/graph');
  check('Topology graph includes devices beyond the first paginated page', graph.data.nodes.length > 50);
  const edge = await request('/api/topology/edges', 'POST', { sourceDeviceId: state.a.id, targetDeviceId: state.b.id, sourcePort: 'QA-Ethernet5' });
  check('Manual topology connection persists', edge.status === 201 && (await request('/api/topology/graph')).data.edges.some(item => item.id === edge.data.id));
  check('Viewer graph excludes connections to hidden devices', !(await request('/api/topology/graph', 'GET', undefined, state.viewer.token)).data.edges.some(item => item.id === edge.data.id));
  check('Viewer cannot mutate topology connections', (await request('/api/topology/edges', 'POST', { sourceDeviceId: state.a.id, targetDeviceId: state.b.id }, state.viewer.token)).status === 403);
  check('Self topology connection is invalid', (await request('/api/topology/edges', 'POST', { sourceDeviceId: state.a.id, targetDeviceId: state.a.id })).status === 400);
  check('Bodyless topology connection deletion works', (await request(`/api/topology/edges/${edge.data.id}`, 'DELETE')).status === 200);
  const types = ['summary', 'metric', 'incidents', 'throughput', 'top_devices', 'text'];
  const dashboard = await request('/api/dashboards', 'POST', { name: 'QA Six Widgets', isShared: true, widgets: types.map((widgetType, order) => ({ widgetType, config: { title: `QA ${widgetType}`, ...(widgetType === 'metric' ? { deviceId: state.b.id, metric: 'cpu' } : widgetType === 'text' ? { text: 'QA saved text' } : {}) }, gridPosition: { colSpan: 6, order } })) });
  const saved = await request(`/api/dashboards/${dashboard.data.id}`);
  check('All six supported dashboard widget types persist in order', saved.data.widgets.map(widget => widget.widgetType).join(',') === types.join(','));
  check('Shared dashboard omits a metric widget outside reader scope', (await request(`/api/dashboards/${dashboard.data.id}`, 'GET', undefined, state.viewer.token)).data.widgets.length === 5);
  check('Readers cannot edit another user shared dashboard', (await request(`/api/dashboards/${dashboard.data.id}`, 'PUT', { name: 'QA denied edit' }, state.viewer.token)).status === 404);
  check('Metric widgets require a device and metric', (await request('/api/dashboards', 'POST', { name: 'QA invalid metric', widgets: [{ widgetType: 'metric' }] })).status === 400);
  const window = await request('/api/maintenance-windows', 'POST', { name: 'QA recurring group maintenance', groupIds: [state.group.id], startAt: new Date(Date.now() + 86400000).toISOString(), endAt: new Date(Date.now() + 90000000).toISOString(), recurring: true, cronExpression: '0 2 * * *', timezone: 'Asia/Seoul' });
  check('Recurring maintenance persists timezone and group scope', window.status === 201 && window.data.timezone === 'Asia/Seoul' && window.data.groupIds[0] === state.group.id);
  check('Upcoming recurring maintenance reports inactive state', (await request(`/api/maintenance-windows/${window.data.id}`)).data.isActive === false);
  check('Group-scoped viewer sees its maintenance window', (await request(`/api/maintenance-windows/${window.data.id}`, 'GET', undefined, state.groupViewer.token)).status === 200);
  check('Invalid IANA maintenance timezone is rejected', (await request(`/api/maintenance-windows/${window.data.id}`, 'PUT', { timezone: 'Invalid/Zone' })).status === 400);
  await request(`/api/maintenance-windows/${window.data.id}`, 'PUT', { startAt: new Date(Date.now() - 172800000).toISOString(), endAt: new Date(Date.now() - 169200000).toISOString(), cronExpression: '* * * * *' });
  check('A later recurrence reports active state after the original dates end', (await request(`/api/maintenance-windows/${window.data.id}`)).data.isActive === true);
  check('Disabling recurrence persists', (await request(`/api/maintenance-windows/${window.data.id}`, 'PUT', { recurring: false })).data.recurring === false);
  check('Disabling recurrence removes active state for an ended window', (await request(`/api/maintenance-windows/${window.data.id}`)).data.isActive === false);
  check('Bodyless maintenance deletion works', (await request(`/api/maintenance-windows/${window.data.id}`, 'DELETE')).status === 200);
  const audit = (await request('/api/audit-logs?limit=100')).data.data;
  check('Audit covers new group and topology mutations', audit.some(item => item.resource === 'device-groups') && audit.some(item => item.resource === 'topology'));
} catch (error) { check(error instanceof Error ? error.message : 'Unexpected regression failure', false); }
finally {
  await mkdir(out, { recursive: true });
  const summary = { generatedAt: new Date().toISOString(), results, passed: results.filter(result => result.passed).length, failed: results.filter(result => !result.passed).length };
  await writeFile(out + '/feature-results.json', JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ passed: summary.passed, failed: summary.failed }));
  process.exitCode = summary.failed ? 1 : 0;
}
