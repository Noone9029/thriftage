# Closed-Beta Load and Performance Plan

Run only against a dedicated staging host using synthetic accounts/data. The k6 scripts refuse to start without an exact expected host and explicit staging acknowledgement. They do not call Twilio, OpenAI, push, or production.

## Targets

- Read mix: 30 concurrent users for three minutes after ramp; p50 <250 ms, p95 <600 ms, p99 <1.5 s, <1% failed requests.
- Controlled writes: five concurrent synthetic users for two minutes; p95 <1 s, p99 <2 s, <1% unexpected failures.
- Checkout contention: one disposable active listing; exactly one order succeeds and competing requests return the stable unavailable response without duplicate reservation/payment/outbox rows.
- Worker recovery: notification and finalization backlogs drain after restart without duplicate materialization.

## Commands

```powershell
$env:TARGET_ENV='staging'
$env:ALLOW_STAGING_LOAD_TEST='THRIFTAGE_STAGING_ONLY'
$env:BASE_URL='https://api-staging-4101.up.railway.app/api/v1'
$env:EXPECTED_STAGING_HOST='api-staging-4101.up.railway.app'
$env:LOAD_TEST_AUTH_TOKEN='<synthetic tester token>'
pnpm load:test:read
```

For bounded writes, use a synthetic conversation and set `ALLOW_STAGING_WRITES=THRIFTAGE_SYNTHETIC_FIXTURES_ONLY`. Checkout is additionally gated by `ENABLE_CHECKOUT_PROBE=true`, a disposable `LISTING_ID`, and buyer-owned `ADDRESS_ID`.

Record commit/release, region, database plan/pool size, fixture volume, k6 summary, API/database/Sentry graphs, slow queries, and regressions. Run `EXPLAIN (ANALYZE, BUFFERS)` only on staging for feed, search, personalized feed, messages, orders, and admin queues using realistic data. Do not paste message/address/AI content into evidence.

## 2026-08-21 staging evidence

The guarded read test targeted API release `b19ce9bad821a0787348f2ffb2dbc4d2dfdd38fd` on Railway Singapore with Supabase Postgres in `ap-south-1` and `DATABASE_POOL_MAX=15`. It used the approved synthetic demo identity and clearly test-scoped inventory. The scenario ramped from 0 to 30 VUs for one minute, held 30 for three minutes, then ramped down for one minute. Each VU performed one rotating feed, personalized-feed, or search request followed by one second of think time. The generator was the operator workstation configured for `America/New_York`, not a Pakistan-region load generator.

| Route             | p50    | p95    | p99    |
| ----------------- | ------ | ------ | ------ |
| All reads         | 520 ms | 636 ms | 687 ms |
| Feed              | 496 ms | 564 ms | 610 ms |
| Personalized feed | 584 ms | 663 ms | 716 ms |
| Search            | 495 ms | 571 ms | 621 ms |

Result: **FAIL**. All 4,722 checks passed and 0 of 4,723 HTTP requests failed. Feed and search now pass p95/p99, and all routes pass p99, but every route still misses p50; overall p95 misses by 36 ms and personalized-feed p95 misses by 63 ms. Joining nested Prisma relations reduced overall p95 from 2.86 s to 636 ms and p99 from 3.05 s to 687 ms without changing the scenario or thresholds. A separate sequential probe measured health p50 at 286 ms from the same operator host, so a Pakistan-region generator is required to separate application latency from the long-distance network floor. The gate remains failed until the original targets pass; Sentry and representative beta-scale catalog evidence also remain unavailable.

### Follow-up optimization evidence

Release `c5e2f889c9363c5a9541e49fbf2ffff0b205a7b6` caches the active recommendation configuration, reads independent personalization history concurrently, performs block exclusion in the candidate query, coalesces short-lived display reputation reads, and selects only scoring fields from recommendation candidates. Unit and isolated PostgreSQL integration tests protect bidirectional block exclusion, learned-signal reset semantics, and reputation-cache behavior.

