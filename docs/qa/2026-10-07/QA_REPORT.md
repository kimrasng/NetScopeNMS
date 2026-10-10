# NetPulse Docker multi-vendor QA — 2026-10-07

## Result

The local Docker lab has passed 602 automated checks/test cases. Three live
Telegram deliveries also passed after correcting a real API rejection; the
recipient confirmed receiving all three test/fault/recovery messages.
The initial four Gemini generation attempts timed out. Four follow-up attempts
using other authentication/request paths or a different model returned HTTP 503;
live AI is not marked passed. This report distinguishes simulator, mock
transport, browser configuration, and live evidence.

| Suite | Passed | Failed | Evidence in `evidence/` |
| --- | ---: | ---: | --- |
| Vitest, 18 files | 198 | 0 | `unit-tests.log` |
| API integration, RBAC and contracts | 95 | 0 | `api-results.json` |
| Monitoring, traps, maintenance, escalation and retry | 26 | 0 | `monitoring-results.json` |
| SSH capture and authentication controls | 14 | 0 | `ssh-results.json` |
| Feature integration | 27 | 0 | `feature-results.json` |
| Seven Docker device profiles | 123 | 0 | `multivendor-results.json` |
| Four AI providers and eight notification channels, local transports | 61 | 0 | `transport-results.json` |
| Disposable database upgrade and repeated seed | 9 | 0 | `upgrade-results.json` |
| Browser E2E, Chromium | 28 | 0 | `browser-summary.json`, `browser-report/index.html` |
| Web AI/Telegram input, masking, edit and persisted key retention | 12 | 0 | `web-credentials-results.json` |
| Actual Linux container stop/restart | 9 | 0 | `outage-results.json` |
| **Local total** | **602** | **0** | |
| Live Telegram test/fault/recovery, recipient confirmed | 3 | 0 | `live-telegram-results.json`, `telegram-recipient-confirmation.json` |
| Initial live Gemini 3.8 attempts | 0 | 4 | `live-initial-results.json`, `live-results.json` |
| Live Gemini alternative request/model attempts | 0 | 4 | `ai-followup-summary.json`, `ai-diagnose-results.json`, `live-ai-results.json` |

Full lint/type checking passed all 10 Turborepo tasks (`lint.log`). The complete
production build passed all six tasks, including the Next.js application
(`build.log`).

## Environment

- Dedicated Compose project: `netpulse-qa`; separate database and result volumes.
- Node 22.23.3, Yarn 1.22.22, TimescaleDB/PostgreSQL 16, Redis 7.
- Production API and Next.js web; Playwright 1.56.1 Chromium in a matching image.
- Web `http://localhost:13000`; API `http://localhost:14000`.
- Host bindings are loopback; SNMP, SSH, and control endpoints use a private
  Docker network. The ignored live secret file is excluded from image builds.
- The final API image includes all fixes and was restarted successfully. All
  eleven running services are healthy; API health returned HTTP 200 as UID 1001.
  Live provider/channel records were removed, the local default AI provider was
  restored, and the transport redirect marker is absent.

| Profile | IP | CPU/RAM fixture |
| --- | --- | --- |
| Cisco IOS XE | 172.28.240.11 | CISCO-PROCESS-MIB / CISCO-MEMORY-POOL-MIB |
| Juniper Junos | 172.28.240.12 | JUNIPER-MIB operating CPU/buffer columns, compound index |
| Arista EOS | 172.28.240.13 | HOST-RESOURCES CPU and RAM storage |
| HPE Aruba AOS-CX | 172.28.240.14 | HOST-RESOURCES CPU and RAM storage |
| Huawei VRP | 172.28.240.15 | HUAWEI-ENTITY-EXTENT-MIB CPU/memory |
| Linux Ubuntu | 172.28.240.16 | HOST-RESOURCES CPU / UCD memory |
| Linux Rocky | 172.28.240.17 | HOST-RESOURCES CPU / UCD memory |

Every profile was registered through the API and polled by the running BullMQ
worker. Tests checked CPU 24%, RAM 40%, sparse interface indices 5/9, growing
bandwidth counters, SNMPv3 SHA/AES privacy, SSH snapshot/diff, LLDP/ARP ring
discovery, CPU 95%/interface-down faults, and recovery. A Linux profile also
verified SNMPv1 packets. LLDP/ARP persisted at least seven topology edges.

## Defects reproduced and corrected

