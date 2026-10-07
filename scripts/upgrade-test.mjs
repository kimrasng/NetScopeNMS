import { mkdtemp, mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
if (!process.env.TEST_DATABASE_URL || !['localhost','127.0.0.1'].includes(new URL(process.env.TEST_DATABASE_URL).hostname)) throw new Error('Provide an empty local disposable TEST_DATABASE_URL');
const client = postgres(process.env.TEST_DATABASE_URL); const db = drizzle(client);
if ((await client`select to_regclass('users') as name`)[0].name) throw new Error('Upgrade fixtures require an empty database');
const folder = await mkdtemp(join(tmpdir(),'netpulse-upgrade-')); await mkdir(join(folder,'meta'));
const journal = JSON.parse(await readFile('packages/shared/drizzle/meta/_journal.json','utf8')); journal.entries = journal.entries.slice(0,2);
await writeFile(join(folder,'meta/_journal.json'),JSON.stringify(journal));
for (const entry of journal.entries) await copyFile(`packages/shared/drizzle/${entry.tag}.sql`,join(folder,`${entry.tag}.sql`));
const results=[]; const check=(name,passed,detail={})=>{results.push({name,passed:!!passed,detail}); console.log(`${passed?'PASS':'FAIL'} ${name}`);};
try {
  await migrate(db,{migrationsFolder:folder});
  check('Baseline migrations reproduce the missing tables',!(await client`select to_regclass('dashboards') as name`)[0].name);
  const [device]=await client`insert into devices(name,ip,polling_enabled) values('Upgrade fixture','192.0.2.201',false) returning id`;
  const [rule]=await client`insert into alert_rules(name,metric_name,operator,threshold,device_id) values('Upgrade CPU','cpu','>',80,${device.id}) returning id`;
  await client`insert into interfaces(device_id,if_index,name,last_updated_at) values(${device.id},5,'old',now()-interval '1 day'),(${device.id},5,'latest',now())`;
  await client`insert into incidents(device_id,rule_id,severity,title,started_at) values(${device.id},${rule.id},'high','Old incident',now()-interval '1 hour'),(${device.id},${rule.id},'high','Duplicate incident',now())`;
  await client`insert into metrics(device_id,metric_name,value,timestamp) values(${device.id},'cpu',90,now()-interval '1 day')`;
  const run = async file => { await new Promise((resolve,reject)=>{ const child=spawn(process.execPath,['--import','tsx',file],{env:{...process.env,DATABASE_URL:process.env.TEST_DATABASE_URL},stdio:['ignore','pipe','pipe']}); let errors=''; child.stderr.on('data',chunk=>{errors+=chunk.toString();}); child.on('error',reject); child.on('exit',code=>code===0?resolve():reject(new Error(`Migration/seed exited ${code}: ${errors.slice(-1000)}`))); }); };
  await run('packages/shared/src/db/migrate.ts');
  check('Duplicate active incidents are merged while preserving history',(await client`select id from incidents where status<>'resolved'`).length===1&&(await client`select id from incidents where status='resolved'`).length===1);
  const interfaces=await client`select name from interfaces`;
  check('Duplicate interface keeps the latest indexed record',interfaces.length===1&&interfaces[0].name==='latest');
  check('Removed duplicate records are archived losslessly',Number((await client`select count(*) as count from migration_archives`)[0].count)===2);
  check('Existing metric data survives hypertable conversion',(await client`select device_id from metrics`).length===1&&(await client`select hypertable_name from timescaledb_information.hypertables where hypertable_name='metrics'`).length===1);
  check('Missing tables and monitoring integrity tables exist',(await client`select table_name from information_schema.tables where table_schema='public' and table_name in ('api_keys','dashboards','dashboard_widgets','topology_positions','alert_evaluations','topology_edges')`).length===6);
  check('Timescale retention, compression and aggregation policies exist',(await client`select job_id from timescaledb_information.jobs where proc_name in ('policy_retention','policy_compression','policy_refresh_continuous_aggregate')`).length===3);
  await run('packages/shared/src/db/migrate.ts');
  check('Repeated migration preserves archived records',Number((await client`select count(*) as count from migration_archives`)[0].count)===2);
  await run('packages/shared/src/db/seed.ts'); const before=await client`select count(*) as count from devices`;
  await run('packages/shared/src/db/seed.ts'); const after=await client`select count(*) as count from devices`;
  check('Seed command is reproducible and idempotent',Number(before[0].count)===Number(after[0].count)&&Number(after[0].count)===4);
} catch(error) {check('Upgrade scenario completed',false,{error:error.message});}
finally {await client.end();const out=process.env.TEST_OUTPUT_DIR??'/tmp/netpulse-integration';await mkdir(out,{recursive:true});await writeFile(out+'/upgrade-results.json',JSON.stringify({generatedAt:new Date().toISOString(),results,passed:results.filter(result=>result.passed).length,failed:results.filter(result=>!result.passed).length},null,2));process.exitCode=results.some(result=>!result.passed)?1:0;}
