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

The guarded read test targeted API release `fa2d3f3c5c71dd9b4f49d1e64d1b9f3de1d06567` on Railway Singapore with Supabase Postgres in `ap-south-1` and `DATABASE_POOL_MAX=15`. It used the approved synthetic demo identity and clearly test-scoped inventory. The scenario ramped from 0 to 30 VUs for one minute, held 30 for three minutes, then ramped down for one minute. Each VU performed one rotating feed, personalized-feed, or search request followed by one second of think time.

| Route             | p50    | p95    | p99    |
| ----------------- | ------ | ------ | ------ |
| All reads         | 1.39 s | 2.86 s | 3.05 s |
| Feed              | 1.26 s | 1.65 s | 1.75 s |
| Personalized feed | 2.43 s | 3.02 s | 3.13 s |
| Search            | 1.26 s | 1.63 s | 1.71 s |

Result: **FAIL**. All 2,820 checks passed and 0 of 2,821 HTTP requests failed, but every route exceeded the latency targets. Railway reported 2,826 2xx responses, no 4xx/5xx responses, peak CPU `0.259 vCPU`, and peak memory `326.9 MB` for the covering window. Two earlier diagnostic runs deliberately issued three parallel requests per VU and were retained only as saturation evidence; they are not the gate result. Sentry and representative beta-scale catalog evidence remain unavailable.
