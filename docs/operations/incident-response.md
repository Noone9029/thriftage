# Incident Response

Severity: **P0** auth takeover, private-data exposure, corruption, or uncontrolled financial/safety impact; **P1** checkout/critical journey unavailable, significant provider failure, or deletion failure without safe recovery; **P2** feature failure with workaround; **P3** minor/cosmetic.

1. **Detect and own:** record timestamp, environment, release/build, reporter, safe correlation IDs, scope, and incident commander. Never paste tokens, private messages, addresses, evidence, or raw prompts.
2. **Contain:** disable affected feature/registration, stop rollout, revoke compromised keys, or remove traffic. Preserve audit evidence. Do not delete records during diagnosis.
3. **Assess:** determine user/data/provider impact, whether notification is legally required, and whether P0/P1 blocks the beta. Escalate privacy/legal questions to approved counsel.
4. **Recover:** deploy a reviewed fix or prior compatible artifact; restore only through the backup runbook. Verify health, readiness, critical journey, workers, and security boundaries.
5. **Communicate:** use the approved support/status channel. Do not speculate or expose another user. Store-facing communications require owner approval.
6. **Learn:** complete a blameless timeline, root cause, detection gap, remediation owner/due date, and regression test. Rotate all potentially exposed credentials and document completion privately.

Provider outage drills: Storage upload failure must leave no committed media reference; Realtime loss must recover by API refetch; Twilio failure must not alter verified identity; OpenAI failure must use deterministic fallback; push failure must not roll back transactions; database outage must return controlled 503/readiness failure and recover after connectivity returns.

For suspected secret exposure: remove public access, revoke/rotate with the provider, update secret stores, restart affected services, inspect usage/audit logs, run `pnpm security:secrets`, and invalidate artifacts containing the secret. Git history rewriting requires explicit incident-owner approval.
