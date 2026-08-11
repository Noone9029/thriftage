# Identity and Onboarding Architecture

## Ownership boundaries

Supabase Auth owns credentials, email confirmation, phone-login OTPs, and sessions. PostgreSQL owns the stable Thriftage user UUID, role, account state, verified application phone, public profile, and authorization. Twilio Verify is replaceable behind `PhoneVerificationProvider`; Supabase Auth Admin is replaceable behind `AuthAdminProvider`. The mobile app receives only a publishable Supabase key and never receives server, SMS, database, or storage credentials.

`AuthenticationGuard` verifies bearer identity. `LinkedUserGuard` resolves that exact provider subject and rejects unprovisioned, suspended, or deactivated accounts. `RoleGuard` then reads `User.role` from PostgreSQL; JWT metadata, headers, query parameters, and request bodies cannot grant ADMIN access.

## User journeys

```text
Registration
full name + email + phone + password
  -> Supabase signup -> email confirmation deep link -> session
  -> API provisioning (confirmed email required)
  -> server-mediated first-phone verification/linking
  -> unique username + optional photo/bio/university -> active app

Login
email + password OR existing verified phone + Supabase OTP
  -> Supabase session -> API account/status resolution
  -> resume phone/profile onboarding if incomplete -> active app

Recovery
email request -> generic Supabase response -> allowlisted recovery deep link
  -> password update -> resolve current application state
```

Phone login uses `shouldCreateUser: false`; unknown numbers cannot create fragmented identities. First-phone linking uses the API/Twilio flow documented in [Secure Phone Verification](./phone-verification.md), preserving the existing `authProviderUserId`. Changing a verified phone and merging conflicting identities fail closed and require future security designs.

Session data persists in SecureStore on native platforms through versioned chunked writes and in localStorage only for web. Refresh is foreground-aware and API retry occurs at most once. Logout removes the provider session, private query state, and pending onboarding record. Deep links accept only the `thriftage` scheme and exact confirmation/recovery paths.

## Profile API and privacy

Protected owner endpoints derive ownership from the authenticated user:

- `GET /api/v1/profiles/me`
- `POST /api/v1/profiles`
- `PATCH /api/v1/profiles/me`
- `GET /api/v1/profiles/username-availability`
- `POST /api/v1/profiles/me/image`
- `DELETE /api/v1/profiles/me/image`

`GET /api/v1/profiles/:username` is public and returns only username, optional image/bio/university, membership date, and the real completed-sales count. It excludes full name, email, phone, provider subject, role, account status, and verification internals. Suspended, deactivated, and soft-deleted users are not publicly resolvable.

Usernames are normalized lowercase, database-unique, and constrained to 3-30 letters, digits, or underscores. Strict mutation contracts reject role, status, counters, identity fields, and caller-controlled user IDs.

## Profile images

The authenticated API accepts one JPEG, PNG, or WebP up to 5 MB. Sharp verifies decoded format, dimensions, page count, and a 36-megapixel input ceiling, then rotates, crops to 512x512, encodes WebP, and removes metadata. The server generates `profiles/<user UUID>/<object UUID>.webp`; filenames are ignored. It uploads before committing metadata, compensates if the database write fails, and removes replaced objects after a successful commit. Cleanup failures are logged by object key for operational retry, never by private contact data.

The configured Supabase bucket is public because profile photos are intentionally public. Only the backend secret uploads or deletes; clients receive public delivery URLs, not storage credentials.

## Administrative authorization

`GET /api/v1/admin/access` is the minimal proof surface. It requires authentication, an ACTIVE linked user, and PostgreSQL role `ADMIN`. A normal user cannot self-promote through provider metadata or request data, and a suspended administrator is rejected before role evaluation.

## External configuration

Implemented in code: validated environment parsing, provider adapters, guarded APIs, normalized contracts, rate/cooldown persistence, secure mobile state, image processing, and deterministic test seams.

Required outside code:

- Supabase URL, publishable key, and backend-only modern secret key;
- email/password provider, mandatory confirmation policy, templates, and the two allowlisted redirect URLs;
- Supabase phone login provider, OTP expiry/rate limits, CAPTCHA or equivalent abuse controls, and geographic restrictions;
- Twilio Verify Service, restricted API key, Fraud Guard, delivery permissions, provider limits, monitoring, and rotation;
- public `profile-images` bucket (or configured name) with a 5 MB bucket limit and JPEG/PNG/WebP allowlist;
- Expo native scheme/build configuration and new signed binaries after plugin changes;
- production CORS origins, secret management, logging/error monitoring, and alerting.

CI uses fake external providers and disposable PostgreSQL. It never sends SMS, changes a live Supabase user, uploads to live storage, or validates native-device delivery.
