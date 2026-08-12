# Trust and Safety Operations Runbook

## Before enabling production traffic

1. Publish approved Terms of Use, Privacy Policy, and Community Guidelines through the admin policy endpoint. Confirm their effective dates and URLs.
2. Set `SUPPORT_URL` to the official safety/support destination.
3. Create a private Supabase bucket matching `DISPUTE_EVIDENCE_BUCKET`; verify anonymous/public reads fail and API-created signed URLs expire.
4. Approve `DISPUTE_WINDOW_HOURS`, `DISPUTE_SHIPPED_MIN_AGE_HOURS`, seller-verification criteria, reapplication delay, and evidence-retention policy.
5. Assign trained moderators, escalation ownership, response targets, and an emergency/legal request process.

## Queue handling

- **Review reports:** compare the report to the transaction-backed review. Hide abusive text, invalidate only demonstrably inauthentic/manipulated ratings, restore mistakes, or dismiss unsupported reports. Always record a specific reason.
- **Disputes:** start review, request missing facts, inspect participant-only evidence, and record a participant-safe resolution. Never promise refunds, escrow, or chargebacks that the commerce system does not support.
- **Seller verification:** assess account history against the configured criteria. The badge is an account-review signal, not KYC or an authenticity guarantee.
- **Restrictions:** use the narrowest effective scope and an expiry where appropriate. Suspend the account only for documented material safety reasons.

## Incident checks

For an abuse escalation, preserve the relevant order, conversation, report, dispute, evidence metadata, safety actions, and `TrustAudit` rows. Do not hard-delete historical marketplace records. Restrict access to private messages/evidence to authorized, purpose-limited staff.

If signed evidence links leak, shorten the configured TTL, review access logs, and rotate the backend Supabase secret through the provider dashboard. Signed URLs expire; object keys alone must not grant access.

## Monitoring

Watch open review reports, open disputes, pending seller verifications, active restrictions, and suspended accounts in the Trust workspace. Alert on sustained queue growth, repeated evidence upload failures, outbox failures, and unusual restriction/suspension volume.

## Deployment verification

Run migrations before the API rollout, then verify `/api/v1/health`, an authorized admin Trust workspace load, policy retrieval, and denied anonymous evidence access. Use synthetic accounts only. Do not upload real identity documents or production dispute evidence during routine verification.
