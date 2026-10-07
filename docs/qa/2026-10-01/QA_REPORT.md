# NetPulse E2E and QA Audit

Audit started: 2026-10-01; completed: 2026-10-02, Asia/Tokyo. Reviewed commit: `a49672de3cc88445aa2947937724d94f9c2a605f`.

The application builds and its 140 existing unit tests pass, but the tested installation is not ready for reliable production monitoring. Restricted users can access resources outside their scope, several primary web actions fail before reaching their handlers, and the normal startup does not run threshold evaluation. Reports, notification history, metric analysis, invitations, and API keys have incompatible contracts between the API and web application.

This report contains **41 grouped findings**. Some groups contain several closely related observations. Priorities are P1 (release blocker or substantial operational/security impact), P2 (functional gap or incorrect behavior), and P3 (minor improvement). Runtime observations and source-only findings are explicitly distinguished. No product source, migration, or lockfile was changed.

## Test conditions and results

The user authorized a full feature audit, a report, and local test-data changes. Tests used a disposable database and Redis, with generated accounts and devices. Existing application databases were not used.

| Component | Test configuration |
| --- | --- |
| Runtime | Node 24.20.0, Yarn 1.22.22; project CI targets Node 22 |
| Web | Next.js 14.2.35 production build, `http://localhost:3000` |
| API | Source execution through `tsx`, port 4000 |
| Database | TimescaleDB/PostgreSQL 16, QA-only port 15432 |
| Redis | Redis 7, QA-only port 16379 |
| External service substitutes | Local AI and webhook receiver on 14567; HTTP success and HTTP 503 cases |
| SNMP | Local UDP agent and proxy on 1162/1161; v1, v2c selection, and v3 SHA/AES authPriv |
| Fixtures | 56 initial devices, scoped users, interfaces, incidents, metric outlier, ping history, snapshots, maintenance, alert rules, reports, and channels |

**Baseline** means only the checked-in Drizzle migrations were applied. Four missing tables blocked AI providers, custom dashboards, and topology positions. After recording these failures, the current schema was pushed **only to the disposable QA DB**, to inspect behavior beyond that installation defect. Supplemental passes do not mean the checked-in migration path works.

| Check group | Checks | Passed | Failed |
| --- | ---: | ---: | ---: |
| Existing Vitest suite | 140, across 10 files | 140 | 0 |
| Baseline API integration | 67 | 22 | 45 |
| Supplemental schema integration | 20 | 13 | 7 |
| Web request reproduction and ICMP worker | 8 | 2 | 6 |
| Explicitly started threshold consumer | 4 | 1 | 3 |
| Final API/installation contracts | 8 | 2 | 6 |
| API control for real-time UI experiment | 1 | 1 | 0 |
| Local UDP SNMP | 7 | 4 | 3 |
| **Additional integration/worker checks** | **115** | **45** | **70** |

The 70 failed checks are **not 70 independent defects**. They include repeated controls and failures caused by the same missing tables or response mismatch. Browser observations are documented separately and are not included in that numerical pass rate. One overly narrow AI-chat assertion was corrected and rerun: the deterministic fixture can return valid RCA JSON text instead of the exact generic text originally expected. The corrected result is a pass, with the correction preserved in the JSON evidence.

`yarn build` passed for all six packages. `yarn lint` failed because the web workspace has no ESLint configuration and opens an interactive configuration prompt. `yarn db:seed` failed because its delegated workspace script does not exist. The initial Vitest output was observed in the tool transcript; a separate raw log was not preserved.

Machine-readable results: [summary.json](/Users/kimrasng/dev/netscopeNMS/docs/qa/2026-10-01/evidence/summary.json), [baseline results](/Users/kimrasng/dev/netscopeNMS/docs/qa/2026-10-01/evidence/api-results.json), [supplemental results](/Users/kimrasng/dev/netscopeNMS/docs/qa/2026-10-01/evidence/supplemental-results.json), [worker results](/Users/kimrasng/dev/netscopeNMS/docs/qa/2026-10-01/evidence/threshold-results.json), and [SNMP results](/Users/kimrasng/dev/netscopeNMS/docs/qa/2026-10-01/evidence/snmp-results.json).

## Feature coverage

