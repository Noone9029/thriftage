# Closed Beta Runbook

## Current activation status

Core staging is online: the Railway API at release `c5e2f889c9363c5a9541e49fbf2ffff0b205a7b6`, Vercel admin preview, Supabase Auth/Postgres/Storage/Realtime, strict CORS, deployed authorization matrix, and Android emulator login/profile/feed flow are verified. Exact-release public and authenticated API smoke passes. EAS Android build `dc462b59-c9f5-4088-a38f-1a4612596e94` is an installable internal preview; the exact APK passed an authenticated staging smoke on `emulator-5554` and accepted preview OTA group `150f9366-ca54-4e65-9cea-2582a854d303` at release `edf83509126fb8dbbdd2ac3a83e1c19f2b6f4223`. The installed package passed compact, typical, and expanded emulator sizing, 200% text, bottom-navigation labels/touch bounds, keyboard dismissal, Android back, cold deep-link, and listing-detail back-navigation checks. **Do not invite testers yet.** The 30-VU read gate has 0% HTTP failures and passes p99, but still misses the strict p50 target and overall/personalized p95 targets. A targeted optimized-release diagnostic shows API p50 `261.27 ms` while the New York-to-Singapore client path remains p50 `579.93 ms`; a Pakistan-region rerun is required and the gate remains failed. A physical-device result and durable tester install path are also still missing, and legal links, Sentry, remaining provider drills, approved content, and named operational owners remain blocked. Emulator and Expo Go checks remain engineering evidence only; only the installed preview-package result counts as artifact evidence.

Synthetic staging fixtures are labeled `STAGING AUTH FIXTURE` or otherwise clearly test-scoped. The demo and A/B/Admin identities are staging-only. Store credentials only in the approved local/provider secret stores; never copy passwords or tokens into tickets, screenshots, documentation, source, or tester messages.

## Scope and cohort

Begin with 20–30 invited testers: roughly one-third buyers, one-third sellers, and one-third mixed users. Include iOS/Android, smaller/typical/large screens, varied network quality, and varied style profiles. Use staging only. Increase the cohort after a 48-hour stable soak and explicit go/no-go review; do not open public registration.

## Entry gates

Use `docs/release/go-no-go.md` as the authority. Required gates include a deployed staging API/Supabase project; real Auth/Storage/Realtime/provider tests; native Android artifact and real-device critical path; iOS build/device result or recorded external Apple blocker; Sentry event/source-map proof; tested account deletion; legal/support beta-safe links; zero known P0/P1 issues; and an install path for every tester.

On 2026-08-21, release `dd28395f6c815c37d8dbde125dd450f64adf5e45` completed a real account-deletion drill with one purpose-created disposable staging identity. The first worker attempt deleted the Supabase Auth identity, profile and listing Storage objects, and application profile/listing-image rows; anonymized the retained account/listing records; left no failed or incomplete deletion request; and preserved the existing demo identity/profile. `ACCOUNT_DELETION_ENABLED` was returned to `false` after the drill. Do not reuse the disposable identity or repeat this destructive proof against a real tester.

## Content and seed policy

Seed only synthetic users, categories, style taxonomy, engagement, and clearly labeled test listings. Initial visible inventory should come from team-owned/test pieces or approved pilot sellers. Every image must be owned, licensed, or explicitly permitted; record owner, source, permission, and takedown contact. Never scrape retailer catalogs or imply partnerships. Keep synthetic transactions isolated from tester orders and clearly labeled.

## Tester flow

1. Send the private TestFlight/Play testing link and beta expectations.
2. Confirm build/environment in **Profile -> About & diagnostics**.
3. Assign seller, buyer, mixed, safety, accessibility, and device-matrix journeys.
4. Collect issues through **Profile -> Beta feedback**; never request passwords, OTPs, tokens, full messages, addresses, evidence, or AI conversations.
5. Review the admin Beta status/Feedback/Trust queues daily and provider consoles for Sentry/Twilio.

The acceptance journey is seller registration/verification/profile/style/listing/upload/submit -> admin approval -> buyer discovery/follow/save/message/AI Style This/COD order -> seller confirm/ship -> buyer delivery -> worker completion -> review. A separate synthetic fixture covers dispute open/resolve.

## Metrics and gates

Track signup/email/phone/style completion, listing submission/approval, feed/search/save/message, checkout/order completion/cancellation, disputes/reviews, AI usage/cost, worker failures, and crashes. Do not add private payloads. Gate target: no known P0/P1; critical journey passes; API error rate <1% under the agreed staging load; and, once traffic exists, >=99.5% crash-free sessions during the observation window.

Severity: **P0** auth takeover, data corruption/loss, widespread private-data leak; **P1** checkout/critical path unavailable, cross-account access, repeated crash; **P2** feature failure with workaround; **P3** cosmetic/minor friction. Stop onboarding for P0/P1, activate relevant kill switches, preserve evidence safely, and follow incident response.

## Exit and ownership

Product owner owns cohort/invitations; engineering owns builds, flags, monitoring, and rollback; trust/safety owns reports/disputes; support owns tester communication; legal/client owns policies/retention/store declarations. End or expand the beta only after a documented review. This runbook never authorizes public launch.
