# Backup and Restore Runbook

Proposed beta objectives, pending business approval: database RPO 24 hours with daily backups (target 15 minutes if PITR is purchased), RTO 4 hours; Storage RPO 24 hours and RTO 8 hours through a separate object inventory/copy strategy. Owner: named platform operator; backup and restore evidence must have a secondary reviewer.

Supabase currently documents daily backups for paid plans with plan-dependent retention and optional PITR. Database backups contain Storage metadata, not object contents. Verify the purchased plan rather than assuming coverage: [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups).

## Non-production restore drill

1. Freeze a synthetic staging fixture manifest and record source project/release/migration list.
2. Create a logical database dump using Supabase CLI/`pg_dump` over TLS and an independent Storage object manifest/copy. Encrypt and store off-site with restricted access.
3. Restore into a new disposable project/database, never over active staging. Reset custom runtime-role passwords after restore.
4. Apply any post-backup migrations and Supabase hardening SQL. Restore permitted synthetic Storage objects.
5. Run `pnpm supabase:verify-security`, `/health`, `/readiness`, representative row-count/content hashes, auth test user, profile/listing image reads, message API read, and COD-order read.
6. Record actual RPO/RTO, missing objects, errors, responsible operator, and cleanup. Delete the disposable project only after review.

Production restore requires an incident commander and owner approval because the project is unavailable during restore. Stop writes, choose a known-good recovery point, preserve incident evidence, restore, rotate/reset custom-role credentials, reapply hardening, validate, then reopen traffic gradually. Never claim backup readiness until this drill passes. No remote backup or restore has been performed yet.
