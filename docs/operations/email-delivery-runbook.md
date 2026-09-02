# Auth Email Delivery Runbook

Supabase custom SMTP through an organization-owned Resend account is mandatory for staging/production; do not rely on the Supabase default sender. Verify an authenticated Thriftage subdomain, provide a monitored sender/support identity, and store Resend SMTP credentials in each isolated Supabase project's secret configuration—not source control or Expo variables.

## Configuration

1. Create separate Resend API/SMTP credentials for staging and production. Configure sender name `Thriftage`, a verified `auth` subdomain sender, SMTP host/port/user/password, and conservative initial limits in each separate Supabase project.
2. Set the exact Site URL and allowlisted mobile callback URLs. Templates use `{{ .ConfirmationURL }}` for Supabase's single-use action and `{{ .SiteURL }}/support` as the public fallback/help path.
3. Disable provider click/link tracking or rewriting for Auth links; rewritten single-use links can invalidate verification.
4. Load `supabase/email-templates/confirmation.html` and `recovery.html`, replacing no variables with secrets.
5. Publish and verify Resend's SPF and DKIM records, configure DMARC for the organizational domain, and keep provider credentials in the organization vault.

## Staging QA

Use controlled inboxes on major providers. Verify signup confirmation and password recovery from request to mobile deep link; expired/reused link behavior; fallback web/help link; sender branding; plain-text accessibility; dark-mode readability; delivery latency; spam placement; generic account-enumeration-safe UI; and logout/session refresh after password change. Record message ID and timings, not full addresses or action URLs.

Production activation requires domain/provider ownership, approved support contact, legal-reviewed footer, tested rate/abuse alerts, and separate production credentials. Rotate credentials by creating a new secret, updating one environment, sending a canary, revoking the old credential, and recording the event.
