<p align="center">
  <h1 align="center">NetPulse</h1>
  <p align="center">AI-Powered Network Management System</p>
</p>

<p align="center">
  <a href="https://github.com/netpulse/netpulse/actions"><img src="https://github.com/netpulse/netpulse/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/license-ISC-blue.svg" alt="License: ISC">
  <img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg" alt="Node.js >= 22">
  <img src="https://img.shields.io/badge/version-1.0.0-orange.svg" alt="Version 1.0.0">
</p>

NetPulse is a full-stack network management system built for monitoring, alerting, and troubleshooting network infrastructure. It combines real-time SNMP/ICMP polling with AI-powered root cause analysis, multi-channel notifications, and interactive topology maps.

## Features

### Device Management
- Full CRUD for network devices (routers, switches, servers, firewalls, APs, load balancers, storage)
- Device groups and tag-based organization
- Geo-coordinates (latitude/longitude) for map placement
- Interface discovery and tracking
- Per-device metrics history
- Scope-based access control per device/group

### Monitoring & Polling
- SNMP v1/v2c/v3 polling with configurable intervals
- ICMP ping monitoring
- BullMQ-based distributed worker queues
- Time-series metric storage with TimescaleDB `time_bucket` aggregation
- Anomaly detection (2σ deviation from 7-day rolling average)
- Linear trend extrapolation and threshold breach prediction

### SNMP Trap Receiver
- Listens for SNMP v1/v2c/v3 traps
- Automatic incident creation from trap events

### Auto-Discovery
- LLDP and ARP-based neighbor discovery
- Automatic topology mapping from discovered relationships

### Alerting & Incidents
- Threshold-based alert rules with configurable operators (`>`, `>=`, `<`, `<=`, `==`, `!=`)
- Flap detection with configurable threshold and window
- Escalation timers with separate notification channels
- Runbook URL attachment per rule
- Full incident lifecycle: problem, acknowledged, resolved
- Incident event timeline with comments
- Auto-resolve on metric recovery
- Real-time WebSocket updates via Socket.IO

### AI Integration
- Multi-provider support: OpenAI, Gemini, Claude, Custom endpoints
- Root cause analysis (RCA) generation for incidents
- Incident chat assistant with metric context
- Natural language queries translated to safe, read-only SQL
- AI narrative report generation
- Provider management (add, test, set default)

### Notifications
- 7 notification channels: Email (SMTP), Telegram, Discord, Slack, SMS (Twilio), PagerDuty, Webhook
- In-app notifications via WebSocket
- Per-channel test dispatch
- Notification history with send/fail status
- Exponential backoff retry (3 attempts)

### Dashboard
- Real-time summary stats (device status counts, active incidents)
- Aggregate throughput charts (bandwidth in/out)
- Top N devices by metric (CPU, memory, etc.)
- Recent alerts feed

### Topology & Maps
- Interactive network topology built with ReactFlow
- Geographic device maps with Leaflet
- Auto-layout from LLDP/ARP discovery data

### Reports
- Four report types: availability, performance, alert summary, AI narrative
- Configurable periods: daily, weekly, monthly
- AI-generated executive summaries with recommendations

### Audit Logging
- Tracks user actions across all resources
- Filterable by user, action, resource, and date range

### Config Snapshots
- Device configuration backup and versioning
- SHA-256 hash-based change detection
- Line-by-line diff between snapshots

### Maintenance Windows
- Scheduled maintenance with start/end times
- Device and group scoping
- Recurring windows with cron expressions
- Active/upcoming/past filtering

### API Keys
- User-scoped API key generation
- SHA-256 hashed storage (raw key shown once)
- Optional expiration dates

### Authentication & RBAC
- JWT-based authentication (7-day token expiry)
- Four roles: `super_admin`, `admin`, `operator`, `viewer`
- Scope-based access: `all` or `restricted` (per device/group)
- Invitation-only user registration with token-based onboarding
- Initial setup wizard for first admin account

## Tech Stack

### Frontend
- Next.js 14 (App Router)
- React 18
- Tailwind CSS + shadcn/ui
- Zustand (state management)
- Recharts (charts and graphs)
- ReactFlow (topology diagrams)
- Leaflet (geographic maps)

