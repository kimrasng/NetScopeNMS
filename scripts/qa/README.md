# Docker QA lab

This isolated Compose project runs NetPulse, TimescaleDB, Redis, five switch
profiles (Cisco, Juniper, Arista, HPE Aruba, Huawei), and two Linux server
profiles (Ubuntu, Rocky). Devices exchange real UDP SNMP v1/v2c/v3, ICMP,
and SSH traffic. MIBs and configuration text are synthetic fixtures; the
containers do not run licensed vendor network operating systems.

## Start a fresh lab

Run from the repository root using Docker Desktop with Linux containers:

```powershell
if (!(Test-Path -LiteralPath .env.test.local)) { New-Item .env.test.local -ItemType File }
docker compose -f docker-compose.qa.yml --profile test build api web browser
docker compose -f docker-compose.qa.yml up -d --wait
docker compose -f docker-compose.qa.yml exec -T api node scripts/integration-test.mjs
docker compose -f docker-compose.qa.yml exec -d api node scripts/mock-services.mjs
```

Integration fixtures require an empty `netpulse_qa` database. Do not rerun that
fixture initializer against the current populated lab. Mock services must be
restarted after API container recreation. The QA entry point supplies local
TCP proxies for existing harnesses' disposable-service guards.

- Web: <http://localhost:13000>
- API: <http://localhost:14000/api/health>
- Fixture administrator: `qa-admin@example.test` / `QA-local-2026!`
- Device network: `172.28.240.11` through `.17`, SNMP `1161`, SSH `2222`.
- Host ports bind to loopback. Device control/ephemeral SSH keys remain on the
  private Docker network. These QA credentials are not deployment defaults.

## Automated scenarios

```powershell
docker compose -f docker-compose.qa.yml exec -T -e NODE_ENV=test api yarn test
docker compose -f docker-compose.qa.yml exec -T api node scripts/monitoring-test.mjs
docker compose -f docker-compose.qa.yml exec -T api node scripts/ssh-test.mjs
docker compose -f docker-compose.qa.yml exec -T api node scripts/feature-test.mjs
docker compose -f docker-compose.qa.yml exec -T api node --import tsx scripts/qa/multivendor-test.mjs
docker compose -f docker-compose.qa.yml exec -T api node scripts/qa/transports-test.mjs
docker compose -f docker-compose.qa.yml run --rm --no-deps browser node scripts/qa/browser.mjs
docker compose -f docker-compose.qa.yml exec -T api yarn lint --cache-dir=/qa/turbo-cache
docker compose -f docker-compose.qa.yml exec -T -e NEXT_TELEMETRY_DISABLED=1 -e NEXT_PUBLIC_API_URL=http://localhost:14000 api yarn build --cache-dir=/qa/turbo-cache
```

The browser suite spaces scenarios by five seconds to respect the unchanged
production API request limit. Allow the request window to settle before
starting it immediately after other API-heavy scenarios. Browser output is
`/qa/browser-summary.json`, `/qa/browser-report`, and `/qa/browser-results`.
Other harnesses write their named `*-results.json` files to `/qa`.

Transport scenarios use actual local HTTP/SMTP exchanges through the normal
API, worker, incident, and notification outbox. QA-only fetch redirection is
enabled solely while `/qa/mock-transports-enabled` exists. The harness removes
the marker in its cleanup. Production startup never loads this redirect.
Successful mock responses do not establish external service availability.

The multi-vendor harness recreates only its tagged fixtures. It leaves them
registered with polling disabled after validation. To watch them continuously,
enable polling in the Devices page. Simulator SSH keys regenerate on restart;
rerun the multi-vendor harness to register fresh pinned credentials.

## Actual container interruption

Only the QA `ubuntu` service is stopped. The dedicated ICMP-only fixture
isolates Docker reachability from optional SNMP timeout behavior:

```powershell
docker compose -f docker-compose.qa.yml exec -T api node scripts/qa/outage-test.mjs prepare
try {
  docker compose -f docker-compose.qa.yml stop ubuntu
  docker compose -f docker-compose.qa.yml exec -T api node scripts/qa/outage-test.mjs offline
} finally {
  docker compose -f docker-compose.qa.yml start ubuntu
}
docker compose -f docker-compose.qa.yml exec -T api node scripts/qa/outage-test.mjs recover
```

## Database upgrade

Use a separate empty QA database; choose a fresh name on each subsequent run:

```powershell
docker compose -f docker-compose.qa.yml exec -T postgres psql -U netpulse -d postgres -c 'CREATE DATABASE netpulse_qa_upgrade;'
docker compose -f docker-compose.qa.yml exec -T -e NODE_ENV=test -e TEST_DATABASE_URL=postgresql://netpulse:qa-local-only@127.0.0.1:15432/netpulse_qa_upgrade api node scripts/upgrade-test.mjs
```

