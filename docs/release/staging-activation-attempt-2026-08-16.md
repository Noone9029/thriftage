# Staging Activation Attempt — 2026-08-16

## Outcome

**STAGING FOUNDATION ACTIVE — DEPLOYED API AND EXTERNAL BETA BLOCKERS REMAIN.** Production was not accessed or changed. A dedicated Supabase staging project and Android emulator now exist, but there is no deployed HTTPS API, native preview artifact, or physical-device result.

## Activated infrastructure

- Created Supabase organization `Thriftage` (`jidpmtxebpwfbxjmyxzc`) and project `thriftage-staging` (`dstnxzljsbyusxoogkzr`) in Mumbai (`ap-south-1`).
- Enabled database SSL enforcement, installed the Supabase root CA locally, and used `verify-full` for operator and runtime connections.
- Applied all 10 Prisma migrations, both idempotent seeds, the server-only Data API boundary, Storage bucket policy, and private Realtime authorization policy.
- Provisioned separate `thriftage_runtime` permission and `thriftage_api` login roles. Credentials and API keys are DPAPI-encrypted outside the repository under `%APPDATA%\Thriftage`.
- Passed the remote security verifier without reading application rows.
- Installed Android Studio, command-line tools, API 36/36.1 Google Play images, and a `medium_phone` AVD. WHPX acceleration is operational; Expo Go launched the mobile login shell against the local API and real staging Supabase project.
- Created and configured the Vercel project `thriftage-admin`; public Supabase variables are set for Preview and Production. Deployment is intentionally withheld until a valid HTTPS API URL exists.

No secret value was printed or committed. Supabase and Vercel CLI sessions remain in their native local credential stores.

## Repository blocker cleared

The server-boundary SQL previously made `thriftage_runtime` a `NOLOGIN` role while the runbook used it as `DATABASE_URL`. The boundary now uses `thriftage_runtime` as the permission/policy group and a separate least-privilege `thriftage_api` login that inherits it. Password assignment remains an out-of-band operator action.

The boundary is idempotent, removes direct grants from the login, denies migration-history access, and is covered by a disposable-database verifier. The remote verifier now requires both admin and runtime TLS connections and validates the exact roles, grants, RLS policies, Storage policy boundary, and Realtime authorization before performing a zero-row runtime query.

## Verification completed locally

- Applied all 10 Prisma migrations and both seeds to an isolated Prisma Dev database.
- Passed 23 database and 66 API integration tests.
- Confirmed migration status is current and schema diff is empty.
- Passed the local runtime-role/ACL proof without reading application rows.
- Expanded the guarded deployed authorization matrix to 15 checks, including public-profile privacy, cross-user order denial, and non-admin trust endpoint denial.
- Exercised local API health/readiness against the staging database and rendered the mobile login route in the Android emulator.

## Remaining deployment decision

Vercel is suitable for the Next.js admin application. The NestJS API also owns continuous notification, order-finalization, and deletion workers, so deploying it as request-scoped Vercel functions would not preserve required worker behavior. Select and authenticate a persistent Node host for the API, then set `NEXT_PUBLIC_API_URL`, deploy the admin, configure Supabase redirect URLs, and run smoke/authorization/provider drills. EAS, physical-device, provider, legal, monitoring, content, Apple, and operational-owner gates remain as listed in [the go/no-go](./go-no-go.md).
