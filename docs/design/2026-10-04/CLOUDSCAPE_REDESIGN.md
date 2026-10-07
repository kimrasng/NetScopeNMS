# NetPulse Cloudscape redesign and verification

Date: 2026-10-04 (Asia/Tokyo)

## Result

All 29 screen routes from the [design audit](../2026-10-02/CLOUDSCAPE_DESIGN_AUDIT.md) were reviewed in the browser and updated toward a Cloudscape management console. Resource collections, operational status, investigation links, and configuration decisions now lead the interface. The changes preserve the existing application and access boundaries.

This work is a design and workflow remediation, not an AWS certification or an assertion of perfect usability. React Flow and Leaflet remain the specialized network viewers. Their controls, status labels, colors, and surrounding content now fit the console. Application charts use Cloudscape LineChart.

The primary patterns used are [full-page resource tables](https://cloudscape.design/patterns/resource-management/view/table-view/), [single-page resource creation](https://cloudscape.design/patterns/resource-management/create/single-page-create/), and the [configurable dashboard](https://cloudscape.design/patterns/general/service-dashboard/configurable-dashboard/). Tables use the native sticky heading pattern; forms use restrained content widths and expandable optional settings; editable dashboards use Board and BoardItem.

## Audit remediation

| Finding | Change | Verification |
|---|---|---|
| D01: page composition and duplicate headings | Route-specific AppLayout content types; native full-page collection tables; form navigation defaults and a 960 px maximum content width | Resource lists, device create/edit, site/profile/preferences forms |
| D02: navigation and breadcrumbs | Shared hierarchy, parent navigation selection on detail routes, one breadcrumb trail, account navigation | Device and incident details, edit forms, account routes |
| D03: incomplete localization | Korean/English application copy, Cloudscape component messages, readable status/role/scope/event labels, localized dates and document language | Korean default; English device collection and preferences; technical metric names and user data remain intact |
| D04: dashboard hierarchy | Actionable incident/down/warning counts, linked resources, recent incidents before trend charts, explicit time windows and freshness | Default dashboard; zero counts display a healthy state rather than a red error |
| D05: dashboard editor and narrow layout | Explicit view/edit modes, native Board in both modes, keyboard movement/resizing, persisted dimensions, breakpoint offsets and order | Resize/save/reload in browser; API layout validation; 487 px view |
| D06: chart readability | Cloudscape LineChart, Date time scales, native theme colors and legends, metric units and bandwidth formatting | Dashboard, custom metric widget, metrics explorer in both themes and at 487 px |
| D07: raw report/RCA presentation | Type-specific report tables; sample-weighted availability; no-data state distinct from zero; RCA summary/root cause/confidence/scope/actions; optional raw data | Availability detail, AI incident response, report aggregation unit tests |
| D08: identifiers before domain information | Device/user names and links in incidents, reports, snapshots, scope selectors and audit entries; technical IDs kept where useful | API name enrichment, response contract validation, visible resource links |
| D09: JSON channel configuration | Typed fields for all notification channels; numeric SMTP port; URL/recipient/header checks; retained masked credentials; optional advanced webhook fields | Empty form field errors, channel payload/validation tests, mock webhook delivery |
| D10: long forms | Alert rule Wizard; device SSH/coordinates/tags in expandable sections; date/time and recurrence controls for maintenance | Three rule steps; device create/edit; maintenance created from date/time inputs |
| D11: form error feedback | Mutation errors stay with the active form; notification input errors attach to individual fields; duplicate global mutation errors removed | Invalid notification submission and API client unit tests |
| D12: metric time selection | Native relative/absolute DateRangePicker, aggregation control, query-specific chart title/range, custom metric Autosuggest | Actual CPU query with 24-hour range, narrow result view |
| D13: assistant and administration | Query/chat/provider tabs; provider tab restricted to administrators; named incident picker; readable AI results; query pagination and sorting | Query, incident chat, provider list; local mock provider |
| D14: network viewer usability | Group and device focus, fit/auto layout, readable status legend, connection table, map coordinate coverage and device locations | 55-node topology, group filter, layout save, map with one located device and 54 missing coordinates |
| D15: discovery job JSON | Domain columns for scope/state/new devices/neighbors/times; device-level result details and warnings; optional raw diagnostics | Completed local job and structured API job collection |
| D16: empty states and table controls | Distinct empty/no-match explanations; no duplicate primary create action; column visibility/order/wrapping/density preferences on devices and audit logs | Device collection/preferences, empty samples, audit table |
| D17: misleading state/action labels | Correct disabled channel text; localized dynamic selections; clearer theme description; role-appropriate operations | Disabled webhook row, Korean rule/channel defaults, account theme switching |

## Problems found during implementation verification

1. Report actor names were added by the query but stripped by the shared response serializer. The shared contract now retains `generatedByName`; browser and API tests verify it.
2. Installed component styles and a newer token package referenced different CSS variable names. Dark topology nodes fell back to white. Design tokens are pinned to the compatible `3.0.84` release for the locked component version. Verify the token/style pairing when upgrading Cloudscape; do not independently replace the token package with an arbitrary newer release.
3. Maintenance date and time controls shared an outer FormField identifier. They now have separate labeled FormFields. A local future schedule was saved through the browser and showed the intended local times.
4. Audit date filters sent parameter names the API did not consume, and static action/resource options did not match stored log values. Date filters now send `from`/`to`; administrator-only metadata provides actual action/resource values and a named user selector. Browser filtering reduced the administrator result from 78 entries to 39 when a one-hour range was applied.
5. A controlled navigation panel opened over the content at 487 px. Its default state now follows the screen breakpoint and form route.
6. The setup route offered initial administrator creation on an initialized installation. It now checks setup status and presents a completion message and sign-in action.
7. Topology refresh and automatic layout discarded React Flow node measurement metadata, leaving nodes hidden despite valid device data. Both updates now retain the existing node metadata. Initial fit uses the whole graph; device/group focus provides a readable close view. Layout saving is shown only to roles allowed to operate devices. Viewer accounts also receive a scope-specific empty-state explanation and no empty operations column.

## Screen coverage

All entries below include source review and an actual browser view. Screenshots are local QA evidence with synthetic devices, accounts, metrics and incidents. The evidence directory also includes intermediate form/editor states; this table selects the representative views.

| Route | Main verification | Evidence |
|---|---|---|
| `/dashboard` | Status hierarchy, incident/device drill-down, native chart, zero counts | [Dark](evidence/01-dashboard-dark.jpg), [light](evidence/37-dashboard-light.jpg) |
| `/devices` | Native resource table, filter/sort/page/column controls | [Korean](evidence/02-devices-dark.jpg), [English](evidence/46-devices-english.jpg) |
| `/devices/create` | Required identity, grouped configuration, optional settings | [Desktop](evidence/03-device-create-dark.jpg), [487 px](evidence/43-device-form-narrow.jpg) |
| `/devices/[id]` | Readable identity, configuration/polling status, tabs | [Detail](evidence/04-device-detail-dark.jpg) |
| `/devices/[id]/edit` | Form width, one breadcrumb, optional configuration | [Edit](evidence/05-device-edit-dark.jpg) |
| `/incidents` | Status/severity and resource navigation | [Collection](evidence/06-incidents-dark.jpg) |
| `/incidents/[id]` | Actor names, event wording, RCA and AI investigation | [Detail](evidence/07-incident-detail-dark.jpg) |
| `/topology` | Theme, fit, groups, automatic layout, save and refresh; scoped viewer actions | [Overview](evidence/22-topology-dark.jpg), [group](evidence/48-topology-group.jpg), [viewer](evidence/50-topology-viewer.jpg) |
| `/maps` | Coordinate coverage, status-aware marker and device table | [Map](evidence/23-map-dark.jpg) |
| `/metrics` | Device/custom metric/time/aggregation controls and chart result | [Desktop](evidence/12-metrics-dark.jpg), [487 px](evidence/44-metrics-narrow.jpg) |
| `/alert-rules` | Condition, target scope and notification-policy Wizard | [Collection](evidence/15-alert-rules-dark.jpg), [Wizard](evidence/16-rule-wizard-dark.jpg), [policy](evidence/17-rule-policy-dark.jpg) |
| `/notifications` | Truthful enabled state, typed channel setup, field errors | [Channels](evidence/13-notifications-dark.jpg), [validation](evidence/14-channel-validation-dark.jpg) |
| `/maintenance` | Scope, separate date/time controls and successful schedule save | [Form](evidence/19-maintenance-form-dark.jpg), [saved](evidence/47-maintenance-saved.jpg) |
| `/config-snapshots` | Named device, technical configuration and explicit diff | [Collection](evidence/29-snapshots-dark.jpg), [comparison](evidence/30-snapshot-comparison.jpg) |
| `/ai` | Query results, named incident chat, provider administration | [Query](evidence/24-ai-query-dark.jpg), [providers](evidence/25-ai-providers-dark.jpg), [chat](evidence/41-ai-chat-light.jpg) |
| `/reports` | Named author, localized generated title and typed content | [Collection](evidence/27-reports-dark.jpg), [availability](evidence/28-report-detail-dark.jpg) |
| `/dashboards` | Table, localized default/shared labels | [Collection](evidence/08-dashboards-dark.jpg) |
| `/dashboards/[id]` | Native view/edit Board; saved layout; responsive widget stacking | [View](evidence/11-custom-dashboard-saved-dark.jpg), [editor](evidence/10-custom-dashboard-edit-dark.jpg), [487 px](evidence/42-custom-dashboard-narrow.jpg) |
| `/device-groups` | Domain table, fields and local feedback | [Groups](evidence/20-device-groups-dark.jpg) |
| `/discovery` | Scope/start/history and structured results | [Discovery](evidence/21-discovery-dark.jpg) |
| `/settings/users` | Plain role labels, readable scope, sensible column widths; administrator-only page | [Users](evidence/31-users.jpg), [viewer access denied](evidence/51-access-denied.jpg) |
| `/settings/site` | Restrained form width and concrete branding fields | [Site](evidence/32-site-settings.jpg) |
| `/settings/api-keys` | Prefix-only collection, readable dates/empty values | [Keys](evidence/33-api-keys.jpg) |
| `/settings/audit-logs` | Named actors, actual filters, optional technical ID column | [Filters](evidence/45-audit-filters.jpg) |
| `/settings/profile` | Read-only identity and grouped account forms | [Profile](evidence/35-profile.jpg) |
| `/settings/preferences` | Korean/English and light/dark transitions, accurate helper text | [Preferences](evidence/36-preferences.jpg) |
| `/login` | Native public form and required-input feedback | [Login](evidence/39-login.jpg) |
| `/setup` | Wizard initial state/required-input validation; initialized-site guard | [Wizard layout](evidence/38-setup.jpg), [initialized site](evidence/49-setup-complete.jpg) |
| `/invite` | Valid invitation form, named role and fixed invited email | [Invitation](evidence/40-invitation.jpg) |

The root route has no independent screen; its redirect is checked separately. Public account creation and new-password submission were not performed through browser automation. Setup/account API flows were exercised in the disposable integration fixture environment; public form layout and validation were reviewed separately.

## Automated verification

| Check | Result | Scope |
|---|---|---|
| `yarn test` | 185 / 185 passed, 16 files | Existing package tests plus API client, stale-response handling, channel configuration and report semantics |
| Disposable integration fixture run | 95 / 95 passed | Local API operations and access boundaries used as the browser dataset |
| `TEST_OUTPUT_DIR=<disposable-dir> node scripts/design-test.mjs` | 25 / 25 passed | Names/serialization, Board layout/order/resize validation, scopes, typed reports, AI and notification mocks, audit metadata and filters |
| `yarn lint` | Passed | All configured workspace checks; no web ESLint warnings/errors |
| `NEXT_PUBLIC_API_URL=http://localhost:4000 yarn build` | Passed | All six build tasks, including Next.js production compilation/type checking |
| `git diff --check` | Passed | Patch whitespace check |

The browser checks include both 1440 × 900 desktop and 487 × 800 narrow views, Korean and English, light and dark themes, actual metric queries, invalid channel input, maintenance schedule creation, snapshot comparison, report detail, AI mock response and pagination, and dashboard move/resize/save/reload. The final saved dashboard retains two columns on desktop and stacks widgets at 487 px, where the page width also remains 487 px. Viewer checks confirm scoped topology data and blocked administrator pages.

The sanitized [verification summary](verification.json) retains individual API check names and pass/fail results without credentials or response bodies. [Topology observations](topology-verification.json) record visible nodes before and after automatic layout and after the periodic refresh.

## Environment and limits

- The QA database and Redis are isolated local containers (`netpulse-design-20261004-db` and `netpulse-design-20261004-redis`) on loopback ports 15432 and 16379. API/web use ports 4000/3000; the mock service uses port 14567.
- The local preview remains available at `http://localhost:3000` after verification, using this isolated QA dataset. The final preview uses the production web build; browser viewport overrides were reset. No real installation database was migrated or reseeded by this design run.
- Synthetic fixture data explains the `QA` resource names and English provider response text in screenshots. AI mocks verify transport and presentation; they do not measure real model reasoning quality.
- Live SNMP/SSH equipment, production provider credentials and external notification destinations were not used for this design verification. Their real-environment behavior is outside these results.
- A large graph overview necessarily has smaller labels. Device focus, group filtering, zooming and the connection table are the readable investigation paths.
- No production deployment, Git push or pull request was performed. Existing user work and earlier functional remediation were preserved.
