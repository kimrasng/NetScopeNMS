import http from 'node:http';
import { generateKeyPairSync, createHash } from 'node:crypto';
import snmp from 'net-snmp';
import ssh2 from 'ssh2';

// Synthetic MIB fixtures; these containers do not run proprietary network OSes.
const profiles = {
  cisco: { name: 'QA-Cisco', description: 'Cisco IOS XE synthetic QA switch', enterprise: 9, port: 'GigabitEthernet1/0/', cpu: 'cisco' },
  juniper: { name: 'QA-Juniper', description: 'Juniper Junos synthetic QA switch', enterprise: 2636, port: 'ge-0/0/', cpu: 'juniper' },
  arista: { name: 'QA-Arista', description: 'Arista EOS synthetic QA switch', enterprise: 30065, port: 'Ethernet', cpu: 'host' },
  hpe: { name: 'QA-HPE', description: 'HPE Aruba AOS-CX synthetic QA switch', enterprise: 47196, port: '1/1/', cpu: 'host' },
  huawei: { name: 'QA-Huawei', description: 'Huawei VRP synthetic QA switch', enterprise: 2011, port: 'GigabitEthernet0/0/', cpu: 'huawei' },
  ubuntu: { name: 'QA-Ubuntu', description: 'Linux Ubuntu synthetic QA server', enterprise: 8072, port: 'ens', cpu: 'host', ucd: true },
  rocky: { name: 'QA-Rocky', description: 'Linux Rocky synthetic QA server', enterprise: 8072, port: 'eth', cpu: 'host', ucd: true },
};
const profile = profiles[process.env.QA_DEVICE_PROFILE];
if (!profile) throw new Error('Unknown QA_DEVICE_PROFILE');
const state = { cpu: 24, memory: 40, revision: 1, interfaceDown: false, snmpAvailable: true };
const versions = new Set();
const errors = [];
const agent = snmp.createAgent({ port: 1161, disableAuthorization: false }, error => {
  if (error) errors.push(error.message);
});
agent.getAuthorizer().addCommunity('qa-lab');
agent.getAuthorizer().addUser({ name: 'qa-v3', level: snmp.SecurityLevel.authPriv, authProtocol: snmp.AuthProtocols.sha, authKey: 'qa-auth-only', privProtocol: snmp.PrivProtocols.aes, privKey: 'qa-privacy-only' });
for (const socket of Object.values(agent.listener.sockets)) {
  // BER encodes the small protocol version at byte four for these QA requests.
  socket.on('message', buffer => { const offset = buffer[1] & 128 ? 2 + (buffer[1] & 127) : 2; if (buffer[offset] === 2) versions.add(buffer[offset + 2]); });
}
const mib = agent.getMib();
function scalar(name, oid, value, type = snmp.ObjectType.Integer) {
  mib.registerProvider({ name, oid, type: snmp.MibProviderType.Scalar, scalarType: type, maxAccess: snmp.MaxAccess['read-only'] });
  mib.setScalarValue(name, value);
}
function table(name, oid, columns, rows, index = [{ columnName: 'index' }]) {
  mib.registerProvider({ name, oid, type: snmp.MibProviderType.Table, maxAccess: snmp.MaxAccess['not-accessible'], tableColumns: columns.map(([number, columnName, type]) => ({ number, name: columnName, type, maxAccess: snmp.MaxAccess['read-only'] })), tableIndex: index });
  for (const row of rows) mib.addTableRow(name, row);
}
const integer = snmp.ObjectType.Integer, string = snmp.ObjectType.OctetString;
scalar('sysDescr', '1.3.6.1.2.1.1.1', profile.description, string);
scalar('sysObjectID', '1.3.6.1.2.1.1.2', `1.3.6.1.4.1.${profile.enterprise}.0`, snmp.ObjectType.OID);
scalar('sysName', '1.3.6.1.2.1.1.5', profile.name, string);
if (profile.cpu === 'host') table('cpu', '1.3.6.1.2.1.25.3.3.1', [[1, 'index', integer], [2, 'load', integer]], [[5, state.cpu], [9, state.cpu]]);
if (profile.cpu === 'cisco') {
  table('cpu', '1.3.6.1.4.1.9.9.109.1.1.1.1', [[1, 'index', integer], [6, 'load', integer]], [[1, state.cpu]]);
  table('memory', '1.3.6.1.4.1.9.9.48.1.1.1', [[1, 'index', integer], [5, 'used', snmp.ObjectType.Gauge], [6, 'free', snmp.ObjectType.Gauge]], [[1, state.memory * 10000, (100 - state.memory) * 10000]]);
}
if (profile.cpu === 'juniper') {
  table('operating', '1.3.6.1.4.1.2636.3.1.13.1', [[1, 'index', integer], [2, 'l1', integer], [3, 'l2', integer], [4, 'l3', integer], [8, 'load', integer], [11, 'buffer', integer]], [[9, 1, 0, 0, state.cpu, state.memory]], [{ columnName: 'index' }, { columnName: 'l1' }, { columnName: 'l2' }, { columnName: 'l3' }]);
}
if (profile.cpu === 'huawei') table('entity', '1.3.6.1.4.1.2011.5.25.31.1.1.1.1', [[1, 'index', integer], [5, 'load', integer], [7, 'memory', integer]], [[9, state.cpu, state.memory]]);
if (profile.ucd) {
  scalar('memoryTotal', '1.3.6.1.4.1.2021.4.5', 1000000);
  scalar('memoryFree', '1.3.6.1.4.1.2021.4.6', 600000);
  scalar('load1m', '1.3.6.1.4.1.2021.10.1.3.1', '0.24', string);
}
// RAM, swap and a mounted disk deliberately have different utilization.
if (profile.cpu === 'host') table('storage', '1.3.6.1.2.1.25.2.3.1', [[1, 'index', integer], [2, 'type', snmp.ObjectType.OID], [3, 'description', string], [4, 'unit', integer], [5, 'size', integer], [6, 'used', integer]], [[5, '1.3.6.1.2.1.25.2.1.2', 'Physical memory', 4096, 100000, 40000], [9, '1.3.6.1.2.1.25.2.1.3', 'Swap', 4096, 50000, 45000], [11, '1.3.6.1.2.1.25.2.1.4', '/', 4096, 1000000, 600000]]);
table('interfaces', '1.3.6.1.2.1.2.2.1', [[1, 'index', integer], [2, 'name', string], [8, 'status', integer], [10, 'incoming', snmp.ObjectType.Counter], [16, 'outgoing', snmp.ObjectType.Counter]], [[5, profile.port + '5', 1, 10000, 20000], [9, profile.port + '9', 1, 30000, 40000]]);
table('lldp', '1.0.8802.1.1.2.1.4.1.1', [[1, 'timeMark', integer], [2, 'localPort', integer], [3, 'remoteIndex', integer], [7, 'portId', string], [9, 'hostname', string], [10, 'description', string]], [[0, 5, 1, 'Ethernet5', process.env.QA_NEIGHBOR_NAME, 'Synthetic QA neighbor']], [{ columnName: 'timeMark' }, { columnName: 'localPort' }, { columnName: 'remoteIndex' }]);
table('lldpAddresses', '1.0.8802.1.1.2.1.4.2.1', [[1, 'timeMark', integer], [2, 'localPort', integer], [3, 'remoteIndex', integer], [4, 'interfaceSubtype', integer], [5, 'addressType', integer], [6, 'addressLength', integer], [7, 'address', snmp.ObjectType.IpAddress]], [[0, 5, 1, 2, 1, 4, process.env.QA_NEIGHBOR_IP]], [{ columnName: 'timeMark' }, { columnName: 'localPort' }, { columnName: 'remoteIndex' }, { columnName: 'addressType' }, { columnName: 'addressLength' }, { columnName: 'address' }]);
table('arp', '1.3.6.1.2.1.4.22.1', [[1, 'index', integer], [2, 'mac', string], [3, 'address', snmp.ObjectType.IpAddress]], [[5, 'QA-MAC', process.env.QA_NEIGHBOR_IP]]);
function update() {
  if (profile.cpu === 'host') for (const index of [5, 9]) mib.setTableSingleCell('cpu', 2, [index], state.cpu);
  if (profile.cpu === 'cisco') { mib.setTableSingleCell('cpu', 6, [1], state.cpu); mib.setTableSingleCell('memory', 5, [1], state.memory * 10000); mib.setTableSingleCell('memory', 6, [1], (100 - state.memory) * 10000); }
  if (profile.cpu === 'juniper') { mib.setTableSingleCell('operating', 8, [9, 1, 0, 0], state.cpu); mib.setTableSingleCell('operating', 11, [9, 1, 0, 0], state.memory); }
  if (profile.cpu === 'huawei') { mib.setTableSingleCell('entity', 5, [9], state.cpu); mib.setTableSingleCell('entity', 7, [9], state.memory); }
  if (profile.cpu === 'host') mib.setTableSingleCell('storage', 6, [5], state.memory * 1000);
  if (profile.ucd) mib.setScalarValue('memoryFree', (100 - state.memory) * 10000);
  mib.setTableSingleCell('interfaces', 8, [5], state.interfaceDown ? 2 : 1);
}
let counter = 0;
setInterval(() => { counter += 10000; for (const index of [5, 9]) { mib.setTableSingleCell('interfaces', 10, [index], counter + index * 1000); mib.setTableSingleCell('interfaces', 16, [index], counter * 2 + index * 1000); } }, 1000).unref();
const keyPair = () => generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs1', format: 'pem' }, publicKeyEncoding: { type: 'pkcs1', format: 'pem' } });
const host = keyPair(), client = keyPair();
const hostKey = ssh2.utils.parseKey(host.privateKey), clientKey = ssh2.utils.parseKey(client.privateKey);
if (hostKey instanceof Error || clientKey instanceof Error) throw new Error('SSH fixture keys invalid');
const fingerprint = 'SHA256:' + createHash('sha256').update(hostKey.getPublicSSH()).digest('base64').replace(/=+$/, '');
const ssh = new ssh2.Server({ hostKeys: [host.privateKey] }, connection => {
  connection.on('error', () => {});
  connection.on('authentication', context => context.username === 'qa' && context.method === 'publickey' && context.key.data.equals(clientKey.getPublicSSH()) ? context.accept() : context.reject());
  connection.on('ready', () => connection.on('session', accept => accept().on('exec', (acceptExec, _reject, info) => {
    const stream = acceptExec();
    if (info.command === 'bad-command') { stream.stderr.write('QA unsupported command'); stream.exit(1); } else { stream.write(`! ${profile.description}\nhostname ${profile.name}\ninterface ${profile.port}5\n description QA revision ${state.revision}\n`); stream.exit(0); }
    stream.end();
  })));
});
ssh.listen(2222, '0.0.0.0');
http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/credentials') { res.end(JSON.stringify({ username: 'qa', privateKey: client.privateKey, fingerprint })); return; }
  if (req.method === 'POST' && req.url === '/state') {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const next = JSON.parse(raw || '{}');
    for (const key of ['cpu', 'memory', 'revision']) if (Number.isFinite(next[key])) state[key] = next[key];
    if (typeof next.interfaceDown === 'boolean') state.interfaceDown = next.interfaceDown;
    update();
  }
  res.end(JSON.stringify({ profile: process.env.QA_DEVICE_PROFILE, name: profile.name, state, versions: [...versions], errors }));
}).listen(8080, '0.0.0.0');
console.log(`${profile.name}: SNMP 1161, SSH 2222, private QA control 8080`);
