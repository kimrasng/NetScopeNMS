import dotenv from 'dotenv';
import postgres from 'postgres';
import { readFile, writeFile } from 'node:fs/promises';

dotenv.config({ path: '.env.test.local' });
if (!process.env.TEST_DATABASE_URL?.includes('/netpulse_qa')) throw new Error('Dedicated QA database required');
const out = process.env.TEST_OUTPUT_DIR ?? '/qa';
const state = JSON.parse(await readFile(`${out}/state.json`, 'utf8'));
const evidence = JSON.parse(await readFile(`${out}/web-credentials-results.json`, 'utf8'));
const fixture = JSON.parse(await readFile(`${out}/web-credentials-state.json`, 'utf8'));
const db = postgres(process.env.TEST_DATABASE_URL);
const check = (name, passed) => { evidence.results.push({ name, passed: Boolean(passed) }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); };
try {
  const providers = fixture.providerId ? await db`select api_key,name from ai_providers where id=${fixture.providerId}` : [];
  const channels = fixture.channelId ? await db`select config,name from notification_channels where id=${fixture.channelId}` : [];
  check('Web-saved AI key persists unchanged after editing', providers.length === 1 && providers[0].name === 'QA Web Credential AI Edited' && providers[0].api_key === process.env.QA_AI_API_KEY);
  check('Web-saved Telegram token and recipient persist after editing', channels.length === 1 && channels[0].name === 'QA Web Credential Telegram Edited' && channels[0].config.botToken === process.env.QA_TELEGRAM_BOT_TOKEN && channels[0].config.chatId === process.env.QA_TELEGRAM_CHAT_ID);
} finally {
  for (const [path, id] of [['/api/ai/providers', fixture.providerId], ['/api/notifications/channels', fixture.channelId]]) {
    if (!id) continue;
    const response = await fetch(`${process.env.TEST_API_URL}${path}/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${state.admin}` }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) check('Temporary web credential fixture cleanup', false);
  }
  await db.end();
  evidence.generatedAt = new Date().toISOString();
  evidence.passed = evidence.results.filter(result => result.passed).length;
  evidence.failed = evidence.results.filter(result => !result.passed).length;
  await writeFile(`${out}/web-credentials-results.json`, JSON.stringify(evidence, null, 2));
}
process.exitCode = evidence.failed ? 1 : 0;