| Area | What was exercised | Result and limit |
| --- | --- | --- |
| Setup and authentication | Fresh setup API, repeated setup rejection, valid/invalid login, browser login/logout, account lifecycle | Basic flows pass; disabled/deleted users and stale roles fail. Setup wizard submission was not separately repeated in the browser. |
| Dashboard | Summary, throughput, recent alerts; admin and scoped viewer | Renders fixture data; exposes global data to scoped viewer; no automatic refresh. |
| Devices | API create/read/update/delete, browser create/edit/delete, search/type/page, detail; interface data | Create/edit pass; deletion buttons and server filters/pages fail; scope and SNMP configuration gaps. |
| Polling | Actual queued ICMP loopback job; direct local SNMP v1/v2c/v3 | ICMP persistence and v3 authPriv pass; scheduling, status, v2c wire version, and sparse interface indices fail. |
| Incidents | List/detail, comment, acknowledge API, resolve API and browser, AI button, Socket.IO experiment | Comments and JSON-bodied API resolve pass; web buttons, scope, real-time rendering, and placeholder analysis fail. |
| Metrics | Aggregation, anomaly fixture, prediction, browser query and date preset | API aggregation/outlier detection pass; analysis rendering and date/query behavior fail. |
| Topology and maps | Both browser routes and topology positions API | Placeholder pages; positions API passes only after supplemental schema. |
| Alert rules | API creation, list/create form, queued metric and explicit consumer | Storage works; default consumer absent, notifications/maintenance/group semantics fail. |
| Notifications | Channel creation/list, local successful and rejecting webhooks, stored history, browser history | Local HTTP delivery reaches receiver; failure handling, history display and test button fail. Real vendors were not contacted. |
| Maintenance | Active/list/create API, invalid ranges/cron, browser list, actual threshold behavior | Stored windows display; suppression and recurrence are not operational. |
| Config snapshots | Create/hash/diff API; two-row browser comparison | Manual snapshot comparison works; access restriction fails. No automatic SSH backup was verified. |
| AI | Provider CRUD/test, query/chat/RCA API, query/chat web | Works with a deterministic local provider after schema supplementation; results and analysis entry points are inconsistent. |
| Reports | Availability/performance/alert-summary/AI-narrative APIs, list and browser generation | Some API reports have data; web list remains empty; availability and narrative are incorrect. |
| Users/invitations | API invitation acceptance, email mismatch, browser invitation creation/list | Invitation links are broken; restricted-resource assignment is absent from UI. |
| API keys | Creation/authentication/expiry API, browser creation | Keys are stored but cannot authenticate; raw value and date contracts fail. |
| Site/profile | Site name and profile name API, browser forms, phone roundtrip | Name changes work; phone and logo have implementation gaps. |
| Preferences | Browser language/theme selection and reload | Korean and dark theme selections persist in the test browser. |
| Audit logs | Browser list; compare mutations with stored logs | Existing device/site events display; several resource mutations are absent. |
| Tooling/docs | Tests/build/lint/seed, migrations, Timescale initialization, OpenAPI, README claims | Build/unit tests pass; installation, lint/seed and contract documentation need work. |

## Findings

### F01 — P1: Resource scope is enforced inconsistently

**Runtime.** A viewer restricted to Router A received Switch B's detail, metrics, incident detail and configuration snapshot. Its dashboard returned all 56 devices. A restricted operator successfully edited B. After schema supplementation, the viewer's AI query also returned B. A group-only viewer saw no incidents for an allowed group device.

Reproduce with two devices and a user allowed only A: request B's detail/metrics/snapshot, update B using the restricted operator, and query the dashboard/AI. Expected: denied or filtered. Observed: HTTP 200 and hidden data/mutation. Centralize resource authorization across REST, AI SQL, reports and group resolution. Sources: [devices.ts:89](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/devices.ts:89), [incidents.ts:31](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/incidents.ts:31), [dashboard.ts:11](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/dashboard.ts:11), [ai.ts:69](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/ai.ts:69).

### F02 — P1: Account disabling, deletion and role changes do not revoke access

**Runtime.** A disabled user could log in. A deleted user's existing JWT could still list devices. An operator downgraded to viewer could still update a device using its old token. Authentication trusts the token role and does not reject missing/disabled DB users; a missing user also loses the restricted scope filter.

Check current existence, enabled state and effective role on authenticated requests and socket connections, with an explicit revocation strategy. Sources: [auth middleware:8](/Users/kimrasng/dev/netscopeNMS/apps/api/src/middleware/auth.ts:8), [login:18](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/auth.ts:18).

### F03 — P1: Socket.IO broadcasts bypass resource scope

**Runtime.** A scoped viewer connected successfully and received `incident:updated` containing B's hidden incident. Incident handlers use global `io.emit`; socket authentication verifies the JWT but does not authorize individual events.

Use authorized user/device rooms or recipient filtering and apply account lifecycle checks. Sources: [socket authentication:132](/Users/kimrasng/dev/netscopeNMS/apps/api/src/index.ts:132), [global incident emission:108](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/incidents.ts:108). Evidence is the baseline check `WebSocket keeps hidden incident private`.

### F04 — P1: Credentials are included in general resource responses and audit details

**Runtime for SNMP; source review for other channels.** Viewer responses contained the fixture's SNMPv3 `authKey` and `privKey`. Device create/update logs store the full submitted body. Notification channel list responses select the complete configuration, and channel audit logging stores that configuration too.

Return explicitly selected public fields, mask credential values in logs, and restrict credential write/read paths. Source: [device list:73](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/devices.ts:73), [device audit:103](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/devices.ts:103), [notification channels:80](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/notifications.ts:80). Saved evidence redacts the QA credential values while preserving field presence.

