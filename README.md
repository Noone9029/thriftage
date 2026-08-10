# Thriftage

Thriftage is a mobile-first peer-to-peer fashion marketplace. This repository currently contains only the Phase 0 engineering foundation; marketplace features begin in later approved phases.

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

2. Create a local PostgreSQL database and user, then copy the environment templates. The checked-in values are placeholders only.

   ```powershell
   Copy-Item packages/db/.env.example packages/db/.env
   Copy-Item apps/api/.env.example apps/api/.env
   Copy-Item apps/admin/.env.example apps/admin/.env.local
   Copy-Item apps/mobile/.env.example apps/mobile/.env
   ```

3. Update `packages/db/.env` with the local connection string and validate the schema:

   ```powershell
   pnpm.cmd db:generate
   pnpm.cmd db:validate
   ```

4. Start all applications, or run one workspace at a time:

   ```powershell
   pnpm.cmd dev
   pnpm.cmd --filter @thriftage/api dev
   pnpm.cmd --filter @thriftage/admin dev
   pnpm.cmd --filter @thriftage/mobile dev
   ```

The API health check is available at `http://localhost:4000/api/v1/health`; the admin app uses port 3000, and Expo selects its available development port.

## Quality gates

Run the same checks enforced by CI:

```powershell
pnpm.cmd db:validate
pnpm.cmd format:check
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
```

`pnpm build` creates production artifacts for the API and shared packages, a Next.js admin build, and an Expo web export. Android and iOS release binaries require platform signing and release configuration and are intentionally outside Phase 0.

## Database workflow

The Phase 0 schema intentionally has no business models. Add every future schema change through Prisma migrations owned by `packages/db`; never edit a shared production schema manually or commit generated credentials.

## Scope boundary

Authentication, profiles, listings, search, messaging, payments, orders, moderation, personalization, and AI are not implemented. See [AGENTS.md](./AGENTS.md) for approved phases, safety constraints, and completion rules.
