# Threat Model and Authorization Matrix

## Boundaries and assets

Supabase authenticates identities; NestJS is the authoritative data/API boundary; PostgreSQL is durable truth; Storage holds controlled media; Realtime carries advisory hints; Twilio, Expo, Sentry, and OpenAI are optional provider boundaries. High-value assets are account/session integrity, private communications/evidence, order availability and price, admin authority, provider keys, and deletion/audit history.

| Threat                                        | Primary mitigations                                                                                                                 | Residual validation                                 |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Account takeover/credential stuffing          | Supabase verification/session handling, generic errors, rate limits, reauthentication                                               | Stage Auth limits, SMTP, recovery, CAPTCHA decision |
| OTP fraud/enumeration                         | normalized E.164 values, persisted start/send/check limits, Twilio restricted keys/Fraud Guard/PK geo controls, kill switch         | Approved-number staging drill and Twilio alerts     |
| IDOR/BOLA                                     | bearer verification, linked-user/role guards, repository ownership filters, private DTOs                                            | Run the A/B/Admin matrix below                      |
| Malicious uploads/private evidence leak       | MIME decode/re-encode, size/dimension/key controls, private signed reads, bucket policy                                             | Real Storage adversarial tests and expiry checks    |
| Fake listings/messaging abuse                 | moderation states, reports, blocks/restrictions, contact detection, audits                                                          | Moderator SLA and pilot-content review              |
| Double purchase/price manipulation            | server-owned price, row lock, idempotency key, listing/order state machines                                                         | Concurrent staging checkout probe                   |
| Order/admin state manipulation                | actor-specific transitions, ADMIN guards, audit records                                                                             | Matrix and manual API review                        |
| Push token abuse/private notification leakage | token ownership/upsert, generic notification copy, receipt deactivation                                                             | APNs/FCM device drill and outage test               |
| Prompt injection/AI leakage                   | fixed tools, structured output validation, eligible inventory enforcement, bounded private context, no raw prompt logs, kill switch | Bounded live staging eval                           |
| Secret/log exposure                           | strict env schemas, secret scan, frontend prefix review, stable error codes, Sentry scrubbing                                       | Scan build artifacts and deliberate Sentry event    |

## Required A/B/Admin checks

Use synthetic staging users A and B and one controlled admin. Record request ID, expected status, actual status, and timestamp. Do not run against production. `pnpm security:authorization:staging` implements the guarded A/B/Admin checks against an exact HTTPS staging host. It requires synthetic fixture IDs and refuses production-looking hosts.

| Check                                                                             | Expected                                       |
| --------------------------------------------------------------------------------- | ---------------------------------------------- |
| A reads B private account/profile edit endpoint                                   | 403/404, no private fields                     |
| B updates A listing or media                                                      | 403/404, no mutation                           |
| A reads B AI conversation or saved outfit                                         | 403/404                                        |
| Stranger reads conversation/messages or subscribes to its Realtime topic          | denied                                         |
| Stranger requests dispute evidence signed URL                                     | denied                                         |
| USER invokes listing moderation, feedback moderation, user suspension, or metrics | 403 `ADMIN_PERMISSION_DENIED`                  |
| Blocked pair starts/sends/realtime-subscribes                                     | denied per messaging policy                    |
| Buyer retries same checkout idempotency key                                       | one order only                                 |
| Two buyers concurrently purchase one listing                                      | one success; other stable unavailable response |

Automated repository integration tests cover ownership, guards, order concurrency, blocks, private evidence, and AI ownership without paid providers. The staging matrix proves deployed configuration. Dependency/static/secret scanning is not a professional third-party penetration test. A focused external assessment remains recommended before public launch.

## Safe DAST cases

Against an isolated staging fixture only: malformed/unknown JSON fields; oversized inputs; invalid UUID/cursors; missing/expired/foreign tokens; method/path enumeration; common security headers; reflected text encoding; upload content mismatch; authorization matrix; and rate-limit behavior. Exclude destructive SQL payloads, credential attacks, provider-spend paths, and production targets.
