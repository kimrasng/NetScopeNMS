import net from 'node:net';
import { spawn } from 'node:child_process';
for (const [port, host, target] of [[13000, 'web', 3000], [14000, 'api', 4000]]) {
  net.createServer(socket => {
    const upstream = net.connect(target, host);
    socket.pipe(upstream).pipe(socket);
    socket.on('error', () => upstream.destroy()); upstream.on('error', () => socket.destroy());
    socket.on('close', () => upstream.destroy());
  }).listen(port, '127.0.0.1');
}
const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, TEST_WEB_URL: 'http://localhost:13000', TEST_API_URL: 'http://localhost:14000', PLAYWRIGHT_HTML_OUTPUT_DIR: `${process.env.TEST_OUTPUT_DIR ?? '/qa'}/browser-report` } });
child.on('error', error => { console.error(error.message); process.exit(1); });
child.on('exit', code => process.exit(code ?? 1));
