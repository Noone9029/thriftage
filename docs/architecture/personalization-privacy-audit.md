# Personalization Privacy Audit

## Data inventory

Private profile data consists of style IDs, normalized color preferences, fit choices, category-specific sizes, lifestyle/expression choices, shopping priorities, budget, currency, quiz progress, versions, and reset timestamps. It is available only through authenticated `/me` endpoints.

Behavior learning uses existing authoritative likes, saves, follows, listing-linked messages, checkout events, and completed purchases. Recommendation events never contain message bodies, addresses, phone/email, search text, raw quiz answers, or physical attributes.

## Access controls

- Public listing and profile contracts never expose a user's style profile.
- Admin APIs expose aggregate profile completion, event totals, feedback totals, taxonomy usage, and scoring configuration.
- Style taxonomy mutation requires an authoritative database `ADMIN` role and writes an audit record.
- Reset and feedback endpoints require the linked authenticated user.
- Blocked relationships and active selling restrictions are applied before ranking and similarity selection.

## Retention and user control

Deleting a user cascades private style and recommendation records. Resetting a style profile removes quiz answers. Resetting learned signals preserves likes, saves, follows, messages, and orders as product records but excludes earlier behavior from future ranking. “Not Interested” is reversible.

No automated sensitive inference, generative AI, vector database, third-party personalization provider, or new paid service is present. Before introducing any such provider, complete a new privacy/security review covering purpose, retention, data residency, deletion, cost controls, fallback behavior, and vendor access.
