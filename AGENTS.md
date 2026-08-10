# AGENTS.md — Thriftage

## 1. Purpose

This repository contains **Thriftage**, a production mobile-first fashion marketplace focused on peer-to-peer resale of clothing, shoes, and accessories, with social discovery and future AI-powered personalization.

Thriftage should feel closer to a modern fashion social platform than a classifieds application.

The product must allow users to:

- create accounts and profiles;
- list their own clothing, shoes, and accessories for sale;
- discover items through a visual feed;
- search and filter the marketplace;
- follow other users;
- like and save items;
- communicate through protected in-app messaging;
- purchase items;
- track orders;
- rate buyers and sellers;
- receive notifications;
- report problematic content or users;
- build a style profile in the personalization phase;
- receive increasingly personalized fashion discovery over time.

The architecture must be suitable for a Pakistan-first launch while avoiding assumptions that would prevent later international expansion.

---

# 2. Agent Operating Rules

These rules apply to every automated coding agent working in this repository.

## 2.1 Read before editing

Before changing code:

1. Read this file.
2. Read the nearest nested `AGENTS.md`, if one exists.
3. Inspect the relevant package/module.
4. Inspect existing tests for the area being changed.
5. Inspect related types, schemas, database models, API contracts, and state machines.
6. Preserve existing conventions unless there is a documented reason to improve them.

Do not make broad changes before understanding the affected subsystem.

## 2.2 Work in bounded tasks

Each task should have one clear purpose.

Good tasks:

- implement product-listing creation;
- add saved-item support;
- create the order-state transition service;
- add message contact-information detection;
- implement profile editing;
- add listing moderation endpoints.

Bad tasks:

- build the marketplace;
- improve the backend;
- refactor the whole app;
- add all social features.

Split large work into independently reviewable slices.

## 2.3 Do not silently change product scope

Do not add new product features solely because they seem useful.

Do not remove or materially change an approved requirement without documenting it.

When a requirement is ambiguous:

- preserve the safest interpretation;
- document the assumption;
- isolate the decision behind a configuration or well-defined interface when practical.

## 2.4 No fake completeness

Never claim a feature is complete merely because the happy-path UI exists.

A production feature is complete only when its applicable layers are handled:

- UI;
- validation;
- authorization;
- API;
- persistence;
- error handling;
- loading states;
- empty states;
- permissions;
- tests;
- analytics hooks where required;
- moderation/security implications where required.

Do not insert fake APIs, fake payments, fake shipping, or fake verification into production paths.

Mocks are permitted only in tests, story/demo fixtures, or explicitly isolated development environments.

## 2.5 Never expose secrets

Never commit:

- API keys;
- database credentials;
- signing secrets;
- JWT secrets;
- payment credentials;
- service-role keys;
- private storage credentials;
- Apple or Google signing credentials.

Use environment variables and `.env.example` files containing placeholder values only.

## 2.6 Production safety

Do not:

- deploy to production;
- publish mobile builds;
- submit to app stores;
- run destructive production migrations;
- delete production data;
- rotate live secrets;
- enable live payment processing;
- change DNS;
- change production auth configuration;

unless the task explicitly authorizes that action.

---

# 3. Product Source of Truth

Implementation should follow, in priority order:

1. explicit current task instructions;
2. approved product specifications and implementation documents;
3. this `AGENTS.md`;
4. existing code and tests;
5. reasonable engineering defaults.

When documents conflict, do not quietly choose whichever is easiest. Document the conflict.

---

# 4. Product Principles

## 4.1 Fashion-first

The interface should feel:

- visual;
- modern;
- premium but accessible;
- fast;
- social;
- trustworthy;
- simple enough for first-time marketplace sellers.

Avoid generic enterprise-dashboard aesthetics in the mobile application.

## 4.2 Mobile-first

The customer product is primarily a mobile experience.

Important flows should be comfortable with one-hand use where practical.

Primary actions must be obvious:

- Sell;
- Buy;
- Save;
- Message;
- Follow;
- View profile.

## 4.3 Trust is a core feature

Thriftage is a user-to-user marketplace.

