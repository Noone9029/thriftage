# External Closed-Beta Prerequisites

This is the authoritative human checklist for work that cannot be completed from the current engineering environment. It contains client decisions, account-owner actions, credentials, physical hardware, paid configuration, legal approval, and authorized content only. It does not authorize public production release.

## Highest-priority release actions

| What                          | Why                                                                                                     | Who must provide it                                       | Exact action                                                                                                                                                                          | Can invited beta proceed without it?                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Release decision owner        | A human must accept residual risk and own stop/go decisions                                             | Client organization                                       | Assign a Release Owner; review and sign the dated go/no-go evidence                                                                                                                   | No                                                                                                   |
| Legal and support values      | Testers need enforceable terms, privacy disclosure, rules, and support                                  | Legal + Product/Support                                   | Supply and approve every missing value in the legal matrix below; configure the runtime URLs                                                                                          | No                                                                                                   |
| Transactional email           | Registration confirmation and password reset are core authentication journeys                           | Account owner + Engineering operator                      | Select/configure SMTP or approved Supabase email delivery, domain, templates, limits, alerts, then run synthetic registration/reset drills                                            | No, unless the owner explicitly narrows scope to pre-provisioned accounts and records that exception |
| Crash/error monitoring        | Engineering lacks real crash-free sessions and alert delivery                                           | Sentry account owner + Technical On-call                  | Create staging API/admin/mobile projects, provide DSNs/auth token securely, configure alerts, upload source maps, and verify a redacted deliberate event                              | No                                                                                                   |
| Restorable backup             | Current staging has no proven recovery point and PITR is disabled                                       | Supabase billing owner + Database/Backup Owner + reviewer | Purchase/confirm an eligible plan, enable daily backups or PITR, confirm a visible recovery point, restore database and Storage manifest into an isolated project, and record RPO/RTO | No                                                                                                   |
| Authorized starter inventory  | Existing listings are synthetic fixtures, not beta merchandise                                          | Product/Content Owner                                     | Provide the minimum licensed/owned catalog described below using the CSV template                                                                                                     | No                                                                                                   |
| Named operating roles         | Incidents, moderation, support, backups, and billing need accountable humans                            | Client organization                                       | Assign each role in the operations matrix and confirm access/escalation paths                                                                                                         | No                                                                                                   |
| Pakistan-origin load evidence | Singapore regional targets pass, but launch-region behavior is unmeasured with representative inventory | Release Owner + Technical On-call                         | Run the guarded 30-worker/3-minute read scenario from an approved Pakistan-origin generator after starter content and monitoring are present                                          | No for the Pakistan-first mixed cohort                                                               |
| Physical Android evidence     | Emulator QA is not hardware QA                                                                          | Android tester + Release Owner                            | Install the exact preview package on a supported phone and record cold start, auth, picker/upload, messaging, COD, back/keyboard/deep-link, and permission behavior                   | No for the final Android gate                                                                        |
| iOS build and device evidence | No iOS artifact or TestFlight/device proof exists                                                       | Apple account owner + iOS tester                          | Provide Apple Developer/App Store Connect access, signing, EAS iOS credentials, build the preview, distribute through TestFlight, and run the critical path on an iPhone              | No for an iOS cohort; an explicitly Android-only engineering cohort may proceed without it           |

## Legal and public configuration matrix

`CURRENT VALUE` reflects deployed staging. Missing values must not be invented.

| Item                              | Required?                  | Current value                                                                           | Owner                         | Status                                       |
| --------------------------------- | -------------------------- | --------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------- |
| Privacy Policy                    | Yes                        | Not configured                                                                          | Legal                         | BLOCKED                                      |
| Terms of Use                      | Yes                        | Not configured                                                                          | Legal                         | BLOCKED                                      |
| Community Guidelines              | Yes                        | Not configured                                                                          | Trust/Safety + Legal          | BLOCKED                                      |
| Support email                     | Yes                        | Not configured                                                                          | Support Owner                 | BLOCKED                                      |
| Support URL                       | Yes                        | Not configured                                                                          | Support Owner                 | BLOCKED                                      |
| Retention Policy                  | Yes                        | Not approved                                                                            | Legal + Database/Backup Owner | BLOCKED                                      |
| Account deletion public URL       | Yes                        | `https://thriftage-admin-6hwrrcub6-ahmad-khalid-s-projects.vercel.app/account-deletion` | Product + Legal               | PRESENT; content/ownership approval required |
| Company/legal entity display name | Yes                        | Not provided                                                                            | Client/Legal                  | BLOCKED                                      |
| Store copyright/ownership         | Yes for store distribution | Not provided                                                                            | Client/Legal                  | BLOCKED                                      |
| Moderation contact                | Yes                        | Not provided                                                                            | Trust/Safety Owner            | BLOCKED                                      |

Account deletion is implemented and has passed one real disposable-identity drill, but the staging flag is currently off. After retention/support approval, the Release Owner must authorize enabling it for testers and recheck the public instructions; do not repeat destructive proof against a real tester.

## Provider handoff and first-beta classification

