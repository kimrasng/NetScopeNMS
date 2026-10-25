<div align="center">

**English** · [한국어](README.ko.md)

# NetPulse

**A self-hosted network management system that connects monitoring, incident response and AI-assisted investigation.**

SNMP / ICMP monitoring · live topology · time-series metrics · incident workflows · multi-channel alerts · scoped access

![Node.js](https://img.shields.io/badge/Node.js-22-5FA04E?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![License](https://img.shields.io/badge/license-ISC-blue)

[Overview](#overview) · [Architecture](#architecture) · [Infrastructure](#infrastructure) · [Features](#features) · [Quick start](#quick-start) · [Development](#development)

</div>

## Overview

NetPulse gives network operators one place to answer three questions: **What is happening? What needs attention? What changed?** It collects reachability and performance measurements from managed devices, keeps their history in TimescaleDB, turns matching alert conditions into incidents, and brings the investigation back into the same web console.

The system combines an inventory of devices and groups with dashboards, interface traffic, network topology, geographic maps, maintenance windows and configuration snapshots. An operator can move from a network-wide summary to an affected device, inspect its metrics and incident timeline, compare captured configurations, and acknowledge or resolve the incident without switching tools.

AI assistance is an optional layer over that operational data. Configured providers can help investigate an incident, translate a natural-language question into a restricted read-only query, or produce a narrative report. Polling, alert evaluation and incident handling do not require an AI provider.

### Who it is for

- **Network operators** who need centralized visibility into routers, switches, servers and other reachable SNMP-enabled equipment.
- **Operations teams** who want threshold alerts, acknowledgements, escalation, maintenance suppression and an auditable incident history.
- **Administrators** who need to give different users access to different devices or groups.
- **Developers and integrators** who want a TypeScript codebase, documented REST endpoints and revocable API keys.

NetPulse monitors equipment through ICMP and SNMP; it does not forward production network traffic. On-demand SSH configuration capture is a separate, explicitly requested operation. Available measurements depend on the device's supported MIBs, credentials and network reachability.

## Highlights

| Area | What you get |
|---|---|
| **Continuous monitoring** | Per-device polling schedules, reachability, latency, CPU, memory and interface throughput with historical metrics. |
| **Incident response** | Device/group rules, flap suppression, recovery, acknowledgements, escalation channels and runbook links. |
| **Network context** | LLDP/ARP discovery, an editable topology graph and geographic device maps. |
| **AI assistance** | OpenAI, Gemini, Claude or a custom provider for RCA, chat, read-only data queries and narrative reports. |
| **Notifications** | SMTP, Telegram, Discord, Slack, Twilio SMS, PagerDuty, webhook and in-app channels, with delivery history. |
| **Operator console** | Next.js and AWS Cloudscape, system and custom dashboards, scoped reports and configuration diffs. |
| **Access control** | Four roles, device/group visibility scopes, revocable API keys, session revocation and audit logging. |

## Architecture

NetPulse is a **TypeScript monorepo with two deployable applications and four shared packages**. The Next.js application serves the console. The Fastify application owns the REST API, authenticated real-time connections and the monitoring services. PostgreSQL/TimescaleDB stores durable application state and measurements; Redis supports BullMQ queues and job schedules.

The packages are code boundaries, not separate services in the default deployment. Starting the API also starts its polling, threshold, notification-delivery and trap workers, plus scheduled discovery when enabled. There is no separate worker container to start in the supplied Compose configuration.

### System topology

```mermaid
flowchart TB
    OP["Operator / administrator"]
    WEB["Web console :3000<br/>Next.js · React · Cloudscape"]

    subgraph APIHOST["API application :4000"]
        REST["REST /api<br/>authentication · validation · access scope"]
        LIVE["Socket.IO /ws<br/>scoped device and incident events"]
        POLL["Polling workers<br/>ICMP · SNMP"]
        RULES["Threshold engine<br/>maintenance · incidents"]
        TRAPS["UDP trap receiver<br/>trap consumer"]
        DISC["Discovery engine<br/>LLDP · ARP"]
        DELIVERY["Delivery engine<br/>outbox · escalation"]
        AI["AI services<br/>RCA · chat · read-only queries"]
    end

    DB[("PostgreSQL 16 + TimescaleDB<br/>inventory · metrics · incidents · outbox")]
    REDIS[("Redis 7 / BullMQ<br/>jobs · schedules")]
    DEV["Managed devices<br/>routers · switches · servers"]
    PROVIDER["Configured AI provider"]
    CHANNEL["Configured notification channels"]

    OP --> WEB
    WEB -->|"HTTP requests"| REST
    WEB <-->|"authenticated live events"| LIVE
    REST --> DB
    REST -->|"schedule changes"| REDIS
    REDIS --> POLL
    POLL <-->|"ICMP / SNMP"| DEV
    POLL -->|"persist samples and interfaces"| DB
    POLL -->|"metric-events"| REDIS
    REDIS --> RULES
    RULES -->|"incidents and delivery records"| DB
    DEV -->|"SNMP traps"| TRAPS
    TRAPS --> REDIS
    TRAPS --> DB
    DISC <-->|"LLDP / ARP over SNMP"| DEV
    DISC --> DB
    DISC <--> REDIS
    DELIVERY <--> DB
    DELIVERY <--> REDIS
    DELIVERY --> CHANNEL
    REST --> AI
    AI <--> PROVIDER
    AI -->|"scoped data access"| DB
    POLL --> LIVE
    RULES --> LIVE
```

### Components and responsibilities

| Component | Responsibility | Main technologies |
|---|---|---|
| **`apps/web`** | Authenticated console, setup wizard, device and incident views, dashboards, maps, topology and administration. Calls the API and refreshes displayed state from live events. | Next.js 14, React 18, Cloudscape, Recharts, ReactFlow, Leaflet, React Context |
| **`apps/api`** | Application bootstrap, REST routes, authentication, authorization, audit policy, Socket.IO, threshold evaluation, incident handling, notification orchestration and SSH capture. | Fastify 5, Socket.IO 4, Zod, Drizzle, BullMQ |
| **`packages/shared`** | Database schema and connection utilities, migrations, sample data, shared types, SNMP validation and response contracts consumed by API and web code. | PostgreSQL, TimescaleDB, Drizzle, Zod |
| **`packages/polling-engine`** | Device polling, metric persistence, interface updates, polling schedules, SNMP trap reception and LLDP/ARP discovery. | BullMQ, Redis, net-snmp, ICMP |
| **`packages/ai-engine`** | Provider adapters and AI operations used by the API's scoped application services. | OpenAI, Gemini, Claude and custom-provider integrations |
| **`packages/notification`** | Transport adapters that send a typed notification payload to the selected channel. Scheduling, durable delivery records and escalation remain in the API. | Email, messaging, SMS, PagerDuty and webhooks |
| **PostgreSQL / TimescaleDB** | Durable inventory, accounts, access settings, incidents, notification records, reports, snapshots and time-series measurements. | PostgreSQL 16 with TimescaleDB |
| **Redis** | Queue coordination and recurring job scheduling. It is not the source of truth for inventory or incident history. | Redis 7, BullMQ |

### Monitoring loop: device to dashboard

```mermaid
sequenceDiagram
    autonumber
    participant Browser as Web console
    participant API as Fastify API
    participant Queue as Redis / BullMQ
    participant Poll as Polling worker
    participant Device as Managed device
    participant DB as TimescaleDB
    participant Rules as Threshold worker

    Browser->>API: Create or update a device
    API->>DB: Save inventory and polling settings
    API->>Queue: Synchronize the device's polling schedule
    loop Configured device polling interval
        Queue->>Poll: Poll enabled device
        Poll->>Device: ICMP probe and SNMP requests
        Device-->>Poll: Reachability, measurements and interfaces
        Poll->>DB: Store samples, status and interface counters
        Poll->>Queue: Publish metric-events
        Poll->>API: Notify result callback
        API-->>Browser: Scoped device:updated / metric:updated
        Queue->>Rules: Evaluate a metric event
        Rules->>DB: Read matching rules and maintenance state
        opt Incident created or recovered
            Rules->>DB: Save incident, timeline and notification outbox
            Rules->>API: Notify incident callback
            API-->>Browser: Scoped incident:updated
        end
    end
    Browser->>API: Fetch current visible data
    API-->>Browser: Authorized device / metric / incident response
```

The polling scheduler follows device changes: disabling polling or removing a device removes its schedule; changing its interval updates the schedule. ICMP supplies reachability and latency. SNMP v1/v2c/v3 supplies supported system and interface data. CPU utilization comes from the host CPU table; interface rows retain the device's real `ifIndex`.

Throughput is calculated from changes in interface octet counters over time, rather than treating a cumulative counter as a rate. The first observation has no previous counter and therefore reports zero throughput. Missing MIB support can leave some measurements unavailable even when a device responds to ping.

### Incident lifecycle and notification delivery

Threshold evaluation uses the metric name, operator, threshold and device/group scope of enabled rules. If a rule specifies both a device and a group, both filters must match. Flap settings control how repeated failures become an incident, while active maintenance suppresses alerting.

Evaluation is serialized per device/rule with a database transaction lock, and stale metric events are ignored. Incident changes, timeline entries and notification outbox records are saved in the same transaction. This keeps the incident history and the request to notify operators together instead of relying on an immediate external send.

```mermaid
flowchart LR
    METRIC["Metric event"] --> CHECK{"Rule matches<br/>and not in maintenance?"}
    CHECK -->|"failure threshold reached"| PROBLEM["Problem incident"]
    PROBLEM -->|"operator acknowledges"| ACK["Acknowledged"]
    PROBLEM -->|"normal measurement"| RESOLVED["Resolved"]
    ACK -->|"recovery or resolution"| RESOLVED
    PROBLEM -->|"still unacknowledged after delay"| ESC["Escalation channels"]
    PROBLEM --> OUTBOX[("Notification outbox")]
    RESOLVED --> OUTBOX
    ESC --> OUTBOX
    OUTBOX --> WORKER["Delivery worker"]
    WORKER --> SENT["Sent"]
    WORKER -->|"send fails"| RETRY["Backoff / retry"]
    RETRY --> WORKER
    RETRY -->|"four attempts exhausted"| FAILED["Failed with error history"]
```

The delivery engine scans due outbox records and queues transport work. Incident delivery allows four total attempts with exponential backoff and records errors instead of reporting a rejected HTTP request as success. Escalation is cancelled when an incident is no longer in the problem state; delivery is suppressed during active maintenance. Channel-test requests record their immediate result separately.

Traps provide another input path alongside polling. The UDP receiver accepts configured communities or SNMPv3 users and passes trap work through Redis to the API's trap consumer. Link-down traps can create incidents; matching link-up traps resolve them. Traps identify devices by source IP, so managed addresses must be unique.

### Discovery, topology and configuration history

- **Discovery:** scheduled or operator-triggered LLDP/ARP jobs persist neighbor relationships and synchronize discovered devices with polling.
- **Topology:** ReactFlow presents the scoped network graph, including manual connections, automatic placement and saved personal positions.
- **Geographic maps:** Leaflet places devices with coordinates on OpenStreetMap tiles and warns when tiles are unavailable.
- **Configuration snapshots:** operators import content or request an SSH command capture. SHA-256 hashes identify changes; stored versions support history and line diffs. SSH capture checks a configured host-key fingerprint and bounds connection time and output. Automatic scheduled SSH backup is not implemented.

### Storage model

The schema groups data around devices, incident response and administration. The diagram below shows the main operational relationships, not every table or column.

```mermaid
erDiagram
    DEVICE_GROUPS o|--o{ DEVICES : groups
    DEVICES ||--o{ INTERFACES : exposes
    DEVICES ||--o{ METRICS : measures
    DEVICES ||--o{ INCIDENTS : experiences
    ALERT_RULES o|--o{ INCIDENTS : triggers
    INCIDENTS ||--o{ INCIDENT_EVENTS : records
    INCIDENTS o|--o{ NOTIFICATIONS : produces
    NOTIFICATION_CHANNELS o|--o{ NOTIFICATIONS : delivers
    DEVICES ||--o{ CONFIG_SNAPSHOTS : captures
```

`metrics` is a TimescaleDB hypertable for historical samples. Inventory and interfaces describe the current managed equipment; incidents and their events preserve the response timeline; notification rows also act as the durable delivery outbox. Accounts, invitations, API keys, dashboards, reports, maintenance windows, AI providers and audit logs live in the same database.

Migrations initialize the hypertable, indexes and Timescale policies. Upgrades preserve historical metrics, and conflicting legacy interface/incident rows are retained in `migration_archives`.

### AI and access boundaries

AI providers are selected from enabled configurations stored through the web UI. Incident RCA uses the affected device, recent metrics and related incident context. Reports can store an AI-generated narrative alongside the manually generated availability, performance and alert-summary reports.

For natural-language data questions, the API validates generated SQL as a single `SELECT` over an allowed set of tables and functions. It exposes scoped public columns from `devices`, `metrics`, `incidents` and `interfaces`, executes in a read-only transaction with a five-second statement timeout, and returns at most 1,000 rows. The result rows are displayed in the console. An absent or failed provider produces an error, not a placeholder analysis.

Authorization belongs to the API, not just the console. Current account enablement, role and device/group scope apply to resource queries, dashboards, reports, AI data access and configuration snapshots. Socket.IO authenticates at `/ws` and rechecks account/session validity and device visibility before emitting device events. Password and account changes revoke old sessions.

## Infrastructure

### Default deployment

The supplied Compose stack runs **web, API, TimescaleDB and Redis**. The API container includes the monitoring workers and migrates the database before starting. Eight SNMP simulator services are also defined for explicit use; they are not required for the application stack.

| Service | Image / build target | Published host ports | Persistent storage |
|---|---|---|---|
| `postgres` | `timescale/timescaledb:latest-pg16` | `5432/TCP` | `pgdata` |
| `redis` | `redis:7-alpine` | `6379/TCP` | `redisdata` |
| `api` | Root `Dockerfile`, target `api` | `4000/TCP`, `162/UDP` | Application state is stored in PostgreSQL |
| `web` | Root `Dockerfile`, target `web` | `3000/TCP` | No separate application data volume |

The browser connects to the API origin configured by `NEXT_PUBLIC_API_URL`; the web container is not an implicit API reverse proxy. REST requests use `/api`, and Socket.IO uses `/ws` on the API host. If you put a TLS reverse proxy in front of the applications, route both the API requests and the Socket.IO connection to Fastify.

### Network paths

| Direction | Protocol / port | Purpose |
|---|---|---|
| Browser to web | TCP 3000 by default | Console pages and assets |
| Browser to API | TCP 4000 by default | REST API and Socket.IO |
| API to PostgreSQL | TCP 5432 | Inventory, metrics and application state |
| API to Redis | TCP 6379 | Background jobs and schedules |
| API to managed devices | ICMP and configured SNMP port, usually UDP 161 | Reachability, measurements and discovery |
| Managed devices to API | UDP 162 on the Docker host | Traps; forwarded to container UDP 1162 |
| API to managed devices | Configured SSH port | Explicit configuration capture |
| API to external providers | Provider-specific outbound connection | AI requests and configured notification delivery |

Direct development startup listens for traps on UDP 1162 by default. Docker fixes the receiver to container UDP 1162 and publishes host UDP 162. Polling credentials do not automatically register a trap user.

### Background services

| Service | Trigger / cadence | Responsibility |
|---|---|---|
| Polling | Per-device interval | Probe devices, save samples and interfaces, publish metric events and update device state |
| Threshold evaluation | Queued metric events | Evaluate rules, maintenance and flap state; create or recover incidents |
| Trap processing | Incoming UDP traps | Interpret link events and update matching incidents |
| Discovery | Every `DISCOVERY_INTERVAL` seconds, default 3600; also on demand | Collect LLDP/ARP relationships and synchronize devices |
| Delivery / escalation | Scheduler scans every second; queued delivery jobs | Process due outbox records and escalation delays |

`/api/health` reports the readiness state of polling, thresholds, delivery, traps and discovery. Disabled optional services are treated as ready. It is a worker-readiness view, not an end-to-end guarantee that every managed device or external provider is reachable.

## Features

### Visibility and reporting

- **Inventory:** device/group creation, editing, deletion, filtering, pagination, coordinates, SNMP settings and per-device SSH credentials. Blank secret edits preserve configured masked values.
- **Dashboards:** system summary, throughput, top devices and incidents; custom summary, metric, incident, throughput, top-device and text widgets with ordering, widths and device selection. Users can save a personal default dashboard; shared dashboards respect the reader's scope.
- **Metrics and reports:** historical charts, manually generated availability, performance, alert-summary and AI-narrative reports with saved list/detail views. Availability is calculated from historical ping samples.
- **Live console:** monitoring events refresh displayed data; filter/range changes refetch results. Site name and logo settings appear in the header.

### Operations and governance

- **Incidents:** acknowledgement, recovery, timeline entries, RCA, runbook links and delayed escalation.
- **Maintenance:** device/group scopes, one-time windows and recurring cron schedules with an explicit IANA timezone. Recurring occurrences keep the original duration.
- **Notification history:** status and errors for SMTP, Telegram, Discord, Slack, Twilio SMS, PagerDuty, webhook and in-app channels. Telegram links open the incident; acknowledgement happens in NetPulse.
- **Administration:** seven-day JWTs, expiring/revocable API keys, email-bound invitations, role and scope enforcement, and mutation audit logs with credentials redacted.

## Quick start

### Option A: run the application in Docker

From a local checkout of the repository:

```bash
cp .env.example .env
# Set NEXTAUTH_SECRET to a private random value before starting.
docker compose up -d --build api web
docker compose ps
```

The command starts API and web plus their PostgreSQL and Redis dependencies. The API image applies migrations before startup. Generate a signing secret with `openssl rand -hex 32` and put the result in `.env`; keep it stable because it also encrypts stored SSH keys.

Open `http://localhost:3000` and complete the first-admin setup wizard. There is no seeded administrator password.

### Option B: run with local development servers

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

### First-run walkthrough

1. Open the web console and create the first administrator using the setup wizard.
2. Create device groups and register a device with its reachable address, SNMP credentials and polling interval.
3. Check device reachability, interface data and historical metrics before adding more devices.
4. Configure a notification channel in the UI and send a channel test.
5. Create an alert rule, choose its device/group scope, threshold, flap settings and notification channels.
6. Add maintenance windows for planned work; use incidents to acknowledge and track actual failures.
7. Run discovery and inspect topology, then add dashboards, reports and optional AI providers as needed.
8. Invite users and assign the least device/group visibility and role needed for their work.

| Address | Purpose |
|---|---|
| `http://localhost:3000` | Web console and initial setup |
| `http://localhost:4000/docs` | Running Swagger / OpenAPI documentation |
| `http://localhost:4000/api/health` | Monitoring-worker readiness |

<details>
<summary><b>View logs, stop and restart the Docker stack</b></summary>

```bash
docker compose logs -f api web
docker compose down
docker compose up -d api web
```

`docker compose down` keeps named volumes. Adding `-v` deletes those volumes, including stored database data.

</details>

## Deployment and configuration

Set `NEXT_PUBLIC_API_URL` to the API URL reachable **from users' browsers**, and set `CORS_ORIGIN`/`WEB_ORIGIN` to the web origin. The browser API URL is compiled into the Docker web build through a build argument, so changing it requires rebuilding the web image. `NEXTAUTH_SECRET` is required by Compose.

The checked-in Compose file is a starting configuration, not a separate hardened production overlay. It publishes database and Redis ports, uses a default PostgreSQL credential and does not configure a Redis password. For an external installation, adapt the Compose services and connection URLs together, restrict infrastructure ports, terminate HTTPS in your deployment and back up the database before upgrades. Environment changes alone do not replace hard-coded database credentials in the Compose file.

### Environment variables

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

## Development

### Repository layout

```text
netscopeNMS/
|-- apps/
|   |-- api/
|   |   `-- src/
|   |       |-- index.ts             API bootstrap and worker lifecycle
|   |       |-- routes/              REST resource handlers
|   |       |-- middleware/          Authentication middleware
|   |       `-- services/            Access, incidents, delivery, AI and SSH
|   `-- web/
|       `-- src/
|           |-- app/                Setup, login and authenticated pages
|           |-- components/         Cloudscape console components
|           `-- lib/                API, auth, sockets and shared UI utilities
|-- packages/
|   |-- shared/src/                 Schema, DB tools, contracts and types
|   |-- polling-engine/src/         Polling, trap receiver and discovery
|   |-- ai-engine/src/              AI provider adapters
|   `-- notification/src/           Notification transport adapters
|-- scripts/                        Startup and regression harnesses
|-- snmpsim/                        SNMP simulator fixtures
`-- docs/                           Design notes and QA reports
```

Yarn 1.22 workspaces link the applications and shared packages. Turborepo coordinates development, build and lint tasks; Vitest runs the unit suite and Playwright covers browser flows.

| Command | Purpose |
|---|---|
| `yarn dev` | Start API and web development tasks |
| `yarn dev:api` / `yarn dev:web` | Start one application |
| `yarn build` | Build workspace packages and applications |
| `yarn lint` | Run workspace lint tasks |
| `yarn test` / `yarn test:watch` | Run unit tests once / in watch mode |
| `yarn db:migrate` | Apply checked-in database migrations |
| `yarn db:seed` | Add optional non-production sample data |

### API conventions

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

### Verification

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

## Troubleshooting

<details>
<summary><b>The console loads, but API requests fail</b></summary>

Check `docker compose ps` and `docker compose logs api web`. `NEXT_PUBLIC_API_URL` must be reachable from the browser, not just from inside Docker. Check `CORS_ORIGIN` against the exact web origin, including scheme and port. Rebuild the web image after changing its compiled API URL.

</details>

<details>
<summary><b>A device responds to ping but has no SNMP measurements</b></summary>

Confirm the API host can reach the device's configured SNMP port, the device accepts its source address, and the version/community or SNMPv3 settings match. Some devices do not expose the MIBs used for CPU, memory or interface measurements. Interface throughput also needs a second observation to calculate a counter delta.

</details>

<details>
<summary><b>Traps do not appear</b></summary>

Check `SNMP_TRAP_ENABLED`, accepted communities and explicit `SNMP_TRAP_USERS`. Send to host UDP 162 for the supplied Docker deployment, or the configured receiver port for direct startup (default 1162). Check firewall rules and that the trap's source IP matches a unique registered device.

</details>

<details>
<summary><b>AI analysis or notification delivery fails</b></summary>

Create and enable providers/channels in the web UI; legacy environment variables do not create them. For notifications, inspect delivery history for status and transport errors, and test the configured channel. For AI, confirm an enabled provider has valid credentials and a reachable endpoint.

</details>

## Documentation

| Resource | Covers |
|---|---|
| [Environment template](.env.example) | Supported application environment settings |
| [Compose configuration](docker-compose.yml) | Services, dependencies, published ports and simulator definitions |
| [Database schema](packages/shared/src/schema/index.ts) | Tables, fields and relations |
| [Shared response contracts](packages/shared/src/contracts.ts) | Machine-validated API response shapes |
| [Retest report](docs/qa/2026-10-02/RETEST_REPORT.md) | Executed QA, evidence and external validation limits |
| [Design notes](docs/design/) | Console design audits and redesign notes |

## License

ISC
