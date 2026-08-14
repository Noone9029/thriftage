# AI Fashion Stylist and Outfit Intelligence

## Status and boundary

The AI Stylist is implemented as a dedicated `ai-stylist` NestJS domain. It advises; it is never the marketplace authority. PostgreSQL, existing listing eligibility, moderation, blocks, seller restrictions, price, currency, size metadata, and commerce services remain authoritative.

```text
authenticated request
  -> structured StylistIntent + minimized Style Profile context
  -> eligible inventory query
  -> bounded deterministic Outfit Composer
  -> provider selection/explanation over candidate IDs
  -> final server-side listing revalidation
  -> persisted structured response + mobile marketplace cards
```

No AI tool can purchase, create an order, message a seller, follow/block a user, change a profile, or perform another write. Those actions remain ordinary user-controlled application flows.

## Provider and Responses API

`AiStylistProvider` is application-owned. `OpenAiStylistAdapter` is the only layer that imports the OpenAI SDK, so inventory, composition, persistence, API contracts, and mobile code do not depend on provider response objects.

The adapter uses the OpenAI Responses API with:

- configuration-driven model and reasoning effort (`gpt-5.6-terra`, `medium` by default);
- strict Zod structured output for the response plan;
- strict, sequential function tools and a bounded tool-call loop;
- `store: false` and application-owned conversation history;
- a one-way hashed safety identifier rather than a user identifier;
- one retry in the SDK, an application timeout, and stable mapped failures;
- a stable `prompt_cache_key` and static instructions/tool definitions before user-specific data.

The versioned system prompt is `thriftage-stylist-v1`; the tool schema is `tools-v1`. Generation records persist requested/returned model, versions, reasoning configuration, latency, token and cached-token usage, tool count, status, failure code, and estimated cost. Hidden reasoning and raw provider responses are neither requested nor stored.

Streaming is intentionally not enabled in this release. The authenticated mobile request is bounded and cancellable locally; only the final validated structured result becomes authoritative. This avoids rendering partial prose as verified inventory.

## Exact model tools

The allowlist is:

1. `get_personalization_context`
2. `search_inventory`
3. `get_listing_details`
4. `compose_outfit_candidates`
5. `get_saved_items`

Arguments are strict and bounded. They never accept `userId`; the tool session closes over the authenticated user. Unknown tools, oversized arguments, side-effect attempts, and excessive loops fail with stable error codes. Tool results contain safe structured fashion facts—not email, phone, address, disputes, verification evidence, private messages, listing descriptions, or other users’ private data.

## Prompt-injection and privacy controls

Seller titles and descriptions are user-generated content and are not sent to the provider. Candidate tool data uses opaque listing references and normalized facts. System instructions, current user text, and structured application data are separate. All model-selected IDs are proposals and must match server-created candidate IDs.

The provider may receive only the active request, compact prior structured intent, bounded candidate facts, and relevant Style Profile signals: styles, colors, fits, sizes, budget range, and reset-aware affinities. Explicit current requests override general profile preferences. Authentication metadata, contact details, addresses, messages, orders, disputes, review history, and sensitive verification data are excluded.

## Intent, occasions, and refinements

`StylistIntent` represents budget in integer minor units, one currency, occasion, requested/excluded colors, styles, fits, garment roles, size constraints, modesty, option count, anchor/locked listing IDs, and refinement type. The deterministic parser recognizes practical phrasing such as “under 5k,” university, wedding, gym, smart casual, cheaper, more modest, different shoes/colors, and another option.

Multi-turn context stores only the compact intent and last outfit references. Refinements preserve relevant constraints and recompute candidates; they do not merely rewrite the prior explanation. An item launched through “Style this piece” is validated before conversation creation and supplied as the first-turn anchor.

## Outfit Composer

The composer supports configurable templates:

- standard and athleisure: top + bottom + shoes;
- layered: top + bottom + outerwear + shoes;
- dress: dress + shoes;
- accessory only when requested.

It bounds candidates per role and uses bounded beam search rather than a catalog-wide Cartesian product. Deterministic scores cover role completeness, style cohesion, color harmony, fit/size confidence, occasion, trust, personal match, and budget. Explicit size mismatches are excluded; unknown size may remain with visible uncertainty. Fit is never guaranteed.

Every completed outfit uses one currency and recomputes the sum from current integer prices. The server rejects over-budget, mixed-currency, missing locked/anchor, ineligible, or fabricated selections. Immediately before returning, it reloads every listing and rechecks active state, seller eligibility, blocks, size claims, price, and currency.

