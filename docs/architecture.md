# Architecture

Thriftage uses a pnpm monorepo with deployable applications under `apps/` and framework-neutral packages under `packages/`.

- `mobile` owns the customer-facing Expo application.
- `admin` owns the Next.js operational application.
- `api` owns REST transport, runtime wiring, and future domain modules.
- `shared` contains portable contracts and pure utilities.
- `config` validates runtime configuration at process boundaries.
- `db` owns the PostgreSQL schema, migrations, and generated Prisma client.

Authentication uses Supabase Auth for managed identity while PostgreSQL owns application users, profiles, roles, and account state. See [ADR 0001](./architecture/adr/0001-authentication-provider.md).

Phase 1A contains only the User/Profile data foundation and privacy-safe contracts. New capabilities should be added as bounded vertical slices without moving authoritative business rules into clients.