Trust systems are not optional polish.

Listings, messaging, identities, transactions, reviews, disputes, moderation, and seller reputation must be designed defensively.

## 4.4 Pakistan-first, global-ready

The first release is intended for Pakistan.

Do not hard-code assumptions that make global expansion expensive.

Examples:

- store currency explicitly;
- use ISO country codes;
- use normalized phone handling;
- use timezone-aware timestamps;
- separate payment-provider logic from order logic;
- separate shipping-provider logic from order logic;
- avoid hard-coding Pakistani cities into core models;
- keep localization possible;
- support address schemas that can evolve.

---

# 5. Approved Technical Direction

Unless an approved architecture decision replaces it, use the following stack.

## 5.1 Monorepo

Use `pnpm` workspaces.

Recommended structure:

```text
thriftage/
├── apps/
│   ├── mobile/
│   ├── admin/
│   └── api/
├── packages/
│   ├── db/
│   ├── shared/
│   ├── config/
│   └── ui/
├── docs/
├── tooling/
├── AGENTS.md
├── package.json
└── pnpm-workspace.yaml
```

## 5.2 Mobile

- React Native
- Expo
- TypeScript
- Expo Router
- TanStack Query for server state
- a small deliberate client-state solution when needed
- shared validation/types where practical

Do not move authoritative business logic into the mobile client.

## 5.3 Admin

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui where appropriate
- server-side authorization for protected admin actions

Admin UI is an operational tool, not the public consumer aesthetic.

## 5.4 API

- NestJS
- TypeScript
- REST API for initial production release
- OpenAPI documentation where practical
- modular domain architecture

## 5.5 Database

- PostgreSQL
- Prisma ORM
- UUID identifiers
- explicit indexes
- transactional writes for multi-step state changes

## 5.6 Authentication

Preferred initial direction:

- managed authentication provider;
- backend-controlled authorization;
- short-lived application sessions/tokens where applicable.

Authentication identifies the user.

Authorization determines what the user is allowed to do.

Never rely on the mobile UI hiding a button as authorization.

## 5.7 Object storage

Use private or controlled object storage for uploaded media.

Product/listing images should use:

- generated object keys;
- content-type checks;
- file-size limits;
- image dimension limits;
- controlled upload paths;
- server-authorized uploads or signed uploads;
- CDN delivery where appropriate.

Do not trust user-supplied filenames.

## 5.8 Cache / jobs

Redis and/or a managed queue may be introduced when a concrete need exists, such as:

- notification dispatch;
- image processing;
- moderation jobs;
- recommendation computation;
- email/SMS delivery;
- analytics aggregation.

Do not add infrastructure merely for architectural decoration.

---

# 6. Domain Modules

The backend should use clear domain boundaries.

Initial modules:

```text
auth
users
profiles
seller-verification
categories
listings
listing-media
favorites
likes
follows
feed
search
messaging
moderation
orders
payments
shipping
reviews
notifications
disputes
analytics
admin
style-profile
recommendations
```

Each module should expose clear services/interfaces rather than reaching into another module's internals.

---

# 7. User Roles

## 7.1 Standard User

A standard user may:

- register;
- log in;
- edit their profile;
- create listings;
- edit eligible listings;
- deactivate eligible listings;
- purchase items;
- save items;
- like items;
- follow users;
- message users through Thriftage;
- view orders;
- receive ratings;
- leave eligible ratings;
- report listings/users/messages where supported.

A single account may act as both buyer and seller.

Do not create separate buyer and seller account systems unless a later requirement demands it.

## 7.2 Administrator

Administrators may, subject to role permissions:

- manage users;
- review listings;
- remove listings;
- suspend users;
- manage categories;
- view orders;
- review disputes;
- review flagged conversations;
- verify sellers;
- view platform analytics;
- perform documented moderation actions.

All sensitive admin actions should be auditable.

---

# 8. Authentication Requirements

Registration requires:

- full name;
- email;
- phone number;
- password.

Optional during initial registration:

- university;
- profile picture;
- bio.

Support:

