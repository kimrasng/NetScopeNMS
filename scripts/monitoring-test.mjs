import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import postgres from 'postgres';
import snmp from 'net-snmp';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import asn1 from 'asn1';
const base = process.env.TEST_API_URL ?? 'http://127.0.0.1:4000';
const out = process.env.TEST_OUTPUT_DIR ?? '/tmp/netpulse-integration';
if (!process.env.TEST_DATABASE_URL || !process.env.TEST_REDIS_URL || !['localhost','127.0.0.1'].includes(new URL(process.env.TEST_DATABASE_URL).hostname)) throw new Error('Provide local disposable test services');
const state = JSON.parse(await readFile(out + '/state.json', 'utf8'));
const db = postgres(process.env.TEST_DATABASE_URL);
const redis = new Redis(process.env.TEST_REDIS_URL, { maxRetriesPerRequest: null });
const pollQueue = new Queue('device-polling', { connection: redis });
const metricQueue = new Queue('metric-events', { connection: redis });
const results = [], deliveries = [];
let rejectDelivery = false;
const receiver = http.createServer(async (req, res) => { let raw = ''; for await (const chunk of req) raw += chunk; deliveries.push(JSON.parse(raw || '{}')); res.writeHead(rejectDelivery ? 503 : 200); res.end('{}'); });
await new Promise(resolve => receiver.listen(14568, '127.0.0.1', resolve));
const agentErrors = [];
const agent = snmp.createAgent({ port: 10161, disableAuthorization: false }, error => { if (error) agentErrors.push(error.message); });
const wireVersions=new Set();
for (const socket of Object.values(agent.listener.sockets)) socket.on('message',buffer=>{try {const reader=new asn1.Ber.Reader(buffer);reader.readSequence();wireVersions.add(reader.readInt());}catch(error){agentErrors.push(error.message);}});
agent.getAuthorizer().addCommunity('qa-monitoring');
agent.getAuthorizer().addUser({ name: 'qa-v3', level: snmp.SecurityLevel.authPriv, authProtocol: snmp.AuthProtocols.sha, authKey: 'qa-auth-only', privProtocol: snmp.PrivProtocols.aes, privKey: 'qa-privacy-only' });
const mib = agent.getMib();
function scalar(name, oid, value, type = snmp.ObjectType.Integer) { mib.registerProvider({ name, oid, type: snmp.MibProviderType.Scalar, scalarType: type, maxAccess: snmp.MaxAccess['read-only'] }); mib.setScalarValue(name, value); }
function table(name, oid, columns, rows, index = [{ columnName: 'index' }]) {
  mib.registerProvider({ name, oid, type: snmp.MibProviderType.Table, maxAccess: snmp.MaxAccess['not-accessible'], tableColumns: columns.map(([number, name, type]) => ({ number, name, type, maxAccess: snmp.MaxAccess['read-only'] })), tableIndex: index });
  for (const row of rows) mib.addTableRow(name, row);
}
scalar('memoryTotal','1.3.6.1.4.1.2021.4.5',1000); scalar('memoryFree','1.3.6.1.4.1.2021.4.6',0);
table('cpu','1.3.6.1.2.1.25.3.3.1', [[1,'index',snmp.ObjectType.Integer],[2,'load',snmp.ObjectType.Integer]], [[5,95],[9,95]]);
table('interfaces','1.3.6.1.2.1.2.2.1', [[1,'index',snmp.ObjectType.Integer],[2,'name',snmp.ObjectType.OctetString],[8,'status',snmp.ObjectType.Integer],[10,'incoming',snmp.ObjectType.Counter],[16,'outgoing',snmp.ObjectType.Counter]], [[5,'port-five',1,1000,2000],[9,'port-nine',2,3000,4000]]);
table('arp','1.3.6.1.2.1.4.22.1', [[1,'index',snmp.ObjectType.Integer],[2,'mac',snmp.ObjectType.OctetString],[3,'address',snmp.ObjectType.IpAddress]], [[5,'qa-mac','127.0.0.23']]);
table('lldpNeighbors','1.0.8802.1.1.2.1.4.1.1', [[1,'timeMark',snmp.ObjectType.Integer],[2,'localPort',snmp.ObjectType.Integer],[3,'remoteIndex',snmp.ObjectType.Integer],[7,'portId',snmp.ObjectType.OctetString],[9,'hostname',snmp.ObjectType.OctetString],[10,'description',snmp.ObjectType.OctetString]], [[0,5,1,'Ethernet5','QA LLDP Neighbor','QA LLDP description']], [{columnName:'timeMark'},{columnName:'localPort'},{columnName:'remoteIndex'}]);
table('lldpAddresses','1.0.8802.1.1.2.1.4.2.1', [[1,'timeMark',snmp.ObjectType.Integer],[2,'localPort',snmp.ObjectType.Integer],[3,'remoteIndex',snmp.ObjectType.Integer],[4,'interfaceSubtype',snmp.ObjectType.Integer],[5,'addressType',snmp.ObjectType.Integer],[6,'addressLength',snmp.ObjectType.Integer],[7,'address',snmp.ObjectType.IpAddress]], [[0,5,1,2,1,4,'127.0.0.24']], [{columnName:'timeMark'},{columnName:'localPort'},{columnName:'remoteIndex'},{columnName:'addressType'},{columnName:'addressLength'},{columnName:'address'}]);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, timeout = 12000) { const started = Date.now(); while (Date.now()-started < timeout) { if (await predicate()) return true; await wait(200); } return false; }
function check(name, passed, detail = {}) { results.push({ name, passed: !!passed, detail }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); }
async function request(path, method = 'GET', body, token = state.admin) { const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }); const data = await response.json(); return { status: response.status, data }; }
let device, rule, channel, maintenance;
try {
  channel = (await request('/api/notifications/channels','POST',{ name:'QA Pipeline Webhook', type:'webhook', config:{ url:'http://127.0.0.1:14568/' } })).data;
  const group = (await request('/api/device-groups','POST',{name:'QA Pipeline Group'})).data;
  device = (await request('/api/devices','POST',{name:'QA SNMP Pipeline',ip:'127.0.0.1',groupId:group.id,snmpVersion:'v2c',snmpCommunity:'qa-monitoring',snmpPort:10161,pollingEnabled:false,pollingInterval:30})).data;
  check('Device credentials are omitted from general reads', !device.snmpCommunity && device.snmpCommunityConfigured === true);
  rule = (await request('/api/alert-rules','POST',{name:'QA Pipeline CPU',groupId:group.id,metricName:'cpu',operator:'>',threshold:80,flapThreshold:1,channels:[channel.id],escalationMinutes:1,escalationChannels:[channel.id]})).data;
  const other = (await request('/api/alert-rules','POST',{name:'QA Other Group CPU',groupId:state.group.id,metricName:'cpu',operator:'>',threshold:80,flapThreshold:1})).data;
  maintenance = (await request('/api/maintenance-windows','POST',{name:'QA Pipeline Maintenance',deviceIds:[device.id],startAt:new Date(Date.now()-60000).toISOString(),endAt:new Date(Date.now()+3600000).toISOString()})).data;
  await request(`/api/devices/${device.id}`,'PUT',{pollingEnabled:true});
  check('Real SNMP poll runs through normal API worker', await until(async () => (await db`select * from metrics where device_id=${device.id} and metric_name='cpu'`).length > 0));
  check('SNMPv2c uses BER version 1 on the actual UDP wire',wireVersions.has(1)&&!wireVersions.has(0),{versions:[...wireVersions]});
  const stored = await db`select metric_name,value from metrics where device_id=${device.id}`;
  check('CPU percentage and zero free memory are collected correctly', stored.some(m => m.metric_name==='cpu' && Number(m.value)===95) && stored.some(m=>m.metric_name==='memory'&&Number(m.value)===100));
  await until(async () => (await db`select if_index from interfaces where device_id=${device.id}`).length === 2);
  const interfaces = await db`select if_index,name,status from interfaces where device_id=${device.id} order by if_index`;
  check('Sparse SNMP interface indices and status stay aligned', interfaces.length===2&&interfaces[0].if_index===5&&interfaces[0].name==='port-five'&&interfaces[0].status==='up'&&interfaces[1].if_index===9&&interfaces[1].status==='down', {interfaces});
  await until(async () => Number((await metricQueue.getJobCounts('waiting','active')).waiting)===0); await wait(300);
  check('Maintenance suppresses incidents and marks device state', !(await db`select id from incidents where device_id=${device.id}`).length && (await request(`/api/devices/${device.id}`)).data.status==='maintenance');
  await request(`/api/maintenance-windows/${maintenance.id}`,'DELETE');
  await pollQueue.add('qa-poll',{deviceId:device.id},{removeOnComplete:true});
  check('SNMP metric creates one threshold incident', await until(async () => (await db`select id from incidents where device_id=${device.id} and rule_id=${rule.id} and status='problem'`).length===1));
  const [incident] = await db`select * from incidents where device_id=${device.id} and rule_id=${rule.id} and status='problem'`;
  if (!incident) throw new Error('Pipeline incident not created');
  check('Rules from a different group do not apply', !(await db`select id from incidents where device_id=${device.id} and rule_id=${other.id}`).length);
  check('Configured notification is delivered and recorded', await until(async () => (await db`select id from notifications where incident_id=${incident.id} and status='sent' and payload->>'event'='trigger'`).length===1));
  await Promise.all(Array.from({length:15},(_,i)=>metricQueue.add('qa-concurrent',{deviceId:device.id,metricName:'cpu',value:95,timestamp:new Date(Date.now()+i).toISOString()},{removeOnComplete:true})));
  await wait(1000);
  check('Concurrent events do not duplicate active incidents or trigger deliveries', (await db`select id from incidents where device_id=${device.id} and rule_id=${rule.id} and status<>'resolved'`).length===1&&(await db`select id from notifications where incident_id=${incident.id} and payload->>'event'='trigger'`).length===1);
  await db`update incidents set started_at=now()-interval '2 minutes' where id=${incident.id}`;
  check('Escalation is delivered by running scheduler', await until(async () => (await db`select id from notifications where incident_id=${incident.id} and status='sent' and payload->>'event'='escalated'`).length===1));
  await wait(1800);
  check('Escalation is idempotent across scheduler ticks', (await db`select id from notifications where incident_id=${incident.id} and payload->>'event'='escalated'`).length===1);
  mib.setTableSingleCell('cpu',2,[5],10); mib.setTableSingleCell('cpu',2,[9],10);
  await pollQueue.add('qa-recovery',{deviceId:device.id},{removeOnComplete:true});
  check('Healthy SNMP sample resolves incident and sends recovery notification', await until(async () => (await db`select id from incidents where id=${incident.id} and status='resolved'`).length===1&&(await db`select id from notifications where incident_id=${incident.id} and status='sent' and payload->>'event'='resolved'`).length===1));
  check('Reachable device returns to Up after recovery', await until(async () => (await request(`/api/devices/${device.id}`)).data.status==='up'));
  rejectDelivery=true; const failed=await request(`/api/notifications/test/${channel.id}`,'POST');
  check('Downstream 503 is exposed as delivery failure',failed.status===502);
  rejectDelivery=false;
  check('Persistent delivery retry succeeds after downstream recovery',await until(async ()=>(await db`select id from notifications where id=${failed.data.notificationId} and status='sent' and attempts>=2`).length===1));
  const v3=(await request('/api/devices','POST',{name:'QA SNMPv3 Pipeline',ip:'127.0.0.1',pollingEnabled:false,snmpPort:10161,snmpVersion:'v3',snmpV3Config:{username:'qa-v3',securityLevel:'authPriv',authProtocol:'SHA',authKey:'qa-auth-only',privProtocol:'AES',privKey:'qa-privacy-only'}})).data;
  check('SNMPv3 edit retains masked credentials', (await request(`/api/devices/${v3.id}`,'PUT',{snmpV3Config:{username:'qa-v3',securityLevel:'authPriv',authProtocol:'SHA',privProtocol:'AES'}})).status===200);
  await request(`/api/devices/${v3.id}`,'PUT',{pollingEnabled:true});
  check('SNMPv3 authentication and privacy work over UDP',await until(async ()=>(await db`select device_id from metrics where device_id=${v3.id} and metric_name='cpu'`).length>0));
  check('SNMPv3 uses BER version 3 on the actual UDP wire',wireVersions.has(3),{versions:[...wireVersions]});
  const discovery=await request('/api/discovery/run','POST',{deviceId:device.id});
  check('On-demand discovery job finishes',await until(async()=>{const jobs=(await request('/api/discovery/jobs')).data.data;return jobs.some(job=>job.id===discovery.data.jobId&&job.state==='completed');},20000));
  const neighbor=await db`select * from devices where ip='127.0.0.23'`;
  check('ARP discovery persists neighbor and topology edge',neighbor.length===1&&(await db`select id from topology_edges where source_device_id=${device.id} and target_device_id=${neighbor[0].id}`).length===1);
  const lldp=await db`select * from devices where ip='127.0.0.24'`;
  check('LLDP discovery preserves hostname, port and topology relationship',lldp.length===1&&lldp[0].name==='QA LLDP Neighbor'&&(await db`select id from topology_edges where source_device_id=${device.id} and target_device_id=${lldp[0].id} and source_port='Ethernet5' and discovery_method='lldp'`).length===1);
  const v3Discovery=await request('/api/discovery/run','POST',{deviceId:v3.id});
  check('SNMPv3 discovery returns authenticated neighbors',await until(async()=>{const jobs=(await request('/api/discovery/jobs')).data.data;return jobs.some(job=>job.id===v3Discovery.data.jobId&&job.state==='completed'&&job.result?.neighborsFound?.length===2);},20000));
  for(const window of (await request('/api/maintenance-windows?limit=200')).data.data) await request(`/api/maintenance-windows/${window.id}`,'DELETE');
  const trapSession=snmp.createSession('127.0.0.1','public',{version:snmp.Version2c,trapPort:Number(process.env.TEST_TRAP_PORT??1162)});
  async function trap(oid){await new Promise((resolve,reject)=>trapSession.trap(oid,[{oid:'1.3.6.1.2.1.2.2.1.1.5',type:snmp.ObjectType.Integer,value:5}],error=>error?reject(error):resolve()));}
  await trap('1.3.6.1.6.3.1.1.5.3'); await trap('1.3.6.1.6.3.1.1.5.3');
  check('UDP link-down traps create one application incident',await until(async()=>(await db`select id from incidents where metric_name='trap:link:5' and status<>'resolved'`).length===1));
  const [trapIncident]=await db`select id from incidents where metric_name='trap:link:5' and status<>'resolved'`;
  await trap('1.3.6.1.6.3.1.1.5.4'); trapSession.close();
  check('UDP link-up trap resolves matching incident',await until(async()=>(await db`select id from incidents where id=${trapIncident.id} and status='resolved'`).length===1));
  check('Local SNMP agent has no protocol errors',agentErrors.length===0,{agentErrors});
} catch(error) { check('Monitoring scenario completed',false,{error:error.message}); }
finally {
  for(const row of await db`select id from devices where snmp_port=10161`) await request(`/api/devices/${row.id}`,'PUT',{pollingEnabled:false});
  await pollQueue.close(); await metricQueue.close(); redis.disconnect(); agent.close(); await new Promise(resolve=>receiver.close(resolve)); await db.end();
  await writeFile(out+'/monitoring-results.json',JSON.stringify({generatedAt:new Date().toISOString(),passed:results.filter(result=>result.passed).length,failed:results.filter(result=>!result.passed).length,results},null,2));
  process.exitCode=results.some(result=>!result.passed)?1:0;
}