## Conversations, idempotency, and retention

`AiStylistConversation`, `AiStylistMessage`, and `AiGeneration` are separate from buyer/seller messaging. Owner-scoped endpoints support create, list, reopen, archive/restore, delete, and send. A deterministic title avoids a second model call. A partial unique index permits one processing generation per user, and `(user_id, client_request_id)` makes mobile retries idempotent.

The client can stop waiting with `AbortController`; the server still enforces its timeout and concurrency ceiling. Rechecking the same client request ID reconciles an already completed generation rather than spending twice.

Conversation deletion removes that conversation, messages, and generation metadata. Saved outfits deliberately survive through nullable historical source references. No final legal retention duration is asserted: deployment policy must define retention and any scheduled deletion process before production. Archive is presentation state, not a retention guarantee.

When a conversation is reopened, all referenced listings are batch-revalidated. Current price and listing presentation replace the stored snapshot when eligible. Missing/sold/blocked/removed items remain visible as historical recommendations marked unavailable; totals become non-authoritative.

## Saved outfits and attribution

Users save a complete generated outfit, inspect it later, remove it, and request a deterministic replacement for an unavailable role. `SavedOutfitItem` keeps a historical listing reference even when its nullable listing foreign key is cleared. Replacement respects current eligibility and uses its own idempotency request ID.

Open, item-save, checkout, and purchase attribution records require an owned generation containing the listing. Checkout/purchase also require an order owned by that buyer for that listing. Analytics contain identifiers and event names, never prompt text. Admin metrics expose aggregates only; no stylist transcript browser exists.

## Reliability, limits, and fallback

Runtime controls cover the kill switch, model, reasoning, input/output size, tool calls, timeout, per-minute and daily user limits, session turns, global concurrency, options, token pricing, and an optional daily estimated-cost circuit breaker. Already billed tokens from provider turns are retained even if a later tool turn fails. Missing usage metadata is tolerated without breaking the response.

Provider timeout, outage, invalid output, unsafe copy, unknown/fabricated candidate IDs, and final validation failure activate the deterministic Thriftage fallback when candidates exist. The fallback still passes final inventory validation and is clearly labeled in mobile and generation metadata. With no complete eligible outfit, the user receives a truthful no-match response—not invented products.

Stable errors include disabled, rate limited, generation in progress, provider unavailable/timeout, invalid response, tool limit, inventory unavailable, ownership/not-found, outfit not found, and unsupported request.

## Evaluation and operations

The local eval dataset covers university, wedding, gym, smart casual, streetwear, minimalist, strict budget, excluded color, unusual/unknown size, sparse inventory, sold/blocked items, locked outerwear, cheaper refinement, malicious injection, and dress composition. Code validators enforce grounding, eligibility, blocks, budget, currency, size, locks, color exclusions, and completeness.

`pnpm ai:eval` is an explicit live-model harness. It reports model/effort, grounding, hard invariants, deterministic no-match handling, personalization/style alignment, explanation safety/quality, latency, cache usage, tokens, tool calls, and estimated cost. `AI_STYLIST_LIVE_EVAL_ENABLED=true` and a backend-only key are mandatory; ordinary CI never calls OpenAI. Multiple comma-separated models/efforts enable comparison before a production change.

The admin workspace shows 24-hour generations, active users, status/model mix, average/p50/p95 latency, token/cached-token usage, estimated cost, provider/fallback rates, unique save and click-through rates, purchases, prompt/tool/eval versions, and effective environment limits. Settings are read-only in the UI; environment-managed changes belong to audited deployment configuration.

See the [AI Stylist runbook](../operations/ai-stylist-runbook.md) for incident response.

## External configuration and exclusions

Implemented in code: provider abstraction, Responses integration, prompt/tools, grounding, persistence, fallback, API, mobile UX, admin aggregates, local evals, and tests.

Requires deployment configuration: an OpenAI project, backend-only restricted key, separate development/production projects where practical, access control, key rotation, billing monitoring, spend alerts/limits, approved retention policy, and staged monitoring.

Optional: intentional live eval configuration. No live key or live-model result is committed.

Virtual try-on, body-photo analysis, image generation/editing, protected-trait or body inference, web shopping, autonomous commerce, fine-tuning, and a custom ML recommender remain out of scope.

Official references: [Responses API](https://developers.openai.com/api/docs/guides/responses), [function calling](https://developers.openai.com/api/docs/guides/function-calling), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [data controls](https://developers.openai.com/api/docs/guides/your-data#default-usage-policies-by-endpoint), and [evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices).
