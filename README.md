# NetPulse

NetPulse is a network management system with SNMP/ICMP polling, scoped monitoring, incident workflows, AI assistance, and multi-channel notifications.

## Implemented features

- **Devices and groups:** create/edit/delete, filtering and pagination, group assignment, coordinates, interface metrics, SNMP v1/v2c/v3 settings, and per-device SSH credentials. Existing masked secrets are preserved when an edit leaves them blank.
- **Monitoring:** BullMQ polling schedules follow device changes. Ping and threshold events update device status. SNMP v2c uses the correct wire version, CPU utilization uses the host CPU table, and interfaces retain their actual `ifIndex`.
- **Alerts:** device/group rules, notifications, escalation channels and delay, runbook links, flap suppression, acknowledgement, recovery, and incident timelines. Device and group filters on one rule both apply. Concurrent events cannot create duplicate active incidents for the same device/rule.
- **Maintenance:** device/group scopes, one-time windows, recurring cron schedules with an explicit IANA timezone, and alert suppression during an active occurrence. Recurrence uses the original window duration.
- **Traps and discovery:** normal API startup includes the UDP receiver, trap consumer, and scheduled LLDP/ARP discovery. Link-down traps create incidents; link-up traps resolve matching incidents. Discovery jobs can also run from the web page and persist neighbor relationships.
- **Topology and maps:** ReactFlow graph with device status, zoom, dragging, automatic placement, saved personal positions and manual connections; Leaflet markers for devices with coordinates. Geographic tiles use OpenStreetMap and display a warning if unavailable.
- **Dashboards:** system summary, throughput, top devices and incidents; custom dashboards with summary, metric, incidents, throughput, top-devices and text widgets. Editors can reorder widgets, choose widths and devices, and save a personal default dashboard. Shared dashboards respect the reader's device scope.
- **AI:** enabled OpenAI, Gemini, Claude or custom providers configured in the UI; incident RCA/chat, scoped read-only SQL queries with displayed result rows, and narrative reports. Missing/failed providers produce errors instead of placeholder success.
- **Reports:** manually generated availability, performance, alert-summary and AI-narrative reports. Availability is calculated from historical ping samples. Results are stored and available in the web list/detail view.
- **Notifications:** SMTP, Telegram, Discord, Slack, Twilio SMS, PagerDuty, webhook and in-app channels. HTTP rejection is recorded as failure. Incident deliveries use a durable outbox with four total attempts and exponential backoff; channel-test requests record the immediate result. History includes status and errors. Telegram links open the incident; acknowledgement happens in NetPulse.
- **Configuration snapshots:** manual content import or on-demand SSH command capture, SHA-256 change detection, history and line diffs. SSH capture verifies a configured SHA-256 host fingerprint and limits connection time/output. Automatic scheduled SSH backup is not implemented.
- **Access and audit:** seven-day JWTs and expiring/revocable API keys; current account role, enablement and device/group scope enforced for API queries and Socket.IO events. Account/password changes revoke old sessions. Invitations enforce their bound email. Mutations are audited with credentials redacted.
- **Web behavior:** filters/ranges refetch, monitoring events refresh displayed state, errors offer recovery, Viewer writes are disabled, profile phone persists, and site name/logo settings render in the header.

## Stack and structure

The frontend uses Next.js 14, React 18, **AWS Cloudscape**, React Context, Recharts, ReactFlow and Leaflet. The backend uses Fastify 5, Socket.IO, Drizzle, Zod, BullMQ, Redis 7 and TimescaleDB/PostgreSQL 16. Yarn 1.22 workspaces and Turborepo coordinate the TypeScript packages.

```text
apps/api/                  Fastify API and application monitoring services
apps/web/                  Next.js App Router and Cloudscape UI
packages/shared/           Schema, migrations, contracts and database utilities
packages/polling-engine/   SNMP/ICMP polling, traps and LLDP/ARP discovery
packages/ai-engine/        Multi-provider AI adapters
packages/notification/     Typed notification transport adapters
scripts/                   Startup and disposable regression harnesses
```