### F05 — P1: Checked-in migrations omit four actively used tables

**Runtime, baseline.** Standard migration completed, but `ai_providers`, `dashboards`, `dashboard_widgets`, and `topology_positions` were absent. AI, custom dashboard and topology-position requests failed with PostgreSQL `42P01`. Pushing the current schema to the disposable DB enabled those routes.

Generate and commit the missing migrations; test a clean install using only the deployment migration command. Source: [schema:255](/Users/kimrasng/dev/netscopeNMS/packages/shared/src/schema/index.ts:255), [schema:303](/Users/kimrasng/dev/netscopeNMS/packages/shared/src/schema/index.ts:303). Supplemental schema push is diagnostic, not a product fix.

### F06 — P1: The shared web client breaks bodyless POST and DELETE actions

**Browser and API reproduction.** The client always sends `Content-Type: application/json` even when there is no body. Fastify returns HTTP 400 `FST_ERR_CTP_EMPTY_JSON_BODY`. Browser Resolve, AI Analysis and device Delete failed. The same request shape failed provider test, notification test and dashboard duplicate. Acknowledge without a comment uses this shape too.

Send JSON headers only with a body, or provide a deliberate empty JSON object where needed. A headerless API delete succeeded on the same disposable device. Sources: [api.ts:46](/Users/kimrasng/dev/netscopeNMS/apps/web/src/lib/api.ts:46), [incident handlers:75](/Users/kimrasng/dev/netscopeNMS/apps/web/src/app/(app)/incidents/[id]/page.tsx:75). Evidence: [delete failure screen](/Users/kimrasng/dev/netscopeNMS/docs/qa/2026-10-01/evidence/browser/device-delete-button-error.jpg), [followup results](/Users/kimrasng/dev/netscopeNMS/docs/qa/2026-10-01/evidence/followup-results.json).

### F07 — P1: Query parameter changes do not trigger fetching

**Browser.** Selecting Devices page 2 retained page 1's rows; selecting Router retained Server rows; search changes left stale data. `useApi` stores parameters in a ref, but its callback/effect dependencies include only the path.

Use a stable query key containing parameters and prevent stale responses from overwriting newer queries. The hook also affects incident filters, metric re-query, audit filters and other parameterized pages; those broader effects are source-derived. Source: [use-api.ts:31](/Users/kimrasng/dev/netscopeNMS/apps/web/src/hooks/use-api.ts:31). Evidence: [page 2](/Users/kimrasng/dev/netscopeNMS/docs/qa/2026-10-01/evidence/browser/device-pagination-stale.txt), [type filter](/Users/kimrasng/dev/netscopeNMS/docs/qa/2026-10-01/evidence/browser/device-type-filter-stale.txt).

### F08 — P1: Normal startup never starts threshold evaluation

**Runtime.** An `evaluate` job remained waiting and the `metric-events` queue had no workers. Bootstrap starts only the polling engine; `startThresholdEngine` is exported but not invoked. Consequently, threshold rule storage is not an operational alerting workflow.

Start and shut down the threshold worker as part of a supported service, and expose queue/worker health. Sources: [bootstrap:169](/Users/kimrasng/dev/netscopeNMS/apps/api/src/index.ts:169), [threshold engine:62](/Users/kimrasng/dev/netscopeNMS/apps/api/src/services/threshold-engine.ts:62).

### F09 — P1: Device changes do not synchronize polling schedules

**Runtime for new devices; source review for later changes.** An enabled device created after API startup had no repeatable polling job. Scheduling runs once at bootstrap. CRUD does not add/remove/update jobs, and scheduled payloads contain copied device configuration.

Synchronize schedules on creation, interval/configuration change, disabling and deletion; load current configuration when a job runs. Sources: [schedulePolling:330](/Users/kimrasng/dev/netscopeNMS/packages/polling-engine/src/index.ts:330), [device create:100](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/devices.ts:100).

### F10 — P1: A reachable new device remains Unknown

**Runtime.** A real one-shot loopback poll returned reachable=true, persisted metrics and updated `lastPolledAt`, but the status remained `unknown`. The poller treats `unknown` as a protected status, preventing the normal first transition to up/down.

Define status ownership explicitly and allow polling to resolve unknown state. Source: [protected statuses:281](/Users/kimrasng/dev/netscopeNMS/packages/polling-engine/src/index.ts:281). Evidence: `Successful first poll moves unknown device to up` in followup results.

### F11 — P1: Threshold incidents do not dispatch configured notifications or escalation

**Runtime plus source review.** With the threshold worker explicitly started, a triggered incident was created but no notification record appeared for the channel configured on its rule. The engine never calls the notification dispatcher. Escalation minutes/channels and runbook are stored fields; no escalation processor consumes them.

