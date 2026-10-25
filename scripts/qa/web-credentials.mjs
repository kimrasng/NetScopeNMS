import { chromium } from 'playwright';
import net from 'node:net';
import { chown, readFile, writeFile } from 'node:fs/promises';

const out = process.env.TEST_OUTPUT_DIR ?? '/qa';
const config = Object.fromEntries((await readFile('/app/.env.test.local', 'utf8')).split(/\r?\n/).filter(line => /^QA_\w+=/.test(line)).map(line => {
  const separator = line.indexOf('=');
  return [line.slice(0, separator), line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, '$2')];
}));
if (![config.QA_AI_API_KEY, config.QA_TELEGRAM_BOT_TOKEN, config.QA_TELEGRAM_CHAT_ID].every(Boolean)) throw new Error('QA credentials required');
const results = [], fixtureIds = {};
const check = (name, passed) => {
  results.push({ name, passed: Boolean(passed) });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  if (!passed) throw new Error(name);
};
const proxies = [];
for (const [port, host, target] of [[13000, 'web', 3000], [14000, 'api', 4000]]) {
  const server = net.createServer(socket => {
    const upstream = net.connect(target, host);
    socket.pipe(upstream).pipe(socket);
    socket.on('error', () => upstream.destroy()); upstream.on('error', () => socket.destroy());
    socket.on('close', () => upstream.destroy());
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  proxies.push(server);
}
const login = await fetch('http://api:4000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'qa-admin@example.test', password: 'QA-local-2026!' }) });
if (!login.ok) throw new Error('QA login failed');
const account = await login.json();
const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(15000);
await page.addInitScript(token => { localStorage.setItem('netpulse_token', token); localStorage.setItem('netpulse_locale', 'en'); }, account.token);
const responseFor = (path, method) => page.waitForResponse(response => new URL(response.url()).pathname === path && response.request().method() === method);
try {
  await page.goto('http://localhost:13000/ai');
  await page.getByRole('tab', { name: 'AI Providers', exact: true }).click();
  await page.getByRole('button', { name: 'Add Provider', exact: true }).click();
  const aiDialog = page.getByRole('dialog');
  await aiDialog.getByLabel('Provider Name', { exact: true }).fill('QA Web Credential AI');
  await aiDialog.getByLabel('Select type', { exact: true }).click();
  await page.getByRole('option', { name: 'Gemini', exact: true }).click();
  const aiKey = aiDialog.getByLabel('API Key', { exact: true });
  check('AI API key input is masked', await aiKey.getAttribute('type') === 'password');
  await aiKey.fill(config.QA_AI_API_KEY);
  await aiDialog.getByLabel('Model', { exact: true }).fill(config.QA_AI_MODEL);
  await aiDialog.getByRole('checkbox', { name: 'Enabled', exact: true }).uncheck();
  const aiCreated = responseFor('/api/ai/providers', 'POST');
  await aiDialog.getByRole('button', { name: 'Create', exact: true }).click();
  const aiResponse = await aiCreated;
  const ai = await aiResponse.json();
  fixtureIds.providerId = ai.id;
  check('AI provider created through web form', aiResponse.status() === 201 && ai.type === 'gemini' && ai.enabled === false);
  check('AI create response excludes API key', !('apiKey' in ai));
  const aiRow = page.getByRole('row').filter({ has: page.getByText('QA Web Credential AI', { exact: true }) });
  await aiRow.getByRole('button', { name: 'Edit', exact: true }).click();
  check('AI edit form keeps stored API key hidden', await aiDialog.getByLabel('API Key', { exact: true }).inputValue() === '');
  await aiDialog.getByLabel('Provider Name', { exact: true }).fill('QA Web Credential AI Edited');
  const aiUpdated = responseFor(`/api/ai/providers/${ai.id}`, 'PUT');
  await aiDialog.getByRole('button', { name: 'Save', exact: true }).click();
  const aiUpdate = await aiUpdated;
  check('AI web edit preserves an omitted credential', aiUpdate.ok() && !('apiKey' in aiUpdate.request().postDataJSON()));

  await page.goto('http://localhost:13000/notifications');
  await page.getByRole('tab', { name: 'Channels', exact: true }).click();
  await page.getByRole('button', { name: 'Add Channel', exact: true }).click();
  const channelDialog = page.getByRole('dialog');
  await channelDialog.getByLabel('Channel Name', { exact: true }).fill('QA Web Credential Telegram');
  await channelDialog.getByLabel('Select channel type', { exact: true }).click();
  await page.getByRole('option', { name: 'Telegram', exact: true }).click();
  const tokenInput = channelDialog.getByLabel('Bot token', { exact: true });
  check('Telegram bot token input is masked', await tokenInput.getAttribute('type') === 'password');
  await tokenInput.fill(config.QA_TELEGRAM_BOT_TOKEN);
  await channelDialog.getByLabel('Chat ID', { exact: true }).fill(config.QA_TELEGRAM_CHAT_ID);
  await channelDialog.getByRole('checkbox').uncheck();
  const channelCreated = responseFor('/api/notifications/channels', 'POST');
  await channelDialog.getByRole('button', { name: 'Create', exact: true }).click();
  const channelResponse = await channelCreated;
  const channel = await channelResponse.json();
  fixtureIds.channelId = channel.id;
  check('Telegram channel created through web form', channelResponse.status() === 201 && channel.type === 'telegram' && channel.enabled === false);
  check('Telegram create response masks bot token', channel.config.botToken === '[REDACTED]');
  const channelRow = page.getByRole('row').filter({ has: page.getByText('QA Web Credential Telegram', { exact: true }) });
  await channelRow.getByRole('button', { name: 'Edit Channel', exact: true }).click();
  check('Telegram edit form keeps stored bot token hidden', await channelDialog.getByLabel('Bot token', { exact: true }).inputValue() === '');
  await channelDialog.getByLabel('Channel Name', { exact: true }).fill('QA Web Credential Telegram Edited');
  const channelUpdated = responseFor(`/api/notifications/channels/${channel.id}`, 'PUT');
  await channelDialog.getByRole('button', { name: 'Save', exact: true }).click();
  const channelUpdate = await channelUpdated;
  check('Telegram web edit retains redacted credential', channelUpdate.ok() && channelUpdate.request().postDataJSON().config.botToken === '[REDACTED]');
} catch (error) {
  let message = error.message;
  for (const secret of [config.QA_AI_API_KEY, config.QA_TELEGRAM_BOT_TOKEN, config.QA_TELEGRAM_CHAT_ID]) message = message.split(secret).join('[REDACTED]');
  results.push({ name: 'Web credential scenario completed', passed: false, detail: message.slice(0, 1500) });
  console.error('FAIL Web credential scenario:', message.slice(0, 1500));
} finally {
  await browser.close();
  for (const server of proxies) server.close();
  await writeFile(`${out}/web-credentials-state.json`, JSON.stringify(fixtureIds), { mode: 0o600 });
  await writeFile(`${out}/web-credentials-results.json`, JSON.stringify({ generatedAt: new Date().toISOString(), scope: 'Web input, masked responses and credential retention; no model generation or Telegram sends', passed: results.filter(result => result.passed).length, failed: results.filter(result => !result.passed).length, results }, null, 2));
  if (process.getuid() === 0) {
    await chown(`${out}/web-credentials-state.json`, 1001, 1001);
    await chown(`${out}/web-credentials-results.json`, 1001, 1001);
  }
}
process.exitCode = results.some(result => !result.passed) ? 1 : 0;