- email login;
- phone login where the selected auth provider supports it safely;
- forgot password;
- password reset;
- email/phone verification as required by product policy.

Normalize email and phone values before uniqueness checks.

Rate-limit authentication abuse paths.

Never reveal whether an account exists through unnecessarily specific reset/login errors.

---

# 9. User Profile Requirements

Profile fields include:

- username;
- full name;
- profile picture;
- bio;
- university;
- seller rating;
- buyer rating where applicable;
- number of completed sales;
- listing count;
- reviews;
- followers;
- following;
- seller verification state.

Profile pages should expose only public-safe information.

Never expose private email addresses or phone numbers in public profile payloads.

---

# 10. Listing System

## 10.1 Supported top-level categories

Initial categories:

- Clothing
- Shoes
- Accessories

Categories should be data-driven so administrators can expand them later.

## 10.2 Required listing fields

A listing requires:

- title;
- description;
- price;
- currency;
- condition;
- size;
- category;
- photos;
- seller.

Optional fields:

- brand;
- color;
- subcategory;
- material;
- original retail price;
- style tags;
- location metadata allowed by product policy.

## 10.3 Condition enum

Initial values:

- NEW
- LIKE_NEW
- GOOD
- FAIR

Use enums/constants rather than uncontrolled strings.

## 10.4 Photos

Listings require:

- minimum 3 photos;
- maximum 10 photos.

Validate:

- count;
- MIME/content type;
- size;
- dimensions when appropriate.

Store image records independently from listing records.

Support ordering of images.

## 10.5 Listing lifecycle

Use an explicit state machine.

Recommended baseline:

```text
DRAFT
PENDING_REVIEW
ACTIVE
RESERVED
SOLD
REJECTED
REMOVED
ARCHIVED
```

Transitions must happen through domain services.

Do not allow arbitrary client-side status mutation.

Examples:

- seller submits DRAFT -> PENDING_REVIEW;
- moderator approves PENDING_REVIEW -> ACTIVE;
- accepted purchase may move ACTIVE -> RESERVED;
- successful completion moves RESERVED -> SOLD;
- administrator may move eligible listing -> REMOVED.

All status transitions should be validated.

## 10.6 Seller ownership

Only the listing owner or authorized administrator can change seller-controlled listing data.

A seller may not purchase their own listing.

Sold listings must not be purchasable.

---

# 11. Product / Listing Detail Screen

Display:

- image gallery;
- title;
- price;
- currency;
- seller summary;
- seller rating;
- description;
- size;
- condition;
- category;
- optional brand;
- optional color;
- save status;
- like status where enabled.

Primary actions:

- Buy Now;
- Save Item;
- Message Seller;
- View Seller Profile.

UI must reflect unavailable/sold/reserved states clearly.

---

# 12. Search and Filtering

Initial filters:

- category;
- size;
- price range;
- condition.

Initial sorting:

- newest;
- oldest;
- lowest price;
- highest price.

Search should support at least:

- listing title;
- description;
- brand;
- category where practical.

Start with PostgreSQL-friendly search where sufficient.

Do not introduce an external search engine until measurable needs justify it.

Keep the search service abstraction clean enough to migrate later.

---

# 13. Social Features

Users may:

- follow users;
- unfollow users;
- save products;
- unsave products;
- like products;
- unlike products.

Protect endpoints against duplicate records using database constraints.

Follower/following counts must derive from authoritative data.

Avoid trusting client-submitted counters.

---

# 14. Discovery Feed

Initial feed content:

- new listings;
- trending listings;
- recommended listings.

The first production feed may use deterministic ranking.

Avoid pretending rule-based ranking is machine learning.

Recommended signals:

- recency;
- engagement;
- seller quality;
- listing completeness;
- followed sellers;
- category affinity;
- size compatibility once available;
- style compatibility in Phase 2;
- user activity in Phase 2.

Feed ranking logic must live behind a service/interface so it can evolve without rewriting the mobile client.

Use pagination.

Prefer cursor pagination for high-volume feeds.

---

# 15. Order Management

## 15.1 Order states

Use an explicit order state machine.