Connect incident transitions to rule-selected channels, delivery history, socket events and an escalation scheduler. Sources: [threshold creation:102](/Users/kimrasng/dev/netscopeNMS/apps/api/src/services/threshold-engine.ts:102), [notification helper:39](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/notifications.ts:39), [rule schema:17](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/alert-rules.ts:17).

### F12 — P1: Active maintenance does not suppress alerting; recurrence is storage only

**Runtime for suppression; source-only for recurrence.** An active window for A was visible in the web UI, but CPU events still created incidents for A when the threshold consumer was explicitly started. No maintenance lookup exists in that processing path. Cron strings are stored but no recurring-window executor is wired into startup.

Apply active device/group windows during incident evaluation and dispatch; implement recurrence semantics and validate them. Sources: [maintenance active query:22](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/maintenance-windows.ts:22), [threshold rule loop:79](/Users/kimrasng/dev/netscopeNMS/apps/api/src/services/threshold-engine.ts:79).

### F13 — P1: Group alert rules apply to devices outside the group

**Runtime.** A rule scoped to Group A created an incident for Switch B, which was outside that group. The threshold engine checks `deviceId` but never checks `groupId`.

Resolve current device/group membership and apply both rule scopes before evaluation. Source: [scope check:80](/Users/kimrasng/dev/netscopeNMS/apps/api/src/services/threshold-engine.ts:80). Evidence: `Group alert rule excludes device outside its group` in threshold results.

### F14 — P2: Concurrent metric events can create duplicate active incidents

**Runtime observation, source-supported.** When the explicit consumer processed the previously queued CPU event and the new CPU event, two active incidents were created for the same device/rule. The check-then-insert sequence is not atomic and worker concurrency is five.

Use a transactional deduplication mechanism or suitable uniqueness/locking strategy. This was observed in one event burst; a sustained concurrency campaign was not run. Source: [existence check and insert:89](/Users/kimrasng/dev/netscopeNMS/apps/api/src/services/threshold-engine.ts:89). Both incident IDs are preserved in threshold results.

### F15 — P1: The incident AI Analysis route reports placeholder text as generated analysis

**API runtime.** Posting an explicit `{}` to `/api/incidents/:id/ai-analysis` returned HTTP 200, wrote `AI Analysis pending - Device: ...`, and added an event saying analysis was generated. It does not call the AI engine. The separate `/api/ai/rca/:id` route produced and persisted real fixture RCA after schema supplementation.

Route the web action to the actual RCA service and report unavailability/failure honestly. The current web action additionally fails earlier because of F06. Source: [placeholder:158](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/incidents.ts:158).

### F16 — P1: Generated reports do not appear in the web list

**Browser and API runtime.** The API returns an array, while the web page reads `data.data` and pagination. Existing reports and a browser-generated report were absent from the list despite successful generation.

Agree on a paginated response and add a generation-to-list acceptance check. Sources: [report list API:33](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/reports.ts:33), [web list:73](/Users/kimrasng/dev/netscopeNMS/apps/web/src/app/(app)/reports/page.tsx:73). Evidence: [empty report list after generation](/Users/kimrasng/dev/netscopeNMS/docs/qa/2026-10-01/evidence/browser/report-generated-but-empty.jpg).

### F17 — P2: Stored notification history is invisible in the web page

**Browser and API runtime.** A notification record existed and the API returned it, but the History tab remained empty. The API returns an array; the web expects `{data,pagination}`. Direct channel tests also do not create delivery-history records.

Align the history contract and define whether test sends are recorded. Sources: [history API:144](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/notifications.ts:144), [history web:331](/Users/kimrasng/dev/netscopeNMS/apps/web/src/app/(app)/notifications/page.tsx:331).

### F18 — P1: Availability reports use current status instead of historical ping results

**Runtime.** A had 7 successful pings out of 13, but its report showed 100% availability because its current status was up. Expected sample availability was approximately 53.85%. `deviceIds:[A]` still produced a report covering all devices; `groupId` is similarly parsed but unused in the query.

Define a historical availability calculation, no-data handling and report scope. Source: [availability SQL:54](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/reports.ts:54). This calculation could mislead SLA decisions even when the report renders successfully.

### F19 — P1: AI narrative reports can succeed with no narrative

**Runtime and source review.** Generation returned HTTP 201 with empty content and `aiSummary:null`, including after a working local default provider was configured. This route ignores DB providers and only attempts a hardcoded Anthropic call when its environment key exists; failures are swallowed.

Use the configured AI-engine provider and return an explicit failure/unavailable response when no narrative is generated. Source: [narrative path:89](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/reports.ts:89). Real Anthropic delivery was not exercised.

### F20 — P2: Anomaly and prediction responses are not rendered correctly

**Browser and API runtime.** The anomaly API detected the CPU=99 fixture outlier in `{data:[...]}`. The page expects a plain array and displayed “No anomalies detected.” Prediction returns `{prediction:{daysUntilThreshold,slope,currentAvg}}` or a message; the page reads `currentTrend`, `predictedBreach` and `estimatedTime`, producing blank/dash fields.

