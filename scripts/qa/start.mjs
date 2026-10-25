import net from 'node:net';
import { spawn } from 'node:child_process';
import { mkdir, chmod } from 'node:fs/promises';

await mkdir('/qa', { recursive: true });
await chmod('/qa', 0o700);
for (const [port, host, target] of [[15432, 'postgres', 5432], [16379, 'redis', 6379]]) {
  net.createServer(socket => {
    const upstream = net.connect(target, host);
    socket.pipe(upstream).pipe(socket);
    socket.on('error', () => upstream.destroy());
    upstream.on('error', () => socket.destroy());
    socket.on('close', () => upstream.destroy());
  }).listen(port, '127.0.0.1');
}
const run = args => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { stdio: 'inherit' });
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`QA startup exited ${code}`)));
});
await run(['--import', 'tsx', 'packages/shared/src/db/migrate.ts']);
const api = spawn(process.execPath, ['--import', './scripts/qa/mock-fetch.mjs', '--import', 'tsx', 'apps/api/src/index.ts'], { stdio: 'inherit' });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => api.kill(signal));
api.on('exit', code => process.exit(code ?? 1));
