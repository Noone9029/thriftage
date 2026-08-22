# Beta Feedback Process

## Tester submission

Testers use **Profile → Beta feedback**, choose a category, describe expected versus actual behavior, and state whether they could continue. Reports must not contain passwords, OTPs, tokens, private message text, delivery addresses, dispute evidence, or private AI conversations. Screenshots are not uploaded by this flow.

The client sends only:

- category and tester-authored description;
- platform;
- current route without query parameters;
- application version and build number.

The strict API schema rejects unknown fields. The database record adds the submitting user ID, status, timestamps, and later reviewer/resolution metadata.

## Operations review

An authorized administrator opens **Feedback operations → General beta**, filters by status, and moves a report through `OPEN`, `UNDER_REVIEW`, then `ACTIONED` or `DISMISSED`. Closing requires a retained resolution. AI feedback is a separate queue and exposes safe generation metadata, not prompts, transcripts, or response payloads.

## Staging evidence

On 2026-08-22, installed Android preview build `0.1.0` (1) on `emulator-5554` submitted synthetic feedback ID `e6b9cea3-e23b-4a50-81cb-856aa11e1df2`. The API returned success and the admin queue returned the same `OPEN` record with platform `ANDROID`, route `/beta-feedback`, and app/build diagnostics. No excluded diagnostic field is accepted by the contract or stored by the feedback repository.

Escalate suspected P0/P1 reports immediately under the incident runbook. Do not copy secrets or private payloads into tickets while escalating.
