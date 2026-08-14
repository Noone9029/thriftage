# Architecture

Thriftage uses a pnpm monorepo with deployable applications under `apps/` and framework-neutral packages under `packages/`.

- `mobile` owns the customer-facing Expo application.
- `admin` owns the Next.js operational application.
- `api` owns REST transport, runtime wiring, identity, marketplace, social, and moderation modules.
- `shared` contains portable contracts and pure utilities.
- `config` validates runtime configuration at process boundaries.
- `db` owns the PostgreSQL schema, migrations, and generated Prisma client.

Authentication uses Supabase Auth for managed identity while PostgreSQL owns application users, profiles, roles, and account state. See [ADR 0001](./architecture/adr/0001-authentication-provider.md) and the [API authentication boundary](./architecture/authentication.md).

The Expo application implements the Phase 1C1 email session lifecycle, protected routing, secure native persistence, and backend provisioning described in [mobile email authentication](./architecture/mobile-authentication.md).

Phase 1C2A adds server-controlled phone ownership verification and links the first verified phone to the existing Supabase and PostgreSQL identities. See [secure phone verification](./architecture/phone-verification.md).

Phase 1B adds server token verification, application-user provisioning, and account-state enforcement. Profile onboarding is implemented as a privacy-safe one-to-one application profile.

The marketplace foundation adds moderated listings and private media, PostgreSQL-native search, deterministic discovery feeds, social relationships, reports, and API-authorized administration. See [marketplace discovery and social](./architecture/marketplace-discovery.md). New capabilities should be added as bounded vertical slices without moving authoritative business rules into clients.

The [AI Fashion Stylist](./architecture/ai-fashion-stylist.md) consumes the existing deterministic personalization and eligibility seams through read-only interfaces. The provider explains and selects only server-composed candidate IDs; PostgreSQL and marketplace domain services remain authoritative. See the [AI operations runbook](./operations/ai-stylist-runbook.md) for incident response and model-change discipline.
