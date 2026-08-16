# Twilio Verify Runbook

Use separate Verify Services and API keys for staging and production. Prefer a Restricted API Key that can create/read Verification and Verification Check resources for only the selected service; never use the Account Auth Token in the application runtime. Twilio recommends API keys and supports fine-grained Restricted keys: [API keys](https://www.twilio.com/docs/iam/api-keys) and [Restricted API keys](https://www.twilio.com/docs/iam/api-keys/restricted-api-keys).

## Configuration

1. Create the Verify Service, Restricted API Key, and secret in the Twilio Console. Store the secret once in the environment vault.
2. Enable Fraud Guard. Configure Pakistan (`PK`, `+92`) SMS to **Monitor all traffic for blocking fraud** during closed beta; disable countries not intentionally supported. Changes take effect immediately. See [Fraud Guard](https://www.twilio.com/docs/verify/preventing-toll-fraud/sms-fraud-guard) and [Geo Permissions](https://www.twilio.com/docs/verify/preventing-toll-fraud/verify-geo-permissions).
3. Keep application limits: five starts/hour/user, 60-second resend cooldown, five sends/attempt, five checks/attempt, and ten-minute attempt TTL. Add Twilio Service Rate Limits for phone/IP or approved privacy-preserving keys; 429/60203 must map to the stable rate-limit response. See [Verify Service Rate Limits](https://www.twilio.com/docs/verify/api/programmable-rate-limits).
4. Configure usage/fraud alerts and daily spend thresholds. Review Verify Logs without exporting full phone numbers into ordinary app logs.

## Staging acceptance

Use approved Twilio test/safe-listed numbers where supported and a minimal number of real Pakistan devices. Test send, correct code, incorrect code, expiry, resend cooldown, maximum checks/sends, provider 429, Fraud Guard block, unsupported destination, and provider outage. Record Twilio error code, HTTP status, expected app code, timestamp, and redacted destination. Never bulk-send or spam real numbers.

If Twilio is unavailable, core browsing remains available; phone verification/login fails with a stable recoverable provider error. Operations may set `PHONE_AUTH_ENABLED=false` only after the corresponding API/mobile enforcement has been verified. No real Twilio account or staging send has been exercised from this repository.
