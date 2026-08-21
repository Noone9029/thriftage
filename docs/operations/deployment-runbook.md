# Deployment Runbook

This repository does not authorize public launch. Staging deployment and closed/internal mobile distribution are the maximum scope; production promotion always requires a named human approver.

## CI and staging

### Current verified staging inventory

- API: `https://api-staging-4101.up.railway.app/api/v1` on Railway project `thriftage-staging`, environment `staging`, service `api`.
- API release: `4360df98c16a9fe45eca027610d5683b57140d86`; `/health` and `/readiness` return 200 and identify `staging`.
- Admin: `https://thriftage-admin-6hwrrcub6-ahmad-khalid-s-projects.vercel.app` in the existing Vercel project `thriftage-admin`.
- Database/Auth/Storage/Realtime: existing Supabase staging project `dstnxzljsbyusxoogkzr` in `ap-south-1`.
- The API allows the exact admin preview origin. Do not broaden credentialed CORS or create duplicate provider projects.

Railway uses the repository `Dockerfile` and `railway.json`, Node 24, `/api/v1/readiness` as its health check, staging-only secret variables, and the least-privilege runtime database role. The API container pins the Supabase Root 2021 CA and requires TLS verification. Background loops execute in the API service; inspect deployment logs for outbox, order-finalization, deletion, and media failures after each release.

1. Start from a reviewed commit. CI must pass frozen install, secret scan, critical dependency audit, formatting, lint, typecheck, unit tests, Prisma validation, migration safety, fresh migration deployment, database/API integration tests, builds, and Expo Doctor.
2. Build immutable API/admin artifacts tagged with `RELEASE_VERSION=<git SHA>`. Inject staging secrets only from the hosting secret store.
3. Run `pnpm config:validate:api -- <completed staging file>` before starting the API. Deploy with the staging runtime database role.
4. Apply pending Prisma migrations using the staging migration role, then run the Supabase hardening/verifier.
5. Require `/api/v1/health` HTTP 200 and `/api/v1/readiness` HTTP 200. Run `pnpm staging:smoke` with the exact staging host/release guard, then the synthetic-fixture acceptance and provider-degradation checks.
6. Produce a preview build from `apps/mobile`: `eas build --profile preview --platform android` and, when Apple access exists, `--platform ios`. Confirm the resolved public environment points only to staging. At this snapshot, EAS is not authenticated and `EXPO_PROJECT_ID` is not configured, so no installable artifact exists.

The deployed smoke requires `TARGET_ENV=staging`, `ALLOW_STAGING_SMOKE=THRIFTAGE_STAGING_ONLY`, an exact HTTPS `STAGING_API_URL` ending at `/api/v1`, `EXPECTED_STAGING_HOST`, and `EXPECTED_RELEASE_VERSION`; an optional `STAGING_SMOKE_AUTH_TOKEN` adds a read-only authenticated probe. The authorization matrix additionally requires `ALLOW_STAGING_AUTHORIZATION_MATRIX=THRIFTAGE_SYNTHETIC_FIXTURES_ONLY`, non-placeholder `USER_A_TOKEN`, `USER_B_TOKEN`, and `ADMIN_TOKEN` values, plus `USER_A_USER_ID`, `USER_A_USERNAME`, `USER_A_ORDER_ID`, `USER_A_DRAFT_LISTING_ID`, `USER_A_DRAFT_LISTING_TITLE`, `USER_A_AI_CONVERSATION_ID`, `USER_A_SAVED_OUTFIT_ID`, `USER_A_PRIVATE_CONVERSATION_ID`, `USER_A_DISPUTE_ID`, and `BLOCKED_CONVERSATION_ID`. Both tools refuse production-looking hosts and never print response bodies or credentials.

`.github/workflows/staging-smoke.yml` exposes the same read-only check through a manually dispatched, protected `staging` GitHub Environment. Configure its optional token as an environment secret. Railway and Vercel remain manually promoted staging targets; do not add production auto-promotion.

Supabase Realtime REST broadcast uses `/realtime/v1/api/broadcast/{topic}/events/{event}?private=true` with the server-only `apikey`; clients subscribe with their own authenticated session and private-channel authorization. Keep provider keys out of logs and documentation.

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
