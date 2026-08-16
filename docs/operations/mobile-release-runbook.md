# Mobile Release Runbook

## Stable identity and profiles

`apps/mobile/eas.json` defines `development`, `development-simulator`, `preview`, and `production`. Preview is internal distribution on the `preview` update channel; production uses the `production` channel and remote auto-incremented native versions. EAS environment names must contain the completed public variables from the matching example file plus secret `SENTRY_AUTH_TOKEN` for source-map upload.

Default identifiers are `com.thriftage.marketplace` for production and suffixed preview/development variants. The Expo project ID, final production identifiers, organization/owner, and URL scheme require client approval before the first distributed build. Do not rename them afterward.

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

Production builds are for store-facilitated testing, not automatic public release. Record build URLs/IDs and SHA. For an OTA preview test, publish to `preview`, install the matching runtime, confirm update and symbolicated deliberate Sentry test, then test rollback. `SENTRY_AUTH_TOKEN` is sensitive; the DSN is public but still environment-specific. Expo's Sentry guide describes automatic EAS Build source-map upload: [Using Sentry](https://docs.expo.dev/guides/using-sentry/).

## Device acceptance

Use at least one supported physical Android device and one physical iPhone when account/hardware access exists. Record model, OS, build ID, network, tester, and timestamp. Exercise cold start, signup/confirmation, phone, recovery, onboarding, listing/media, feed/search, messaging/reconnect/refetch, COD order, notifications, review/block/dispute, AI fallback/live mode as enabled, logout, and deletion. Android additionally covers back button, keyboard, picker, deep links, and background/foreground sessions.

Test small, typical, and large phones; light appearance is intentionally enforced. Validate VoiceOver/TalkBack labels, focus, dynamic text resilience, touch targets, permission denial, offline and recoverable errors. Web export is not native acceptance.

## Distribution blockers

No Expo project, EAS credentials, approved final branding, Apple Developer/App Store Connect access, Play Console access, APNs/FCM configuration, native artifacts, TestFlight group, Play track, or real-device evidence is currently present. These remain external beta blockers until verified. Final branding blocks store submission but does not block an explicitly identified engineering preview build.