### Backend
- Fastify 5 with TypeScript
- Socket.IO (real-time WebSocket)
- Drizzle ORM (type-safe queries)
- BullMQ (job queues and workers)
- Zod (request validation)
- Swagger/OpenAPI auto-generated docs at `/docs`

### Database
- TimescaleDB (PostgreSQL 16 with time-series extensions)
- Redis 7 (BullMQ job queues, caching)

### Tooling
- Turborepo (monorepo build orchestration)
- Yarn 1.22 workspaces
- Vitest (testing)
- GitHub Actions (CI/CD)

## Project Structure

```
netpulse/
├── apps/
│   ├── api/                  # @netpulse/api - Fastify backend (14 route modules)
│   └── web/                  # @netpulse/web - Next.js frontend
├── packages/
│   ├── shared/               # @netpulse/shared - Drizzle ORM schema (17 tables), DB connection
│   ├── polling-engine/       # @netpulse/polling-engine - SNMP/ICMP polling, trap receiver, auto-discovery
│   ├── ai-engine/            # @netpulse/ai-engine - Multi-provider AI engine
│   └── notification/         # @netpulse/notification - 7-channel notification dispatcher
├── docker-compose.yml
├── turbo.json
└── package.json
```

## Quick Start

### Prerequisites

- Node.js 22 (LTS)
- Yarn 1.22+
- Docker and Docker Compose

### 1. Clone the repository

```bash
git clone https://github.com/netpulse/netpulse.git
cd netpulse
```

### 2. Start infrastructure services

```bash
docker compose up -d postgres redis
```

This starts TimescaleDB on port 5432 and Redis on port 6379.

### 3. Install dependencies

```bash
yarn install
```

### 4. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your settings. See [Environment Variables](#environment-variables) for details.

### 5. Run database migrations

```bash
yarn db:migrate
```

Optionally seed with sample data:

```bash
yarn db:seed
```

### 6. Start development servers

```bash
yarn dev
```

