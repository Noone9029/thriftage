# Environment Reference

Use independent secret stores for local, EAS `preview`, staging runtime, EAS `production`, and production runtime. Validate a completed file with `pnpm config:validate:api -- <file>` or `pnpm config:validate:mobile -- <file>`. Example files deliberately contain blockers and must not pass unchanged.

## Current staging inventory

| Component               | Verified staging value                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| API base                | `https://api-staging-4101.up.railway.app/api/v1`                                           |
| API environment/release | `staging` / `c5e2f889c9363c5a9541e49fbf2ffff0b205a7b6`                                     |
| API compute / DB region | Railway Singapore / Supabase `ap-south-1`                                                  |
| Admin preview           | `https://thriftage-admin-6hwrrcub6-ahmad-khalid-s-projects.vercel.app`                     |
| Account deletion page   | `https://thriftage-admin-6hwrrcub6-ahmad-khalid-s-projects.vercel.app/account-deletion`    |
| Supabase project        | `dstnxzljsbyusxoogkzr` (`ap-south-1`, staging only)                                        |
| Allowed browser origin  | Exact admin preview URL above                                                              |
| Expo project            | `@noone9029s-team/thriftage` / `8b3c5e61-0f52-4646-a29a-bf5b3dd86d91`                      |
| Android preview build   | `dc462b59-c9f5-4088-a38f-1a4612596e94` from `aa036173e30db306e7770394688ff0b01c6cb1a5`     |
| Mobile preview OTA      | Group `150f9366-ca54-4e65-9cea-2582a854d303` at `edf83509126fb8dbbdd2ac3a83e1c19f2b6f4223` |
| Mobile preview target   | Public staging API and staging Supabase; never localhost/LAN for an EAS preview            |

Current staging uses `DATABASE_POOL_MAX=15`, matching the verified Supabase session-pool client limit. Runtime flags disable registration, phone auth, seller verification, account deletion, AI Stylist, and push notifications. Account deletion was enabled only for the controlled 2026-08-21 disposable-identity drill and restored to `false` afterward. Its public unauthenticated Vercel page is configured as the backend `ACCOUNT_DELETION_URL` and is exposed through safe runtime config. Realtime broadcast is server-side operational even though it is not a public client feature flag. Privacy Policy, Terms, Community Guidelines, support links, and Sentry remain intentionally unconfigured blockers. The installed Android preview uses native build release `aa036173e30db306e7770394688ff0b01c6cb1a5` and preview OTA release `edf83509126fb8dbbdd2ac3a83e1c19f2b6f4223`; its diagnostics obtain the current API release from the runtime. Preview builds set `SENTRY_DISABLE_AUTO_UPLOAD=true` until Sentry credentials exist; production does not. Expo Go is development evidence only and is not interchangeable with the installed preview package.

## Identity and runtime

| Variable               | Classification         | Requirement                                                            |
| ---------------------- | ---------------------- | ---------------------------------------------------------------------- |
| `NODE_ENV`             | runtime                | `development`/`test` locally; `production` for staging and production. |
| `DEPLOYMENT_ENV`       | runtime                | Backend identity: `local`, `staging`, or `production`.                 |
| `RELEASE_VERSION`      | runtime                | Git SHA or immutable release; required non-local.                      |
| `API_HOST`, `API_PORT` | runtime                | Nest listen address and port.                                          |
| `CORS_ORIGINS`         | runtime/security       | Explicit comma-separated HTTPS admin origins non-local.                |
| `LOG_FORMAT`           | runtime                | `json` is mandatory non-local.                                         |
| `DATABASE_URL`         | backend secret/runtime | Pooled TLS URL for least-privilege login role `thriftage_api`.         |
| `DATABASE_POOL_MAX`    | runtime/performance    | Prisma client cap; must not exceed the provider pool's client limit.   |
| `TEST_DATABASE_URL`    | test secret            | Disposable integration-test database only.                             |

## Mobile and EAS

All values below are build-time and public in the app bundle; none may contain a secret.

| Variable                                                                                                                                                                | Purpose                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `EXPO_PUBLIC_DEPLOYMENT_ENV`, `EXPO_PUBLIC_RELEASE_VERSION`                                                                                                             | Safe diagnostics and anti-environment-confusion checks.            |
| `EXPO_PUBLIC_API_URL`                                                                                                                                                   | Versioned API base; HTTPS and non-local for deployed builds.       |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                                                                                                      | Public Auth/Realtime client configuration.                         |
| `EXPO_PUBLIC_APP_SCHEME`                                                                                                                                                | Stable auth/deep-link scheme.                                      |
| `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`                                                                                                       | Public mobile monitoring configuration.                            |
| `EXPO_PUBLIC_SUPPORT_URL`, `EXPO_PUBLIC_PRIVACY_POLICY_URL`, `EXPO_PUBLIC_TERMS_OF_USE_URL`, `EXPO_PUBLIC_COMMUNITY_GUIDELINES_URL`, `EXPO_PUBLIC_ACCOUNT_DELETION_URL` | Client-approved public resources.                                  |
| `THRIFTAGE_APP_VARIANT`                                                                                                                                                 | `development`, `preview`, or `production`; set by EAS profile.     |
| `THRIFTAGE_APP_VERSION`, `IOS_BUILD_NUMBER`, `ANDROID_VERSION_CODE`                                                                                                     | Product/native versions.                                           |
| `IOS_BUNDLE_IDENTIFIER`, `ANDROID_APPLICATION_ID`                                                                                                                       | Optional client-approved identifier overrides.                     |
| `EXPO_PROJECT_ID`                                                                                                                                                       | Expo project identity; required for EAS Update/build distribution. |