Baseline:

```text
PENDING
CONFIRMED
SHIPPED
DELIVERED
COMPLETED
CANCELLED
```

Additional internal payment/shipping states may exist separately.

Do not overload one status column with every domain concern.

## 15.2 Order rules

Users can:

- place eligible orders;
- view active orders;
- view order history;
- track order status.

Sellers can:

- view orders for their items;
- perform only allowed seller transitions.

Administrators can:

- inspect orders;
- perform explicitly authorized interventions.

## 15.3 Transaction integrity

Order creation must:

1. verify listing availability;
2. verify buyer is not seller;
3. lock or transactionally protect availability;
4. create order;
5. update listing reservation/sold state as appropriate;
6. avoid duplicate purchases caused by retries.

Use idempotency for externally retried order/payment requests.

---

# 16. Payments

Payment logic must be provider-independent.

Core order logic must not directly depend on a single payment gateway.

Use a payment adapter/interface.

Store:

- provider;
- provider reference;
- amount;
- currency;
- payment state;
- timestamps;
- reconciliation metadata where required.

Never store raw card data.

Do not implement escrow semantics unless the legal/payment model explicitly supports them.

For initial Pakistan rollout, payment methods may include approved local gateways and/or COD depending on final product decisions.

Live payment credentials must never be used in local tests.

---

# 17. Shipping

Shipping must be abstracted from order logic.

Support:

- shipping address;
- provider;
- tracking number;
- shipment state;
- shipment timestamps.

Do not promise real-time tracking unless the selected courier integration provides it.

---

# 18. Internal Messaging

Messaging is a critical marketplace-protection feature.

Users should communicate through Thriftage rather than exchanging direct contact details.

## 18.1 Privacy rules

Do not display:

- phone numbers;
- private email addresses;
- WhatsApp links;
- private contact details.

## 18.2 Messaging features

Baseline:

- buyer/seller conversation;
- text messages;
- conversation list;
- unread count;
- timestamps;
- message status as required.

A conversation should normally be tied to a marketplace context such as a listing and/or transaction.

## 18.3 Contact-information detection

Detect and flag likely:

- phone numbers;
- email addresses;
- WhatsApp links;
- social handles where reasonably possible.

Detection is moderation assistance, not a guarantee.

Do not silently claim perfect detection.

Store moderation events separately from raw conversational business logic.

## 18.4 Flagged conversations

Authorized admins can review flagged content according to product policy.

Admin reads of private communications should be:

- role restricted;
- auditable;
- purpose limited.

---

# 19. Ratings and Reviews

After an eligible completed transaction:

Buyer may:

- rate seller from 1 to 5 stars;
- leave a review.

Seller may:

- rate buyer from 1 to 5 stars;
- leave permitted feedback if product policy allows.

Rules:

- only participants in an eligible transaction may review;
- only after the required transaction state;
- no duplicate review for the same reviewer/transaction/role;
- reviews must be attributable internally;
- moderation may hide abusive reviews without corrupting rating history.

Display:

- average rating;
- review count;
- review history.

Use database constraints to prevent duplicate reviews.

---

# 20. Notifications

Users may receive notifications for:

- new follower;
- new message;
- item sold;
- item purchased;
- order status change;
- listing moderation result;
- review received where appropriate.

Design notifications as domain events.

Channels may include:

- in-app;
- push;
- email;
- SMS where explicitly needed.

Users should eventually have notification preferences.

Do not send duplicate notifications for retried events.

---

# 21. Seller Verification

Seller verification is an explicit trust subsystem.

Initial verification status:

```text
UNVERIFIED
PENDING
VERIFIED
REJECTED
SUSPENDED
```

Do not conflate identity verification with rating.

Verification flows must be configurable because requirements may differ by country.

Sensitive verification documents must:

- be private;
- use restrictive access controls;
- have documented retention/deletion rules;
- never be exposed through ordinary user APIs.

Do not collect identity documents until the business has approved exactly what is required and why.

---

# 22. Moderation and Safety

Users should be able to report relevant:

- listings;
- users;
- messages;
- reviews.