## Local setup

Use Node.js 22, Yarn 1.22.22, Docker and Docker Compose. From the repository root:

```bash
cp .env.example .env
# Edit .env; replace NEXTAUTH_SECRET with a private random value.
yarn install --frozen-lockfile
docker compose up -d postgres redis
yarn db:migrate
# Optional sample data; does not create an administrator.
yarn db:seed
yarn dev
```

Open http://localhost:3000 and complete the first-admin setup wizard. The API runs on http://localhost:4000; Swagger is at `/docs` and worker health is at `/api/health`. `yarn dev:api` and `yarn dev:web` start each application separately.

The API, migration/seed tools and web configuration load root `.env` defaults. Injected environment variables and application-local overrides take precedence. Changes to the root environment file invalidate Turbo build caches. Sample seeding is idempotent, uses TEST-NET addresses with polling disabled, and rejects production execution.

`yarn db:migrate` applies checked-in migrations and initializes the metrics hypertable, indexes and Timescale policies. Upgrades preserve historical metrics; conflicting legacy interface/incident rows are retained in `migration_archives`. Take a database backup before upgrading a real installation.

## Docker

```bash
docker compose up -d --build api web
```

The API image migrates before starting and runs its polling, threshold, delivery, discovery and trap workers. API/web healthchecks report readiness. Compose also defines eight optional-to-start SNMP simulator services; select them explicitly if needed. The command above starts API/web plus their database/Redis dependencies.

| Service | Host port |
| --- | --- |
| TimescaleDB | 5432/TCP |
| Redis | 6379/TCP |
| API | 4000/TCP; 162/UDP for traps |
| Web | 3000/TCP |

Set `NEXT_PUBLIC_API_URL` to the API URL reachable **from users' browsers**, and set `CORS_ORIGIN`/`WEB_ORIGIN` to the web origin. The browser API URL is compiled into the Docker web build through a build argument, so changing it requires rebuilding the web image. `NEXTAUTH_SECRET` is required by Compose.

## Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | Timescale/PostgreSQL connection | local `netpulse` database |
| `REDIS_URL` | BullMQ Redis connection | `redis://localhost:6379` |
| `NEXTAUTH_SECRET` | JWT signing and SSH-key encryption | development fallback only |
| `NEXT_PUBLIC_API_URL` | Browser API URL, set before building | `http://localhost:4000` |
| `WEB_ORIGIN` | Invitation and notification links | `http://localhost:3000` |
| `NEXTAUTH_URL` | Invitation-link fallback | `http://localhost:3000` |
| `CORS_ORIGIN` | Allowed browser/socket origin | `http://localhost:3000` |
| `API_PORT` | Direct API listening port | `4000` |
| `LOG_LEVEL` | API logging level | `info` |
| `SNMP_TRAP_ENABLED` | Start UDP trap receiver | `true` |
| `SNMP_TRAP_PORT` | Direct receiver port | `1162` |
| `SNMP_TRAP_COMMUNITY` | Accepted v1/v2c community | `public` |
| `SNMP_TRAP_USERS` | JSON array of SNMPv3 USM users | `[]` |
| `DISCOVERY_ENABLED` | Enable scheduled discovery | `true` |
| `DISCOVERY_INTERVAL` | Discovery interval in seconds | `3600` |
| `NODE_ENV` | Runtime mode | `development` |

Configure **AI providers and notification channels in the web UI**; legacy `ANTHROPIC_API_KEY`, `SMTP_*`, Telegram and other transport environment fields do not create usable providers/channels. Jira and Kakao adapters are not provided.

SNMPv3 device/trap configuration includes `username`, `securityLevel` (`noAuthNoPriv`, `authNoPriv`, `authPriv`), `authProtocol` (`MD5`/`SHA`), `authKey`, `privProtocol` (`DES`/`AES`) and `privKey` as required by the selected level. Configure trap users explicitly; a device's polling credentials do not automatically register a trap user. Traps identify a device by source IP; use unique managed addresses. Docker always binds the receiver on container UDP 1162 and publishes host UDP 162.

