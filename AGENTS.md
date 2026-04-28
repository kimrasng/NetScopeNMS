# NetPulse — Project Conventions

## Workflow — Planning First (MANDATORY)

Before implementing ANY feature or change, you MUST go through a planning conversation with the user:

1. **Receive request** — User describes what they want
2. **Ask questions** — Use interactive question prompts to clarify:
   - Scope: What exactly is included/excluded?
   - Design decisions: Which approach among alternatives?
   - Priority: What to build first if multi-step?`
   - Constraints: Any specific requirements or limitations?
3. **Present plan** — Summarize the agreed plan back to the user
4. **Get confirmation** — Wait for explicit "go ahead" before writing any code
5. **Implement** — Only then start coding

**DO NOT** skip the planning phase. Even for seemingly simple tasks, confirm scope first.
**DO NOT** start writing code while still gathering requirements.

This applies to all AI agents working on this project.

## Language — Korean (MANDATORY)

All communication with the user MUST be in **Korean (한국어)**.
- Questions, plans, summaries, explanations — all in Korean
- Code, comments, variable names, commit messages — remain in English
- AGENTS.md and documentation files — remain in English

## Overview

NetPulse is an AI-powered Network Management System (NMS). Turborepo monorepo with Yarn 1.22 workspaces.

## Architecture

```
apps/api/          → @netpulse/api      — Fastify 5 REST API + Socket.IO
apps/web/          → @netpulse/web      — Next.js 14 (App Router) + Cloudscape Design System
packages/shared/   → @netpulse/shared   — Drizzle ORM schema (19 tables), DB connection, shared types
packages/polling-engine/ → @netpulse/polling-engine — SNMP/ICMP polling, BullMQ workers, trap receiver, LLDP/ARP discovery
packages/ai-engine/     → @netpulse/ai-engine     — Multi-provider AI (OpenAI, Gemini, Claude, Custom)
packages/notification/  → @netpulse/notification  — 7-channel notification dispatcher
```

## Tech Stack

| Layer      | Technology                                                    |
|------------|---------------------------------------------------------------|
| Runtime    | Node.js 22, TypeScript (ES2022, strict mode)                  |
| Backend    | Fastify 5, Socket.IO 4, Zod validation, Swagger/OpenAPI      |
| Frontend   | Next.js 14 App Router, Cloudscape Design System, Recharts     |
| ORM        | Drizzle ORM with postgres.js driver                           |
| Database   | TimescaleDB (PostgreSQL 16 + time-series hypertables)         |
| Queue      | BullMQ + Redis 7                                              |
| Build      | Turborepo, Yarn 1.22 workspaces, Vitest                      |
| CI/CD      | GitHub Actions                                                |

## Design System — Cloudscape

The frontend uses **AWS Cloudscape Design System** exclusively. No Tailwind, no shadcn/ui, no custom CSS frameworks.

Key packages:
- `@cloudscape-design/components` — All UI components
- `@cloudscape-design/global-styles` — Global CSS reset and tokens
- `@cloudscape-design/collection-hooks` — Table/Cards filtering, sorting, pagination
- `@cloudscape-design/board-components` — Dashboard board/widget layout

Key layout components:
- `TopNavigation` — App-wide top bar (logo, user menu, notifications)
- `AppLayout` — Main shell (side nav, content, tools panel, split panel)
- `SideNavigation` — Left nav with sections, links, dividers, badges
- `ContentLayout` — Page-level header + content wrapper
- `SplitPanel` — Detail panel for table selections

Content types for `AppLayout.contentType`:
- `"table"` — Table pages (devices, incidents, audit logs)
- `"form"` — Create/edit forms
- `"wizard"` — Multi-step flows (setup wizard)
- `"dashboard"` — Dashboard pages
- `"cards"` — Card grid pages

## TypeScript Conventions

- **Strict mode** — `strict: true`, `noUnusedLocals`, `noUnusedParameters`
- **Module** — ESNext with bundler resolution
- **Target** — ES2022
- **No type suppression** — Never use `as any`, `@ts-ignore`, `@ts-expect-error`
- **Zod for validation** — All API request bodies validated with Zod schemas
- **Type exports** — Use `export type` for type-only exports

## Code Style

- ESM modules (`"type": "module"` in package.json)
- File extensions in imports: `.js` for TypeScript files (ESM convention)
- Named exports preferred over default exports
- Functional components only (no class components)
- Section comments: `// ─── Section Name ───────────────────`

## API Conventions

- All endpoints prefixed with `/api`
- JWT Bearer token authentication (7-day expiry)
- Four roles: `super_admin`, `admin`, `operator`, `viewer`
- Scope-based access: `all` or `restricted` (per device/group)
- Paginated responses: `{ data: T[], pagination: { page, limit, total, totalPages } }`
- Error responses: `{ error: string, message?: string }`
- Audit logging on all mutating operations

## Database

- Drizzle ORM with postgres.js driver
- Schema in `packages/shared/src/schema/index.ts`
- 19 tables with UUID primary keys, timestamptz columns
- TimescaleDB hypertable for `metrics` table
- Relations defined with `drizzle-orm/relations`

## Testing

- Vitest for all packages
- 140+ tests across 10 test files
- `yarn test` runs all, `yarn test:watch` for dev

## Commands

```bash
yarn dev          # Start API + Web concurrently
yarn dev:api      # API only (port 4000)
yarn dev:web      # Web only (port 3000)
yarn build        # Build all packages
yarn test         # Run all tests
yarn db:migrate   # Run database migrations
yarn db:seed      # Seed sample data
yarn lint         # Lint all packages
```