After two warm-ups, a bounded authenticated sequential probe made 10 recommendation-feed requests from the same operator workstation. All returned HTTP 200. Client timing was p50 `579.93 ms` and p95 `648.78 ms`; correlated Railway request logs measured API timing at p50 `261.27 ms` and p95 `266.79 ms`. The approximately `319 ms` p50 gap is transit and edge overhead from the New York operator path to Railway Singapore. The narrowed candidate projection did not materially improve the small staging fixture, so no further speculative cache or infrastructure was added.

This probe is diagnostic evidence, not a substitute for the guarded 30-VU scenario. The gate remains **FAIL** until the original thresholds pass from an approved Pakistan-region generator with representative beta-scale inventory and monitoring evidence.

## 2026-08-22 regional staging diagnostic

Release `adba7a9de89bcf80bac86c04cf951d0787d827ca` adds a bounded application-user lookup cache after profiling showed that authenticated user resolution added approximately `60 ms` per request between Railway Singapore and Supabase Mumbai. Only active standard users are cached, for at most three seconds and 5,000 entries; in-flight lookups are coalesced. Administrators, missing users, and suspended or deactivated users are never cached, so privileged and denied states remain authoritative on every request. Unit tests cover concurrency, expiry, and excluded states.

An exact-release diagnostic ran from the existing Railway Singapore staging instance for three minutes with 30 concurrent workers against authenticated feed, personalized-feed, and search reads. This was a regional application diagnostic, not the required Pakistan-origin run and not representative beta-scale inventory.

| Route             | Requests |       p50 |       p95 |       p99 |
| ----------------- | -------: | --------: | --------: | --------: |
| All reads         |    4,235 | 265.98 ms | 404.46 ms | 653.23 ms |
| Feed              |    1,414 | 258.95 ms | 386.76 ms | 657.39 ms |
| Personalized feed |    1,409 | 276.89 ms | 463.13 ms | 654.96 ms |
| Search            |    1,412 | 250.16 ms | 390.91 ms | 640.43 ms |

Result: **FAIL**. All routes pass p95 and p99 but miss the strict p50 target. The diagnostic recorded three client-side failures; correlated Railway logs for the measurement window recorded 4,264 responses, zero HTTP statuses >=400, zero upstream-error rows, and no application warning/error entries. Warm sequential authenticated p50 was `209.87–215.23 ms`, confirming that the optimization helps low-contention reads but does not clear the sustained concurrency gate. Stop extending cache duration: further work should measure database/query or regional-placement changes. The final gate still requires the approved Pakistan-region generator, representative beta inventory, and monitoring evidence.

### Database round-trip optimization evidence

Release `4c2e556a4d6edf06588e83851c464ffefd97d740` keeps bidirectional block checks authoritative inside the listing query, hydrates chronological NEW feed records without a separate rank lookup, and combines five bounded personalization-history reads into one bounded `UNION ALL` query. It does not extend cache duration, add infrastructure, or weaken listing eligibility. The new personalization SQL was executed read-only against staging PostgreSQL before deployment; unit tests cover the one-query feed path, in-query block predicates, and per-source history limits. The complete default suite, typecheck, builds, formatting, lint, migration safety, and secret scans pass. The isolated destructive integration suite was not run locally because no disposable `TEST_DATABASE_URL` is available; staging was not repurposed as a test database.

The exact-release three-minute, 30-worker authenticated regional diagnostic produced:

| Route             | Requests |       p50 |       p95 |       p99 |
| ----------------- | -------: | --------: | --------: | --------: |
| All reads         |    4,634 | 138.73 ms | 249.43 ms | 597.30 ms |
| Feed              |    1,545 | 128.33 ms | 193.44 ms | 470.03 ms |
| Personalized feed |    1,546 | 192.02 ms | 298.95 ms | 659.45 ms |
| Search            |    1,543 | 128.20 ms | 196.26 ms | 549.16 ms |

Result: **regional technical targets PASS** with zero diagnostic failures. Correlated Railway logs recorded 4,641 HTTP 200 responses from the diagnostic source at server p50 `132 ms`, p95 `244 ms`, and p99 `577 ms`, with zero upstream-error rows and no application warning/error entries. This clears the measured Singapore-regional latency defect. The authoritative release gate remains **BLOCKED**, not PASS, until an approved Pakistan-origin generator, representative beta-scale inventory, and monitoring evidence reproduce the result.
