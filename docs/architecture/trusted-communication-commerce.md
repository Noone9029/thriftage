# Trusted Communication and Commerce

## Architecture

NestJS is authoritative for conversation membership, message creation, moderation, checkout, order transitions, payment state, shipping, and notification creation. PostgreSQL is the system of record. Mobile and admin consume shared Zod contracts; neither writes database state directly.

```text
Mobile -> NestJS -> PostgreSQL
                  |-> notification_outbox -> in-app notification -> Expo adapter
                  `-> Supabase private Broadcast (delivery hint only)
```

## Messaging and realtime

One conversation is reused for each `(listing, buyer)` pair. Only its buyer and seller can list, read, send, or mark messages read. Messages are immutable, limited to 2,000 characters, paginated, and persisted before realtime publication. Private channel topic: `conversation:<uuid>`; event: `message-created`. Reconnect refetches the API, so missed or duplicate broadcasts do not create or lose messages.

Phone, email, obfuscated email/digit, and WhatsApp patterns are blocked. Social handles are delivered but flagged. Blocked attempts are retained in protected message/moderation tables, excluded from delivery and unread counts, and create no recipient notification. Admin context reads and resolutions create audit rows.

## Checkout and reservation

Checkout supports one ACTIVE listing, one seller, one order, and COD. The API ignores client prices. It locks the eligible listing row with `SELECT ... FOR UPDATE`, snapshots listing, parties, price/currency, image key, and delivery address, creates the COD payment and order, then atomically changes `ACTIVE -> RESERVED`. A unique active-order index and `(buyer, idempotencyKey)` constraint provide defense in depth. The losing concurrent buyer receives `LISTING_NOT_AVAILABLE`.

```text
Buyer place order -> PENDING
Seller confirm    -> CONFIRMED
Seller ship       -> SHIPPED
Buyer received    -> DELIVERED
System worker     -> COMPLETED + COD COLLECTED + listing SOLD

Buyer cancel: PENDING -> CANCELLED
Seller cancel: PENDING|CONFIRMED -> CANCELLED
```

Cancellation releases only the matching `RESERVED` row. It cannot reactivate independently moderated inventory. Seller shipping records a human-entered provider and optional tracking reference; no courier integration is claimed.

## Payments, notifications, and history

Core order code depends on `PaymentProvider`. Only `CashOnDeliveryAdapter` is enabled. COD is `PENDING_COLLECTION` at checkout and becomes `COLLECTED` only after buyer-confirmed delivery is finalized. Digital providers, refunds, escrow, payouts, and webhooks are intentionally deferred.

Every material transition writes an immutable `OrderEvent`. Notifications originate in the same database transaction as domain changes. A PostgreSQL worker claims outbox rows with `FOR UPDATE SKIP LOCKED`, uses dedupe keys, exponential retry, bounded attempts, and visible failure states. Expo tickets and receipts are tracked per device; `DeviceNotRegistered` deactivates the token. Push failure never rolls back the message or order.

## External configuration

| Status                          | Capability                                                                 | Required work                                                                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Implemented in code             | Persistence, API authorization, COD, outbox, manual shipping, admin review | Apply migrations and run API workers                                                                                                                                                    |
| Requires external configuration | Supabase private Broadcast                                                 | Enable `REALTIME_BROADCAST_ENABLED`, configure private-channel Realtime RLS so only mapped conversation participants can receive the topic, and keep service credentials in API runtime |
| Requires external configuration | Expo push                                                                  | Add EAS project ID, APNs/FCM credentials, enable `EXPO_PUSH_ENABLED`, and optionally set `EXPO_PUSH_ACCESS_TOKEN`                                                                       |
| Intentionally deferred          | Digital payment and courier providers                                      | Complete merchant/provider approval, secret custody, signed webhook design, sandbox proof, and explicit production approval                                                             |

The Supabase Realtime authorization policy must map `auth.uid()` to the application user and test the requested topic against conversation membership. It belongs in the Supabase-hosted Realtime policy environment, not this portable application migration.

## Privacy and retention

Messages, flags, orders, payments, shipments, notifications, and audit events use restrictive foreign keys. Account deletion must later anonymize retained history; it must not cascade transaction evidence. Delivery address and phone are returned only to order participants and authorized admins. Push payloads contain IDs and generic copy, never message bodies, address, email, phone, or payment credentials.
