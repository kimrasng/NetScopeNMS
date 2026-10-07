import { generateKeyPairSync, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import ssh2 from 'ssh2';
import postgres from 'postgres';
const { Server, utils } = ssh2;
const base = process.env.TEST_API_URL ?? 'http://127.0.0.1:4000';
if (!process.env.TEST_DATABASE_URL || !['127.0.0.1','localhost'].includes(new URL(process.env.TEST_DATABASE_URL).hostname) || !['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw new Error('Provide local disposable QA services');
const out = process.env.TEST_OUTPUT_DIR ?? '/tmp/netpulse-integration';
  const state = JSON.parse(await readFile(out + '/state.json','utf8'));
const db = postgres(process.env.TEST_DATABASE_URL);
const keyPair = () => generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs1',format:'pem'},publicKeyEncoding:{type:'pkcs1',format:'pem'}});
const host = keyPair(); const client = keyPair();
const hostKey = utils.parseKey(host.privateKey); const clientKey = utils.parseKey(client.privateKey);
if (hostKey instanceof Error || clientKey instanceof Error) throw new Error('QA key generation failed');
const fingerprint = 'SHA256:' + createHash('sha256').update(hostKey.getPublicSSH()).digest('base64').replace(/=+$/,'');
const clients = new Set(); let captures=0;
const server = new Server({hostKeys:[host.privateKey]}, connection => {
  clients.add(connection); connection.on('close',()=>clients.delete(connection)); connection.on('error',()=>{});
  connection.on('authentication', context => {
    if (context.username==='qa' && context.method==='publickey' && context.key.data.equals(clientKey.getPublicSSH())) context.accept(); else context.reject();
  });
  connection.on('ready',()=>connection.on('session', accept=>accept().on('exec',(acceptExec,_reject,info)=>{
    const stream=acceptExec();
    if (info.command==='bad-command') { stream.stderr.write('unsupported'); stream.exit(1); stream.end(); return; }
    if (info.command!=='empty-command') stream.write(`hostname qa-router\ninterface Ethernet5\n description QA revision ${++captures}\n`);
    stream.exit(0); stream.end();
  })));
});
await new Promise(resolve=>server.listen(12122,'127.0.0.1',resolve));
const results=[];
const check=(name,passed,detail={})=>{results.push({name,passed:!!passed,detail});console.log(`${passed?'PASS':'FAIL'} ${name}`);};
const request=async(path,method='GET',body,token=state.admin)=>{const response=await fetch(base+path,{method,headers:{Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,data:await response.json()};};
try {
  const created=await request('/api/devices','POST',{name:'QA SSH Router',ip:'127.0.0.1',pollingEnabled:false,sshPort:12122,sshUsername:'qa',sshPrivateKey:client.privateKey,sshHostFingerprint:fingerprint});
  check('SSH device accepts trusted host and private key',created.status===201&&created.data.sshKeyConfigured===true,{status:created.status});
  const id=created.data.id;
  const [stored]=await db`select ssh_key_encrypted from devices where id=${id}`;
  check('SSH private key encrypted at rest and omitted from responses',stored.ssh_key_encrypted.startsWith('v1:')&&!stored.ssh_key_encrypted.includes('PRIVATE KEY')&&!JSON.stringify(created.data).includes('PRIVATE KEY')&&!('sshKeyEncrypted' in created.data));
  const first=await request('/api/config-snapshots/capture','POST',{deviceId:id});
  check('SSH capture stores actual command output and hash',first.status===201&&first.data.configText.includes('QA revision 1')&&first.data.hash===createHash('sha256').update(first.data.configText).digest('hex'),{status:first.status});
  const second=await request('/api/config-snapshots/capture','POST',{deviceId:id});
  check('Second SSH capture records configuration changes',second.status===201&&second.data.diff.includes('-  description QA revision 1')&&second.data.diff.includes('+  description QA revision 2'));
  const comparison=await request(`/api/config-snapshots/${first.data.id}/diff/${second.data.id}`);
  check('Snapshot comparison exposes added and removed lines',comparison.status===200&&comparison.data.added.includes(' description QA revision 2')&&comparison.data.removed.includes(' description QA revision 1'));
  check('Failed SSH command is reported as failed',(await request('/api/config-snapshots/capture','POST',{deviceId:id,command:'bad-command'})).status===502);
  check('Empty SSH output cannot create a successful snapshot',(await request('/api/config-snapshots/capture','POST',{deviceId:id,command:'empty-command'})).status===502);
  await request(`/api/devices/${id}`,'PUT',{sshHostFingerprint:'0'.repeat(64)});
  check('Untrusted SSH host is rejected',(await request('/api/config-snapshots/capture','POST',{deviceId:id})).status===502);
  await request(`/api/devices/${id}`,'PUT',{sshHostFingerprint:fingerprint,location:'QA retains credentials'});
  const preserved=await request('/api/config-snapshots/capture','POST',{deviceId:id});
  check('Device edit preserves encrypted SSH credentials',preserved.status===201,{status:preserved.status,error:preserved.data.error});
  const forbidden=await request('/api/config-snapshots/capture','POST',{deviceId:id},state.viewer.token);
  check('Viewer cannot capture an out-of-scope configuration',[403,404].includes(forbidden.status),{status:forbidden.status,error:forbidden.data.error});
  const viewerCapture=await request('/api/config-snapshots/capture','POST',{deviceId:state.a.id},state.viewer.token);
  check('Viewer cannot capture an authorized device',viewerCapture.status===403,{status:viewerCapture.status});
  const scoped=await request(`/api/config-snapshots/${first.data.id}`,'GET',undefined,state.viewer.token);
  check('Restricted viewer cannot read SSH snapshots',[403,404].includes(scoped.status),{status:scoped.status,error:scoped.data.error});
  const audit=await request('/api/audit-logs?limit=200');
  check('Capture audited without private keys',audit.data.data.some(row=>row.action==='config-snapshot.capture')&&!JSON.stringify(audit.data).includes('PRIVATE KEY'));
  const spec=await request('/docs/json');
  check('OpenAPI describes report responses and device request fields',spec.status===200&&!!spec.data.paths['/api/reports/']?.get?.responses?.['200']?.content?.['application/json']?.schema&&!!spec.data.paths['/api/devices/']?.post?.requestBody?.content?.['application/json']?.schema?.properties?.snmpV3Config);
} catch(error) {check('SSH scenario completed',false,{error:error.message});}
finally {
  for (const connection of clients) connection.end();
  await new Promise(resolve=>server.close(resolve)); await db.end(); await mkdir(out,{recursive:true});
  await writeFile(out+'/ssh-results.json',JSON.stringify({generatedAt:new Date().toISOString(),passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results},null,2));
  process.exitCode=results.some(r=>!r.passed)?1:0;
}
