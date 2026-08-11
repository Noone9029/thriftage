# API Authentication Boundary

Phase 1B establishes two deliberately separate server concepts:

- **Authenticated identity:** a bearer token cryptographically verified as a non-anonymous user from the configured Supabase project.
- **Linked application user:** a PostgreSQL `User` resolved by the verified Supabase subject. PostgreSQL remains authoritative for Thriftage role and account status.

## Request flow

```text
Mobile -> Supabase Auth -> access token -> Thriftage API
       -> getClaims(token) -> normalized authenticated identity
       -> resolve/provision PostgreSQL User
       -> enforce Thriftage role/accountStatus -> domain service
```

`AuthenticationGuard` extracts only `Authorization: Bearer <token>` and delegates verification to the application-owned `AuthTokenVerifier`. The Supabase adapter uses `auth.getClaims(token)`, then validates expiry, nonblank subject, exact project issuer, authenticated audience and provider role, and rejects anonymous identities. It never treats the Supabase role as a Thriftage role.

`LinkedUserGuard` resolves the verified subject through `ApplicationUserResolver`. An unprovisioned identity receives `AUTH_USER_NOT_PROVISIONED`; suspended and deactivated users receive distinct forbidden errors. Active users are attached to typed request context for `@CurrentUser()`.

## Provisioning

`POST /api/v1/auth/provision` requires a verified identity but not an existing `User`. Its strict request contract accepts only `fullName`. The provisioning service calls `auth.getUser(token)` for authoritative identity, email, phone, and confirmation state, verifies that its subject matches the already-verified token identity, and performs an upsert keyed by `authProviderUserId`.

Database unique constraints provide the final concurrency boundary. A duplicate request returns the existing record without changing name, role, status, or marketplace state. Email or phone ownership conflicts with another provider subject return `AUTH_IDENTITY_CONFLICT`; accounts are never silently merged or reassigned.

Provisioning additionally requires a non-null, authoritatively confirmed email. A provider-issued session cannot bypass email confirmation; it receives `AUTH_EMAIL_UNVERIFIED` until confirmation completes.

`GET /api/v1/auth/me` requires both guards and returns the privacy-safe private account contract. It excludes the external auth subject, deletion metadata, and secrets. Profile and mobile flows are documented in [Identity and Onboarding](./identity-onboarding.md).

## Configuration and lifecycle

Routine access-token verification requires `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. That server auth client disables session persistence and refresh. Phase 1C2A separately requires a modern backend-only `SUPABASE_SECRET_KEY` for the narrowly scoped Auth Admin adapter described in [secure phone verification](./phone-verification.md). The secret never participates in bearer-token verification or enters a client bundle; legacy service-role keys are not accepted.

Future Orders, Payments, Reviews, Disputes, Messages, and Audit records must preserve historical marketplace integrity and must not be destructively cascade-deleted merely because a user account is deleted.
