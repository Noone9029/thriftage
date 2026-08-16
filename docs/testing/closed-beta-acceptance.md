# Closed-Beta Acceptance Evidence

This is the definitive acceptance map for the release commit. CI proves deterministic domain behavior without paid providers; staging and physical-device evidence prove deployed integrations. Neither substitutes for the other.

## Automated repository evidence

| Journey slice                                                           | Automated evidence                                                                        |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Seller draft, 3–10 media boundary, submit, admin approval               | `marketplace.integration.test.ts` and image processor/storage adapter tests               |
| Buyer discovery, follow/save, private messaging, block/contact controls | marketplace, personalization, communication/commerce, and trust integration suites        |
| Atomic COD checkout, idempotency, seller transitions, worker completion | `commerce-communication.integration.test.ts`, state-machine and finalization-worker tests |
| Review, dispute, evidence authorization, policies, restrictions         | `trust-operations.integration.test.ts`                                                    |
| Style profile, personalized ranking, hidden inventory                   | `personalization.integration.test.ts` and recommendation tests                            |
| Grounded AI, ownership, failure fallback, limits                        | AI integration/unit/eval-validator tests; live provider remains a staging gate            |
| Account deletion, retry, anonymization, Auth/media cleanup              | account-deletion integration/service/worker tests                                         |
| Cross-account and admin boundaries                                      | integration suites plus `pnpm security:authorization:staging`                             |

Run `pnpm test`, migrate a fresh disposable database from zero, then run `pnpm test:db`. CI must not call Twilio, OpenAI, Expo push, SMTP, or remote Supabase.

## Deployed staging acceptance

Record release SHA, environment, request IDs, fixture IDs, tester, timestamp, and PASS/FAIL. First run `pnpm staging:smoke`, then `pnpm security:authorization:staging` with dedicated synthetic A/B/Admin fixtures. Complete the seller → admin → buyer → seller → buyer → worker → review journey from `docs/operations/closed-beta-runbook.md`. Use a separate completed order for the optional dispute path. Exercise real Auth, Storage, Realtime reconnect/refetch, Twilio, SMTP, push, and bounded OpenAI only when approved credentials exist; otherwise keep that feature disabled and record `BLOCKED`.

## Physical-device record

At minimum, install the actual preview artifact on a supported Android device and record model/OS/build ID. Repeat on iPhone when Apple access exists. Capture cold start, deep links, email/phone auth, photo permission denial/acceptance, keyboard/back behavior, background/reconnect, push, checkout, logout, and deletion. Test small, typical, and large layouts plus TalkBack/VoiceOver. Web export or simulator-only evidence cannot close this gate.

Any cross-account access, private-data leak, checkout corruption, authentication takeover, or repeated critical crash is P0/P1 and a no-go. Attach evidence outside source control; never attach tokens, OTPs, messages, addresses, evidence objects, or AI conversation contents.
