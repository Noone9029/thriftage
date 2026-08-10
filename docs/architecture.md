# Architecture

Thriftage uses a pnpm monorepo with deployable applications under `apps/` and framework-neutral packages under `packages/`.

- `mobile` owns the customer-facing Expo application.
- `admin` owns the Next.js operational application.
- `api` owns REST transport, runtime wiring, and future domain modules.
- `shared` contains portable contracts and pure utilities.
- `config` validates runtime configuration at process boundaries.
- `db` owns the PostgreSQL schema, migrations, and generated Prisma client.

Phase 0 intentionally contains no marketplace domain models or feature modules. New capabilities should be added as bounded vertical slices without moving authoritative business rules into clients.