Share response types and test both positive analysis and no-data cases through the UI. Sources: [anomaly API:75](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/metrics.ts:75), [prediction API:114](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/metrics.ts:114), [web analysis:131](/Users/kimrasng/dev/netscopeNMS/apps/web/src/app/(app)/metrics/page.tsx:131).

### F21 — P2: AI SQL results contain rows but the web shows only SQL

**Browser and API runtime, supplemental.** The query API returned 56 device rows without `columns`. The UI renders a data table only when `result.columns` is present, so the rows were not visible.

Supply column metadata or derive it consistently in the web client. Sources: [query return:70](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/ai.ts:70), [web table condition:116](/Users/kimrasng/dev/netscopeNMS/apps/web/src/app/(app)/ai/page.tsx:116). Evidence: [AI data missing screen](/Users/kimrasng/dev/netscopeNMS/docs/qa/2026-10-01/evidence/browser/ai-data-missing.jpg).

### F22 — P2: Metric range presets shift the requested period by the local timezone

**Browser/source.** At roughly 23:14 in UTC+9, the one-hour preset filled 13:14–14:14 rather than 22:14–23:14. It formats UTC via `toISOString().slice(0,16)` and later parses that timezone-less value as local time.

Keep instants internally and format/parse local inputs consistently. Source: [preset and query dates:83](/Users/kimrasng/dev/netscopeNMS/apps/web/src/app/(app)/metrics/page.tsx:83). Evidence: [preset snapshot](/Users/kimrasng/dev/netscopeNMS/docs/qa/2026-10-01/evidence/browser/metrics-preset-timezone.txt).

### F23 — P1: API key management does not produce a usable integration credential

**Browser and API runtime.** A generated key used as Bearer authentication returned HTTP 401 because authentication only verifies JWTs. Creation returns a flat object with `key`, but the UI expects `rawKey`, so it does not display the raw credential. The DatePicker's `YYYY-MM-DD` expiry produces HTTP 500 because the API expects an ISO datetime.

Implement documented key authentication with owner/scope/expiry checks, align creation response fields and convert expiry dates. Sources: [key creation:30](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/api-keys.ts:30), [web creation:53](/Users/kimrasng/dev/netscopeNMS/apps/web/src/app/(app)/settings/api-keys/page.tsx:53), [JWT middleware:10](/Users/kimrasng/dev/netscopeNMS/apps/api/src/middleware/auth.ts:10).

### F24 — P2: Profile phone changes show success but are discarded

**Browser and API roundtrip.** The profile form sends `phone` and shows success. Reloading showed an empty phone. The API validation/UPDATE accepts only `name` and strips `phone`.

Persist the supported field or remove the editable field until supported. Sources: [profile API:56](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/auth.ts:56), [profile web:37](/Users/kimrasng/dev/netscopeNMS/apps/web/src/app/(app)/settings/profile/page.tsx:37).

### F25 — P2: Topology and geographic maps are placeholders despite README feature claims

**Browser and source.** Both routes display “coming soon.” No graph or map is rendered. README describes ReactFlow/Leaflet and auto-layout as available; these packages are absent from web dependencies. Device coordinates and stored topology positions have no visual consumer here.

Implement the viewers and required relationship data, or mark the features as planned in documentation. Sources: [topology:14](/Users/kimrasng/dev/netscopeNMS/apps/web/src/app/(app)/topology/page.tsx:14), [map:14](/Users/kimrasng/dev/netscopeNMS/apps/web/src/app/(app)/maps/page.tsx:14), [README:73](/Users/kimrasng/dev/netscopeNMS/README.md:73).

### F26 — P2: Custom dashboard widgets exist in the API but have no web viewer/editor

**Supplemental API and browser.** Widget creation/read and duplication succeeded after supplying the missing schema. The web lists dashboard names as plain text with Duplicate/Delete, but has no detail page, widget builder or widget renderer. The creation form only sends name/description/shared. A default dashboard is not used to select the main dashboard layout.

Build the dashboard rendering/editing flow around the existing API or limit the visible claim to metadata management. Sources: [dashboard API:14](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/dashboards.ts:14), [web create:53](/Users/kimrasng/dev/netscopeNMS/apps/web/src/app/(app)/dashboards/page.tsx:53).

### F27 — P1: Trap reception and discovery are not integrated into the running application

**Source-only integration finding.** `TrapReceiver` and `DiscoveryEngine` are exported library implementations, but bootstrap does not start them. Trap handling queues/emits an event without an application consumer that creates the README-promised incidents. Discovery can create devices but does not persist topology edges for the promised map auto-layout. No trap/discovery control flow is present in the web.