Moderation cases should have:

- reporter;
- target type;
- target id;
- reason;
- optional detail;
- evidence references where applicable;
- status;
- assigned admin;
- resolution;
- timestamps.

Recommended status:

```text
OPEN
UNDER_REVIEW
ACTIONED
DISMISSED
```

Admin actions must be logged.

Avoid hard-deleting records needed for dispute resolution or audit unless retention policy requires deletion.

---

# 23. Disputes

Dispute architecture should support:

- order reference;
- buyer;
- seller;
- reason;
- description;
- evidence;
- status;
- admin notes;
- resolution.

Exact financial remedies depend on the final payment model.

Do not invent refund/escrow behavior before payment rules are approved.

---

# 24. Style Profile — Phase 2

The style-profile system improves discovery and recommendations.

Do not block core marketplace launch on advanced AI.

## 24.1 Style quiz

Possible style choices include:

- Streetwear;
- Old Money;
- Vintage;
- Gothic;
- Y2K;
- Minimalist;
- Formal;
- Smart Casual;
- Athleisure;
- Techwear.

Lifestyle options include:

- Student;
- Professional;
- Entrepreneur;
- Creative;
- Athlete.

Personality inputs may include:

- Outgoing;
- Reserved;
- Creative;
- Ambitious;
- Experimental;
- Classic.

Fashion priorities may include:

- Comfort;
- Price;
- Aesthetics;
- Sustainability;
- Exclusivity.

## 24.2 Optional physical profile

Possible optional values:

- height;
- weight;
- body type;
- skin tone;
- preferred fit.

Preferred fit examples:

- Oversized;
- Relaxed;
- Regular;
- Slim;
- Tailored.

These values can be sensitive.

Collect only when clearly useful.

Explain why they improve recommendations.

Never use them for harmful or discriminatory ranking.

## 24.3 Style output

Generate structured outputs such as:

- primary style;
- secondary style;
- recommended colors;
- recommended categories;
- preferred fit recommendations.

Prefer structured stored attributes over storing only a free-text AI paragraph.

---

# 25. Personalized Discovery — Phase 2

Personalization may consider:

- style preferences;
- size compatibility;
- fit preference;
- color preference;
- user activity;
- saved items;
- followed users;
- purchase history;
- listing interactions.

Recommendations must only show eligible marketplace inventory.

Do not recommend removed, rejected, sold, or otherwise unavailable inventory.

---

# 26. Style Match Score — Phase 2

Products may display a style match score, such as:

```text
85% Match
```

The score must be generated from a documented scoring system.

Do not fabricate arbitrary percentages solely for UI effect.

The scoring system should be explainable enough to answer:

- what signals contributed;
- what signals were unavailable;
- why one item ranked above another.

Keep match scoring versioned so algorithms can evolve.

---

# 27. AI / Recommendation Rules

Advanced AI is a later layer, not a dependency of core commerce.

AI systems must:

- consume structured product and user data;
- never invent purchasable products that are not in inventory;
- respect listing eligibility;
- return structured machine-readable output where possible;
- fail gracefully;
- not block browsing if the AI provider is unavailable;
- avoid exposing private user data unnecessarily;
- have token/cost controls;
- be observable.

Use deterministic/rule-based fallbacks where practical.

Do not train custom models during MVP without a demonstrated need.

---

# 28. Admin Dashboard

Admin capabilities include:

- manage users;
- manage listings;
- manage categories;
- review listing approvals;
- view orders;
- review disputes;
- review flagged messages;
- verify sellers;
- inspect reports;
- view revenue metrics;
- view marketplace metrics.

Admin UI must have role-aware permissions.

Sensitive actions should require confirmation.

Record audit entries for material changes.

---

# 29. Analytics

Instrument important marketplace events from the beginning.

Examples:

```text
user_registered
profile_completed
listing_draft_created
listing_submitted
listing_approved
listing_rejected
listing_viewed
item_liked
item_saved
seller_followed
message_sent
checkout_started
order_created
order_confirmed
order_shipped
order_delivered
order_completed
order_cancelled
review_submitted
report_submitted
style_quiz_started
style_quiz_completed
```

