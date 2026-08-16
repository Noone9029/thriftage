import 'dotenv/config';

import { z } from 'zod';

import { AI_STYLIST_SYSTEM_PROMPT } from '../ai-stylist.constants';
import { composeOutfitCandidates } from '../outfit-composer';
import { OpenAiStylistAdapter } from '../openai-stylist.adapter';
import { STYLIST_EVAL_DATASET } from './eval-dataset';
import { validateEvalOutfit } from './eval-validators';

const environmentSchema = z.object({
  AI_STYLIST_CACHED_INPUT_COST_MICRO_USD_PER_MILLION: z.coerce.number().default(200_000),
  AI_STYLIST_EVAL_MODELS: z.string().default('gpt-5.6-terra'),
  AI_STYLIST_EVAL_REASONING_EFFORTS: z.string().default('medium'),
  AI_STYLIST_INPUT_COST_MICRO_USD_PER_MILLION: z.coerce.number().default(2_000_000),
  AI_STYLIST_LIVE_EVAL_ENABLED: z.literal('true'),
  AI_STYLIST_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(200).max(16_000).default(1800),
  AI_STYLIST_OUTPUT_COST_MICRO_USD_PER_MILLION: z.coerce.number().default(12_000_000),
  AI_STYLIST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(30_000),
  OPENAI_API_KEY: z.string().trim().min(16),
});