1. **Vendor CPU/RAM collection:** the original generic collector omitted
   Cisco, Juniper, and Huawei CPU/RAM and treated swap/disk storage as RAM.
   The original image produced 13 passes and 8 failures across 21 direct
   metric checks (`vendor-baseline.json`). The corrected collector produced
   21 passes and no failures (`vendor-probe.json`). It joins storage columns
   by their full index, includes only RAM, weights allocation units, rejects
   invalid values, tolerates unsupported optional MIBs, and selects vendor
   fallbacks by `sysObjectID`. Six focused unit tests cover these cases.
   Final review also reproduced nonfinite UCD input producing a `NaN` memory
   value (`system-metrics-infinite-before.log`); numeric parsing now excludes
   nonfinite input before any resource arithmetic. All 198 unit tests passed
   again with that regression assertion.
2. **Telegram formatting:** unescaped user/AI text in Markdown could corrupt
   messages or be rejected. Telegram now uses escaped HTML and bounded field
   lengths, including Unicode text. Recovery and escalation labels reflect
   the event. Focused unit and transport tests verify escaping, long messages,
   and trigger/recovery payloads.
   Live testing then reproduced HTTP 400: Telegram rejects an inline button
   pointing to `http://localhost:13000/notifications`. Loopback or malformed
   incident links now omit the button while preserving the alert. A regression
   covers localhost, IPv4 loopback and IPv6 loopback. The actual rejection is
   preserved in `telegram-live-diagnostic.json`; three deliveries passed after
   the fix.
3. **Container health checks:** `localhost` could resolve to IPv6 while the
   application listened on IPv4, making usable services appear unhealthy.
   Docker health checks now use `127.0.0.1`.
4. **Unbounded AI provider requests:** the initial live connection request
   exceeded the harness's 90-second deadline while the server request remained
   active. Provider requests now have a 60-second deadline. Two real local HTTP
   tests cover an accepted request that never responds and a timely response.
   Gemini 3 requests also use the recommended default temperature and a low
   thinking level for interactive latency. Generation still timed out with
   Gemini 3.8; these changes are not presented as resolving that external path.
5. **Gemini response parsing and key transport:** a focused regression
   reproduced the old parser returning a thought summary and discarding the
   remaining answer parts. Another reproduced a blocked response becoming an
   empty successful answer. The parser now joins non-thought text and reports
   blocked/empty responses as errors. API keys use the documented authentication
   header rather than a URL query parameter. The before-fix run had three
   regression failures (`ai-gemini-before.log`); the final 198 unit tests and
   61 local transport checks passed. Header authentication is not claimed to
   resolve provider overload.

Existing browser tests were updated to the current English labels, tabbed
device/metric views, explicit dashboard edit mode, and actual result pagination.
The notification test now visits later history pages to find older failed
deliveries. The suite is paced to respect the unchanged production API limit.
Initial test-mode/fixture issues are not counted as product defects.

## AI and notification coverage

OpenAI, Gemini, Claude, and Custom provider paths passed connection, natural
language query/SQL execution, persisted RCA, incident chat, AI report narrative,
and HTTP 503 failure handling using local deterministic HTTP responses.

Telegram, Discord, Slack, Twilio SMS, PagerDuty, webhook, email SMTP, and in-app
channels passed test delivery, persisted history, incident trigger and recovery.
Six HTTP channels also passed initial rejection and subsequent outbox retry.
PagerDuty recovery used resolve/deduplication semantics. SMTP messages were
received over a real local TCP exchange. Telegram escaped special characters
in device names and produced recovery messages.

The separate container interruption scenario stopped only QA Ubuntu. Real ICMP
failure marked its isolated test device Down, created one incident/notification,
and remained idempotent on another failed sample. Restart restored reachability,
resolved the incident, sent recovery, and returned the device to Up.

## Browser and database coverage

Twenty-one authenticated console routes loaded without observed initial API or
JavaScript errors, after initial REST requests and chart loading completed.
Functional E2E covered device search/interface detail, stored
availability reports, notification history/pagination, metrics/anomalies and
prediction, dashboard widget persistence, AI result tables, and viewer access
restrictions. Per-route screenshots and rendered text are in the HTML report.
The final 21-route contact sheet is `evidence/browser-contact-sheet.png`.
Three targeted follow-up scenarios explicitly waited for the default dashboard
widget, React Flow nodes, and Leaflet container to render after dynamic loading.
Their report is `evidence/rendering/browser-report/index.html`; the contact
sheet uses these later screenshots for those three routes.

