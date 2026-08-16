# Monitoring and Alerting

API and mobile initialize separate Sentry projects from environment-specific DSNs. Default PII is disabled, and recursive event/breadcrumb scrubbing filters credentials, tokens, OTPs, phone/email, addresses, message bodies, evidence, and AI prompts. Mobile source maps upload during EAS builds only through secret `SENTRY_AUTH_TOKEN`; API builds emit source maps and require the hosting release upload step.

Every API response receives `x-request-id`. Completion logs contain method, path without query, status, latency, and correlation ID—never request bodies or auth headers. OpenAI logs add generation ID, safe provider request ID, model, latency, and status without prompts. `/health` proves process liveness; `/readiness` checks database connectivity and returns only a stable public error when unavailable.

Configure alerts by environment and aggregate window:

| Signal                     | Initial closed-beta trigger                           | Response                                                      |
| -------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| API 5xx                    | >2% for 5 minutes or 10 events                        | Page on-call; correlate release/request IDs.                  |
| Readiness/database         | 3 consecutive failures                                | Stop traffic/deploy; database incident runbook.               |
| Mobile crash-free sessions | <99.0% after at least 100 sessions                    | Stop cohort expansion; triage P0/P1.                          |
| Notification outbox        | oldest pending >5 minutes or failed growth            | Inspect worker/provider; transactions remain committed.       |
| Order finalization         | any terminal failure after retries                    | P1 manual queue review.                                       |
| AI                         | budget circuit breaker, >10% provider failures/15 min | Disable `AI_STYLIST_ENABLED`; deterministic fallback remains. |
| Twilio                     | 3x baseline sends/failures or spend threshold         | Disable new phone flows; review Fraud Guard/Geo.              |
| Storage                    | >5 failures/5 min                                     | Disable uploads if necessary; preserve database state.        |
| Safety/disputes            | spike above defined cohort baseline                   | Notify trust operator; do not automate punitive action.       |

Tune thresholds after the first cohort; do not page on individual recoverable events. Provider dashboards, hosting metrics, Supabase reports, Sentry, and the existing admin aggregate metrics form the minimum beta dashboard. No remote Sentry project or alert has yet been configured or tested.
