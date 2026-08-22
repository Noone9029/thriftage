# Closed-Beta Tester Checklist

Use only the assigned staging account and authorized test content. Record PASS, FAIL, or BLOCKED plus device/OS/build and a short reproduction note. Do not test destructive admin actions.

## Authentication

- [ ] Register when the coordinator confirms registration is enabled; verify confirmation behavior.
- [ ] Sign in with email and restore the session after a cold start.
- [ ] Request and complete password reset when staging email delivery is enabled.
- [ ] Confirm phone sign-in is not shown while phone authentication is disabled.

## Profile

- [ ] Complete onboarding and edit public-safe profile fields.
- [ ] Add or replace a profile image; deny photo permission once and recover.
- [ ] Complete the Style Profile and verify **For you** remains usable.

## Marketplace

- [ ] Browse New, Trending, and For you; refresh and paginate where available.
- [ ] Search and exercise category, size, price, condition, and sort controls.
- [ ] Open a listing and verify photos, seller, price, size, condition, and availability.
- [ ] Create a listing draft, add 3–10 authorized images, submit it, and wait for moderator approval.

## Social and messaging

- [ ] Save/unsave a listing and follow/unfollow a seller.
- [ ] Send a normal marketplace message and verify reconnect/refetch behavior.
- [ ] Try a clearly synthetic contact-sharing message and confirm it is blocked; do not use real private details.

## Commerce

- [ ] Place a synthetic Cash on Delivery order using coordinator-approved data.
- [ ] As seller, confirm and mark it shipped with synthetic tracking.
- [ ] As buyer, confirm delivery; verify automatic completion and COD collection.
- [ ] Submit one factual transaction review and confirm duplicate review is unavailable.

## AI and safety

- [ ] If AI Stylist is enabled, verify grounded inventory-only results and the report control.
- [ ] If AI is disabled, confirm normal discovery and deterministic personalization still work and no Stylist entry is offered.
- [ ] Report a synthetic listing/user issue and verify the acknowledgement.
- [ ] Block/unblock the assigned synthetic user and verify messaging restrictions.

## Feedback and finish

- [ ] Submit one issue through **Profile → Beta feedback** without passwords, OTPs, tokens, private messages, addresses, evidence, or private AI conversations.
- [ ] Check in-app notifications for exercised events. Live push is not part of the test while disabled.
- [ ] Sign out and sign back in. Use the coordinator’s update/uninstall instructions when finished.