SSH capture accepts a trusted `SHA256:...` base64 or hexadecimal host-key fingerprint. Obtain it through an independently trusted channel. Stored private keys are encrypted using the signing secret; rotating `NEXTAUTH_SECRET` requires re-entering stored SSH keys. Capture commands are device/vendor specific and run only when requested.

## API conventions

All resource endpoints use `/api`. Authentication accepts a JWT or API key as a Bearer credential. Lists use `{ data, pagination: { page, limit, total, totalPages } }`; errors use `{ error, message? }`. Invalid bodies, identifiers, dates, coordinates and pagination return client errors. Secret fields are excluded from ordinary responses; configured flags let forms retain credentials.

Roles are `super_admin`, `admin`, `operator` and `viewer`. Device operations and incident actions require Operator or above. Global configuration requires an unrestricted administrator; user role/enablement updates and deletion require Super Admin. A restricted user's direct request for a hidden device returns 404. Resource scope applies to reports, dashboards, AI queries, snapshots and live events as well as device lists.

| Route group | Main operations |
| --- | --- |
| `/auth`, `/setup` | Login/profile/password, first setup, site settings, email-bound invites, account administration |
| `/devices`, `/device-groups` | Devices, interface/history data and groups |
| `/incidents`, `/alert-rules`, `/maintenance-windows` | Lifecycle, RCA, comments, alert and maintenance configuration |
| `/dashboard`, `/dashboards` | System aggregates and custom layouts/widgets |
| `/topology`, `/discovery` | Scoped graph, positions, connections and discovery jobs |
| `/metrics` | Time series, anomalies and trend predictions |
| `/ai`, `/reports` | Provider management, query/chat/RCA and report generation |
| `/notifications` | Transport configuration, test send and paginated history |
| `/config-snapshots` | Import, SSH capture, list/detail/diff |
| `/api-keys`, `/audit-logs`, `/health` | Integration credentials, audit and worker readiness |

See running Swagger for exact methods and schemas. Shared Zod response contracts cover reports, notification history, invitations, metrics and AI query results; they are also validated by the web client.

## Verification

```bash
yarn install --frozen-lockfile
yarn test
yarn lint
yarn build
```

The unit suite includes API access, polling, notification adapters, recurrence and web request/refetch contracts. Database/network regression harnesses require **disposable local** services and create/change fixture data:

```bash
export TEST_API_URL=http://127.0.0.1:4000
export TEST_DATABASE_URL=postgresql://netpulse:password@127.0.0.1:5432/netpulse_qa
export TEST_REDIS_URL=redis://127.0.0.1:6379/1
export TEST_OUTPUT_DIR=/tmp/netpulse-qa
# Start the API using the same database and Redis, after yarn db:migrate.
# The integration harness requires an empty users table and reserves local port 14567.
yarn test:integration
yarn test:monitoring
yarn test:ssh
yarn test:features
# Uses the integration fixtures above, plus a running web and mock-services.mjs.
yarn playwright install chromium
yarn test:e2e
# Override TEST_DATABASE_URL with a separate completely empty database first.
yarn test:upgrade
```

Monitoring reserves UDP 10161 and local webhook port 14568; SSH reserves TCP 12122. Set `TEST_TRAP_PORT` if the API receiver uses a port other than 1162. `state.json` contains private fixture credentials and must not be published; `*-results.json` are sanitized evidence. [The remediation report](docs/qa/2026-10-02/RETEST_REPORT.md) distinguishes executed checks from configured CI coverage and lists external validation limits.

GitHub Actions runs frozen installation, build, lint, unit tests, local API/UDP-SNMP/SSH regressions, Chromium E2E cases and legacy database upgrade checks on Node.js 22. Uploads are restricted to sanitized result files.

## License

ISC
