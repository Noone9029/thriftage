# Closed-Beta Go / No-Go

This is the authoritative release gate. `PASS` requires verified evidence; `FAIL` means a required artifact or behavior is defective; `BLOCKED` means required external access, configuration, or evidence is unavailable; `NOT APPLICABLE` requires a written reason. Any P0/P1, Security/Data `FAIL`, or required platform `BLOCKED` means **NO-GO**.

Current decision: **NO-GO — core staging is online and verified; native build/device, legal, monitoring, backup/restore, and beta-operations evidence remain blocked.**

Evidence snapshot (2026-08-20): Railway staging API `https://api-staging-4101.up.railway.app/api/v1` is healthy and ready at release `4360df98c16a9fe45eca027610d5683b57140d86`; the Vercel admin preview is online at `https://thriftage-admin-6hwrrcub6-ahmad-khalid-s-projects.vercel.app`; Supabase project `dstnxzljsbyusxoogkzr` is `ACTIVE_HEALTHY`; public smoke, the 15-check A/B/Admin authorization matrix, real Auth/Storage/Realtime drills, CORS, admin API checks, worker-log inspection, and Android emulator login/profile/feed checks pass. Repository gates are rerun before closing this snapshot. No public production deployment is authorized.

| Category     | Gate                                                                                | Status         | Evidence / owner action                                                                          |
| ------------ | ----------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------ |
| Security     | No committed/bundled secrets; strict deployed env validation                        | PASS           | Source/artifact scans and environment validators                                                 |
| Security     | Data API/RLS/Storage/Realtime policy applied and remote verifier clean              | PASS           | Remote TLS, roles, grants, buckets, and Realtime policy verifier passes                          |
| Security     | A/B/Admin authorization matrix on deployed staging                                  | PASS           | Guarded 15-check synthetic-fixture matrix passes against the public API                          |
| Security     | Dependency audit has no unresolved critical issue                                   | PASS           | Critical-level audit gate; compatible upstream fixes remain tracked for inherited advisories     |
| Security     | External penetration assessment                                                     | NOT APPLICABLE | Recommended before public launch; not a closed-beta entry gate                                   |
| Data         | All Prisma migrations current and integration suite passes                          | PASS           | 10 migrations; remote schema current; local isolated integration evidence                        |
| Data         | Backup/restore drill proves representative data and API readiness                   | BLOCKED        | Managed restore exercise and evidence required                                                   |
| Data         | Retention/anonymization policy approved                                             | BLOCKED        | Client/legal decision required                                                                   |
| Providers    | Supabase Auth/Postgres/Storage/Realtime exercised                                   | PASS           | Real staging login, Storage access controls, A/B delivery, C denial, and remote DB verifier pass |
| Providers    | Twilio PK geo, Fraud Guard, limits, alerts, approved-number OTP drill               | BLOCKED        | Twilio owner access and test numbers required; phone auth remains disabled                       |
| Providers    | OpenAI bounded live eval/failure drill or AI deliberately disabled                  | PASS           | `aiStylist=false`; deterministic non-AI paths remain available                                   |
| Providers    | Custom SMTP/domain/templates confirmation/recovery drill                            | BLOCKED        | Email provider/domain and approved templates required                                            |
| Providers    | Expo push APNs/FCM device and failure-path drill                                    | BLOCKED        | EAS/Apple/Google credentials and devices required; push remains disabled                         |
| Mobile       | Preview configuration cannot target production and diagnostics identify environment | PASS           | Strict staging config, EAS profiles, and About & diagnostics                                     |
| Mobile       | Icon, adaptive icon, splash, and display name explicitly configured                 | PASS           | Engineering placeholder is explicit; final brand assets remain a store-submission task           |
| Mobile       | Expo Go emulator uses public staging API and real Supabase                          | PASS           | Demo login -> authenticated Discover -> profile -> marketplace feed passes on `emulator-5554`    |
| Mobile       | Installable Android preview artifact produced                                       | BLOCKED        | Expo account authentication and existing EAS project ID are unavailable                          |
| Mobile       | Android critical path passes on a physical device                                   | BLOCKED        | No physical Android device is connected; emulator evidence is not substituted                    |
| Mobile       | iOS TestFlight/archive and real-device critical path                                | BLOCKED        | Apple Developer/App Store Connect/macOS/device required                                          |
| Mobile       | Small/typical/large screen, accessibility, keyboard/back/deep-link QA               | BLOCKED        | Full native device-matrix evidence required                                                      |
| Backend      | Health/readiness, redacted logs, worker backlog visibility, runtime flags           | PASS           | Public endpoints pass; current deployment logs show startup and no worker failures               |
| Backend      | Public staging smoke and authenticated probe                                        | PASS           | Guarded smoke passes against the exact HTTPS host and release SHA                                |
| Backend      | Controlled database-outage recovery                                                 | BLOCKED        | Requires an approved isolated staging outage window                                              |
| Admin        | Existing Vercel preview, login/API authorization, and strict CORS                   | PASS           | Page 200; eight ADMIN endpoints 200; normal users 403; unauthorized origin receives no ACAO      |
| Store Policy | UGC acceptance/report/block/moderation and AI report pathways                       | PASS           | App/API/admin implementation and automated tests                                                 |
| Store Policy | Apple/Play metadata, reviewer account, declarations completed accurately            | BLOCKED        | Client-owned copy/assets/accounts/answers required                                               |
| Privacy      | In-app asynchronous deletion and public unauthenticated page implemented            | PASS           | Integration test plus `/account-deletion` route                                                  |
| Privacy      | Deletion exercised through real Auth and Storage                                    | BLOCKED        | Destructive provider drill requires an approved disposable staging identity                      |
| Privacy      | Data inventory reconciled to deployed providers/SDKs                                | BLOCKED        | Legal/client/provider review required                                                            |
| Legal        | Approved Privacy/Terms/Community Guidelines/support contact URLs                    | BLOCKED        | Client/legal values not provided; links remain null in staging runtime config                    |
| Operations   | Incident, deployment, rollback, backup, provider, release, beta runbooks            | PASS           | Repository documentation updated with actual staging inventory                                   |
| Operations   | Named on-call/provider/backup/retention owners and access confirmed                 | BLOCKED        | Client organization assignments required                                                         |
| Testing      | Repository install/format/lint/typecheck/unit/DB/build/Expo gates                   | PASS           | Current closeout verification recorded in the completion report                                  |
| Testing      | Staging load targets measured with no severe query regression                       | BLOCKED        | Agreed load window, limits, and representative fixtures required                                 |
| Testing      | Zero known P0/P1                                                                    | BLOCKED        | Issue tracker/release-triage evidence and named decision owner unavailable                       |
| Beta Content | Licensed/owned starter listings and synthetic seed approved                         | BLOCKED        | Product/content owner inventory required; existing fixtures are test-only                        |
| Monitoring   | Sentry projects, alerts, source maps, deliberate staging event verified             | BLOCKED        | Sentry project/access required                                                                   |
| Monitoring   | Twilio spend/fraud and worker/API alert routes tested                               | BLOCKED        | Provider/alerting access and recipients required                                                 |

Totals: **17 PASS / 20 BLOCKED / 0 FAIL / 1 NOT APPLICABLE** (38 gates).

Decision owner must sign and date the release evidence outside source control. This file does not authorize invited onboarding, public launch, or production deployment.
