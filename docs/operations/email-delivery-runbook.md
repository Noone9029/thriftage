# Auth Email Delivery Runbook

Supabase custom SMTP is mandatory for staging/production; do not rely on the default development sender. The business owner must select the provider, verify the sending domain, provide a monitored sender/support identity, and store credentials in the Supabase project secret configuration—not source control or Expo variables.

## Configuration

1. Configure sender name `Thriftage`, verified sender address/domain, SMTP host/port/user/password, and conservative initial limits in each separate Supabase project.
2. Set the exact Site URL and allowlisted mobile callback URLs. Templates use `{{ .ConfirmationURL }}` for Supabase's single-use action and `{{ .SiteURL }}/support` as the public fallback/help path.
3. Disable provider click/link tracking or rewriting for Auth links; rewritten single-use links can invalidate verification.
4. Load `supabase/email-templates/confirmation.html` and `recovery.html`, replacing no variables with secrets.
5. Configure SPF, DKIM, and DMARC according to the selected provider; keep provider credentials in the organization vault.

## Staging QA

Use controlled inboxes on major providers. Verify signup confirmation and password recovery from request to mobile deep link; expired/reused link behavior; fallback web/help link; sender branding; plain-text accessibility; dark-mode readability; delivery latency; spam placement; generic account-enumeration-safe UI; and logout/session refresh after password change. Record message ID and timings, not full addresses or action URLs.

Production activation requires domain/provider ownership, approved support contact, legal-reviewed footer, tested rate/abuse alerts, and separate production credentials. Rotate credentials by creating a new secret, updating one environment, sending a canary, revoking the old credential, and recording the event.
