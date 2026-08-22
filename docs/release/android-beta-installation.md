# Android Closed-Beta Installation

This package is an internal staging preview. It is not a production or Play Store release.

## Verified package

| Field               | Value                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| EAS build           | `dc462b59-c9f5-4088-a38f-1a4612596e94`                                                                                                                |
| Build page          | `https://expo.dev/accounts/noone9029s-team/projects/thriftage/builds/dc462b59-c9f5-4088-a38f-1a4612596e94`                                            |
| Package             | `com.thriftage.marketplace.preview`                                                                                                                   |
| Version             | `0.1.0` (`versionCode` 1)                                                                                                                             |
| Runtime             | `0.1.0`, preview channel                                                                                                                              |
| APK SHA-256         | `b0227e5d9a2b35884a55795179c7940e2440ea79e46d6aaa30a264d24694e591`                                                                                    |
| APK size            | 120,295,959 bytes                                                                                                                                     |
| Current Android OTA | group `9255dbe7-9487-4c05-bb3c-287e4f1fbea2`, update `01a02aff-28c2-79a8-b60f-da678bf85199`, mobile commit `da6246e4a9587d466df8f58ff74bd3684cc27754` |
| Staging API         | `https://api-staging-4101.up.railway.app/api/v1`, release `f7fac85344697e73fd843b0bad7b393fb1a4678d`                                                  |

The downloaded APK passed Android v2 signature verification. The upload fix is a compatible JavaScript update on runtime `0.1.0`; the later API serialization fix is server-side, so a new native build is not required. The EAS artifact is scheduled to expire on **2026-09-04**. The Expo owner must renew or replace the distribution artifact before then.

## Install

1. Open the build page supplied by the beta coordinator and download the preview APK.
2. Compare its SHA-256 with the value above. Do not install if it differs.
3. If Android asks, allow this browser or file manager to install unknown apps. Do not enable the permission globally.
4. Open the APK and choose **Install**, then open **Thriftage Preview**.
5. Keep internet access available for the preview update. Relaunch once if requested.
6. In **Profile → About & diagnostics**, confirm environment `staging`, app `0.1.0` / build `1`, and API release `f7fac85344697e73fd843b0bad7b393fb1a4678d`.
7. Sign in with credentials assigned separately, or register only when registration is explicitly enabled.
8. Submit issues through **Profile → Beta feedback**.

## Update or uninstall

Compatible preview updates apply when the app starts. Fully close and reopen the app to activate an update. For a new native build, download the replacement APK and install it over the existing preview package. Uninstall through **Settings → Apps → Thriftage Preview → Uninstall**. Uninstalling clears local app data but does not delete the server account; use the documented account-deletion path when enabled.

Never place tester passwords, OTPs, or access tokens in this repository or an issue report.