Define service startup, trap-to-incident processing, discovery scheduling and persisted network relationships. Sources: [exports:359](/Users/kimrasng/dev/netscopeNMS/packages/polling-engine/src/index.ts:359), [trap event:145](/Users/kimrasng/dev/netscopeNMS/packages/polling-engine/src/trap-receiver.ts:145), [discovery insertion:246](/Users/kimrasng/dev/netscopeNMS/packages/polling-engine/src/discovery.ts:246). End-to-end external trap/discovery traffic was not tested.

### F28 — P2: Implemented configuration fields cannot be configured through the web

**Browser and source.** SNMP v3 selection exposes no username/auth/privacy fields. A browser-created v3 device had `snmpV3Config:null`. Device group assignment is absent, and `/api/device-groups` returned 404. Alert channel/escalation/runbook fields exist in the API but are absent from its create form. Restricted user invitations have no allowed-device/group controls. SSH fields exist in device schema/API but no web configuration or verified backup collector uses them.

Expose complete validated forms and selection data for supported settings. Define unfinished features explicitly. Sources: [device schema:12](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/devices.ts:12), [rule schema:17](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/alert-rules.ts:17), [invite form:366](/Users/kimrasng/dev/netscopeNMS/apps/web/src/app/(app)/settings/users/page.tsx:366). The web flap-window default is 300 while the engine interprets it in minutes; label units and reconcile the default before relying on it operationally.

### F29 — P1: API and web invitation links both target nonexistent routes

**Browser and API runtime.** The API creates `/auth/invite?token=...`, which returned a web 404. The UI expects `result.token` although the API returns `{invitation,inviteUrl}` and displays `http://localhost:3000/invite/undefined`. The actual page is `/invite` with a query parameter.

Use one validated invitation-response contract and the existing acceptance route. Sources: [API link:109](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/setup.ts:109), [web link:158](/Users/kimrasng/dev/netscopeNMS/apps/web/src/app/(app)/settings/users/page.tsx:158). Evidence: [broken link screenshot](/Users/kimrasng/dev/netscopeNMS/docs/qa/2026-10-01/evidence/browser/invitation-ui-undefined-link.jpg).

### F30 — P1: An email-bound invitation accepts a different email

**API runtime.** An invitation for `qa-expected@example.test` was accepted as `qa-other@example.test` with HTTP 201. Acceptance checks token validity but not the bound email.

Enforce the invitation email when present and handle optional unbound invitations deliberately. Source: [acceptance:123](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/setup.ts:123). This experiment used generated local users only.

### F31 — P2: Invalid input often returns 500 or enters the database

**API runtime.** An empty device body, malformed metric date, negative page and invalid key expiry produced 500. An invalid IP with latitude/longitude=999 was accepted. Maintenance ending before it starts and a non-cron string were accepted.

Map validation failures to useful 400 responses and validate dates, pagination, coordinates, IPs and cross-field relationships. Sources: [device validation:8](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/devices.ts:8), [metric date conversion:18](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/metrics.ts:18), [maintenance schema:8](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/maintenance-windows.ts:8).

### F32 — P1: Failed notification delivery is reported as successful

**Runtime for webhook; source review for other HTTP channels.** A local receiver deliberately returned HTTP 503. The API test route still returned HTTP 200 `{ok:true}`. The dispatcher awaits `fetch` without checking `response.ok`; HTTP failures therefore do not trigger the retry helper. The same pattern appears in Telegram, Discord, Slack, SMS and PagerDuty paths.

Check vendor status/body, retry appropriate failures and record delivery outcomes. The web additionally labels disabled channels “Enabled” because both branches use the same text. Sources: [webhook:206](/Users/kimrasng/dev/netscopeNMS/packages/notification/src/index.ts:206), [test result:135](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/notifications.ts:135), [enabled label:218](/Users/kimrasng/dev/netscopeNMS/apps/web/src/app/(app)/notifications/page.tsx:218). Real vendor delivery was not attempted.

### F33 — P2: Audit logging does not cover all mutations

**API/database runtime and source.** API key, dashboard and AI provider mutations did not produce matching audit events; dashboard/provider omissions were rechecked after schema supplementation. Profile/password/report paths also have no audit calls. This conflicts with the project convention and README's broad resource coverage claim.

Define the audit event matrix and centralize consistent recording/redaction. Sources: [API keys:30](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/api-keys.ts:30), [dashboards:41](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/dashboards.ts:41), [providers:204](/Users/kimrasng/dev/netscopeNMS/apps/api/src/routes/ai.ts:204).

### F34 — P2: The normal install does not initialize metrics as a Timescale hypertable

**Runtime and deployment review.** The extension existed in the image, but the normal migration command left zero hypertables. `init-timescale.sql` is separate and is not called by startup. Running it after fixture metrics existed failed with “table metrics is not empty”; its first conversion has no `migrate_data => true`. A rollback-only empty-table probe succeeded.

