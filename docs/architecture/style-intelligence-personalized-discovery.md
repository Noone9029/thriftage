# Style Intelligence and Personalized Discovery

## Scope

Thriftage uses deterministic, structured personalization. It does not call an LLM, create embeddings, claim machine learning, or invent inventory. Only `ACTIVE` listings from active, non-deleted, non-blocked, unrestricted sellers are eligible.

## Structured data

`StyleDefinition` is an administrator-managed taxonomy seeded with stable UUIDs for Streetwear, Old Money, Vintage, Gothic, Y2K, Minimalist, Formal, Smart Casual, Athleisure, and Techwear. Deactivation prevents new selection without breaking historical references.

`UserStyleProfile` is private and owns normalized style, color, fit, category-specific size, lifestyle, expression, priority, currency, and budget preferences. Quiz status and step support save/resume. `profileVersion` invalidates stale feed cursors after edits. The deterministic output identifies primary/secondary styles, preferred fits, colors, and garment roles.

Listings retain seller-facing `size` and `color` while adding normalized style IDs, color family, fit, garment role, size system, and compatibility key. Historical listings remain nullable; all newly submitted listings must have complete normalized metadata.

## Scoring and ranking

Algorithm `rules-v1` computes a 0–100 match score from only available components:

- selected styles: 35%;
- color: 15%;
- fit: 10%;
- compatible size: 15%;
- budget: 15%;
- recent style affinity: 10%.

Unavailable components are excluded from the denominator. Avoided colors and incompatible sizes contribute zero. Explanations are emitted only for positive components and are ordered by contribution.

Feed rank combines personal match (45), behavior (15), followed seller (8), freshness (12), seller trust (8), engagement (7), and deterministic exploration (5). Weights total 100 and are database-constrained. Candidate retrieval is bounded at 200, followed by stable sorting and seller/style diversity caps. A cursor fixes `asOf`, algorithm version, profile version, and offset; a profile or configuration change requires a fresh feed.

Likes, saves, follows, messages, checkout, and completed purchases are authoritative signals with 90-day linear decay. Explicit preferences have greater weight. “Not Interested” immediately excludes a listing and supports undo. A learned-signal reset records a cutoff timestamp without deleting product records.

Search filters remain strict and authoritative. Normalized color, fit, garment role, size system, and style filters only narrow eligible inventory. Similar items use shared styles, category, or garment role and the same availability, account, and block rules.

## Privacy and future AI boundary

Admin endpoints expose aggregate counts, taxonomy, and versioned configuration only—never individual profiles. Analytics records identifiers, event type, source, version, and timestamp, not quiz values or message bodies.

Height, weight, body type, and skin tone are intentionally not collected: current listing metadata cannot use them reliably, so collection would violate data minimization. A future AI stylist should consume the existing structured profile and eligible inventory through a separate context service; it must not bypass this ranking or eligibility boundary.
