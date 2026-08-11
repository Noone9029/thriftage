# Secure Phone Verification and Linking

Phase 1C2A verifies ownership of the first phone attached to an existing Thriftage account. It does not add phone login, phone-only signup, mobile OTP screens, change-phone behavior, account merging, or profile onboarding.

## Security decision and provider boundaries

Thriftage does not use the ordinary client-side `updateUser({ phone })` plus `phone_change` OTP flow for account linking. A stale pending phone-change state can make the intended target ambiguous. The authenticated client therefore supplies only a phone number, owned attempt ID, and OTP to the Thriftage API. It can never select the application user or Supabase subject.

Three boundaries remain separate:

- `PhoneVerificationProvider` sends and checks possession challenges. `TwilioVerifyAdapter` maps Twilio results into `PENDING`, `APPROVED`, `INVALID`, or `EXPIRED` application values.
- `AuthAdminProvider` reads and updates one exact external subject. `SupabaseAuthAdminAdapter` calls Admin `getUserById`/`updateUserById` with the PostgreSQL user's existing `authProviderUserId`, normalized phone, and `phone_confirm: true`.
- `PhoneLinkingService` owns validation, attempt lifecycle, ownership, abuse controls, collision checks, provider ordering, reconciliation, and application-database synchronization.

Supabase remains the credential/session provider. PostgreSQL remains authoritative for Thriftage authorization, account status, application ownership, and private account output. Twilio Verify is replaceable behind its interface.

## Sequence and endpoints

```text
Authenticated active email user
  -> POST /api/v1/auth/phone-verification/start
  -> PhoneVerificationProvider sends SMS
  -> user submits string OTP
  -> POST /api/v1/auth/phone-verification/verify
  -> provider confirms possession
  -> persist PROVIDER_VERIFIED
  -> AuthAdminProvider updates exact existing Supabase user
  -> transactionally synchronize User.phone + phoneVerified
  -> mark LINKED -> return PrivateUserAccount
```

All endpoints require `AuthenticationGuard` and `LinkedUserGuard`, so only provisioned active accounts proceed.

- `POST /auth/phone-verification/start` normalizes an international number, checks collisions and start limits, supersedes an older pending attempt, sends the challenge, and returns masked data.
- `POST /auth/phone-verification/verify` accepts an owned UUID and a 4-10 digit string code, preserving leading zeroes.
- `POST /auth/phone-verification/:attemptId/resend` enforces ownership, cooldown, expiry, and persisted send limits.
- `GET /auth/phone-verification/current` returns the latest actionable masked attempt for interruption recovery.
- `DELETE /auth/phone-verification/current` cancels pending workflow state only. It never removes a verified phone or mutates Supabase.

## Persistence and lifecycle

`PhoneVerificationAttempt` stores UUID ownership, canonical E.164 phone, provider, safe provider reference, counters, expiry/cooldown timestamps, and lifecycle timestamps. It never stores OTPs, credentials, or provider payloads.

```text
PENDING -> PROVIDER_VERIFIED -> LINKED
PENDING -> EXPIRED | CANCELLED | FAILED
```

User-row locks serialize starts and final database synchronization. The existing unique `User.phone` constraint is the final concurrent-ownership boundary. Persisted policy defaults are five starts/hour, a 60-second resend cooldown, five sends, five checks, and a ten-minute attempt lifetime. Provider-side fraud/rate controls remain required.

## Distributed consistency and retries

Supabase and PostgreSQL cannot share a transaction. Provider approval is persisted before the Auth Admin mutation. A retry of `PROVIDER_VERIFIED` first inspects the exact Supabase user:

- expected already-confirmed phone: finish PostgreSQL synchronization and mark `LINKED`;
- no phone or the same unconfirmed phone: set and confirm the expected phone, validate the returned identity, then synchronize;
- different Supabase phone: fail `PHONE_IDENTITY_CONFLICT` without replacement;
- application phone owned by another user: fail `PHONE_ALREADY_IN_USE` without merging.

An already `LINKED` attempt returns current private account state idempotently. Database failure after external success never reports completion; the durable `PROVIDER_VERIFIED` attempt enables reconciliation.

## Privacy and production configuration

Responses expose only attempt ID, masked phone, safe status, expiry, cooldown, or the authenticated owner's existing `PrivateUserAccount`. Full phone numbers are absent from challenge responses, URLs, public profiles, analytics, and logs. Logs should use application user/attempt IDs and safe provider references only.

Required server variables:

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and backend-only `SUPABASE_SECRET_KEY`;
- `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, and `TWILIO_VERIFY_SERVICE_SID`;
- optional `PHONE_VERIFICATION_*` policy overrides documented in `.env.example`.

Supabase recommends modern `sb_secret_...` keys for trusted servers. Twilio recommends API keys over the account Auth Token for production; use a restricted key granting only required Verify permissions where available. Configure the Verify Service, SMS delivery/geographic permissions, Fraud Guard, provider rate limits, monitoring, and secret rotation outside source control. No live external calls occur in CI.