Apply Timescale initialization at the correct installation stage and support upgrades with existing data. Verify compression/retention/aggregate policies too. Sources: [initialization SQL:8](/Users/kimrasng/dev/netscopeNMS/packages/shared/drizzle/init-timescale.sql:8), [startup script:5](/Users/kimrasng/dev/netscopeNMS/scripts/start-api.sh:5). The successful empty-table probe does not imply startup automatically performs initialization.

### F35 — P2: Documented quality/setup commands are not reproducible

**Command runtime.** `yarn lint` failed at Next's interactive ESLint setup prompt. `yarn db:seed` failed with “Command db:seed not found.” Root build/dev/lint commands invoke `npx turbo`, but turbo is not pinned in root dependencies; this audit downloaded turbo 2.11.6. Docker uses Node 20 while conventions/CI use 22.

Commit noninteractive lint configuration, implement or remove the seed command, pin the task runner and align supported runtimes. Evidence: [lint.log](/Users/kimrasng/dev/netscopeNMS/docs/qa/2026-10-01/evidence/lint.log), [seed.log](/Users/kimrasng/dev/netscopeNMS/docs/qa/2026-10-01/evidence/seed.log), [build.log](/Users/kimrasng/dev/netscopeNMS/docs/qa/2026-10-01/evidence/build.log).

### F36 — P2: Existing tests and OpenAPI do not verify the web/API contract

**Runtime and source review.** The existing 140 tests pass despite the reproduced integration failures. OpenAPI exposed 60 paths with zero JSON request-body schemas. Route-local Zod parsing is not supplied as OpenAPI request/response schemas. CI runs build and Vitest, with no browser E2E job or clean database/service integration stage.

Add shared contracts and meaningful regression tests for migration installation, resource scope, stateful UI actions and worker workflows. Sources: [CI tests:39](/Users/kimrasng/dev/netscopeNMS/.github/workflows/ci.yml:39), [Swagger registration:88](/Users/kimrasng/dev/netscopeNMS/apps/api/src/index.ts:88). This is a coverage gap, not a claim that passing unit tests are invalid.

### F37 — P2: Site logo settings have no rendering consumer

**Source-only.** The site context loads `logoUrl`, and the web form says it will display in the header, but TopNav only reads `siteName` and supplies no logo source. Saving a logo cannot produce the described header behavior through the current implementation.

Pass the saved logo to the identity component and verify persistence/rendering. Sources: [site context:17](/Users/kimrasng/dev/netscopeNMS/apps/web/src/lib/site.tsx:17), [TopNav:12](/Users/kimrasng/dev/netscopeNMS/apps/web/src/components/top-nav.tsx:12).

### F38 — P2: Error and permission states are misleading or inaccessible

**Browser for empty/error and role controls; source review for not-found incident.** Baseline dashboard/provider load failures looked like empty lists. A scoped viewer saw administration navigation and Edit/Delete controls on a hidden device. Several pages discard the hook error field; missing/failed incident detail stays in the spinner branch because it checks `loading || !incident` without an error state.

Show distinct loading/empty/error/forbidden/not-found states with recovery actions and render controls based on effective permissions. UI checks supplement server authorization and cannot replace F01/F02 fixes. Sources: [dashboard hook:27](/Users/kimrasng/dev/netscopeNMS/apps/web/src/app/(app)/dashboards/page.tsx:27), [incident loading:111](/Users/kimrasng/dev/netscopeNMS/apps/web/src/app/(app)/incidents/[id]/page.tsx:111).

### F39 — P1: Connected sockets do not update displayed monitoring state

**Browser and API experiment.** With incident A open, a separate API request resolved it successfully and emitted the update. The page remained Problem with Resolve/Acknowledge buttons until reload; reload showed Resolved and the new timeline event. The web connects Socket.IO but has no application `socket.on` consumers for incident/device/notification updates, and the common fetch hook has no refresh interval.

Subscribe to authorized events and invalidate/refetch relevant data, with reconnection recovery. Polling also needs a supported mechanism to propagate device/metric changes. Sources: [socket client:21](/Users/kimrasng/dev/netscopeNMS/apps/web/src/lib/socket.ts:21), [incident hook:67](/Users/kimrasng/dev/netscopeNMS/apps/web/src/app/(app)/incidents/[id]/page.tsx:67). Evidence: [stale screen](/Users/kimrasng/dev/netscopeNMS/docs/qa/2026-10-01/evidence/browser/realtime-incident-stale.txt), [after reload](/Users/kimrasng/dev/netscopeNMS/docs/qa/2026-10-01/evidence/browser/realtime-incident-after-reload.txt).

### F40 — P1: Selecting SNMP v2c sends SNMP v1 packets

**Local UDP runtime.** The mock agent and proxy recorded BER version 0 for both v1 and v2c selections. v2c should use version 1. Memory collection passed because the local agent accepts v1; a v2c-only device can reject this request. The poller calls `createSession` without its `version` option, which defaults to v1 in the installed library.

