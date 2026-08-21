# Backup and Restore Runbook

Proposed beta objectives, pending business approval: database RPO 24 hours with daily backups (target 15 minutes if PITR is purchased), RTO 4 hours; Storage RPO 24 hours and RTO 8 hours through a separate object inventory/copy strategy. Owner: named platform operator; backup and restore evidence must have a secondary reviewer.

Supabase currently documents daily backups for paid plans with plan-dependent retention and optional PITR. Database backups contain Storage metadata, not object contents. Verify the purchased plan rather than assuming coverage: [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups).

## Current staging evidence

On 2026-08-21, the authenticated Supabase CLI queried project `dstnxzljsbyusxoogkzr` with `supabase backups list`. The provider returned region `ap-south-1`, `pitr_enabled: false`, `backups: null`, empty `physical_backup_data`, and `walg_enabled: true`. WAL-G capability alone is not evidence of an available recovery point, so no restorable managed backup is currently proven.

Before the release gate can pass, the account owner must confirm the purchased backup entitlement and retention, name a platform operator and secondary reviewer, provide an approved disposable restore destination, and select a recovery point that Supabase reports as available. Do not invoke `supabase backups restore` against active staging; that command is a destructive in-place PITR operation. The drill below must restore to an isolated destination and verify both database and Storage recovery.

## Non-production restore drill

1. Freeze a synthetic staging fixture manifest and record source project/release/migration list.
2. Create a logical database dump using Supabase CLI/`pg_dump` over TLS and an independent Storage object manifest/copy. Encrypt and store off-site with restricted access.
3. Restore into a new disposable project/database, never over active staging. Reset custom runtime-role passwords after restore.
4. Apply any post-backup migrations and Supabase hardening SQL. Restore permitted synthetic Storage objects.
5. Run `pnpm supabase:verify-security`, `/health`, `/readiness`, representative row-count/content hashes, auth test user, profile/listing image reads, message API read, and COD-order read.
6. Record actual RPO/RTO, missing objects, errors, responsible operator, and cleanup. Delete the disposable project only after review.

Production restore requires an incident commander and owner approval because the project is unavailable during restore. Stop writes, choose a known-good recovery point, preserve incident evidence, restore, rotate/reset custom-role credentials, reapply hardening, validate, then reopen traffic gradually. Never claim backup readiness until this drill passes. No remote restore has been performed yet, and the current staging backup query does not expose a restorable recovery point.
