# Trusted Commerce Security Audit

## Result

The code closes the primary in-scope authorization and transaction-integrity risks. External Supabase Realtime policies and physical-device push delivery remain deployment validation gates.

## Controls reviewed

- **Messaging:** sender identity comes from the verified API session; participant-scoped queries prevent conversation IDOR; message length and database-backed rate limits bound abuse; React Native renders message text without HTML; logs and analytics exclude bodies.
- **Contact protection:** deterministic categories distinguish blocking from review-only flags; evidence is retained; blocked content is not delivered or notified; admin access and decisions are audited.
- **Commerce:** final checkout revalidates ACTIVE inventory; seller self-purchase is rejected; totals come from PostgreSQL; row locking and uniqueness prevent double purchase; idempotency keys make retries stable.
- **State:** explicit actor/action transitions reject arbitrary patches; cancellation updates payment/shipment and releases only the matching reservation; completion owns `RESERVED -> SOLD`.
- **Payments:** COD starts unpaid; provider reference and state are durable; no card data, live credentials, unsigned webhook, fake refund, or digital-money path exists.
- **Shipping/privacy:** only the seller, buyer, and authorized admin can retrieve an order snapshot; only the seller can create shipment state; notification payloads exclude delivery data.
- **Notifications:** recipient is server-derived; unique dedupe keys prevent spam; outbox/push failures are isolated; receipt handling disables stale Expo devices; registration reassigns a token to the authenticated owner.
- **Admin:** role guards protect flag/order endpoints; message inspection creates an audit record; order UI is read-only and cannot perform hidden state manipulation.

## Residual deployment checks

1. Apply and test private Supabase Realtime RLS policies in the target project.
2. Validate APNs/FCM/EAS credentials and foreground/background behavior on physical iOS and Android devices.
3. Run production-like load tests against managed PostgreSQL; local Prisma Dev emits a concurrent-query deprecation warning.
4. Establish retention/anonymization policy before account deletion ships.
5. Re-run the production dependency audit when Expo/Metro can resolve `image-size >= 2.0.3`; the current Metro toolchain resolves `2.0.2` and reports two high-severity parser denial-of-service advisories. Do not process untrusted ICNS, JXL, or HEIF assets in build tooling until patched.
