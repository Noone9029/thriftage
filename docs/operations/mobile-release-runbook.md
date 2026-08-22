# Mobile Release Runbook

## Stable identity and profiles

`apps/mobile/eas.json` defines `development`, `development-simulator`, `preview`, and `production`. Preview is internal distribution on the `preview` update channel; production uses the `production` channel and remote auto-incremented native versions. EAS environment names must contain the completed public variables from the matching example file plus secret `SENTRY_AUTH_TOKEN` for source-map upload.

Default identifiers are `com.thriftage.marketplace` for production and suffixed preview/development variants. The repository is linked to Expo project `@noone9029s-team/thriftage` (`8b3c5e61-0f52-4646-a29a-bf5b3dd86d91`), and the Android preview package is `com.thriftage.marketplace.preview`. Final production identifiers and ownership still require client approval; do not rename a distributed identifier without a reviewed migration plan.

`apps/mobile/assets/engineering-placeholder-icon.png` is deliberately wired as the iOS icon, Android adaptive foreground, and splash image so no Expo default can ship unnoticed. `extra.brandingStatus` reports `engineering-placeholder`. It is acceptable for engineering preview builds only. Replace it with approved, platform-tested client artwork before any store submission and update the status to `approved` in the same reviewed change.

`runtimeVersion` follows app version. Increment the app version for any native dependency/plugin/app-config change. A compatible JavaScript-only update may stay on the same runtime. Expo recommends separate channels and runtime compatibility; see [EAS Update](https://docs.expo.dev/build/updates/) and [eas.json profiles](https://docs.expo.dev/build/eas-json/).

## Preflight

1. Complete and validate the preview mobile environment. Ensure API/Supabase hosts are staging and `EXPO_PUBLIC_DEPLOYMENT_ENV=staging`.
2. Run `pnpm install --frozen-lockfile`, `pnpm mobile:doctor`, `pnpm --filter @thriftage/mobile typecheck`, and `pnpm --filter @thriftage/mobile build`.
3. Run `eas config --profile preview --platform android` and iOS; review identifiers, channel, runtime, public variables, and permissions. Do not paste output containing secrets into tickets.
4. Configure EAS project ownership, Android signing, Apple team/provisioning, APNs, FCM, and Sentry source-map credentials in the relevant account vault.

## Builds and updates

From `apps/mobile`:

```bash
eas build --profile development --platform android
eas build --profile preview --platform android
eas build --profile preview --platform ios
eas build --profile production --platform all
```

Production builds are for store-facilitated testing, not automatic public release. Record build URLs/IDs and SHA. For an OTA preview test, publish to `preview`, install the matching runtime, confirm update and symbolicated deliberate Sentry test, then test rollback. The verified runtime `0.1.0` preview update is group `150f9366-ca54-4e65-9cea-2582a854d303` (Android `01a02808-e96c-74d3-88f9-5e8c28691169`) at release `edf83509126fb8dbbdd2ac3a83e1c19f2b6f4223`; it is preview-only and does not authorize production promotion. `SENTRY_AUTH_TOKEN` is sensitive; the DSN is public but still environment-specific. Expo's Sentry guide describes automatic EAS Build source-map upload: [Using Sentry](https://docs.expo.dev/guides/using-sentry/).

## Device acceptance

Use at least one supported physical Android device and one physical iPhone when account/hardware access exists. Record model, OS, build ID, network, tester, and timestamp. Exercise cold start, signup/confirmation, phone, recovery, onboarding, listing/media, feed/search, messaging/reconnect/refetch, COD order, notifications, review/block/dispute, AI fallback/live mode as enabled, logout, and deletion. Android additionally covers back button, keyboard, picker, deep links, and background/foreground sessions.

Test small, typical, and large phones; light appearance is intentionally enforced. Validate VoiceOver/TalkBack labels, focus, dynamic text resilience, touch targets, permission denial, offline and recoverable errors. Web export is not native acceptance.

## Distribution blockers

The Expo project, EAS Android credentials, Android internal artifact, and preview OTA path are present. Approved final branding, Apple Developer/App Store Connect access, Play Console access, APNs/FCM configuration, an iOS artifact, TestFlight/Play tester tracks, durable tester distribution, and physical-device evidence remain external beta blockers. Final branding blocks store submission but does not block an explicitly identified engineering preview build.