| Provider    | Purpose and current project/status                                             | Access or credentials still required                            | Exact remaining action                                                                                 | First invited beta classification                   | Can remain disabled?                                                             |
| ----------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | -------------------------------------------------------------------------------- |
| Supabase    | Required Auth/Postgres/Storage/Realtime; project `dstnxzljsbyusxoogkzr` active | Billing/backup ownership, DPA/access review                     | Clear backup action above; approve retention, region, roles, and disclosures                           | REQUIRED                                            | No                                                                               |
| Railway     | Required staging API/workers; project `thriftage-staging` active               | Named owner/on-call and billing/log-retention access            | Confirm owner, alert recipient, access roles, billing, DPA, and log retention                          | REQUIRED                                            | No                                                                               |
| Vercel      | Admin preview and public deletion page active                                  | Named owner and final public configuration                      | Confirm access/billing/DPA and configure approved links/contact values                                 | REQUIRED for current admin/operations surface       | No                                                                               |
| Expo/EAS    | Android build/update project `@noone9029s-team/thriftage` active               | Expo owner and durable distribution ownership                   | Renew/replace artifact before 2026-09-04, keep preview channel controlled, distribute the verified APK | REQUIRED for Android beta                           | No                                                                               |
| SMTP        | Not configured                                                                 | Provider/domain credentials and approved templates              | Configure confirmation/recovery delivery, limits, alerts, and run both drills                          | REQUIRED for normal registration/recovery           | No for normal beta; only a signed pre-provisioned-account exception can defer it |
| Sentry      | SDKs present; projects/DSNs/source-map token absent                            | Sentry account/project access and alert recipients              | Complete monitoring action above                                                                       | REQUIRED                                            | No                                                                               |
| Twilio      | Phone auth disabled; no live OTP transfer                                      | Twilio owner, test numbers, credentials, geo/Fraud Guard/limits | Configure and run approved-number send/verify/failure drills before enabling                           | MAY REMAIN DISABLED                                 | Yes; email auth remains authoritative. Live phone verification remains BLOCKED   |
| OpenAI      | AI Stylist disabled; deterministic discovery active                            | Provider approval, key, data-boundary approval, budget          | Run bounded live eval/failure drill only before enabling                                               | MAY REMAIN DISABLED                                 | Yes                                                                              |
| Google Play | No Play testing track or owner evidence                                        | Play Console owner, signing, declarations, tester cohort        | Complete accurate checklist and upload an AAB only when Play distribution is chosen                    | MAY REMAIN DISABLED for sideloaded engineering beta | Yes; required for Play closed testing/public release                             |
| Apple       | No iOS credentials, artifact, or TestFlight proof                              | Apple Developer/App Store Connect owner, signing, device        | Complete iOS action above                                                                              | REQUIRED only for iOS cohort                        | Yes for an explicitly Android-only cohort                                        |

Expo Push/APNs/FCM remains disabled and live verification is **BLOCKED** on credentials/devices. In-app notifications are authoritative, so push may remain disabled for the first invited beta if testers are told not to expect background alerts. If push is enabled, Apple/Google credentials, disclosure, failure-path testing, and physical-device proof become required.

## Operational role assignments

| Role                   | Responsibility                                                          | Assignment |
| ---------------------- | ----------------------------------------------------------------------- | ---------- |
| Release Owner          | Signs go/no-go, controls cohort, feature flags, pause/rollback          | UNASSIGNED |
| Technical On-call      | Responds to API/mobile/worker incidents and owns escalation             | UNASSIGNED |
| Moderation Owner       | Reviews reports, messages, reviews, disputes, and seller cases          | UNASSIGNED |
| Support Owner          | Receives tester issues and publishes support contact/response target    | UNASSIGNED |
| Security Escalation    | Owns P0 security triage, evidence preservation, and disclosure          | UNASSIGNED |
| Database/Backup Owner  | Owns backups, restore drills, migrations, RPO/RTO                       | UNASSIGNED |
| Backup Drill Reviewer  | Independently verifies restore evidence and cleanup                     | UNASSIGNED |
| Provider Billing Owner | Owns Supabase/Railway/Vercel/Expo/Sentry/Twilio/OpenAI spend and access | UNASSIGNED |
| Content Owner          | Verifies listing ownership/licensing and takedown contact               | UNASSIGNED |
| Legal/Privacy Owner    | Approves policies, retention, provider terms, and store declarations    | UNASSIGNED |

## Starter-content handoff

Provide at least **30 approved live beta listings** before the representative load run and tester invitations:

- 10 Clothing, 10 Shoes, and 10 Accessories listings;
- at least 3 owned/licensed photos per listing, with 3–6 preferred and no scraped retailer imagery;
- all four supported conditions represented, with at least 5 listings per condition except where truthful inventory cannot support it;
- varied common sizes, including at least 5 distinct clothing sizes and 5 distinct shoe sizes across appropriate size systems;
- at least three price bands: below PKR 1,500; PKR 1,500–3,499; and PKR 3,500+, with at least 6 listings in each;
- at least 6 approved style tags represented, with each used by at least 3 listings;
- complete title, description, category, condition, size, price, currency, seller, asset owner, permission reference, and takedown contact;
- moderation approval before the listing becomes visible.

Use `docs/release/starter-content-template.csv`. The template contains no products or assets; the Content Owner supplies and approves them.

## Store and account-owner information

Before TestFlight, Play testing, or public submission, the relevant owner must supply final app/store copy, approved icon/splash/screenshots, age/content-rating answers, Data Safety/App Privacy answers, UGC/AI declarations, export-compliance answers, reviewer account and instructions, target countries, support/legal URLs, company/copyright values, and confirmation of Google personal-account testing rules. Credentials belong only in the organization vault and store console.

## Remaining optional capability blockers

These do not block an explicitly scoped Android engineering beta while their flags remain off: Twilio phone auth, AI Stylist/OpenAI, Expo Push, seller verification, Google Play distribution, and iOS. Each becomes required before its capability or platform is promised. The client must explicitly approve the narrowed scope; engineering must not silently enable any of them.
