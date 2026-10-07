# NetPulse Remediation Retest — 2026-10-02

## Outcome

All **41 findings** from the 2026-10-01 audit have been corrected and verified within the approved local/mock scope. The missing topology/map viewers, custom dashboard builder, discovery/trap application pipeline, escalation/retry delivery, group management and verified SSH capture are now implemented. [The finding-by-finding matrix](../REMEDIATION.md) records each fix and its evidence.

This is a remediation retest, not certification of every vendor, input, deployment or workload. No real equipment, live AI account or external notification recipient was used. Source changes remain in the working tree; no deployment or remote publication was performed.

## Executed verification

| Suite | Passed | Failed | Evidence |
| --- | ---: | ---: | --- |
| Vitest unit and web contract/refetch tests, 14 files | 174 | 0 | [Unit log](evidence/unit-tests.log) |
| HTTP API, access revocation, scoped sockets, AI and report contracts | 95 | 0 | [API results](evidence/api-results.json) |
| UDP SNMP, threshold/maintenance, delivery/escalation, traps and discovery | 26 | 0 | [Monitoring results](evidence/monitoring-results.json) |
| Real local SSH transport, encrypted keys, fingerprint verification and snapshots | 14 | 0 | [SSH results](evidence/ssh-results.json) |
| Group CRUD, all six widgets, sharing, topology CRUD and recurrence state | 27 | 0 | [Feature results](evidence/feature-results.json) |
| Legacy schema upgrade, archives, historical metrics and repeated seed/migrate | 9 | 0 | [Upgrade results](evidence/upgrade-results.json) |
| **Total automated assertions** | **345** | **0** | Unit 174 + integration 171; repeated Node 22 runs are not counted twice. |

Two additional image-startup assertions passed (reported separately from the 345 unit/integration assertions).

Node **22.23.3** in the official Alpine image passed `yarn test`, `yarn lint` and `yarn build`. Host API/network harnesses ran on Node 24.20.0. Frozen installation, production Docker web/API builds, Compose configuration and the non-root API image's normal startup/migration were checked. Worker health returned `polling`, `thresholds`, `delivery`, `traps` and `discovery` all true. [Node 22 quality log](evidence/node22-quality.log), [production web build](evidence/docker-web-build.log), [API build](evidence/docker-api-build.log), [runtime check](evidence/runtime-results.json).

One verification attempt during concurrent image builds hit Vitest's default five-second config-import timeout. The same tests passed on the quiescent final rerun **without increasing the timeout or changing that test**. The [earlier timing failure](evidence/node22-timeout-attempt.log) is retained; it is not included as a passed assertion.

## Browser acceptance

The application was operated through the in-app browser at its default narrow viewport. These are observed acceptance checks, separate from the six configured Playwright CI cases. The CI cases were enumerated successfully; **the standalone Chromium runner and remote GitHub Actions jobs were not executed in this session**. The corresponding six workflows below were exercised manually.

