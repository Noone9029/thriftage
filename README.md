# Thriftage

Thriftage is a mobile-first peer-to-peer fashion marketplace. The repository contains identity and onboarding, moderated discovery, protected messaging and COD commerce, transaction-backed trust, deterministic style intelligence, and an inventory-grounded AI Fashion Stylist.

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
   pnpm.cmd db:seed:styles
   ```

4. Start all applications, or run one workspace at a time:

   ```powershell
   pnpm.cmd dev
   pnpm.cmd --filter @thriftage/api dev
   pnpm.cmd --filter @thriftage/admin dev
   pnpm.cmd --filter @thriftage/mobile dev
   ```

The API health check is available at `http://localhost:4000/api/v1/health`; the admin app uses port 3000, and Expo selects its available development port.

Set the backend Supabase, Twilio Verify, storage, trust-policy, dispute, support, realtime, outbox, and Expo push variables from `apps/api/.env.example`. Routine token verification uses the publishable key; secure phone linking, controlled storage, and API-originated realtime use a backend-only Supabase secret key. Push and realtime remain disabled by default. Protected requests use `Authorization: Bearer <access-token>`; see the [identity and onboarding architecture](./docs/architecture/identity-onboarding.md), [marketplace discovery architecture](./docs/architecture/marketplace-discovery.md), and [trusted communication and commerce architecture](./docs/architecture/trusted-communication-commerce.md).

Set `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `apps/mobile/.env`. Configure `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `apps/admin/.env.local`. Configure `thriftage://auth/callback` and `thriftage://auth/reset-password` as allowed redirects before testing confirmation or recovery links. No server secret belongs in an `EXPO_PUBLIC_*` or `NEXT_PUBLIC_*` variable.

The AI Stylist is disabled by default. To enable it in a controlled backend environment, set `OPENAI_API_KEY` only in the API secret store and set `AI_STYLIST_ENABLED=true`. Model, reasoning, timeout, token, tool, rate, concurrency, option, price-estimation, and optional daily cost-ceiling settings are documented in `apps/api/.env.example`. Never place the OpenAI key in mobile, admin, `EXPO_PUBLIC_*`, or `NEXT_PUBLIC_*` configuration.

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

`pnpm build` creates production artifacts for the API and shared packages, a Next.js admin build, and an Expo web export. Android and iOS release binaries require platform signing and release configuration.

## Closed-beta readiness

The repository is prepared for isolated local, staging, and production configuration; it does not contain provider credentials or authorize public launch. Start with the [production architecture](./docs/architecture/production-architecture.md), [environment reference](./docs/operations/environment-reference.md), [deployment runbook](./docs/operations/deployment-runbook.md), and authoritative [go/no-go checklist](./docs/release/go-no-go.md).

Release-specific checks include:

```powershell
pnpm.cmd security:secrets
pnpm.cmd security:artifacts
pnpm.cmd ci:migration-safety
pnpm.cmd security:audit
pnpm.cmd mobile:doctor
pnpm.cmd staging:smoke
pnpm.cmd security:authorization:staging
```

The two staging commands require an exact HTTPS staging host, explicit staging acknowledgement, and controlled synthetic credentials/fixtures. Their required inputs and the seller → admin → buyer acceptance record are documented in the [closed-beta acceptance guide](./docs/testing/closed-beta-acceptance.md). Final provider, native-build, physical-device, legal, support, monitoring, backup/restore, load, and store evidence remains a release gate rather than a repository assumption.

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

## Communication and commerce

Users can start persisted listing conversations, receive private realtime delivery hints, and see unread state. Deterministic contact-sharing protection blocks high-confidence phone, email, and WhatsApp patterns and routes protected evidence to the audited admin moderation workspace.

Buy Now supports one unique listing per COD order. PostgreSQL row locking atomically reserves inventory; sellers confirm and ship; buyers confirm receipt; the system completes the order, records COD collection, and marks the listing sold. In-app notifications are durable, while Expo push is delivered through a retryable outbox when configured. See the [architecture](./docs/architecture/trusted-communication-commerce.md) and [security audit](./docs/architecture/trusted-commerce-security-audit.md).

## Trust, reputation, and safety

Completed buyers and sellers can leave one transaction-backed review each. Reputation aggregates exclude administratively invalidated reviews while preserving audit history. Blocking prevents new discovery/social/messaging interaction without erasing active orders or historical conversations. Eligible order problems use private evidence and an auditable dispute timeline. Seller verification is explicitly an account-review badge, not KYC or an authenticity guarantee.

Create `DISPUTE_EVIDENCE_BUCKET` as a private Supabase bucket before enabling evidence uploads. Configure dispute windows, seller-verification thresholds, current policy URLs/content, and `SUPPORT_URL` from approved business/legal inputs. See the [trust architecture](./docs/architecture/trust-reputation-safety.md) and [operations runbook](./docs/operations/trust-safety-runbook.md).

## Style intelligence and personalized discovery

Run `pnpm db:seed:styles` after migrations to idempotently seed the approved style taxonomy and `rules-v1` scoring configuration. Users can privately save/resume a structured style quiz, edit or reset it, reset learned ranking signals without deleting marketplace history, and hide recommendations with undo. New listing submissions require normalized style, color, fit, garment-role, and size metadata.

Authenticated `RECOMMENDED` discovery computes versioned 0–100 matches, truthful reasons, bounded behavior-aware ranking, diversity, deterministic exploration, and stable pagination. It never calls generative AI or labels rule-based ranking as machine learning. See the [style intelligence architecture](./docs/architecture/style-intelligence-personalized-discovery.md) and [privacy audit](./docs/architecture/personalization-privacy-audit.md).

## AI Fashion Stylist

Authenticated users can start private Stylist conversations, ask natural-language fashion questions, refine complete outfits, build around a listing, save outfits, and replace unavailable pieces. The backend composes bounded candidates from current eligible inventory, lets the configured provider select and explain only those candidates, and revalidates every listing, price, size claim, seller restriction, and block before responding. Provider failure falls back to deterministic Thriftage Style Intelligence.

The OpenAI Responses integration uses strict structured output and read-only tools with `store: false`; application PostgreSQL owns conversation state. Mobile cancellation, generation idempotency, token/cost tracking, aggregate admin metrics, a kill switch, local evaluators, and optional explicit live-model comparison are included. Ordinary CI never calls OpenAI.

Run the optional live eval only with an approved non-production project and explicit opt-in:

```powershell
$env:AI_STYLIST_LIVE_EVAL_ENABLED = 'true'
$env:OPENAI_API_KEY = '<backend-only-eval-project-key>'
pnpm.cmd ai:eval
```

See the [AI Stylist architecture](./docs/architecture/ai-fashion-stylist.md) and [operations runbook](./docs/operations/ai-stylist-runbook.md).

## Scope boundary

Change-phone, identity merging, digital payments, courier integrations, automated refunds/chargebacks, KYC or seller identity documents, escrow, wallets/payouts, vector search, virtual try-on, image-based body inference, autonomous AI commerce, fine-tuning, and a custom ML recommender are not implemented. See [AGENTS.md](./AGENTS.md) for safety constraints.
