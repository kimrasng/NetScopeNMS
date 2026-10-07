# NetPulse Cloudscape design audit

Date: 2026-10-02

## Assessment

NetPulse uses real Cloudscape components, global styles, themes, and collection hooks. Its component foundation is appropriate. However, several page compositions do not follow Cloudscape patterns, and important domain information is still presented as backend fields or generic CRUD controls. This makes parts of the application feel assembled rather than designed for network operations.

The strongest examples are the custom dashboard, report contents, incident AI analysis, notification configuration, discovery, and metric exploration. Some UI added during the functional remediation has this same limitation: working data connections did not establish a finished interaction design.

"AI slop" in this report describes the perceived absence of deliberate hierarchy, domain language, and workflow design. It is a qualitative assessment, not a claim about how any particular source file was authored. Standard Cloudscape spacing, rounded containers, and simple tables are not inherently defects.

## Review scope and evidence

- Reviewed all 30 page source files: 29 user-facing pages and the root redirect.
- Visited all 26 authenticated pages plus login in the browser with disposable local fixtures.
- Reviewed setup and valid invitation forms from source. They were not exercised through their complete browser flows in this design audit.
- Inspected the main console at 1440 x 900 in dark mode; compared the dashboard and device list in light mode; checked custom dashboard and metrics at 487 x 800.
- Opened AI chat, report details, notification creation, and rule creation. Queried fixture metrics and inspected the resulting chart. Submitted an empty group form to observe validation feedback; the invalid request created no group.
- Saved 39 screenshots in [evidence](./evidence/). Some accessibility files are incremental snapshots, not standalone complete page descriptions.
- The fixture harness passed its 95 assertions while creating review data. That result is not a design conformance score.
- No product source was changed for this audit. Temporary services, fixtures, browser tab, and viewport overrides were cleaned up.

This is a design and interaction review, not a formal WCAG certification or a test of every state at every breakpoint. Empty space caused by a small fixture dataset is not itself counted as a defect. Graph/map observations concern presentation; the fixture graph has no discovered connections, so the lack of edges is not treated as a design failure.

## What is already appropriate

The shared shell uses `TopNavigation`, `AppLayout`, `SideNavigation`, `BreadcrumbGroup`, and `Flashbar`. Forms use `Form`, `FormField`, `Input`, `Select`, and `Container`. Resource lists use real Cloudscape tables, status indicators, sorting, and pagination. No competing CSS component framework was found in the web UI. The setup wizard and simple login form are reasonable foundations.

Recharts, React Flow, and Leaflet are appropriate specialized tools for the project. Their presence is not evidence of bad design. Their colors, typography, controls, and responsive behavior still need to fit the surrounding console.

## Findings

Priority means redesign order: High affects primary work or meaning; Medium affects consistency or efficiency; Low is polish. Pattern gaps are distinguished from reviewer judgments. Optional components are not treated as mandatory everywhere.

### D01 — High — Shared layout does not distinguish page types

`apps/web/src/app/(app)/layout.tsx:92` never sets `AppLayout.contentType`. Device create/edit and profile forms therefore retain the general shell and open navigation used by tables and dashboards. Inputs stop well before their broad surrounding containers, making the page look like a large generic card with an undersized form inside it.

