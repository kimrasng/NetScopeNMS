# @netpulse/web — Frontend Conventions

## Design System: Cloudscape (MANDATORY)

This app uses **AWS Cloudscape Design System** exclusively.

**DO NOT** use Tailwind CSS, shadcn/ui, Material UI, Ant Design, or any other UI framework.
**DO NOT** write custom CSS unless absolutely necessary (and only via CSS Modules).

### Required Packages

```
@cloudscape-design/components          — All UI components
@cloudscape-design/global-styles       — Global CSS reset and design tokens
@cloudscape-design/collection-hooks    — Table/Cards filtering, sorting, pagination
@cloudscape-design/board-components    — Dashboard board/widget layout
@cloudscape-design/component-toolkit   — Internal toolkit (peer dependency)
```

### Next.js Configuration

Cloudscape packages must be transpiled in `next.config.mjs`:

```js
const nextConfig = {
  transpilePackages: [
    '@cloudscape-design/components',
    '@cloudscape-design/component-toolkit',
  ],
};
```

All Cloudscape components are client-side only. Pages using Cloudscape must have `"use client"` directive.

### Component Import Pattern

Always import from individual component paths:

```tsx
// ✅ Correct
import Button from "@cloudscape-design/components/button";
import Table from "@cloudscape-design/components/table";

// ❌ Wrong — barrel imports increase bundle size
import { Button, Table } from "@cloudscape-design/components";
```

## App Shell Structure

```
TopNavigation          — Fixed top bar (logo, user menu, notifications bell)
└── AppLayout          — Main layout shell
    ├── navigation     — SideNavigation (left panel)
    ├── breadcrumbs    — BreadcrumbGroup
    ├── notifications  — Flashbar (toast messages)
    ├── content        — ContentLayout > page content
    ├── splitPanel     — SplitPanel (detail view for table selections)
    └── tools          — HelpPanel (right panel, contextual help)
```

### Content Types

Set `AppLayout.contentType` based on page type:
- `"table"` — Device list, incident list, audit logs, etc.
- `"form"` — Create/edit forms
- `"wizard"` — Setup wizard, multi-step flows
- `"dashboard"` — Dashboard pages
- `"cards"` — Card grid pages

### SideNavigation Structure

```
Monitoring
  ├── Dashboard
  ├── Devices
  ├── Incidents
  └── Topology
Network
  ├── Metrics
  └── Maps
Operations
  ├── Alert Rules
  ├── Notifications
  ├── Maintenance
  └── Config Snapshots
Intelligence
  ├── AI Assistant
  └── Reports
Administration
  ├── Users
  ├── Site Settings
  ├── API Keys
  └── Audit Logs
```

## File Structure

```
apps/web/
├── src/
│   ├── app/                    — Next.js App Router pages
│   │   ├── layout.tsx          — Root layout (Cloudscape global styles)
│   │   ├── page.tsx            — Redirect to /dashboard
│   │   ├── login/              — Login page
│   │   ├── setup/              — Initial setup wizard
│   │   ├── invite/             — Invitation acceptance
│   │   ├── (app)/              — Authenticated route group
│   │   │   ├── layout.tsx      — App shell (TopNav + AppLayout + SideNav)
│   │   │   ├── dashboard/      — Dashboard page
│   │   │   ├── devices/        — Device list + [id] detail
│   │   │   ├── incidents/      — Incident list + [id] detail
│   │   │   ├── topology/       — Network topology (ReactFlow)
│   │   │   ├── maps/           — Geographic map (Leaflet)
│   │   │   ├── metrics/        — Metrics explorer
│   │   │   ├── alert-rules/    — Alert rule CRUD
│   │   │   ├── notifications/  — Notification channels + history
│   │   │   ├── maintenance/    — Maintenance windows
│   │   │   ├── config-snapshots/ — Config snapshot viewer
│   │   │   ├── ai/             — AI assistant (query + chat)
│   │   │   ├── reports/        — Report list + generation
│   │   │   ├── dashboards/     — Custom dashboard CRUD
│   │   │   └── settings/       — Users, site, API keys, audit logs
│   ├── lib/
│   │   ├── api.ts              — Fetch wrapper with auth token
│   │   ├── auth.ts             — Auth state management (token, user)
│   │   ├── socket.ts           — Socket.IO client
│   │   └── types.ts            — Shared frontend types
│   ├── components/
│   │   ├── app-layout.tsx      — Reusable AppLayout wrapper
│   │   ├── navigation.tsx      — SideNavigation config
│   │   ├── top-nav.tsx         — TopNavigation config
│   │   ├── notifications.tsx   — Flashbar notification manager
│   │   └── common/             — Shared components (StatusIndicator, etc.)
│   └── hooks/
│       ├── use-api.ts          — Data fetching hooks (SWR-like)
│       ├── use-auth.ts         — Auth context hook
│       └── use-notifications.ts — Flash notification hook
```

## Coding Conventions

### React Components

- Functional components only, with `"use client"` directive
- Named exports: `export function DeviceListPage() { ... }`
- Props interfaces: `interface DeviceListPageProps { ... }`
- No default exports except for Next.js page/layout files

### State Management

- React Context for global state (auth, notifications)
- `useState` / `useReducer` for local component state
- No external state library (no Redux, no Zustand)

### Data Fetching

- Custom `useApi` hook wrapping `fetch` with JWT token injection
- API base URL from `NEXT_PUBLIC_API_URL` env var
- All API calls go through `lib/api.ts` wrapper

### Table Pattern (Cloudscape)

```tsx
import Table from "@cloudscape-design/components/table";
import { useCollection } from "@cloudscape-design/collection-hooks";

// Use collection hooks for filtering, sorting, pagination
const { items, collectionProps, filterProps, paginationProps } = useCollection(data, {
  filtering: { ... },
  sorting: { ... },
  pagination: { pageSize: 50 },
  selection: { trackBy: "id" },
});
```

### Form Pattern (Cloudscape)

```tsx
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";

// Wrap form sections in Container with Header
// Use SpaceBetween for consistent spacing
// Use FormField for labels, descriptions, error text
```

### Status Indicators

Map device/incident statuses to Cloudscape `StatusIndicator`:
- `up` → `<StatusIndicator type="success">Up</StatusIndicator>`
- `down` → `<StatusIndicator type="error">Down</StatusIndicator>`
- `warning` → `<StatusIndicator type="warning">Warning</StatusIndicator>`
- `unknown` → `<StatusIndicator type="stopped">Unknown</StatusIndicator>`
- `maintenance` → `<StatusIndicator type="in-progress">Maintenance</StatusIndicator>`
- `problem` → `<StatusIndicator type="error">Problem</StatusIndicator>`
- `acknowledged` → `<StatusIndicator type="warning">Acknowledged</StatusIndicator>`
- `resolved` → `<StatusIndicator type="success">Resolved</StatusIndicator>`

### Severity Badges

Map severity levels to Cloudscape `Badge`:
- `critical` → `<Badge color="red">Critical</Badge>`
- `high` → `<Badge color="red">High</Badge>`
- `medium` → `<Badge color="blue">Medium</Badge>`
- `low` → `<Badge color="grey">Low</Badge>`

## API Integration

- Base URL: `process.env.NEXT_PUBLIC_API_URL` (default: `http://localhost:4000`)
- Auth: JWT Bearer token stored in localStorage
- All responses follow: `{ data: T[], pagination: { page, limit, total, totalPages } }`
- Error shape: `{ error: string, message?: string }`
- WebSocket: Socket.IO at `ws://localhost:4000/ws` with JWT auth

## Environment Variables

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```