Do not log secrets, message bodies, passwords, or highly sensitive data into analytics.

Key product metrics should eventually include:

- registrations;
- profile completion;
- listings created;
- listing approval rate;
- active sellers;
- active buyers;
- listing-to-sale conversion;
- GMV;
- completed orders;
- cancellation rate;
- repeat purchase rate;
- save rate;
- message-to-order conversion;
- retention;
- dispute rate.

---

# 30. Database Rules

## 30.1 IDs

Use UUIDs unless a specific service requires another public identifier.

Do not expose sequential database IDs as a security boundary.

## 30.2 Timestamps

Use timezone-aware timestamps.

Store canonical timestamps in UTC.

## 30.3 Money

Never use floating-point numbers for money.

Use integer minor units where practical, e.g.:

```text
PKR 1,500.00 -> 150000 minor units
```

or a precise decimal type when the currency model requires it.

Always store currency with monetary values.

## 30.4 Constraints

Prefer database-enforced invariants for:

- uniqueness;
- foreign-key integrity;
- one review per eligible transaction/role;
- one follow relationship per pair;
- one save per user/listing;
- one like per user/listing.

## 30.5 Soft deletion

Use soft deletion/status deactivation where auditability is important.

Do not make soft deletion the default for every table without reason.

## 30.6 Migrations

Every schema change requires a migration.

Never manually mutate shared production schemas.

Review destructive migrations carefully.

---

# 31. API Rules

## 31.1 Versioning

Use a consistent API prefix, for example:

```text
/api/v1
```

## 31.2 Validation

Validate all external inputs at the API boundary.

Reject unknown or invalid enum values.

Do not trust client-calculated:

- prices;
- ratings;
- ownership;
- status;
- commissions;
- totals.

## 31.3 Authorization

Every protected endpoint must explicitly validate permissions.

Prefer policy/guard-based authorization over scattered ad hoc checks.

## 31.4 Pagination

List endpoints must support pagination.

Avoid unbounded database queries.

## 31.5 Errors

Return stable error codes/messages suitable for client handling.

Do not leak:

- stack traces;
- SQL details;
- internal paths;
- provider secrets.

---

# 32. Mobile Application UX Requirements

Every network-dependent screen should handle:

- loading;
- success;
- empty;
- recoverable error;
- offline/degraded state where appropriate.

Forms should provide:

- inline validation;
- clear error copy;
- disabled/reasonable submitting state;
- protection against accidental duplicate submission.

Accessibility:

- semantic labels;
- readable contrast;
- touch-friendly targets;
- dynamic text resilience where practical.

Performance:

- optimize image loading;
- paginate feeds;
- avoid rendering huge lists;
- avoid unnecessary global state;
- avoid blocking the UI on optional analytics/AI.

---

# 33. Security Baseline

Apply:

- least privilege;
- secure headers where applicable;
- request validation;
- rate limiting on abuse-sensitive endpoints;
- authorization on every protected resource;
- secure password/auth provider practices;
- secret management;
- dependency review;
- upload restrictions;
- database constraints;
- audit logging for sensitive admin activity.

Threats explicitly relevant to Thriftage include:

- account takeover;
- spam;
- fake listings;
- counterfeit/scam behavior;
- off-platform transaction attempts;
- abusive messaging;
- listing-image abuse;
- duplicate purchases;
- price manipulation;
- unauthorized order-status changes;
- rating manipulation;
- admin privilege abuse.

Security fixes take precedence over cosmetic work.

---

# 34. Privacy

Collect only data needed for product functionality.

Separate:

- public profile data;
- private account data;
- transactional data;
- sensitive verification data;
- personalization data.

Users must eventually be able to:

- request account deletion;
- manage relevant profile information;
- understand how personalization data is used.

Do not expose private phone/email values through public DTOs.

Avoid putting PII in logs.

---

# 35. Testing Strategy

Tests are required where they provide meaningful protection.

## 35.1 Unit tests

Prioritize:

- state machines;
- pricing/totals;
- authorization policies;
- moderation detection;
- recommendation scoring;
- validation helpers.

## 35.2 Integration tests

Prioritize:

- auth boundaries;
- listing creation;
- listing approval;
- search filters;
- follows/saves/likes uniqueness;
- order creation;
- concurrent purchase protection;
- reviews;
- message flagging;
- admin permissions.

## 35.3 End-to-end tests

Critical journeys:

### Buyer
1. register;
2. browse;
3. view listing;
4. save/message;
5. purchase;
6. view order;
7. complete transaction;
8. review seller.

### Seller
1. register;
2. create profile;
3. create listing;
4. upload images;
5. submit;
6. receive approval;
7. receive order;
8. update permitted order state;
9. receive review.

### Admin
1. sign in;
2. review listing;
3. approve/reject;
4. review flagged message;
5. suspend eligible user;
6. inspect dispute.

Do not make tests depend on live third-party production services.

---

# 36. Quality Gates

Before claiming a task complete, run all applicable checks.

Baseline commands should eventually include:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For database changes:

```bash
pnpm prisma format
pnpm prisma validate
```

For mobile changes, run relevant Expo/React Native checks.

For API changes, run affected integration tests.

For UI changes, verify the actual rendered screen when tooling permits.

If a command cannot run, explicitly state why.

Never say "all tests pass" without having run them.

---

# 37. Coding Standards

## TypeScript

- strict mode;
- avoid `any`;
- prefer narrow domain types;
- use discriminated unions for stateful domain behavior when useful;
- keep functions focused;
- avoid giant service classes.

## Naming

Names should describe domain meaning.

Prefer:

```text
createListing
reserveListingForOrder
approveListing
flagMessageForContactSharing
```

Avoid:

```text
handleThing
processData
doAction
utils2
```

## Comments

Comments explain:

- why;
- invariant;
- trade-off;
- non-obvious safety behavior.

Do not narrate obvious syntax.

## Files

Avoid files becoming dumping grounds.

Split modules when responsibilities diverge.

Do not create abstractions with only theoretical future value.

---

# 38. Observability

Production services should support:

- structured logging;
- error monitoring;
- request correlation where practical;
- health checks;
- operational metrics.

Never log passwords, tokens, secret headers, verification documents, or raw private message content unnecessarily.

---

# 39. Feature Flags

Use feature flags/configuration for risky or staged capabilities, including:

- style quiz;
- match scores;
- AI recommendations;
- seller verification variants;
- new payment providers;
- experimental feed ranking;
- invitation-only beta behavior.

Do not permanently fork business logic when a configuration can express the rollout safely.

---

# 40. Implementation Phases

Build in this order unless the approved implementation plan changes it.

## Phase 0 — Repository and Engineering Foundation

Deliver:

- monorepo;
- TypeScript configuration;
- linting;
- formatting;
- test infrastructure;
- environment templates;
- mobile shell;
- admin shell;
- API shell;
- database package;
- CI;
- basic logging/error infrastructure;
- documentation structure.

Do not begin feature sprawl before foundations work.

## Phase 1 — Identity and Profiles

Deliver:

- registration;
- login;
- reset flow;
- profile create/edit;
- public profile;
- privacy-safe DTOs.

## Phase 2 — Listings and Media

Deliver:

- categories;
- listing drafts;
- image uploads;
- listing validation;
- listing submission;
- listing moderation;
- listing detail;
- seller listing management.

## Phase 3 — Search, Feed, and Social Graph

Deliver:

- browse feed;
- search;
- filters;
- sorting;
- likes;
- saves;
- follows;
- pagination.

## Phase 4 — Messaging and Trust

Deliver:

- conversations;
- messages;
- contact-information detection;
- moderation flags;
- reports;
- seller verification foundation;
- admin moderation tools.

## Phase 5 — Orders and Commerce

Deliver:

- Buy Now flow as product-approved;
- order creation;
- order state machine;
- transaction integrity;
- payment adapter;
- shipping model;
- buyer order history;
- seller order management;
- admin order view.

## Phase 6 — Reviews and Notifications