Content-heavy lists such as devices, incidents, and audit logs wrap a full-page table in `ContentLayout`, with an additional page header. Cloudscape recommends the full-page table itself for that pattern, while short tables can appropriately use a bordered table inside `ContentLayout`. Forms have their own content width and navigation defaults. These are actual pattern gaps, not a request to remove every container. [Table view](https://cloudscape.design/patterns/resource-management/view/table-view/), [single page create](https://cloudscape.design/patterns/resource-management/create/single-page-create/).

Direction: select the shell content type per route; use one page heading; retain container layouts for dashboards, details, and short collections.

Evidence: [devices](./evidence/devices.jpg), [device create](./evidence/device-create.jpg), [profile](./evidence/profile.jpg).

### D02 — Medium — Navigation does not consistently express location

The shell breadcrumb contains only the site name and prevents navigation (`layout.tsx:97`). Detail/edit pages add another breadcrumb below their heading, producing two unrelated breadcrumb areas. Names also vary between the configured site name, `Home`, and `NetPulse`.

`components/navigation.tsx:75` passes the exact pathname as `activeHref`, so the devices link loses its active state on a device detail route. The official navigation pattern recommends highlighting the resource type on details pages. [Side navigation](https://cloudscape.design/patterns/general/service-navigation/side-navigation/).

Personal profile/preferences are also placed under Administration, although they already exist in the user menu. The notification bell leads to channel administration rather than a personal notification view. Those are information-architecture judgments; a bell icon alone does not prove a missing feature.

Direction: one route-aware breadcrumb in the shell, a meaningful active parent link, and labels/grouping that describe the user's task.

Evidence: [device detail](./evidence/device-detail.jpg), [incident detail](./evidence/incident-detail.jpg).

### D03 — High — Incomplete localization makes screens look unfinished

Korean pages contain English navigation entries, form labels, actions, placeholders, data labels, and messages. Examples include `Device groups`, `Discovery`, `Query Parameters`, `Dashboard name`, `Move earlier`, `Capture via SSH`, `Overview`, `Analysis Details`, `Required`, and `Find users`.

The latest connection/scope fields and custom dashboard are particularly affected. This is not a request to translate standard protocol names such as SNMP, SSH, or CPU. Internal UI vocabulary should follow the selected locale consistently.

Direction: use the existing translation system for all visible UI strings and distinguish technical values from interface labels.

Evidence: [metrics](./evidence/metrics.jpg), [rule form](./evidence/alert-rule-modal.jpg), [users](./evidence/users.jpg).

### D04 — High — Basic dashboard has weak operational hierarchy

The summary gives zero counts, unknown devices, total devices, and active problems similar emphasis. The nested text grids make the values look like attributes rather than a quick operational overview. The first viewport is dominated by the summary and throughput container; recent problems appear farther down.

The top-device and recent-alert tables use plain names/titles rather than direct resource links. Time window, freshness, and next investigation steps are not prominent. The reviewer concern is the extra effort required to answer "What needs attention now?" Cloudscape dashboards explicitly support monitoring and investigation. [Service dashboards](https://cloudscape.design/patterns/general/service-dashboard/).

Direction: prioritize actionable problems and health, provide drill-down links, and show the timeframe and refresh context without adding decorative KPI cards.

Evidence: [dashboard](./evidence/dashboard-desktop.jpg), [full dashboard](./evidence/dashboard-full.jpg).

### D05 — High — Custom dashboard looks like a settings editor

`dashboards/[id]/page.tsx:38` always shows editable name and sharing/default switches for the owner. Every widget has separate Edit / Move earlier / Remove buttons outside its container. The result is a repeated form-and-buttons layout instead of a dashboard to monitor.

The modal exposes `Width (12 columns)` and raw widget type names. `Grid` uses an unqualified fixed `colspan`; at 487 px, the metric widget still occupied about half the content width and its chart labels became cramped. Board components are installed but unused. Cloudscape's configurable dashboard pattern uses Board as its layout foundation, with item movement, sizing, and a palette. [Configurable dashboard](https://cloudscape.design/patterns/general/service-dashboard/configurable-dashboard/).

Direction: make dashboard viewing the main experience, put item actions in their own headers/menus, use the Board pattern for layout controls, and adapt widgets to narrow widths. An explicit edit mode is a reviewer recommendation, not an official requirement for every configurable dashboard.

Evidence: [desktop dashboard](./evidence/custom-dashboard-desktop.jpg), [narrow dashboard](./evidence/custom-dashboard-narrow.jpg).

### D06 — High — Chart presentation does not match the theme or meaning

The rendered metric chart's 14 px axis labels use Recharts' `#666` fill in dark mode; they are visibly weak against the background. Dashboard throughput and widget charts similarly retain default axis/tooltip styling and hardcoded series colors.

Throughput does not display an always-visible inbound/outbound legend or axis unit. Metric charts show average/minimum/maximum series without a visible legend, and generic titles such as `Chart` or `metric` do not explain the selected device, metric, unit, and range. Overlapping series can look like one unexplained green line.

Cloudscape recommends meaningful titles, labels, legends, and a consistent accessible palette. Recharts can remain if these requirements are implemented deliberately. [Data visualization](https://cloudscape.design/patterns/general/data-vis/).

Direction: theme-aware tokens, domain-specific titles and units, readable ticks, legends, and informative tooltips. This audit did not formally measure WCAG contrast across every chart.

Evidence: [metric result](./evidence/metrics-result.jpg), [throughput](./evidence/dashboard-desktop.jpg).

### D07 — High — Reports and AI analysis expose payloads instead of insights

`reports/page.tsx:39` recursively renders object keys and JSON-serializes array objects. The availability report initially presents collapsed `deviceIds`, `periodDays`, and `availability` sections; expanding it exposes `uptime_pct` with many decimal places. This is data inspection, not a readable report.

`incidents/[id]/page.tsx:232` displays the stored RCA string directly. The fixture analysis contains structured root cause, confidence, affected scope, remediation, urgency, and summary, but they appear as one raw JSON paragraph.

Direction: report-specific summaries/tables/charts; readable availability percentages; an RCA summary with confidence, affected resources, and ordered remediation. Raw data can remain as an optional technical view.

Evidence: [report payload](./evidence/report-json.jpg), [incident RCA](./evidence/incident-detail.jpg).

### D08 — Medium — Resource identity is frequently shown as UUIDs

Alert rules show the device UUID. Reports show the creator UUID. Snapshots show the device UUID as the primary device label. Incident events show actor UUIDs and internal event names. Profile shows `super_admin` in a disabled input. These fields make users translate database identifiers into operational meaning.

Technical identifiers are appropriate in audit details and API-oriented views, but names should be primary where a user is choosing a device, identifying an actor, or reading a report.

Direction: readable names with links, localized event labels, and secondary/copyable identifiers where useful.

Evidence: [rules](./evidence/alert-rules.jpg), [snapshots](./evidence/config-snapshots.jpg), [reports](./evidence/reports.jpg).

### D09 — High — Notification setup requires knowledge of the API schema

`notifications/page.tsx:293` provides a generic textarea initialized with `{}`. Selecting Email does not produce SMTP/server/recipient fields, schema guidance, or a channel-specific example. Using a Cloudscape textarea does not make this a finished configuration flow.

Direction: typed fields per channel, appropriate credential inputs, localized constraint/help text, field validation, and clear test feedback. Keep a JSON view only if an advanced workflow needs it.

Evidence: [notification configuration](./evidence/notification-config-modal.jpg).

### D10 — Medium — Complex settings are presented as long undifferentiated forms

Rule creation puts roughly fourteen controls into a default-width modal: threshold, scope, notification channels, escalation, runbook, enabled state, and flapping. Metric names are free text rather than a guided selection. Device forms keep optional SSH, coordinates, and tags expanded in a long sequence of containers. Maintenance exposes raw cron/timezone inputs with limited guidance.

This looks like fields were added as features arrived, without deciding which decisions belong together. Cloudscape's form guidance prioritizes a short primary configuration and allows additional settings in expandable sections. [Single page create](https://cloudscape.design/patterns/resource-management/create/single-page-create/).

Direction: group core rules, scope, notification policy, and advanced behavior; use a form page or wizard when the configuration warrants it. Short group creation can remain a modal.

Evidence: [rule modal](./evidence/alert-rule-modal.jpg), [device form](./evidence/device-create.jpg).

### D11 — High — Form validation feedback is disconnected from its input

Submitting an empty group name kept the modal open, but the error appeared behind it twice: once in the global error flashbar and once as an informational alert. The Name field itself had no error state. The visible message was the backend validation text `body/name must NOT have fewer than 1 characters`.

The group page stores the error in `message` outside the modal (`device-groups/page.tsx:19,24`). Several new pages also use an untyped informational alert for both success and failure. This makes a working error response difficult to understand and recover from.

Direction: localized field-level validation, form-level errors inside the modal, correct feedback severity, and one intentional notification path.

Evidence: [group validation](./evidence/group-validation-modal.jpg).

### D12 — Medium — Metric exploration asks users to work in API date syntax

The From/To controls are plain text inputs with `YYYY-MM-DDTHH:mm`. Time presets do populate them, but the controls still expose serialization syntax. The preset buttons also lack a selected state. The initial view offers a prediction threshold/action before a resource and useful data context have been established.

Direction: an appropriate Cloudscape time-range control, clear timezone/range context, a visible selected preset, and prediction tied to the current metric query.

Evidence: [initial metrics](./evidence/metrics.jpg), [narrow metrics](./evidence/metrics-narrow.jpg).

### D13 — Medium — AI workspace mixes assistance with provider administration

The query input occupies a small part of a large container, with no example questions or clear scope. The chat tab requires a manually entered incident ID to reveal the conversation. Provider administration appears immediately beneath both tabs, so the main assistant view doubles as an administrative settings page.

Direction: an appropriately sized prompt area, useful example questions, incident selection or entry from incident details, and separate provider settings. Use a consistent conversation presentation instead of ad hoc bordered divs.

Evidence: [AI query](./evidence/ai.jpg), [AI chat](./evidence/ai-chat.jpg).

### D14 — High for topology, Medium for map — Network views lack scale and status context

The topology's fixed 540 px canvas fits all 55 fixture nodes into a tall four-column arrangement, making labels very small. Manual connection controls are always visible for operators and sit below the graph. No graph search/focus workflow or domain status legend is apparent.

The map has functional markers and resource links, but uses raw `up` status labels and hardcoded colors. Only located devices appear; the page does not summarize how many scoped devices lack coordinates. Leaflet and React Flow controls are valid, but need to be integrated with the console's language and task hierarchy.

Direction: a usable graph viewport, grouping/filtering/focus controls, a clear status legend, secondary connection editing, and map coverage counts. Do not infer a topology failure from the absence of fixture edges.

Evidence: [topology](./evidence/topology.jpg), [map](./evidence/maps.jpg).

### D15 — Medium — Discovery is a developer job monitor

Discovery starts with a permanent implementation-oriented info banner, an unlabeled select, and actions in English. Its main identifier is a queue key such as `repeat:scheduled-full-discovery:...`; status is a raw string and details are JSON. It does not foreground which devices were scanned, new neighbors/connections, failures, and next steps.

Direction: label the scan scope, summarize results in domain terms, link to discovered resources/topology, and reserve queue IDs/raw results for technical details.

Evidence: [discovery](./evidence/discovery.jpg).

### D16 — Medium — Empty states and collection controls are uneven

Several empty states repeat the resource title or the create-button text instead of explaining the state. Empty resources and no filter matches are not consistently distinguished. Some empty states duplicate the primary create action. Cloudscape recommends an understandable state and a recovery action without repeating heading/button text. [Empty states](https://cloudscape.design/patterns/general/empty-states/).

No table preferences are currently used. Column visibility/density preferences could help the wide device, user, and audit tables. No split panel is used; an incident preview may help investigation while retaining list filters. Both are optional improvements, not blanket conformance failures.

Direction: consistent empty/no-match/error states; task-specific table preferences where needed. The simple three-column group table can remain a bordered collection.

### D17 — High — Enabled-state text can contradict the actual state

Both notification channels (`notifications/page.tsx:221`) and AI providers (`ai/page.tsx:424`) use `t("common.enabled")` in both branches of the enabled boolean. The fixture disabled channel therefore displays the same "enabled" text as the enabled channel, with only the icon/color differing.

This is a UI truthfulness defect, not a stylistic preference. Fix the label first, and use readable localized status values consistently in discovery, maps, widgets, and resource lists.

Evidence: [notification channels](./evidence/notifications.jpg). Provider behavior was confirmed in source; a disabled provider was not added for this audit.

## Page coverage

All authenticated pages inherit the common shell findings. The table lists the main additional observations, not an exhaustive repetition of those shared issues.

| Page | Evidence mode | Main findings | Assessment |
|---|---|---|---|
| `/dashboard` | Browser + source | D04, D06, D16 | Rework operational hierarchy and drill-down |
| `/devices` | Browser + source | D01, D03, D16 | Good table foundation; fix composition/localization |
| `/devices/create` | Browser + source | D01, D03, D10 | Grouped form foundation; too much expanded optional setup |
| `/devices/[id]` | Browser + source | D02, D03, D08 | Useful tabs; overview mixes identity, polling and configuration |
| `/devices/[id]/edit` | Browser + source | D01, D02, D03, D10 | Reuse form pattern and one breadcrumb |
| `/incidents` | Browser + source | D01, D03, D16 | Add clear title/resource links; current title cells look like plain text |
| `/incidents/[id]` | Browser + source | D02, D03, D07, D08 | Replace raw RCA and technical timeline labels |
| `/topology` | Browser + source | D03, D14 | Major usability work at larger node counts |
| `/maps` | Browser + source | D03, D14 | Functional foundation; improve status/coverage context |
| `/metrics` | Browser + source | D03, D06, D12 | Rework date selection and chart context |
| `/alert-rules` | Browser + source | D01, D03, D08, D10 | Long modal and internal device labels |
| `/notifications` | Browser + source | D03, D09, D17 | Typed setup and truthful statuses are priorities |
| `/maintenance` | Browser + source | D01, D03, D10 | Dates/scope/recurrence need cohesive wording |
| `/config-snapshots` | Browser + source | D01, D03, D08 | Device names/links; configuration text itself is appropriately technical |
| `/ai` | Browser + source | D03, D13, D17 | Separate assistant work from provider administration |
| `/reports` | Browser + source | D01, D03, D07, D08 | Rebuild report presentation around report types |
| `/dashboards` | Browser + source | D01, D03, D16 | Normal collection; improve headings and labels |
| `/dashboards/[id]` | Browser + source | D03, D05, D06 | Highest perceived assembly/template quality problem |
| `/device-groups` | Browser + source | D03, D11, D16 | Simple table is appropriate; fix feedback/localization |
| `/discovery` | Browser + source | D03, D15 | Turn job diagnostics into an operator workflow |
| `/settings/users` | Browser + source | D03, D16 | Sound collection foundation; clarify roles/scope and table density |
| `/settings/site` | Browser + source | D01, D03 | Simple form is reasonable; width and wording need consistency |
| `/settings/api-keys` | Browser + source | D01, D03, D16 | Technical prefixes are appropriate; localize guidance/empty states |
| `/settings/audit-logs` | Browser + source | D01, D03, D08, D16 | Technical details are valid; names and useful columns should lead |
| `/settings/profile` | Browser + source | D01, D08 | Read-only identity should be readable text; improve form width |
| `/settings/preferences` | Browser + source | D01, D02 | Simple controls are appropriate; theme description always says system-driven |
| `/login` | Browser + source | Minor copy/brand polish | Simple Cloudscape form; low redesign priority |
| `/setup` | Source only | D03; step validation opportunity | Wizard is appropriate; localize step/helper text |
| `/invite` | Source only | D03, D08 | Localize registration and display role names meaningfully |
| `/` | Source only | Redirect | No standalone design to assess |

## Recommended redesign order

1. Correct UI truthfulness and feedback first: enabled labels, modal validation, raw identifiers in primary labels.
2. Establish page-type layouts, single headings/breadcrumbs, active navigation, and complete localization.
3. Rework basic/custom dashboards and theme-aware charts, including narrow widget layout.
4. Present reports and RCA as readable domain information; replace JSON channel configuration with typed forms.
5. Refine discovery, metric time selection, topology scale, advanced forms, and empty states.

Keep Cloudscape as the design foundation. Judge the next iteration using actual tasks: find a failing device, investigate an incident, understand an RCA, configure notifications, compare a snapshot, and monitor a chosen metric. Successful API calls alone do not validate those experiences.