async function main(): Promise<void> {
  const environment = environmentSchema.parse(process.env);
  const models = environment.AI_STYLIST_EVAL_MODELS.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const efforts = environment.AI_STYLIST_EVAL_REASONING_EFFORTS.split(',')
    .map((value) => value.trim())
    .filter((value): value is 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' =>
      ['none', 'low', 'medium', 'high', 'xhigh', 'max'].includes(value),
    );
  const adapter = new OpenAiStylistAdapter(environment.OPENAI_API_KEY);
  const summaries: unknown[] = [];

  for (const model of models) {
    for (const reasoningEffort of efforts) {
      let groundedPasses = 0;
      let hardPasses = 0;
      let latencyMs = 0;
      let inputTokens = 0;
      let cachedInputTokens = 0;
      let outputTokens = 0;
      let toolCalls = 0;
      let explanationPasses = 0;
      let personalizationPasses = 0;
      let deterministicFallbackPasses = 0;
      let deterministicFallbackCases = 0;
      let evaluated = 0;
      for (const testCase of STYLIST_EVAL_DATASET) {
        const blocked = new Set(testCase.blockedSellerIds);
        const eligible = new Set(testCase.eligibleListingIds);
        const candidates = testCase.candidates.filter(
          ({ id, sellerId }) => eligible.has(id) && !blocked.has(sellerId),
        );
        const composed = composeOutfitCandidates(candidates, testCase.intent, { maxOptions: 3 });
        if (composed.length === 0) {
          deterministicFallbackCases += 1;
          if (!testCase.expectsCompleteOutfit) deterministicFallbackPasses += 1;
          continue;
        }
        const result = await adapter.generate(
          {
            conversationSummary: {},
            generationId: `live-eval-${evaluated + 1}`,
            initialCandidates: composed,
            intent: testCase.intent,
            maxOutputTokens: environment.AI_STYLIST_MAX_OUTPUT_TOKENS,
            maxToolCalls: 0,
            model,
            reasoningEffort,
            safetyIdentifier: 'thriftage-synthetic-live-eval',
            systemPrompt: AI_STYLIST_SYSTEM_PROMPT,
            timeoutMs: environment.AI_STYLIST_TIMEOUT_MS,
            tools: [],
            userMessage: testCase.prompt,
          },
          async () => {
            throw new Error(
              'Live eval exposes no tools; candidates are precomposed synthetic data.',
            );
          },
        );
        evaluated += 1;
        latencyMs += result.latencyMs;
        inputTokens += result.usage.inputTokens;
        cachedInputTokens += result.usage.cachedInputTokens;
        outputTokens += result.usage.outputTokens;
        toolCalls += result.toolCallCount;
        const selected = result.plan.selections
          .map(({ candidateId }) => composed.find(({ id }) => id === candidateId))
          .filter((candidate) => candidate !== undefined);
        if (selected.length === result.plan.selections.length) groundedPasses += 1;
        if (
          result.plan.assistantMessage.trim().length >= 20 &&
          result.plan.selections.every(
            ({ explanation }) =>
              explanation.trim().length >= 20 &&
              !/guaranteed authentic|definitely fits|hidden prompt|chain.of.thought/i.test(
                explanation,
              ),
          )
        )
          explanationPasses += 1;
        if (
          testCase.intent.requestedStyles.length === 0 ||
          selected.every((outfit) =>
            outfit.items.every(({ styleSlugs }) =>
              styleSlugs.some((style) => testCase.intent.requestedStyles.includes(style)),
            ),
          )
        )
          personalizationPasses += 1;
        if (
          selected.length > 0 &&
          selected.every(
            (outfit) =>
              validateEvalOutfit(outfit, {
                blockedSellerIds: blocked,
                eligibleListingIds: eligible,
                intent: testCase.intent,
                inventoryListingIds: new Set(testCase.candidates.map(({ id }) => id)),
              }).passed,
          )
        )
          hardPasses += 1;
      }
      const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
      const estimatedCostMicroUsd = Math.ceil(
        (uncachedInputTokens * environment.AI_STYLIST_INPUT_COST_MICRO_USD_PER_MILLION +
          cachedInputTokens * environment.AI_STYLIST_CACHED_INPUT_COST_MICRO_USD_PER_MILLION +
          outputTokens * environment.AI_STYLIST_OUTPUT_COST_MICRO_USD_PER_MILLION) /
          1_000_000,
      );
      summaries.push({
        averageLatencyMs: evaluated === 0 ? null : Math.round(latencyMs / evaluated),
        averageToolCalls: evaluated === 0 ? null : toolCalls / evaluated,
        cacheHitRate: inputTokens === 0 ? 0 : cachedInputTokens / inputTokens,
        cachedInputTokens,
        datasetCases: STYLIST_EVAL_DATASET.length,
        deterministicFallbackCases,
        deterministicFallbackPassRate:
          deterministicFallbackCases === 0
            ? 1
            : deterministicFallbackPasses / deterministicFallbackCases,
        estimatedCostMicroUsd,
        explanationQualityPassRate: evaluated === 0 ? 0 : explanationPasses / evaluated,
        groundedPassRate: evaluated === 0 ? 0 : groundedPasses / evaluated,
        hardInvariantPassRate: evaluated === 0 ? 0 : hardPasses / evaluated,
        inputTokens,
        model,
        overallHardPassRate:
          (hardPasses + deterministicFallbackPasses) / STYLIST_EVAL_DATASET.length,
        outputTokens,
        personalizationPassRate: evaluated === 0 ? 0 : personalizationPasses / evaluated,
        providerEvaluated: evaluated,
        reasoningEffort,
        toolCalls,
      });
    }
  }

  process.stdout.write(
    `${JSON.stringify({ evalVersion: 'thriftage-stylist-eval-v1', summaries }, null, 2)}\n`,
  );
  if (
    summaries.some(
      (summary) =>
        (summary as { groundedPassRate: number }).groundedPassRate < 1 ||
        (summary as { hardInvariantPassRate: number }).hardInvariantPassRate < 1 ||
        (summary as { overallHardPassRate: number }).overallHardPassRate < 1 ||
        (summary as { deterministicFallbackPassRate: number }).deterministicFallbackPassRate < 1 ||
        (summary as { explanationQualityPassRate: number }).explanationQualityPassRate < 0.9 ||
        (summary as { personalizationPassRate: number }).personalizationPassRate < 0.9,
    )
  )
    process.exitCode = 1;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown live evaluation failure.';
  process.stderr.write(`AI Stylist live evaluation failed: ${message}\n`);
  process.exitCode = 1;
});
