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
$env:BASE_URL='https://staging-api.example.invalid/api/v1'
$env:EXPECTED_STAGING_HOST='staging-api.example.invalid'
$env:LOAD_TEST_AUTH_TOKEN='<synthetic tester token>'
pnpm load:test:read
```

For bounded writes, use a synthetic conversation and set `ALLOW_STAGING_WRITES=THRIFTAGE_SYNTHETIC_FIXTURES_ONLY`. Checkout is additionally gated by `ENABLE_CHECKOUT_PROBE=true`, a disposable `LISTING_ID`, and buyer-owned `ADDRESS_ID`.

Record commit/release, region, database plan/pool size, fixture volume, k6 summary, API/database/Sentry graphs, slow queries, and regressions. Run `EXPLAIN (ANALYZE, BUFFERS)` only on staging for feed, search, personalized feed, messages, orders, and admin queues using realistic data. Do not paste message/address/AI content into evidence.

No staging endpoint or credentials are currently available, so no measurements are claimed. Passing local tests does not satisfy this gate.
