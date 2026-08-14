# AI Stylist Operations Runbook

## Operating posture

The Stylist is optional to core marketplace browsing and commerce. `AI_STYLIST_ENABLED=false` is the emergency kill switch; saved outfits and conversation history remain readable while new generation is disabled. The deterministic fallback is the first response to recoverable provider failures. Never weaken inventory, authorization, privacy, or final-validation rules to restore AI output.

Use aggregate admin metrics and structured server logs. Do not copy raw user prompts, transcript bodies, access tokens, or provider keys into tickets or dashboards.

## Initial triage

1. Confirm API health and database connectivity.
2. Check 24-hour generation status, provider error rate, fallback rate, average/p50/p95 latency, tool-call counts, token/cached-token totals, and estimated cost.
3. Identify the active model, reasoning effort, prompt version, tool schema version, and eval version.
4. Compare the incident start time with deployments or environment changes.
5. Reproduce with synthetic inventory and a non-production account; never use another user’s transcript.

## Cost spike

1. Activate the kill switch if the daily circuit breaker has not already done so and spend is continuing unexpectedly.
2. Check generation volume, repeated client request IDs, tool loops, output-token settings, cache-hit rate, and per-user/rate-limit distribution.
3. Confirm current provider billing and project limits outside Thriftage; application estimates are operational approximations.
4. Preserve aggregate generation IDs/model versions for investigation without exporting prompts.
5. Fix the cause, run local tests and the optional live eval, then re-enable gradually with a conservative daily budget.

## Provider outage or latency spike

1. Confirm the API and database are healthy independently.
2. Inspect timeout and provider-failure statuses. The user should receive grounded fallback outfits where inventory permits.
3. If abandoned calls or spend continue, disable the Stylist. Do not disable marketplace browsing.
4. Check provider status through an authorized operations channel.
5. Re-enable only after a synthetic request succeeds inside configured timeout and fallback metrics normalize.

## Invalid-response or grounding regression

1. Keep final validation enabled. It is the safety boundary.
2. Check prompt, tool schema, model, and reasoning versions for drift.
3. Run AI unit, tool, prompt-injection, security, and eval-validator tests.
4. Run the optional live eval only from an approved non-production project. Require 100% grounding and hard-invariant pass rates.
5. Roll back the model/prompt deployment or activate the kill switch if fabricated IDs, unsafe claims, or invalid-response volume persists.

## Prompt regression or model change

1. Change only configuration/versioned prompt code—never use an untracked “latest” model alias.
2. Run the deterministic suite first.
3. For an approved live comparison:

   ```powershell
   $env:AI_STYLIST_LIVE_EVAL_ENABLED = 'true'
   $env:AI_STYLIST_EVAL_MODELS = 'current-model,candidate-model'
   $env:AI_STYLIST_EVAL_REASONING_EFFORTS = 'medium'
   $env:OPENAI_API_KEY = '<backend-only-eval-project-key>'
   pnpm.cmd ai:eval
   ```

4. Compare invariants, explanation/personalization rates, latency, tokens, tool calls, cache rate, and estimated cost.
5. Record operator, old/new model or prompt version, eval artifact, deployment, and timestamp in the deployment audit system. Never record the key.

## Rate-limit exhaustion

1. Determine whether the limit is per-minute, daily user, session turn, concurrency, or cost ceiling.
2. Look for retry storms and confirm clients reuse the same request ID when reconciling a lost response.
3. Do not raise limits until abuse and cost impact are understood.
4. If a legitimate launch event requires adjustment, change environment configuration through the audited deployment path and monitor cost/error rates.

## Tool-loop errors

1. Confirm `AI_STYLIST_MAX_TOOL_CALLS` and tool schema version.
2. Inspect only tool names/counts and stable failure codes; avoid dumping personalized tool payloads.
3. Reproduce with synthetic arguments. Unknown tools and side-effect requests must remain rejected.
4. Roll back the prompt/model or disable generation if the model repeatedly loops.

## Fallback activation

A fallback spike is expected during provider trouble, not proof of unsafe output. Confirm that:

- every returned listing still passes final eligibility;
- fallback metadata and mobile labeling are present;
- budget, size, block, lock, and currency validators remain green;
- no-match is returned when no complete eligible outfit exists.

If fallback itself fails final validation, disable generation and treat it as an application incident.

## API-key compromise

1. Disable the Stylist and revoke the compromised key in the provider project immediately.
2. Review provider project usage, access audit, environment/deployment access, CI logs, and secret-scanning results.
3. Create a new least-privilege project key through the approved secret manager and deployment process.
4. Never paste the replacement key into source, chat, issue trackers, mobile/admin variables, or logs.
5. Redeploy, validate a synthetic request, restore spend alerts, and document the incident timeline and rotation.

## Eval failure

Do not promote a candidate model/prompt. Separate hard invariant failures from subjective quality failures. Any grounding, eligibility, budget, blocked-seller, size-mismatch, locked-item, or fabricated-ID failure is release-blocking. Investigate dataset and validator changes like production code; do not loosen validators merely to improve a score.

## Recovery checklist

- API health and database migration status are green.
- AI-specific tests, security tests, and eval validators pass.
- Synthetic generation or deterministic fallback returns only current eligible listings.
- Admin metrics show expected model/prompt/tool/eval versions.
- Provider errors, latency, rate limits, and estimated cost are within approved bounds.
- No secret appeared in source, client bundles, logs, or incident artifacts.
- Re-enablement is staged and monitored.
