# Marketplace Discovery and Social Foundation

## Domain boundaries

Marketplace code is separated into `categories`, `listings`, `listing-media`, `discovery`, `social`, and `moderation` API modules. Shared Zod contracts live in `packages/shared/src/marketplace`; PostgreSQL and Prisma remain authoritative for ownership, status, counts, and uniqueness. Mobile and admin clients never submit counters, seller identity, listing state, or moderation state as trusted facts.

## Listing lifecycle

Sellers may create and edit `DRAFT` or `REJECTED` listings. Submission requires an active category and 3–10 stored images and moves the listing to `PENDING_REVIEW`. An API-authorized administrator may move it to `ACTIVE` or `REJECTED`; removal produces `REMOVED`. Sellers may archive eligible inventory as `ARCHIVED`. Active content is immutable, so a seller cannot publish unreviewed edits. Every administrator transition writes a `ModerationAudit` row in the same database transaction.

`RESERVED` and `SOLD` exist in the schema for the approved lifecycle but are not reachable until commerce is implemented. No purchase, order, payment, or shipping behavior exists in this phase.

## Media storage policy

Create two Supabase Storage buckets:

- `profile-images`: public, as documented by identity architecture.
- `listing-images`: private, with bucket-level MIME restrictions for `image/jpeg`, `image/png`, and `image/webp`, and a 5 MB file limit.

Only the API receives the backend secret key. It verifies declared type, decodes the actual image with Sharp, rejects multi-page/undersized/oversized inputs, rotates, bounds output to 1600×2000, strips metadata, and writes WebP under `listings/<seller-uuid>/<listing-uuid>/<image-uuid>.webp`. Clients receive 15-minute signed read URLs only after authorization or public-eligibility checks. Draft object names or URLs are never exposed by public endpoints. Upload failures compensate storage writes; cleanup failures leave a private orphan rather than a broken database reference and are logged for operations.

## Search and discovery

Search is PostgreSQL-native and isolated behind the listing repository. It filters approved `ACTIVE` inventory by category descendants, size, price range, currency, and condition; sorts by time or minor-unit price; and uses validated opaque keyset cursors. Trigram indexes support title, description, and brand matching without an external search service.

Feed cursors freeze an `asOf` timestamp. `NEW` sorts by creation time. `TRENDING` uses the documented integer score:

```text
30 × unique likes + 40 × unique saves + max(0, 720 − age in hours)
```

`RECOMMENDED` adds 1000 points for followed sellers. Unique database relationships limit repeat engagement, and the system does not claim this deterministic ranking is AI.

## Social and safety rules

Composite database keys make like, save, and follow actions idempotent. Services block self-like, self-save, and self-follow. Counts are queried from relationships. Reports target exactly one listing or user; partial unique indexes prevent duplicate open reports from the same reporter. Reports never trigger automatic enforcement.

## Local setup and test data

After applying migrations, run:

```powershell
pnpm.cmd db:seed:categories
```

The seed is idempotent and contains taxonomy only. Create users and listings through normal application flows. Automated tests generate synthetic users and inventory in a dedicated `TEST_DATABASE_URL` and clean them afterward. Never copy production users, private images, reports, or credentials into local/test databases.

## Administrator bootstrap

There is intentionally no public “become admin” endpoint. First provision the person through normal authentication. Then an authorized database operator may promote the exact provider identity in a controlled environment:

```sql
UPDATE users
SET role = 'ADMIN', updated_at = CURRENT_TIMESTAMP
WHERE auth_provider_user_id = '<verified-provider-user-id>'
  AND account_status = 'ACTIVE'
  AND deleted_at IS NULL;
```

Verify exactly one row changed and record the operator/change ticket outside the application. The admin UI signs in through Supabase, but every operation is independently guarded by the API's linked-user and PostgreSQL role checks.
