# Store Submission Checklist

This is an owner checklist, not authorization to submit publicly. Closed/internal testing is the maximum scope of the current readiness goal. Values marked **CLIENT REQUIRED** must not be invented.

## Apple / TestFlight

- [ ] Final app name, subtitle, description, keywords, primary/secondary category — **CLIENT REQUIRED**
- [ ] Final icon, splash, screenshots for required iPhone sizes, and optional preview video — **CLIENT REQUIRED**
- [ ] Stable bundle ID, Expo project owner/ID, signing team, version/build number approved
- [ ] Support URL/contact, Privacy Policy URL, Terms, Community Guidelines, external deletion URL — **CLIENT/LEGAL REQUIRED**
- [ ] Age-rating answers reflect UGC, marketplace, messaging, and AI content
- [ ] App Privacy answers reconciled to `docs/privacy/data-inventory.md` and deployed SDK/provider behavior
- [ ] UGC review notes explain policy acceptance, report, block, moderation, and developer contact paths
- [ ] Account-deletion review notes identify Profile -> Delete account and the public web resource
- [ ] Export compliance/encryption answers reviewed by the account owner/legal counsel
- [ ] Controlled staging reviewer account created out of band; credentials entered only in App Store Connect
- [ ] Reviewer can exercise buyer/seller/AI flows without production admin access
- [ ] Internal TestFlight build uploaded, processed, installed, and critical path recorded
- [ ] External TestFlight group/beta review details prepared only if external testing is approved

## Google Play

- [ ] Final app name, short/full descriptions, category, feature graphic, icon, phone screenshots — **CLIENT REQUIRED**
- [ ] Stable application ID, Play App Signing, versionCode/versionName, target SDK verified
- [ ] Privacy Policy and external account-deletion URL publicly reachable without login
- [ ] Data Safety answers reconciled to the engineering inventory and every active provider
- [ ] Content-rating, target-audience, ads, UGC, messaging, commerce/COD, and AI declarations accurate
- [ ] AI response Helpful/Not Helpful/Report pathway and moderation queue verified
- [ ] App-access reviewer account stored only in Play Console; instructions cover gated flows
- [ ] Target countries limited to approved beta distribution; no worldwide/public availability
- [ ] AAB uploaded to Internal testing, tester install/auth/deep-link/push verified
- [ ] Closed-testing track and cohort prepared
- [ ] Account owner confirms whether personal-account tester-count/duration production-access rules apply based on account creation/type

## Reviewer account procedure

Create a dedicated verified staging user with synthetic profile/listing data and no admin role. Store credentials in the organization vault and provider console only. Seed or approve a separate synthetic seller listing so checkout and messaging work. Reset credentials after review. Never commit credentials, disable normal authorization, expose private production data, or give reviewers internal admin access.

Final branding assets are not supplied in this repository. `apps/mobile/assets/engineering-placeholder-icon.png` and its splash/adaptive-icon uses are explicitly marked through `extra.brandingStatus=engineering-placeholder`; they must be treated as engineering placeholders and are a store-submission blocker, not an engineering closed-beta blocker.

## Policy sources reviewed

Engineering reviewed the current official sources on 2026-08-16: Apple's [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [account-deletion requirements](https://developer.apple.com/support/offering-account-deletion-in-your-app/), and [TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/); Google's [user-generated content policy](https://support.google.com/googleplay/android-developer/answer/9876937), [account-deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111), [AI-generated content policy](https://support.google.com/googleplay/android-developer/answer/14151465), and [data-use declaration guidance](https://developer.android.com/privacy-and-security/declare-data-use). Recheck these sources at submission because policies and account-specific console requirements can change.
