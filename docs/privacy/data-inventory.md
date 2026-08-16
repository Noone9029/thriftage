# Privacy and Store Data Inventory

This engineering inventory supports legal review, Google Play Data Safety, and Apple App Privacy. It is not a completed store declaration or approved privacy policy. Confirm every SDK/provider behavior and final retention rule before submission.

| Data category                       | Required?                             | Purpose and storage                                   | Provider sharing                                     | Deletion                                                                               |
| ----------------------------------- | ------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Email, name, auth identifiers       | Required                              | Account/authentication; Supabase Auth and PostgreSQL  | Supabase                                             | Auth identity deleted; application values anonymized                                   |
| Phone number and OTP metadata       | Required by current onboarding policy | Identity/trust; phone stored, OTP handled by provider | Supabase, Twilio Verify                              | Phone anonymized; justified abuse metadata may be retained                             |
| Profile photo, bio, university      | Optional                              | Public marketplace profile; Storage/PostgreSQL        | Supabase Storage                                     | Deleted with account                                                                   |
| Listings and listing photos         | User-provided                         | Marketplace UGC/moderation                            | Supabase Storage                                     | Active UGC/media removed; safety history minimized                                     |
| Messages and moderation flags       | User-provided                         | Buyer/seller communication and abuse prevention       | Supabase database/Realtime advisory hints            | Conversation content deleted or anonymized subject to approved safety retention        |
| Delivery address and order contact  | Required for order                    | COD fulfillment and transaction record                | PostgreSQL; no courier integration yet               | Active address deleted; completed-order PII minimized under approved retention policy  |
| Orders, payments, shipment, reviews | Transactional                         | Commerce, reconciliation, reputation                  | Supabase PostgreSQL                                  | Minimum pseudonymous audit history retained; period requires legal approval            |
| Reports, disputes, evidence         | Optional/transactional                | Safety and dispute resolution                         | Supabase private Storage/database                    | Private evidence removed or retained only under approved policy                        |
| Style, size, fit, color preferences | Optional                              | Deterministic personalization                         | Supabase PostgreSQL                                  | Deleted with account; reset available                                                  |
| AI Stylist input/output and usage   | Optional, feature-flagged             | Grounded outfit help, safety, cost control            | OpenAI receives bounded request context when enabled | Conversations/generations deleted with account except minimized operational aggregates |
| Push token                          | Optional                              | Device notifications                                  | Expo Push; APNs/FCM downstream                       | Deactivated on logout/provider rejection; deleted with account                         |
| Crash/error telemetry               | Optional by environment               | Reliability and security operations                   | Sentry when configured                               | Avoid PII; retention configured in Sentry and disclosed after review                   |
| Beta feedback                       | Optional                              | Product/quality triage                                | PostgreSQL; no automatic attachments                 | Deleted with account unless a minimized resolved audit is legally justified            |

All network traffic must use TLS in staging/production. Public clients receive only publishable/public configuration. Passwords, OTPs, tokens, private messages, addresses, evidence, and raw AI conversations are excluded from analytics, feedback metadata, and default logs.

## Data export decision

A self-service export is deferred for closed beta: it is not currently a store gate, and a rushed export risks exposing private counterparty, moderation, and transaction data. Before public launch, legal/product must define scope and identity verification, then implement a bounded asynchronous export if required.

## Client-owned approvals

Required before store submission: legal Privacy Policy/Terms/Community Guidelines; official support contact; retention and deletion bases; Sentry/email-provider disclosures; exact store form answers; and provider data-processing agreements. Do not paste this inventory into a store form without confirming deployed behavior.
