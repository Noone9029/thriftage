# Architecture

Thriftage uses a pnpm monorepo with deployable applications under `apps/` and framework-neutral packages under `packages/`.

- `mobile` owns the customer-facing Expo application.
- `admin` owns the Next.js operational application.
- `api` owns REST transport, runtime wiring, and future domain modules.
- `shared` contains portable contracts and pure utilities.
- `config` validates runtime configuration at process boundaries.
- `db` owns the PostgreSQL schema, migrations, and generated Prisma client.

Authentication uses Supabase Auth for managed identity while PostgreSQL owns application users, profiles, roles, and account state. See [ADR 0001](./architecture/adr/0001-authentication-provider.md) and the [API authentication boundary](./architecture/authentication.md).

The Expo application implements the Phase 1C1 email session lifecycle, protected routing, secure native persistence, and backend provisioning described in [mobile email authentication](./architecture/mobile-authentication.md).

Phase 1B adds server token verification, application-user provisioning, and account-state enforcement. Profile onboarding and client authentication UI remain deferred. New capabilities should be added as bounded vertical slices without moving authoritative business rules into clients.
