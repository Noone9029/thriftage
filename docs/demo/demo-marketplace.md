# Synthetic Demo Marketplace

This dataset makes Thriftage staging useful for product demonstrations and visual QA. It is synthetic content only: it is not authorized beta inventory, and it does not satisfy launch inventory gates.

## Scale and coverage

The manifest defines 12 fictional seller personas and 75 listings: 60 `ACTIVE`, 8 `SOLD`, 2 `DRAFT`, 2 `PENDING_REVIEW`, 1 `REJECTED`, and 2 `ARCHIVED`. Inventory covers Clothing, Shoes, and Accessories; all ten approved styles; PKR pricing; alpha, EU shoe, and one-size sizing; every condition; and every stylist garment role.

Fifteen seller/lifecycle contact sheets in `apps/api/demo-assets/source/` were created with OpenAI image generation for this staging dataset. The seed pipeline derives three listing-specific WebP variants per listing and uploads them through the controlled listing-media adapter. Rights/source records are in `docs/demo/demo-image-manifest.csv` after seeding. Seller avatars are deterministic synthetic monograms.

The inventory spans PKR 950–20,500, all four listing conditions, `XS`–`XL` alpha sizing, EU shoe sizing, and one-size accessories. Seller audiences are backed by Follow rows and vary from 7 to 24 followers; no follower, rating, sale, or listing counters are written directly.

## Operator commands

The commands fail closed unless the target is explicitly local or staging, the confirmation phrase matches, and the Supabase project identity is verified. Supply credentials through the existing secret manager; never place them in the repository.

```powershell
$env:DEPLOYMENT_ENV = 'staging'
$env:ALLOW_DEMO_MARKETPLACE_SEED = 'THRIFTAGE_SYNTHETIC_STAGING_ONLY'
$env:DEMO_SUPABASE_PROJECT_REF = '<approved-staging-project-ref>'
pnpm seed:demo
pnpm seed:demo:report
pnpm seed:demo:verify
```

`pnpm seed:demo` is idempotent: deterministic IDs, composite constraints, schema-conforming deterministic storage keys, and upserts prevent duplication. Run it twice and compare `seed:demo:report` output. `pnpm seed:demo:reset` is an explicit destructive operator action restricted by the same guard. It deletes only reserved synthetic identities, deterministic relationships, and the exact media-object manifest owned by those records. It never creates, changes, resets, or prints credentials for `thriftage_demo`.

## QA profiles and flows

The three deterministic ranking profiles are `neutralarchive` (Minimalist, neutral, relaxed, M, under PKR 8,000), `lahorelayers` (Streetwear/Techwear, dark, oversized, L, under PKR 10,000), and `sundaywardrobe` (Old Money/Smart Casual, beige/navy, tailored, M, under PKR 15,000). Verify that the real recommendation service produces different top results and match contributions for each.

For visual QA on Android, inspect Discover, Search and filters, listing detail galleries, seller profiles, Saved, Style Profile/For You, Messages, Orders, reviews, and the Stylist fallback. Capture evidence under `docs/demo/screenshots/` without passwords, tokens, private contact values, or secret-bearing browser chrome.

The current evidence set contains:

- `01-discover.png` and `02-for-you.png` — populated Discover photography and deterministic match badges;
- `03-search-hoodie.png` — populated search plus category, condition, style, color, fit, garment, size, price, and sorting controls;
- `04-listing-detail.png` and `05-seller-profile.png` — normal media delivery, price, match reasons, seller metrics, and active inventory;
- `06-saved.png` and `07-profile.png` — the preserved demo account's curated shortlist and profile shell;
- `08-messages.png` — a natural four-message marketplace thread with listing context;
- `09-reviews.png` — a completed-transaction-backed seller review;
- `10-style-profile.png` and `11-stylist.png` — structured style-profile output and inventory-grounded Stylist entry state.
