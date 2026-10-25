import { existsSync } from 'node:fs';

// Loaded only by the QA bootstrap. Production startup never imports this file.
const original = globalThis.fetch;
const hosts = new Set(['api.openai.com', 'generativelanguage.googleapis.com', 'api.anthropic.com', 'api.telegram.org', 'api.twilio.com', 'events.pagerduty.com']);
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (process.env.QA_TRANSPORT_MOCK_URL && hosts.has(url.hostname) && existsSync('/qa/mock-transports-enabled')) {
    const destination = `${process.env.QA_TRANSPORT_MOCK_URL}/${url.hostname}${url.pathname}${url.search}`;
    return original(destination, options);
  }
  return original(input, options);
};
