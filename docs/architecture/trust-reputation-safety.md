# Trust, Reputation, and Safety Architecture

## Domain boundaries

Thriftage keeps trust behavior in four API modules: `reviews`, `disputes`, `seller-verification`, and `trust`. Reviews are immutable transaction records with a separate moderation state. Disputes own case timelines and private evidence metadata. Seller verification is an account-review process only. Trust owns policy acceptance, user blocking, scoped restrictions, safety actions, and reputation reads.

These modules publish minimal analytics events and durable notification-outbox records. Push delivery is supplementary; an unavailable push provider cannot roll back a review, dispute, restriction, or verification decision.

## Authoritative rules

- Only participants in a `COMPLETED` order can review, once per reviewer and order. Buyer-to-seller and seller-to-buyer ratings remain separate.
- `TEXT_HIDDEN` removes review text but preserves the rating. `INVALIDATED` removes the review from aggregates without deleting transaction history.
- Blocking removes both follow directions and prevents new social, listing, and free-text messaging interactions. Existing orders, disputes, conversations, and audit history remain accessible.
- Current required policy versions gate user-generated-content actions. Publishing a replacement version requires fresh acceptance.
- One dispute may exist per order. Eligible states are shipped, delivered, or completed within configurable timing boundaries.
- Seller verification is `ACCOUNT_REVIEW`; the badge does not certify identity, item authenticity, or transaction outcomes.
- Restrictions are scoped to messaging, selling, buying, or social behavior. Account suspension uses the existing authoritative account status.

## Private evidence

Dispute images are decoded, dimension-checked, metadata-stripped, converted to WebP, and stored under `disputes/<disputeId>/<uuid>.webp` in the dedicated `DISPUTE_EVIDENCE_BUCKET`. The bucket must be private. Clients receive short-lived signed URLs only after participant or ADMIN authorization. Storage keys and service credentials are never public contracts.

Create the bucket outside application startup and deny public reads. Configure `DISPUTE_EVIDENCE_SIGNED_URL_TTL_SECONDS`. Set `DISPUTE_EVIDENCE_RETENTION_DAYS` only after legal/business approval; until then, no automated retention deletion is claimed.

## Store-readiness boundary

The app now has reporting, blocking, objectionable-content moderation, policy acceptance, and a configurable support link, consistent with current [Apple user-generated-content guidance](https://developer.apple.com/app-store/review/guidelines/) and [Google Play UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937). Submission still requires approved Terms of Use, Privacy Policy, Community Guidelines, official support contact, moderation staffing/escalation policy, and completed store disclosures.

## Deliberate limitations

No automated refund, chargeback, escrow, KYC, identity-document collection, counterfeit guarantee, or AI moderation is implemented. Dispute resolutions document operational outcomes; they do not invent financial remedies.
