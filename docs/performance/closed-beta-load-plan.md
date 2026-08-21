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