This starts both the API server (http://localhost:4000) and the web app (http://localhost:3000) concurrently via Turborepo.

You can also start them individually:

```bash
yarn dev:api   # API only on port 4000
yarn dev:web   # Web only on port 3000
```

### 7. Open the app

Visit http://localhost:3000. On first launch, you'll see the setup wizard to create your admin account.

API docs are available at http://localhost:4000/docs (Swagger UI).

## Docker Deployment

Run the full stack with Docker Compose:

```bash
docker compose up -d
```

This starts four services:

| Service    | Image                          | Port |
|------------|--------------------------------|------|
| `postgres` | timescale/timescaledb:latest-pg16 | 5432 |
| `redis`    | redis:7-alpine                 | 6379 |
| `api`      | Built from Dockerfile          | 4000 |
| `web`      | Built from Dockerfile          | 3000 |

Set `NEXTAUTH_SECRET` and `ANTHROPIC_API_KEY` in your environment or a `.env` file before running.

```bash
docker compose down     # Stop all services
docker compose logs -f  # Follow logs
```

## API Endpoints

All endpoints are prefixed with `/api`. Most require a JWT Bearer token.

### Auth (`/api/auth`)

| Method | Path        | Description          | Auth     |
|--------|-------------|----------------------|----------|
| POST   | `/login`    | Login, get JWT token | Public   |
| GET    | `/me`       | Get current user     | Required |
| PUT    | `/profile`  | Update display name  | Required |
| PUT    | `/password` | Change password      | Required |

### Devices (`/api/devices`)

| Method | Path                | Description              | Auth              |
|--------|---------------------|--------------------------|-------------------|
| GET    | `/`                 | List devices (paginated) | Required          |
| GET    | `/:id`              | Get device with interfaces | Required        |
| POST   | `/`                 | Create device            | Operator+         |
| PUT    | `/:id`              | Update device            | Operator+         |
| DELETE | `/:id`              | Delete device            | Admin+            |
| GET    | `/:id/interfaces`   | Get device interfaces    | Required          |
| GET    | `/:id/metrics`      | Get device metrics       | Required          |

### Incidents (`/api/incidents`)

| Method | Path                   | Description              | Auth     |
|--------|------------------------|--------------------------|----------|
| GET    | `/`                    | List incidents (paginated) | Required |
| GET    | `/:id`                 | Get incident with events | Required |
| POST   | `/:id/acknowledge`     | Acknowledge incident     | Required |
| POST   | `/:id/resolve`         | Resolve incident         | Required |
| POST   | `/:id/ai-analysis`     | Trigger AI analysis      | Required |
| POST   | `/:id/comments`        | Add comment              | Required |

### Dashboard (`/api/dashboard`)

| Method | Path             | Description                    | Auth     |
|--------|------------------|--------------------------------|----------|
| GET    | `/summary`       | Device and incident counts     | Required |
| GET    | `/top-devices`   | Top N devices by metric        | Required |
| GET    | `/recent-alerts` | Recent incidents feed          | Required |
| GET    | `/throughput`    | Aggregate bandwidth over time  | Required |

### AI (`/api/ai`)

| Method | Path                    | Description                | Auth     |
|--------|-------------------------|----------------------------|----------|
| POST   | `/query`                | Natural language query     | Required |
| POST   | `/chat`                 | Incident chat assistant    | Required |
| POST   | `/rca/:incidentId`      | Generate root cause analysis | Required |
| GET    | `/providers`            | List AI providers          | Required |
| POST   | `/providers`            | Add AI provider            | Admin+   |
| PUT    | `/providers/:id`        | Update AI provider         | Admin+   |
| DELETE | `/providers/:id`        | Delete AI provider         | Admin+   |
| POST   | `/providers/:id/test`   | Test provider connection   | Admin+   |

### Notifications (`/api/notifications`)

| Method | Path                    | Description              | Auth     |
|--------|-------------------------|--------------------------|----------|
| GET    | `/channels`             | List notification channels | Required |
| POST   | `/channels`             | Create channel           | Admin+   |
| PUT    | `/channels/:id`         | Update channel           | Admin+   |
| DELETE | `/channels/:id`         | Delete channel           | Admin+   |
| POST   | `/test/:channelId`      | Test send notification   | Admin+   |
| GET    | `/history`              | Notification history     | Required |

### Metrics (`/api/metrics`)

| Method | Path         | Description                          | Auth     |
|--------|--------------|--------------------------------------|----------|
| GET    | `/`          | Time-series query with bucketing     | Required |
| GET    | `/anomalies` | Anomaly detection (2σ deviation)     | Required |
| GET    | `/predict`   | Trend prediction and threshold ETA   | Required |

### Alert Rules (`/api/alert-rules`)

| Method | Path    | Description        | Auth     |
|--------|---------|--------------------|----------|
| GET    | `/`     | List alert rules   | Required |
| GET    | `/:id`  | Get alert rule     | Required |
| POST   | `/`     | Create alert rule  | Admin+   |
| PUT    | `/:id`  | Update alert rule  | Admin+   |
| DELETE | `/:id`  | Delete alert rule  | Admin+   |

### Reports (`/api/reports`)

| Method | Path        | Description                          | Auth     |
|--------|-------------|--------------------------------------|----------|
| GET    | `/`         | List generated reports               | Required |
| GET    | `/:id`      | Get report details                   | Required |
| POST   | `/generate` | Generate report (4 types available)  | Required |

### Setup (`/api/setup`)

| Method | Path              | Description                  | Auth        |
|--------|-------------------|------------------------------|-------------|
| GET    | `/status`         | Check if setup is needed     | Public      |
| GET    | `/site`           | Get site settings            | Public      |
| PUT    | `/site`           | Update site settings         | Admin+      |
| POST   | `/init`           | Initial admin setup          | Public (once) |
| POST   | `/invite`         | Create invitation link       | Admin+      |
| GET    | `/invite/:token`  | Get invitation details       | Public      |
| POST   | `/invite/accept`  | Accept invitation, register  | Public      |
| GET    | `/invitations`    | List all invitations         | Admin+      |
| GET    | `/users`          | List all users               | Admin+      |
| DELETE | `/users/:id`      | Delete user                  | Super Admin |

### Audit Logs (`/api/audit-logs`)

| Method | Path   | Description              | Auth   |
|--------|--------|--------------------------|--------|
| GET    | `/`    | Query audit logs         | Admin+ |
| GET    | `/:id` | Get audit log entry      | Admin+ |

### Config Snapshots (`/api/config-snapshots`)

| Method | Path   | Description                | Auth       |
|--------|--------|----------------------------|------------|
| GET    | `/`    | List snapshots (paginated) | Required   |
| GET    | `/:id` | Get snapshot with config   | Required   |
| POST   | `/`    | Create snapshot            | Operator+  |
| DELETE | `/:id` | Delete snapshot            | Operator+  |

### Maintenance Windows (`/api/maintenance-windows`)

| Method | Path      | Description                  | Auth     |
|--------|-----------|------------------------------|----------|
| GET    | `/active` | Get currently active windows | Required |
| GET    | `/`       | List windows (paginated)     | Required |
| GET    | `/:id`    | Get window details           | Required |
| POST   | `/`       | Create maintenance window    | Admin+   |
| PUT    | `/:id`    | Update maintenance window    | Admin+   |
| DELETE | `/:id`    | Delete maintenance window    | Admin+   |

### API Keys (`/api/api-keys`)

| Method | Path   | Description    | Auth     |
|--------|--------|----------------|----------|
| GET    | `/`    | List your keys | Required |
| POST   | `/`    | Create API key | Required |
| DELETE | `/:id` | Revoke API key | Required |

### Health (`/api/health`)

| Method | Path | Description  | Auth   |
|--------|------|--------------|--------|
| GET    | `/`  | Health check | Public |

## Testing

Tests run with Vitest. The suite includes 140 tests across 10 test files.

```bash
# Run all tests
yarn test

# Watch mode
yarn test:watch
```

## CI/CD

GitHub Actions runs on every push and pull request to `main` and `develop`:

1. Checkout code
2. Setup Node.js 22
3. Cache `node_modules` and Turbo build artifacts
4. Install dependencies (`yarn install --frozen-lockfile`)
5. Typecheck and build all packages (`yarn build`)
6. Run test suite (`npx vitest run`)

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable              | Description                        | Default                                              |
|-----------------------|------------------------------------|------------------------------------------------------|
| `DATABASE_URL`        | PostgreSQL connection string       | `postgresql://netpulse:netpulse@localhost:5432/netpulse` |
| `REDIS_URL`           | Redis connection string            | `redis://localhost:6379`                             |
| `NEXTAUTH_SECRET`     | JWT signing secret                 | (change in production)                               |
| `NEXTAUTH_URL`        | App base URL                       | `http://localhost:3000`                              |
| `ANTHROPIC_API_KEY`   | Anthropic API key (for AI features)| -                                                    |
| `SMTP_HOST`           | SMTP server host                   | `smtp.gmail.com`                                     |
| `SMTP_PORT`           | SMTP server port                   | `587`                                                |
| `SMTP_USER`           | SMTP username                      | -                                                    |
| `SMTP_PASS`           | SMTP password                      | -                                                    |
| `TELEGRAM_BOT_TOKEN`  | Telegram bot token                 | -                                                    |
| `DISCORD_WEBHOOK_URL` | Discord webhook URL                | -                                                    |
| `SLACK_WEBHOOK_URL`   | Slack webhook URL                  | -                                                    |
| `TWILIO_SID`          | Twilio account SID                 | -                                                    |
| `TWILIO_TOKEN`        | Twilio auth token                  | -                                                    |
| `TWILIO_FROM`         | Twilio sender phone number         | -                                                    |
| `PAGERDUTY_ROUTING_KEY` | PagerDuty routing key            | -                                                    |
| `JIRA_URL`            | Jira instance URL                  | -                                                    |
| `JIRA_EMAIL`          | Jira account email                 | -                                                    |
| `JIRA_TOKEN`          | Jira API token                     | -                                                    |
| `KAKAO_API_KEY`       | Kakao API key                      | -                                                    |
| `KAKAO_SENDER_KEY`    | Kakao sender key                   | -                                                    |
| `NODE_ENV`            | Environment mode                   | `development`                                        |
| `API_PORT`            | API server port                    | `4000`                                               |
| `WEB_PORT`            | Web server port                    | `3000`                                               |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests (`yarn test`) and build (`yarn build`)
5. Commit with a clear message
6. Open a pull request against `develop`

Please keep PRs focused on a single concern. Run `yarn lint` before submitting.

## License

ISC