The normal configuration paths are AI > AI Providers and Notifications >
Channels > Telegram. A separate Chromium scenario used the supplied test
credentials in those forms, created disabled temporary records, reopened the
edit forms, and saved name changes without re-entering secrets. Database
comparisons confirmed the original key/token and recipient remained intact.
Inputs were masked, AI responses omitted the key, and Telegram responses
redacted the token. All 12 checks passed, and temporary records were deleted.
No generation or Telegram sends occurred during this form test. The ignored
environment file is an automation input, not the normal administration UI.

The upgrade suite used an additional empty QA database. It checked duplicate
incident/interface archival, retention of historical metrics through Timescale
conversion, missing tables and policies, repeated migrations, and idempotent
sample seeding. Production seeding protection remained enabled.

## Live status and limits

- Live AI used the supplied Gemini 3.8 Flash configuration. Model metadata GET
  and `countTokens` POST returned HTTP 200; actual generation did not respond
  within the deadlines. One initial connection attempt and the three remaining
  query/chat/RCA attempts exhausted the agreed four-call scope. The last three
  NMS endpoints returned HTTP 500 after approximately 60 seconds. The cause of
  the stalled external generation response is not isolated.
- The user then requested other methods using the same validly entered key.
  Four additional generation requests were attempted without automatic retries:
  Gemini 3.8 through native header authentication, Gemini 3.5 through the NMS
  query route, Gemini 3.8 through Google's OpenAI compatibility endpoint, and
  Gemini 3.8 through the Interactions API. All returned HTTP 503. Native and
  Interactions responses explicitly reported high model demand; the NMS server
  recorded the same high-demand message for Gemini 3.5. Direct diagnostic
  responses arrived in approximately 1.2–2.7 seconds. The API's internal query
  failure response was HTTP 500 wrapping the upstream 503. This establishes
  current upstream unavailability rather than a reported key-authentication
  rejection; it does not conclusively identify the earlier timeout cause.
  Additional chat/RCA calls were skipped after the failed query. The four-call
  follow-up scope is exhausted, and no generated answer is claimed.
  A subsequent authenticated model-list request returned HTTP 200 and included
  `gemini-2.5-flash` and `gemini-3.1-flash-lite` (`ai-model-metadata.json`).
  Listing establishes metadata access only; their generation was not attempted.
- Live Telegram test, threshold fault, and recovery were accepted by the real
  Bot API and persisted as `sent`. No successful messages preceded the three
  final sends: the diagnostic localhost-button request returned HTTP 400.
  The recipient supplied the matching test, CPU 95 fault, and CPU 20 recovery
  messages from the Telegram client on October 7. End-to-end receipt is
  confirmed (`telegram-recipient-confirmation.json`). The copied text alone
  does not establish how formatting is visually rendered in the client.
- No external delivery or generated model response is claimed by mock checks.
- These are synthetic SNMP/SSH protocol profiles, not vendor NOS/firmware
  certification. Actual device families and their configured MIBs can differ.
- SMTP/Slack/Discord/SMS/PagerDuty real accounts were not supplied; their
  transport paths were tested locally. Long-running soak and load testing
  beyond the exercised flows were not performed.

Reproduction commands and secret-file format are in
[`scripts/qa/README.md`](../../../scripts/qa/README.md).

## MIB and Telegram references

- [Cisco CPU MIB usage](https://www.cisco.com/c/en/us/support/docs/ip/simple-network-management-protocol-snmp/15215-collect-cpu-util-snmp.html)
- [Cisco memory pools](https://www.cisco.com/c/en/us/support/docs/ip/simple-network-management-protocol-snmp/15216-contiguous-memory.html)
- [Juniper SNMP health monitoring](https://www.juniper.net/documentation/us/en/software/junos/network-mgmt/topics/topic-map/health-monitoring-with-snmp.html)
- [Arista SNMP example](https://www.arista.com/docs/Manuals/QuickStart-Managing7150Series.pdf)
- [HPE AOS-CX 6100 diagnostics/MIB support](https://www.arubanetworks.com/techdocs/AOS-CX/10.06/PDF/6100/Diagnostics%20Supportability%206100.pdf)
- [Huawei MIB CPU/memory example](https://info.support.huawei.com/enterprise/en/doc/EDOC1100410594/e704d4b7/mib-example)
- [Telegram formatting requirements](https://core.telegram.org/bots/api#formatting-options)
- [Gemini generation thinking configuration](https://ai.google.dev/gemini-api/docs/generate-content/thinking)
- [Gemini latency and temperature guidance](https://ai.google.dev/gemini-api/docs/troubleshooting)
- [Gemini authentication header](https://ai.google.dev/gemini-api/docs/api-key)
- [Google OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai)
- [Gemini Interactions text generation](https://ai.google.dev/gemini-api/docs/text-generation)
