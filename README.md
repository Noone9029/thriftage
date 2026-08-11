# Thriftage

Thriftage is a mobile-first peer-to-peer fashion marketplace. The repository contains the engineering foundation, complete identity/onboarding, and the trusted marketplace discovery layer: category taxonomy, moderated listings with private media, search and deterministic feeds, likes, saves, follows, seller profiles, reporting, and PostgreSQL-authorized admin operations.

## Repository layout

```text
apps/
  mobile/   Expo + React Native customer application
  admin/    Next.js operations console
  api/      NestJS REST API
packages/
  config/   Validated runtime configuration
  db/       Prisma schema, migrations, and generated client
  shared/   Framework-neutral contracts, constants, and utilities
docs/       Architecture and engineering decisions
tooling/    Repository automation added as concrete needs emerge
```

## Prerequisites

- Node.js 20.19, 22.12, or 24.x (Node.js 24 LTS is used in CI)
- pnpm 11.16
- PostgreSQL 16 or newer

Install pnpm if needed:

```powershell
npm.cmd install --global pnpm@11.16.0
```

## Local setup

1. Install workspace dependencies:

   ```powershell
   pnpm.cmd install
   ```

2. Create local `thriftage` and `thriftage_test` PostgreSQL databases with a development-only user, then copy the environment templates. The checked-in values are placeholders only.

   ```powershell
   Copy-Item packages/db/.env.example packages/db/.env
   Copy-Item apps/api/.env.example apps/api/.env
   Copy-Item apps/admin/.env.example apps/admin/.env.local
   Copy-Item apps/mobile/.env.example apps/mobile/.env
   ```

3. Update `packages/db/.env` with local connection strings, validate the schema, and apply migrations:

   ```powershell
   pnpm.cmd db:generate
   pnpm.cmd db:validate
   pnpm.cmd db:migrate:deploy
   pnpm.cmd db:seed:categories
   ```

4. Start all applications, or run one workspace at a time:

   ```powershell
   pnpm.cmd dev
   pnpm.cmd --filter @thriftage/api dev
   pnpm.cmd --filter @thriftage/admin dev
   pnpm.cmd --filter @thriftage/mobile dev
   ```

The API health check is available at `http://localhost:4000/api/v1/health`; the admin app uses port 3000, and Expo selects its available development port.

Set the backend Supabase, Twilio Verify, `PROFILE_IMAGE_BUCKET`, and `LISTING_IMAGE_BUCKET` variables from `apps/api/.env.example`. Routine token verification uses the publishable key; secure phone linking and controlled storage use a modern backend-only Supabase secret key. Twilio uses restricted API-key credentials. Protected requests use `Authorization: Bearer <access-token>`; see the [identity and onboarding architecture](./docs/architecture/identity-onboarding.md) and [marketplace discovery architecture](./docs/architecture/marketplace-discovery.md).

Set `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `apps/mobile/.env`. Configure `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `apps/admin/.env.local`. Configure `thriftage://auth/callback` and `thriftage://auth/reset-password` as allowed redirects before testing confirmation or recovery links. No server secret belongs in an `EXPO_PUBLIC_*` or `NEXT_PUBLIC_*` variable.

## Quality gates

Run the same checks enforced by CI:

```powershell
pnpm.cmd db:validate
pnpm.cmd format:check
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd test:db
pnpm.cmd build
```

`pnpm build` creates production artifacts for the API and shared packages, a Next.js admin build, and an Expo web export. Android and iOS release binaries require platform signing and release configuration and are intentionally outside Phase 0.

## Identity and database architecture

Supabase Auth is the initial identity provider, but it does not own application data. Supabase verifies credentials and manages sessions; PostgreSQL owns the application `User`, one-to-one `Profile`, roles, and account state. Passwords and password hashes are never stored by Prisma. See [ADR 0001](./docs/architecture/adr/0001-authentication-provider.md).

`POST /api/v1/auth/provision` performs idempotent application-user linking only after the authoritative provider reports a confirmed email. `GET /api/v1/auth/me` returns the active linked user's privacy-safe account contract. Provisioning accepts only `fullName`; provider identity, contact verification, role, and status remain server-authoritative.

Every schema change must use reviewed Prisma migrations owned by `packages/db`; never edit a shared production schema manually or commit generated credentials.

Database integration tests require a dedicated database whose name contains `test`. After setting `TEST_DATABASE_URL`, apply the migration and run the constraint suite:

```powershell
$env:DATABASE_URL = $env:TEST_DATABASE_URL
pnpm.cmd db:migrate:deploy
pnpm.cmd test:db
```

The database test guard refuses non-test database names before any cleanup runs.
For a disposable named `prisma dev` instance, set `ALLOW_PRISMA_DEV_TEST_DATABASE=true`; only non-default localhost ports are accepted by that override.

## Marketplace operations

Run `pnpm db:seed:categories` after migrations to upsert the approved Clothing, Shoes, and Accessories taxonomy. Sellers create private drafts, upload 3–10 validated photos, and submit for review. Only an API-authorized ADMIN may approve, reject, remove, manage taxonomy, or resolve reports. See the [marketplace discovery architecture](./docs/architecture/marketplace-discovery.md) for storage policy, state transitions, ranking, local test data, and admin bootstrapping.

## Scope boundary

Change-phone, identity merging, messaging, orders, purchase actions, payments, shipping, reviews, seller verification documents, notification delivery, personalization, recommendations described as AI, and AI features are not implemented. Discovery's `RECOMMENDED` mode is explicitly deterministic. See [AGENTS.md](./AGENTS.md) for safety constraints and later phases.
