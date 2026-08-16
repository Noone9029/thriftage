# Account Deletion Design

## User and API flow

The discoverable mobile path is **Profile -> Delete account**. The user reauthenticates, confirms `DELETE`, and calls `POST /api/v1/privacy/account-deletion`. The API rejects administrators, active commerce, and active disputes; records an immutable request identity; revokes provider sessions; marks the application account `DEACTIVATED`; and returns an asynchronous status. Repeated requests return the same workflow rather than creating duplicate jobs.

`GET /api/v1/privacy/account-deletion` exposes only the requesting user's status. The public Next.js `/account-deletion` page explains how to start deletion without requiring app access; its final deployment URL is configured through `ACCOUNT_DELETION_URL` and `EXPO_PUBLIC_ACCOUNT_DELETION_URL`.

## Worker and recovery

The worker claims bounded batches with stale-lock recovery. Each independently retryable checkpoint is persisted:

1. remove profile and listing objects;
2. anonymize/delete application data;
3. delete the Supabase Auth identity;
4. mark the request complete.

The workflow is idempotent across restarts. Stable error codes and attempt counts are retained for operations; no credentials or deleted PII are logged. `ACCOUNT_DELETION_ENABLED=false` is the emergency stop. A failed request remains auditable and retryable by a controlled operational procedure; there is no user-data restoration after anonymization.

## Data disposition

Profiles, contact details, active UGC, social graph, saved items/outfits, AI conversations, personalization, push devices, and unneeded media are removed or anonymized. Completed transaction, dispute, moderation, fraud, and audit records retain only the minimum pseudonymous history required to preserve marketplace integrity. Their final retention periods and legal bases require approved Pakistan/international legal policy; the code does not invent them.

Before beta, run the database integration test and a staging provider drill through Auth identity deletion and Storage cleanup. Before store submission, deploy and verify the public page from an unauthenticated browser.
