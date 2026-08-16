# Staging Activation Attempt — 2026-08-16

## Outcome

**CODE READY — EXTERNAL BETA BLOCKERS REMAIN.** Production was not accessed or changed. No staging URL, provider verification, native artifact, or physical-device result exists from this attempt.

## Environment inventory

- No staging database, Supabase, Twilio, SMTP, OpenAI, Sentry, Expo, Apple, Google, or deployment-platform credentials were present in the process environment or repository-local environment files.
- EAS CLI reported that the local session is not logged in.
- Supabase CLI could not list projects because no access token was configured.
- No Git remote or deployment-platform configuration identifies a staging host.
- Docker CLI is installed, but its daemon is unavailable. Android SDK/ADB, Java, EAS, Supabase, k6, `psql`, and `pg_dump` are not installed as persistent local tools; pnpm can invoke temporary CLIs where authentication permits.

These checks inspected credential presence and CLI session state only. No secret values were printed or persisted.

## Repository blocker cleared

The server-boundary SQL previously made `thriftage_runtime` a `NOLOGIN` role while the runbook used it as `DATABASE_URL`. The boundary now uses `thriftage_runtime` as the permission/policy group and a separate least-privilege `thriftage_api` login that inherits it. Password assignment remains an out-of-band operator action.

The boundary is idempotent, removes direct grants from the login, denies migration-history access, and is covered by a disposable-database verifier. The remote verifier now requires both admin and runtime TLS connections and validates the exact roles, grants, RLS policies, Storage policy boundary, and Realtime authorization before performing a zero-row runtime query.

## Verification completed locally

- Applied all 10 Prisma migrations and both seeds to an isolated Prisma Dev database.
- Passed 23 database and 66 API integration tests.
- Confirmed migration status is current and schema diff is empty.
- Passed the local runtime-role/ACL proof without reading application rows.
- Expanded the guarded deployed authorization matrix to 15 checks, including public-profile privacy, cross-user order denial, and non-admin trust endpoint denial.

## External evidence still required

Provide a dedicated staging Supabase project plus admin/runtime credentials, choose and authenticate a deployment platform, and provide an EAS account/project. Those three inputs unlock database/provider configuration, an HTTPS API/admin deployment, remote security and authorization checks, Android preview distribution, and subsequent physical-device testing. Other provider, legal, monitoring, content, Apple, and operational-owner gates remain as listed in [the go/no-go](./go-no-go.md).