This reproduces baseline duplicate records, then checks archival, preservation
of historical metrics, new tables, Timescale policies, repeated migration,
and idempotent sample seeding. Production sample seeding remains disabled.

## Live AI and Telegram

Save real credentials only in Git-ignored `.env.test.local`, one `NAME=value`
per line. Choose one AI provider type: `openai`, `gemini`, `claude`, or
`custom`. Use a model ID available to that account. `custom` requires the
complete chat-completion endpoint in `QA_AI_BASE_URL`.

```dotenv
QA_AI_TYPE=
QA_AI_MODEL=
QA_AI_API_KEY=
QA_AI_BASE_URL=
QA_TELEGRAM_BOT_TOKEN=
QA_TELEGRAM_CHAT_ID=
```

For a new Telegram bot, create it with BotFather and send it a private message.
If the bot has exactly one private chat, the helper can find its ID without
printing the token:

```powershell
docker compose -f docker-compose.qa.yml up -d --wait --no-build api
docker compose -f docker-compose.qa.yml exec -d api node scripts/mock-services.mjs
docker compose -f docker-compose.qa.yml exec -T api node scripts/qa/telegram-chat.mjs
```

Set the returned chat ID in the host secret file, then run:

```powershell
docker compose -f docker-compose.qa.yml exec -T api node scripts/qa/live-test.mjs
```

The secret file is mounted read-only inside Docker. The live harness
performs up to four AI calls (connection, query, incident chat, RCA) and three
Telegram messages (test, fault, recovery). It removes temporary live provider
and channel records and restores the fixture default provider. Evidence stores
only check outcomes, not credentials. A `sent` outbox row records acceptance
by Telegram; the recipient must separately confirm messages appeared in the
Telegram client. Missing settings are reported as `credentials_required`.
Use `--telegram-only` or `--ai-only` to recheck one integration without sending
messages or making model calls for the other. `QA_PRIOR_AI_CALLS` and
`--skip-connection` account for already attempted calls when continuing an
interrupted run. Do not repeat a live generation run beyond its agreed budget
without additional user approval.

Normal administrators enter AI credentials in **AI > AI Providers** and Telegram
credentials in **Notifications > Channels > Telegram**. **Settings > API Keys**
manages NetPulse's own API access keys. The QA environment file only supplies
automation credentials; it is not required for normal web configuration.

To verify those actual web forms without additional generation or messages:

```powershell
try {
  docker compose -f docker-compose.qa.yml run --rm --no-deps -v "${PWD}/.env.test.local:/app/.env.test.local:ro" browser node scripts/qa/web-credentials.mjs
} finally {
  docker compose -f docker-compose.qa.yml exec -T api node scripts/qa/verify-web-credentials.mjs
}
```

The browser creates disabled temporary records and saves edits without
re-entering the stored secrets. The API-side verifier compares persisted values
without printing them and deletes the temporary records. Evidence contains only
outcomes. Do not enable traces or screenshots while filling real secret fields.

`ai-diagnose.mjs` can compare `native-header`, `openai-compatible`, and
`interactions` Gemini request paths. Each invocation performs exactly one
generation request with no automatic retry and records sanitized HTTP/latency
metadata in `ai-diagnose-results.json`. Its ledger caps attempts at four;
`QA_PRIOR_AI_CALLS` includes requests made by the NMS harness in that same scope.
`--stop-after-ai-failure` stops the NMS harness after a failed query or chat,
leaving remaining diagnostic attempts unused. A new generation scope still
requires user authorization after an earlier scope is exhausted.

## Preserve evidence

Copy only sanitized result files, the browser report, and verification logs:

```powershell
New-Item docs/qa/2026-10-07/evidence -ItemType Directory -Force
docker compose -f docker-compose.qa.yml cp api:/qa/multivendor-results.json docs/qa/2026-10-07/evidence/
docker compose -f docker-compose.qa.yml cp api:/qa/transport-results.json docs/qa/2026-10-07/evidence/
docker compose -f docker-compose.qa.yml cp api:/qa/browser-summary.json docs/qa/2026-10-07/evidence/
docker compose -f docker-compose.qa.yml cp api:/qa/browser-report docs/qa/2026-10-07/evidence/
```

Do not export `/qa/state.json` or fixture state files: they hold local session
or fixture credentials. The evidence directory is ignored by Git and excluded
from Docker build context, as is `.env.test.local`.

To stop the lab while retaining its QA databases and evidence volumes:

```powershell
docker compose -f docker-compose.qa.yml down
```