`SENTRY_AUTH_TOKEN`, Apple credentials, Google service-account JSON, signing keys, and EAS credentials are sensitive EAS/build secrets and must never use `EXPO_PUBLIC_`.

## Supabase, Twilio, and providers

| Variable                                                                                         | Classification          | Purpose                                                                                |
| ------------------------------------------------------------------------------------------------ | ----------------------- | -------------------------------------------------------------------------------------- |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`                                                       | provider/runtime        | Backend Auth validation and public-key metadata.                                       |
| `SUPABASE_SECRET_KEY`                                                                            | backend secret          | Server-only Auth admin, Storage, and Realtime REST operations.                         |
| `SUPABASE_MIGRATION_DATABASE_URL`                                                                | operator secret         | Admin/migration connection used only by security verification and deployment.          |
| `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_VERIFY_SERVICE_SID` | backend provider secret | Required only when `PHONE_AUTH_ENABLED=true`; omit them when the provider is disabled. |
| `OPENAI_API_KEY`                                                                                 | backend provider secret | Separate project key per environment. Required only when AI is enabled non-local.      |
| `EXPO_PUSH_ACCESS_TOKEN`                                                                         | backend provider secret | Required when push sending is enabled.                                                 |
| `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE`                                                        | runtime/observability   | Server event destination and sample rate.                                              |

## Feature and operational controls

`REGISTRATION_ENABLED`, `PHONE_AUTH_ENABLED`, `SELLER_VERIFICATION_ENABLED`, `ACCOUNT_DELETION_ENABLED`, `AI_STYLIST_ENABLED`, `EXPO_PUSH_ENABLED`, and `REALTIME_BROADCAST_ENABLED` are runtime feature/kill switches. The public `/api/v1/runtime-config` contract exposes only their safe client-facing state; server authorization remains authoritative. High-risk beta capabilities default off where safe. Supabase signup/phone provider controls must also be disabled in the provider dashboard during a provider-wide incident because clients can contact Supabase Auth directly.

AI limits: `AI_STYLIST_MODEL`, `AI_STYLIST_REASONING_EFFORT`, `AI_STYLIST_MAX_OUTPUT_TOKENS`, `AI_STYLIST_MAX_TOOL_CALLS`, `AI_STYLIST_TIMEOUT_MS`, `AI_STYLIST_DAILY_USER_LIMIT`, `AI_STYLIST_SESSION_TURN_LIMIT`, `AI_STYLIST_MAX_OUTFIT_OPTIONS`, `AI_STYLIST_MAX_REQUESTS_PER_MINUTE`, `AI_STYLIST_MAX_CONCURRENT_GENERATIONS`, `AI_STYLIST_MAX_INPUT_CHARACTERS`, `AI_STYLIST_DAILY_BUDGET_MICRO_USD`, and the three cost-rate variables. Live eval additionally requires `AI_STYLIST_LIVE_EVAL_ENABLED`, `AI_STYLIST_EVAL_MODELS`, and `AI_STYLIST_EVAL_REASONING_EFFORTS` in an intentional operator session.

Abuse/worker settings: `PHONE_VERIFICATION_*`, `CONVERSATION_MAX_STARTS_PER_DAY`, `MESSAGE_MAX_SENDS_PER_MINUTE`, `MESSAGE_MAX_BLOCKED_PER_HOUR`, `OUTBOX_BATCH_SIZE`, `OUTBOX_MAX_ATTEMPTS`, `OUTBOX_POLL_INTERVAL_MS`, and `PUSH_RECEIPT_DELAY_SECONDS`.

Storage/trust settings: `PROFILE_IMAGE_BUCKET`, `LISTING_IMAGE_BUCKET`, `LISTING_IMAGE_SIGNED_URL_TTL_SECONDS`, `DISPUTE_EVIDENCE_BUCKET`, `DISPUTE_EVIDENCE_SIGNED_URL_TTL_SECONDS`, `DISPUTE_EVIDENCE_RETENTION_DAYS`, `DISPUTE_WINDOW_HOURS`, `DISPUTE_SHIPPED_MIN_AGE_HOURS`, `SELLER_VERIFICATION_MIN_COMPLETED_SALES`, and `SELLER_VERIFICATION_REAPPLY_DAYS`. Retention remains unset until legal approval.

Backend public-resource variables are `SUPPORT_URL`, `PRIVACY_POLICY_URL`, `TERMS_OF_USE_URL`, `COMMUNITY_GUIDELINES_URL`, and `ACCOUNT_DELETION_URL`. Staging may omit unavailable public resources and Sentry while retaining explicit blockers; production requires all of them. Any configured URL must be non-placeholder HTTPS. SMTP host/user/password, sender identity, domain, and Auth templates are configured in Supabase—not consumed by application code.

The API container pins the public Supabase Root 2021 CA at `tooling/certificates/supabase-root-2021-ca.crt` and exposes it to Node through `NODE_EXTRA_CA_CERTS`. Keep `sslmode=verify-full` in hosted database URLs. Review and replace the pinned CA before its April 2031 expiry or sooner if Supabase announces a rotation.
