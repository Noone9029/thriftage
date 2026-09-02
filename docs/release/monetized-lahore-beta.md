# Monetized Lahore Android Beta

Status: **NO-GO for registration, live money, and invitations until the gates below have evidence.** The code defaults PayFast, COD, payouts, registration, and AI Stylist off.

## Release scope

- 20–30 invited Lahore testers through Google Play closed testing.
- Android package `com.thriftage.marketplace`, reserved in an organization-owned Play Console before first upload.
- One generic account type; sellers are derived from listing activity.
- Physical fashion goods only, so checkout uses approved external payment methods rather than Google Play Billing.
- AI Stylist disabled and hidden. Deterministic discovery remains.
- No cart, variants, subscriptions, listing fees, partial refunds, iOS public release, or paid acquisition.

## Gate 1: commercial

- Pakistan lawyer approves merchant-of-record flow, seller/buyer terms, full-refund policy, disputes, payout handling, privacy, and retention.
- Pakistan accountant approves invoices, versioned withholding/reporting, marketplace ledger treatment, and contribution-margin reporting.
- PayFast provides written marketplace collection/later-payout approval, sandbox/live credentials, exact callback/status/refund documentation, settlement terms, merchant limits, and named escalation.
- Courier agreement requires Lahore rate card, coverage, pickup/delivery/return evidence, liability, escalation, and itemized deposits into Thriftage's account.

Owner evidence fields: legal approval reference, accounting approval reference, PayFast approval reference, courier agreement reference, approver, and date. Missing evidence means all live-money flags stay false.

## Gate 2: ownership and infrastructure

- Official WHOIS and trademark conflict checks are documented; register `thriftage.pk`, or `thriftage.com.pk` only if the first is unavailable.
- Configure `www`, `api`, `admin`, and `auth`, plus `support@`, SPF, DKIM, and DMARC.
- Create a business-owned Play organization account, complete identity/D-U-N-S requirements, and reserve `com.thriftage.marketplace`.
- Create isolated production Supabase, Railway, Vercel, Resend, Sentry, and Expo/EAS environments. No staging database, bucket, key, or synthetic identity is reused.
- Configure backups and pass an isolated Postgres and object-storage restore drill before registration.
- Configure Supabase custom SMTP with Resend on an authenticated subdomain; verify confirmation and recovery delivery. The Supabase default sender is not accepted.

## Gate 3: engineering and staging

- Use Node 24 LTS and pnpm 11.16; frozen install, format, lint, strict typecheck, tests, Prisma validation, migration safety, fresh migrations, builds, Expo Doctor, secret scans, and critical dependency audit pass.
- Current `main` is deployed to isolated staging and its release identity matches the tested commit.
- PayFast sandbox covers success, cancellation, signature failure, duplicate callback, amount mismatch, authoritative-status disagreement, 15-minute expiry, and provider outage.
- Courier simulation covers every status, COD deposit match/mismatch, return, loss, and evidence access.
- Finance acceptance covers commission rounding, zero/unapproved withholding, full refund, inspection-gated restock, encrypted bank/wallet profiles, phone match, reauthentication, 72-hour hold, settlement retry, payout eligibility, and creator/approver separation.
- Security, authorization, load, backup restore, and physical Android critical acceptance pass with production-like flags.
- `AI_STYLIST_ENABLED=false`; `PAYFAST_ENABLED`, `PAYFAST_LIVE_ENABLED`, `COD_ENABLED`, and `PAYOUTS_ENABLED` remain independent.

## Gate 4: closed test and first money

1. Upload a signed production-profile AAB first to internal testing, then closed testing; verify application ID, version code, signing owner, data-safety answers, support/legal links, and tester Google Group/email allowlist.
2. Run sandbox purchases with the invited cohort.
3. Enable PayFast live for five capped orders only after all earlier gates.
4. Enable COD only after the courier's itemized-deposit drill reconciles exactly.
5. Cap week one at ten total live orders. Review every order and payout manually. Raise only after a clean seven-day reconciliation signed by both finance operators.

If the Play account is personal rather than organizational, verify the then-current production-access testing requirement in Play Console; do not assume the organization flow applies.

## Success and stop signals

Week 1: 20–30 invitees, no unauthorized access, no oversold unit, all deposits matched, zero duplicate charge/refund/payout, all support cases acknowledged, crash/health alerts working.

Month 1: report registrations, verified accounts, active users, total/active sellers, listing approval and stock, checkout-to-order conversion, placed/completed GMV, cancellations, disputes, refunds, commission, provider/courier cost, liabilities, payout timeliness, repeat purchase, and retention.

Month 3: review cohort expansion using reconciled unit economics, repeat behavior, dispute rate, moderation load, payout reliability, and restore/incident evidence. Paid acquisition remains off until the unit economics reconcile.

Immediate stop: unmatched money, payout to an unapproved destination, oversell, signature bypass, cross-user finance exposure, unrecoverable data, Sev-1 security issue, or inability to restore. Disable the affected money flag, preserve evidence, stop new orders if required, and follow incident response.

## Budget envelope below PKR 250,000

- 35% legal/accounting
- 25% provider/courier setup and settlement float
- 20% domain, Play, hosting, email, monitoring, and SMS
- 10% tester/content/support operations
- 10% contingency

This is an allocation ceiling, not authorization to spend or a claim that vendor quotes are current.