Deliver:

- buyer/seller transaction reviews;
- rating aggregates;
- in-app notifications;
- push notification integration where approved;
- event-driven notification architecture.

## Phase 7 — Production Hardening

Deliver:

- end-to-end tests;
- authorization audit;
- security review;
- rate limiting;
- performance review;
- database indexes;
- backup/recovery plan;
- monitoring;
- analytics;
- privacy/account deletion requirements;
- production environment documentation;
- release candidates.

## Phase 8 — Style Profile and Personalized Discovery

Deliver:

- style quiz;
- structured style profile;
- size/fit/color preference storage;
- deterministic personalization;
- style match scoring;
- personalized feed ranking;
- explainable match output.

## Phase 9 — AI Enhancement

Only after sufficient marketplace/catalog data exists:

- AI stylist;
- natural-language fashion intent;
- AI-assisted outfit recommendations;
- richer recommendation explanations;
- experimentation framework.

Do not let Phase 9 block production of the core marketplace.

---

# 41. Definition of Done

A feature is done only if:

- requirements are satisfied;
- code follows repository conventions;
- authorization is correct;
- validation exists;
- error states exist;
- tests cover important logic;
- migrations are included if needed;
- generated types/schema are updated;
- lint passes;
- typecheck passes;
- relevant tests pass;
- no secrets are committed;
- relevant docs are updated;
- no unrelated changes are bundled in.

---

# 42. Pull Request / Change Summary Format

When finishing work, provide:

## Summary
What changed and why.

## User-visible behavior
What the user/admin can now do.

## Technical changes
Important architecture/schema/API decisions.

## Database changes
Migrations, new constraints, indexes.

## Security / privacy impact
Any relevant changes.

## Tests
Commands run and results.

## Known limitations
Anything intentionally deferred.

## Files changed
Short grouped summary, not a raw enormous list unless requested.

---

# 43. Stop Conditions

Stop and surface the issue instead of guessing when a task requires an unresolved decision involving:

- commission or profit-share calculations;
- marketplace fee policy;
- refund policy;
- escrow;
- payout timing;
- seller identity/KYC requirements;
- legal retention requirements;
- payment-provider choice;
- shipping liability;
- prohibited-item policy;
- live production secrets;
- destructive data migration;
- production deployment.

These are product/business/legal decisions, not coding assumptions.

---

# 44. Explicitly Out of Scope Until Approved

Do not implement these merely because they are plausible future features:

- auctions;
- bidding;
- livestream commerce;
- crypto payments;
- NFT ownership;
- complex wallet balances;
- automatic escrow;
- international tax calculation;
- multi-currency settlement;
- cross-border seller payouts;
- virtual try-on;
- image-based body measurement;
- custom-trained ML models;
- community challenges;
- influencer revenue sharing;
- paid listing boosts;
- subscriptions;
- advertising marketplace.

Architectural seams may support future expansion, but do not pre-build unused systems.

---

# 45. First Development Milestone

The first milestone is **engineering foundation only**.

Codex should initially:

1. create the pnpm monorepo;
2. create `apps/mobile`;
3. create `apps/admin`;
4. create `apps/api`;
5. create `packages/db`;
6. create `packages/shared`;
7. configure TypeScript;
8. configure linting/formatting;
9. configure testing;
10. add environment templates;
11. configure Prisma/PostgreSQL package;
12. establish CI;
13. add health endpoints/basic app shells;
14. document local setup;
15. run lint, typecheck, tests, and builds.

Do **not** implement payments, AI, messaging, or complex marketplace workflows in the first milestone.

The foundation should be clean enough that subsequent Codex tasks can add one vertical feature slice at a time without rewriting the repository.

---

# 46. Final Principle

Thriftage must be built as a real marketplace, not a prototype disguised as production software.

Prefer:

- explicit states over magic strings;
- database constraints over assumptions;
- server authorization over UI trust;
- modular services over tangled logic;
- testable workflows over clever shortcuts;
- measured iteration over speculative complexity;
- user trust over growth hacks;
- production correctness over demo-only speed.
