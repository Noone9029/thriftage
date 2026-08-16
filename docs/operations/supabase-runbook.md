# Supabase Runbook

Create separate Supabase organizations/projects for staging and production. Never copy production user data to staging. Record project refs and owners in the private operations vault, not source control.

## Database and Data API

1. Require TLS. Use the Supavisor transaction pooler for the API and a direct/session connection for migrations. `00-server-boundary.sql` creates non-login permission role `thriftage_runtime` and login role `thriftage_api`; generate and set only the `thriftage_api` password out of band. Do not run the API as `postgres`.
2. Apply Prisma migrations with the migration role: `pnpm db:migrate:deploy`. Never use `prisma db push` in staging or production.
3. Apply `supabase/sql/00-server-boundary.sql`, then `01-storage-buckets.sql` and `02-realtime-authorization.sql` with the migration/admin role.
4. In API settings, expose only the empty `api` schema; do not expose `public`. Disable Realtime public-channel access.
5. Set the `thriftage_api` password out of band, use its pooled TLS URL as `DATABASE_URL`, and restart the API. The login inherits only the `thriftage_runtime` permission group and must remain `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, and `NOBYPASSRLS`.
6. Run `SUPABASE_MIGRATION_DATABASE_URL=<redacted direct TLS URL> DATABASE_URL=<redacted runtime pooled TLS URL> pnpm supabase:verify-security`. The verifier checks catalogs plus a zero-row runtime access probe; it does not read application records.
7. Run Supabase Security and Performance Advisors and archive results with the release evidence.

Supabase documents that Data API grants and RLS are separate controls; both are intentionally applied here. See [Securing your API](https://supabase.com/docs/guides/api/securing-your-api).

## RLS inventory

All Prisma-managed `public` tables are server-only. Direct client access is **No**. `anon`, `authenticated`, and `service_role` receive no table grants; RLS is enabled; only `thriftage_runtime_server_access` grants the non-login/JWT permission role server access. Login role `thriftage_api` inherits that role and has no direct application-table grants. `_prisma_migrations` is migration-role only.

Sensitive tables explicitly covered include `users`, `profiles`, `phone_verification_attempts`, `messages`, `orders`, `payments`, `addresses`, `disputes`, `dispute_evidence`, `seller_verifications`, `user_restrictions`, all AI conversation/generation/outfit tables, style-profile tables, and recommendation events. The same rule applies to every other Prisma application table. CI requires each future migration to include a security review; rerun the hardening SQL after schema changes until hardening is embedded in that migration.

Only `realtime.messages` has an authenticated-client policy. Because JWT roles have no grants on `public`, the policy calls `thriftage_security.can_receive_conversation_topic`, a locked-search-path `SECURITY DEFINER` function with execute permission only for `authenticated`. It maps `auth.uid()` to the application user and validates conversation membership, active account state, blocks, and active messaging restrictions. Apply this SQL as the table-owning migration/admin role; never transfer the function to a JWT or runtime role. Clients have no broadcast INSERT policy; the API emits private advisory hints. Durable messages are fetched from NestJS. This follows Supabase's [Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization) guidance.

## Storage inventory

| Bucket             | Visibility | Object format/limit                 | Key pattern                                         | Access and retention                                                                              |
| ------------------ | ---------- | ----------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `profile-images`   | public     | processed WebP, 5 MiB input ceiling | `profiles/<user UUID>/<UUID>.webp`                  | API writes/deletes; public render; replace cleanup plus reconciliation.                           |
| `listing-images`   | private    | processed WebP, 5 MiB input ceiling | `listings/<seller UUID>/<listing UUID>/<UUID>.webp` | API writes/deletes and returns short-lived signed reads; listing lifecycle/cleanup policy.        |
| `dispute-evidence` | private    | processed WebP, 5 MiB input ceiling | `disputes/<dispute UUID>/<UUID>.webp`               | API writes; participants/admin receive 10-minute signed reads; retention requires legal approval. |

Seller verification currently stores an account-review statement only. Do **not** create an identity-document bucket until the business approves collection purpose, fields, access, and retention.

Test real staging upload/render/replace/delete, signed-URL expiry, unrelated-user denial, anonymous denial, MIME mismatch, oversized input, and orphan reconciliation before beta. The repository tests do not prove remote bucket policy.

## Auth, Realtime, and external settings

- Configure exact mobile redirect URIs for the approved scheme, email confirmation, recovery, and Site URL. Enable email confirmation.
- Configure custom SMTP and branded templates; the default service is not production delivery. Current Supabase guidance limits the default service and recommends custom SMTP: [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
- Review Auth rate limits in the dashboard/Management API. Supabase documents endpoint-specific token buckets and 429 behavior: [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).
- Evaluate supported mobile CAPTCHA only after a staging UX test; retain application throttles regardless.
- Disable Realtime public-channel access. Test authorized A/B and denied stranger C with real JWTs, then background/reconnect/refetch.

## Migration and recovery

Flow: generate locally -> review SQL/destructive operations -> fresh database from zero -> CI -> staging deploy -> security verifier -> staging smoke -> human production approval -> backup/restore point -> production `migrate deploy` -> smoke. Irreversible migrations require a forward-fix script and documented data restore plan.

Supabase database backups do not include Storage objects. Paid projects have plan-dependent daily backup retention and optional PITR; verify the selected plan and restore it before relying on it. See [Database Backups](https://supabase.com/docs/guides/platform/backups).