Map the selected protocol version into session options, including discovery helpers where appropriate. Source: [community session:162](/Users/kimrasng/dev/netscopeNMS/packages/polling-engine/src/index.ts:162). Evidence: `v2c wire version matches selection` in SNMP results. v3 authPriv separately passed with BER version 3.

### F41 — P2: SNMP interface indices are replaced with array positions

**Local UDP runtime.** The agent exposed interfaces with indices 5 and 9 (`eth5`, `eth9`). Both v1 and v2c poll results returned indices 1 and 2. The collector uses `idx + 1` instead of the OID instance suffix, and combines separate walk results by array position.

Join walks by actual interface index to preserve identity and handle missing/sparse columns. Wrong indices can attach histories and deltas to the wrong ports. Source: [interface mapping:193](/Users/kimrasng/dev/netscopeNMS/packages/polling-engine/src/index.ts:193). No sustained bandwidth/counter-wrap campaign was run.

## Implemented backend behavior missing from the web

| Backend/storage behavior | Missing or broken web path | Findings |
| --- | --- | --- |
| Report generation and stored reports | List reads the wrong response envelope | F16 |
| Stored notification records | History reads the wrong envelope | F17 |
| Anomaly and trend computation | Result shapes do not match rendered fields | F20 |
| AI query rows | Table requires absent column metadata | F21 |
| Actual AI RCA service | Incident button calls a placeholder route | F15 |
| Dashboard widgets/layout metadata | No widget viewer/editor/default layout consumer | F26 |
| SNMPv3 credentials, group IDs, advanced alert settings | Incomplete forms; group management missing | F28 |
| Topology positions and geographic coordinates | Placeholder viewers | F25 |
| Site logo URL | Header ignores saved value | F37 |
| Socket update events | Connection exists, event consumers do not | F39 |

## Features that appear available but do not complete their promised behavior

The highest-priority misleading flows are API key generation, invitation creation, incident AI analysis, AI narrative reporting, maintenance suppression, rule-driven notifications/escalation and real-time monitoring. In several cases, storage or a success response exists without the corresponding end-to-end effect. README also presents maps, trap incidents and discovery auto-layout as completed, while their application integration is missing. Update these claims when implementation is incomplete so users can distinguish supported operations from planned features.

## Recommended remediation order and acceptance checks

1. **Authorization and credentials:** deny all out-of-scope access/mutations/AI/socket data; deny disabled/deleted users and stale privileges; remove credential values from ordinary reads and logs. Re-run A/B device and group-only scenarios.
2. **Installation and shared contracts:** create the four missing-table migrations; initialize Timescale correctly; repair bodyless requests, query keys and response envelopes. A fresh documented install must support all advertised routes. Test actual browser buttons and paginated/filtered data changes.
3. **Monitoring pipeline:** synchronize schedules; correct status transitions and SNMP version/index handling; start threshold/trap/discovery services; implement maintenance, deduplication, dispatch and escalation. Accept only after device → metric → incident → recorded notification → recovery works in the normal startup configuration.
4. **User-visible completion:** fix invitation/API key/profile flows, report calculation, AI route consistency, real-time refresh, dashboard/map viewers and supported configuration forms. Verify values persist and are visible after reload.
5. **Regression coverage and operations:** add contract/browser/service tests for these failures, fix lint/seed and documentation, expose background worker health and errors. Expand to vendor integrations, real equipment, load and resilience tests after functional blockers are resolved.

## Evidence, reproduction and limits

The [evidence directory](/Users/kimrasng/dev/netscopeNMS/docs/qa/2026-10-01/evidence/README.md) contains sanitized JSON outcomes, selected command logs, browser DOM snapshots, screenshots and the QA harnesses. Tokens, key hashes and credential values were redacted from saved result JSON. The private runtime state file containing session tokens was not copied into this repository.

The harnesses mutate a disposable database and assume the local QA service ports described above. They are audit artifacts rather than a committed product test suite. The final deletion probe requires the browser-created fixture; the threshold harness explicitly starts a consumer, so its success cannot be attributed to default bootstrap. Evidence includes initial loading captures as well as settled captures; conclusions use the settled data/error observations.

This audit does not certify every possible input, network vendor or deployment. Live OpenAI/Gemini/Claude, SMTP, Telegram, Discord, Slack, Twilio and PagerDuty were not contacted. AI checks used deterministic responses and verify integration rather than model quality. SNMP checks used a local agent, not physical equipment; CPU utilization semantics, sustained throughput, counter wrap, link churn and broad authentication combinations were not exhaustively tested. External traps and discovery traffic, automatic SSH backups, long-running escalation, performance/load, disaster recovery, a complete mobile/accessibility matrix, and a full Docker application build were not validated. Node 22 compatibility needs confirmation because this audit ran Node 24.

Product files remained unchanged. Only this report and evidence were added. The QA API, web and mock service were stopped after evidence export. Both QA containers were stopped and their disposable data removed through `--rm`; unrelated containers were left running. No listeners remained on the QA application ports 3000, 4000 or 14567.
