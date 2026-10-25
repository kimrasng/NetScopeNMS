import { readFile, writeFile } from 'node:fs/promises';
import dotenv from 'dotenv';

const filename = '.env.test.local';
dotenv.config({ path: filename });
const token = process.env.QA_TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('Set QA_TELEGRAM_BOT_TOKEN in .env.test.local first');
try {
  const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, { signal: AbortSignal.timeout(15000) });
  const updates = await response.json();
  if (!response.ok || !updates.ok) throw new Error(`Telegram getUpdates rejected (HTTP ${response.status})`);
  const chats = new Map();
  for (const update of updates.result) {
    const chat = update.message?.chat;
    if (chat?.type === 'private') chats.set(String(chat.id), chat.type);
  }
  if (chats.size !== 1) {
    console.log(JSON.stringify({ status: chats.size ? 'choose_test_recipient' : 'send_a_message_to_the_bot_first', privateChatIds: [...chats.keys()] }));
    process.exitCode = 2;
  } else {
    const chatId = [...chats.keys()][0];
    if (process.argv.includes('--save')) {
      const current = await readFile(filename, 'utf8');
      const configured = current.match(/^QA_TELEGRAM_CHAT_ID=(.*)$/m)?.[1].trim();
      if (configured) throw new Error('Test chat ID is already configured; existing choice preserved');
      await writeFile(filename, /^QA_TELEGRAM_CHAT_ID=/m.test(current) ? current.replace(/^QA_TELEGRAM_CHAT_ID=.*$/m, `QA_TELEGRAM_CHAT_ID=${chatId}`) : `${current}\nQA_TELEGRAM_CHAT_ID=${chatId}\n`, { mode: 0o600 });
    }
    console.log(JSON.stringify({ status: process.argv.includes('--save') ? 'test_chat_saved' : 'test_chat_found', chatId }));
  }
} catch (error) {
  // Never print a request URL or an error stack containing the bot token.
  console.log(JSON.stringify({ status: 'failed', reason: error.message.includes(token) ? 'Telegram request failed' : error.message }));
  process.exitCode = 1;
}
