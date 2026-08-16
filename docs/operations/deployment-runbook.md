# Deployment Runbook

This repository does not authorize public launch. Staging deployment and closed/internal mobile distribution are the maximum scope; production promotion always requires a named human approver.

## CI and staging

1. Start from a reviewed commit. CI must pass frozen install, secret scan, critical dependency audit, formatting, lint, typecheck, unit tests, Prisma validation, migration safety, fresh migration deployment, database/API integration tests, builds, and Expo Doctor.
2. Build immutable API/admin artifacts tagged with `RELEASE_VERSION=<git SHA>`. Inject staging secrets only from the hosting secret store.
3. Run `pnpm config:validate:api -- <completed staging file>` before starting the API. Deploy with the staging runtime database role.
4. Apply pending Prisma migrations using the staging migration role, then run the Supabase hardening/verifier.
5. Require `/api/v1/health` HTTP 200 and `/api/v1/readiness` HTTP 200. Run `pnpm staging:smoke` with the exact staging host/release guard, then the synthetic-fixture acceptance and provider-degradation checks.
6. Produce a preview build from `apps/mobile`: `eas build --profile preview --platform android` and, when Apple access exists, `--platform ios`. Confirm the resolved public environment points only to staging.

No account/credentials are configured in this repository, so no hosted staging deployment has been performed yet.

The deployed smoke requires `TARGET_ENV=staging`, `ALLOW_STAGING_SMOKE=THRIFTAGE_STAGING_ONLY`, `STAGING_API_URL` ending at `/api/v1`, `EXPECTED_STAGING_HOST`, and `EXPECTED_RELEASE_VERSION`; an optional `STAGING_SMOKE_AUTH_TOKEN` adds a read-only authenticated probe. The authorization matrix additionally requires the explicit synthetic-fixture acknowledgement and A/B/Admin tokens/fixture IDs described by its startup errors. Both tools refuse production-looking hosts and never print response bodies or credentials.

`.github/workflows/staging-smoke.yml` exposes the same read-only check through a manually dispatched, protected `staging` GitHub Environment. Configure its optional token as an environment secret. The repository cannot provide deployment automation until the API/admin hosting platform is selected and connected; do not add a speculative provider-specific deploy or production auto-promotion.

## Production promotion

Promotion order: approved release commit -> successful staging soak/acceptance -> go/no-go approval -> verified backup/restore point -> production migration -> API/admin deploy -> health/readiness/smoke -> production native build or compatible OTA update. Do not automatically deploy production from every merge.

Set `REGISTRATION_ENABLED=false`, `AI_STYLIST_ENABLED=false`, and optional-provider flags off until each production provider passes its gate. Enable one controlled capability at a time.

## Rollback

- **API/admin:** redeploy the prior immutable artifact, keeping schema compatibility. Use feature flags first when safer.
- **EAS Update:** republish the previous compatible update to the affected channel. Never cross `runtimeVersion`; native changes require a new binary.
- **Native build:** stop rollout or assign the previous eligible TestFlight/Play testing build. Installed iOS binaries cannot be remotely downgraded.
- **Database:** prefer a reviewed forward fix. Do not run ad hoc down migrations. For data loss/corruption, stop writes and execute the tested restore plan.
- **Providers:** disable the affected feature. COD and core browsing remain independent from OpenAI/push; phone-login incidents may require registration/phone-auth restriction.

Record release SHA, migration list, artifact/build IDs, EAS channels/runtime, approver, timestamps, smoke evidence, alerts, and rollback owner in the release record.