| Flow | Observed result | Evidence |
| --- | --- | --- |
| Reports | Stored list opens availability details with 13 samples and 53.846% uptime. | [Screenshot](evidence/browser/report-availability.png) |
| Notification history | Persisted Sent/Failed records and failure messages render. | [Screenshot](evidence/browser/notification-history.png) |
| Metrics | Device selection, 24h preset, anomaly 99, and prediction slope/threshold information render; local range remains correct. | [Screenshot](evidence/browser/metrics-anomaly-prediction.png) |
| AI query | SQL plus returned device columns/rows render. | [Screenshot](evidence/browser/ai-query-rows.png) |
| Incident AI | Analysis button calls the local provider and adds a real analysis timeline entry. | [Screenshot](evidence/browser/incident-ai-analysis.png) |
| Live incident | Backend resolution appears in the detail state and timeline without reloading the page. No precise refresh-latency claim is made. | [Screenshot](evidence/browser/realtime-incident-resolved.png) |
| Dashboard builder | Added summary widget, successful save, retained widgets/default after reload; login/main route uses the saved default. | [Screenshot](evidence/browser/dashboard-widgets-persisted.png) |
| Topology | Automatic placement saves and survives reload; authorized nodes/status render; Viewer has no connection mutation controls. Dark-mode node contrast and zoom bounds were corrected. | [Scoped screenshot](evidence/browser/viewer-topology-scoped.png) |
| Geographic map | Initial bounds fit the authorized marker; Viewer location table contains only its allowed device. | [Screenshot](evidence/browser/viewer-map-scoped.png) |
| Viewer permissions | Only QA Router A appears; add/edit/delete controls are disabled. Direct users page is denied with a return action; hidden device returns a finite error. | [List](evidence/browser/viewer-devices-scoped.png), [denied route](evidence/browser/viewer-admin-page-denied.png), [hidden detail](evidence/browser/viewer-hidden-device-error.png) |
| Advanced alert form | Device, channel, 2-minute escalation/channel and runbook values persist after creating and reopening the rule; flap window is labeled in minutes. | [Screenshot](evidence/browser/advanced-rule-persisted.png) |
| Device configuration | SNMPv3 user/security/auth/privacy and SSH fields are available. Saving a location edit with blank secret fields retains configured keys. | API/UDP masked-edit regressions plus browser detail verification. |
| Invitation | Restricted device selection is available; generated URL targets /invite?token=..., without undefined. No email was sent. | [Screenshot after closing token modal](evidence/browser/invitation-created.png) and API email-binding/reuse assertions. |
| Profile | Phone survives save and reload. | [Screenshot](evidence/browser/profile-phone-persisted.png) |
| Site settings | Saved logo is rendered in the app header. | [Screenshot](evidence/browser/site-logo-rendered.png) |
| Maintenance | Cron, Asia/Seoul timezone and selected group persist. 02:00–03:00 remains unchanged after reopening/saving; scope is displayed. | [Screenshot](evidence/browser/maintenance-timezone-scope-persisted.png), [accessibility evidence](evidence/browser/maintenance-timezone-scope-persisted.ax.txt) |

## Important acceptance details

- The UDP agent exposed CPU 95%, free-memory zero and sparse interface indices 5/9. Actual packets selected v2c BER version 1 and v3 BER version 3. LLDP system name/port and ARP neighbors persisted into topology edges. Link-down duplicates produced one incident; link-up resolved it.
- Fifteen concurrent threshold events produced one active incident. Active maintenance suppressed triggering; unrelated group rules stayed silent. Trigger, escalation and recovery were recorded, and a deliberately rejected webhook retried successfully without false immediate success.
- SSH used ephemeral host/client keys and a real local SSH server. Wrong host fingerprints, nonzero commands and empty output failed. Successful capture stored hashes/diffs and encrypted private keys; responses/audits omitted key material.
- Upgrade fixtures began with the original schema and duplicate records. Historical metrics survived hypertable conversion; duplicates were archived, three Timescale policies existed, and repeated migration/seed runs preserved data.
- Additional retest discoveries were fixed: dashboard save rejected extra database fields, invitation URL needed an absolute origin, trap matching needed stable selection for duplicate fixture source IPs, topology needed dark-mode/zoom handling, and maintenance edits needed local-time conversion/current recurrence state.

## Reproduction and operational boundaries

[README](../../../README.md) documents setup, root environment loading, Node 22 quality commands and disposable regression execution. Scripts require local disposable services and must not run against production data. Test state/JWT/private keys are kept outside the repository; only sanitized results and selected screenshots are included. The original audit evidence is retained separately.

Migrations 0002–0005 add the missing schema, monitoring integrity, account deletion behavior and SSH host verification. Real upgrades require a database backup. AI and notification credentials are configured through the UI; environment variables alone do not create providers/channels. SSH capture is on demand; scheduled SSH backup, Jira and Kakao integrations are not advertised as implemented.

Remaining external acceptance: physical multi-vendor SNMP/SSH equipment; live AI output quality; authenticated SMTP and vendor delivery; external v1/v3 trap combinations; prolonged outage/retry/restart behavior; production load, failover and disaster recovery; complete desktop/mobile/accessibility coverage. These were outside the approved local/mock environment. The six browser CI cases are prepared and listed, but a passing hosted CI run is not claimed.

Temporary QA services were stopped after evidence export; existing unrelated containers/services were preserved.
