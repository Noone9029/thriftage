import type OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';

import { AI_STYLIST_SYSTEM_PROMPT } from './ai-stylist.constants';
import { AI_STYLIST_TOOL_DEFINITIONS } from './ai-stylist-tool-registry';
import type { AiProviderRequest, ComposedOutfitCandidate } from './ai-stylist.types';
import { OpenAiStylistAdapter } from './openai-stylist.adapter';

const outfit: ComposedOutfitCandidate = {
  currency: 'PKR',
  id: '00000000-0000-4000-8000-000000000010',
  items: [
    {
      colorFamily: 'BLACK',
      currency: 'PKR',
      fitType: 'REGULAR',
      garmentRole: 'TOP',
      id: '00000000-0000-4000-8000-000000000001',
      match: null,
      priceMinor: 200_000,
      sellerCompletedSales: 2,
      sellerId: '10000000-0000-4000-8000-000000000001',
      sellerVerified: true,
      sizeCompatibilityKey: 'M',
      sizeConfidence: 'MATCH',
      sizeSystem: 'LETTER',
      styleSlugs: ['minimalist'],
    },
  ],
  matchScore: 82,
  totalPriceMinor: 200_000,
  uncertainConstraints: [],
};

function request(overrides: Partial<AiProviderRequest> = {}): AiProviderRequest {
  return {
    conversationSummary: { occasion: 'UNIVERSITY' },
    initialCandidates: [outfit],
    intent: {
      anchorListingId: null,
      budgetMaxMinor: 800_000,
      budgetMinMinor: null,
      colors: ['BLACK'],
      currency: 'PKR',
      excludedColors: [],
      freeTextObjective: 'University outfit under 8k',
      lockedListingIds: [],
      modesty: null,
      occasion: 'UNIVERSITY',
      optionCount: 1,
      preferredFits: [],
      refinement: 'NONE',
      requestedGarmentRoles: [],
      requestedStyles: ['minimalist'],
      sizeConstraints: [],
    },
    maxOutputTokens: 1800,
    maxToolCalls: 6,
    model: 'gpt-5.6-terra',
    reasoningEffort: 'medium',
    safetyIdentifier: 'hashed-user',
    systemPrompt: AI_STYLIST_SYSTEM_PROMPT,
    timeoutMs: 20_000,
    tools: AI_STYLIST_TOOL_DEFINITIONS,
    userMessage: 'University outfit under 8k',
    ...overrides,
  };
}

const plan = {
  assistantMessage: 'A concise grounded option.',
  kind: 'OUTFITS' as const,
  quickRefinements: ['CHEAPER' as const],
  selections: [
    {
      candidateId: outfit.id,
      explanation: 'A cohesive university look.',
      title: 'Campus minimal',
    },
  ],
};

function response(output: unknown[], outputParsed: unknown, input = 100, cached = 20, result = 30) {
  return {
    model: 'gpt-5.6-terra-2026-08-01',
    output,
    output_parsed: outputParsed,
    usage: {
      input_tokens: input,
      input_tokens_details: { cache_write_tokens: 0, cached_tokens: cached },
      output_tokens: result,
      output_tokens_details: { reasoning_tokens: 5 },
      total_tokens: input + result,
    },
  };
}

describe('OpenAiStylistAdapter', () => {
  it('uses stateless Responses API structured output with strict bounded tools', async () => {
    const parse = vi.fn().mockResolvedValue(response([], plan));
    const client = { responses: { parse } } as unknown as OpenAI;
    const result = await new OpenAiStylistAdapter('test-key-not-real', client).generate(
      request(),
      vi.fn(),
    );

    expect(result.plan).toEqual(plan);
    expect(result.usage).toEqual({ cachedInputTokens: 20, inputTokens: 100, outputTokens: 30 });
    const [body, options] = parse.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(body).toMatchObject({
      max_output_tokens: 1800,
      model: 'gpt-5.6-terra',
      parallel_tool_calls: false,
      prompt_cache_key: 'thriftage-stylist-v1-tools-v1',
      reasoning: { effort: 'medium' },
      safety_identifier: 'hashed-user',
      store: false,
      tool_choice: 'auto',
    });
    expect(body).not.toHaveProperty('conversation');
    expect(body).not.toHaveProperty('previous_response_id');
    expect(body.tools).toEqual(
      expect.arrayContaining([expect.objectContaining({ strict: true, type: 'function' })]),
    );
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('executes function calls, carries stateless items forward, and accumulates usage', async () => {
    const functionCall = {
      arguments: '{}',
      call_id: 'call_1',
      name: 'get_personalization_context',
      parsed_arguments: {},
      type: 'function_call',
    };
    const parse = vi
      .fn()
      .mockResolvedValueOnce(response([functionCall], null, 80, 10, 10))
      .mockResolvedValueOnce(response([], plan, 60, 5, 20));
    const execute = vi.fn().mockResolvedValue({ styles: ['minimalist'] });
    const client = { responses: { parse } } as unknown as OpenAI;

    const result = await new OpenAiStylistAdapter('test-key-not-real', client).generate(
      request(),
      execute,
    );

    expect(execute).toHaveBeenCalledWith('get_personalization_context', {});
    expect(result.toolCallCount).toBe(1);
    expect(result.usage).toEqual({ cachedInputTokens: 15, inputTokens: 140, outputTokens: 30 });
    const secondInput = (parse.mock.calls[1]?.[0] as { input: unknown[] }).input;
    expect(secondInput).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', type: 'message' }),
        expect.objectContaining({ call_id: 'call_1', type: 'function_call_output' }),
      ]),
    );
  });

  it('maps timeouts, invalid output, and excessive tool loops to stable domain errors', async () => {
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    const timeoutClient = {
      responses: { parse: vi.fn().mockRejectedValue(timeout) },
    } as unknown as OpenAI;
    await expect(
      new OpenAiStylistAdapter('test-key-not-real', timeoutClient).generate(request(), vi.fn()),
    ).rejects.toMatchObject({ code: 'AI_PROVIDER_TIMEOUT' });

    const invalidClient = {
      responses: { parse: vi.fn().mockResolvedValue(response([], null)) },
    } as unknown as OpenAI;
    await expect(
      new OpenAiStylistAdapter('test-key-not-real', invalidClient).generate(request(), vi.fn()),
    ).rejects.toMatchObject({ code: 'AI_RESPONSE_INVALID' });

    const loopClient = {
      responses: {
        parse: vi.fn().mockResolvedValue(
          response(
            [
              {
                arguments: '{}',
                call_id: 'call_2',
                name: 'get_personalization_context',
                parsed_arguments: {},
                type: 'function_call',
              },
            ],
            null,
          ),
        ),
      },
    } as unknown as OpenAI;
    await expect(
      new OpenAiStylistAdapter('test-key-not-real', loopClient).generate(
        request({ maxToolCalls: 0 }),
        vi.fn(),
      ),
    ).rejects.toMatchObject({ code: 'AI_TOOL_LIMIT_EXCEEDED' });
  });

  it('never sends seller UGC or private account fields in candidate context', async () => {
    const parse = vi.fn().mockResolvedValue(response([], plan));
    const client = { responses: { parse } } as unknown as OpenAI;
    await new OpenAiStylistAdapter('test-key-not-real', client).generate(request(), vi.fn());
    const body = parse.mock.calls[0]?.[0] as { input: { content: string }[] };
    const serialized = body.input[0]?.content ?? '';
    expect(serialized).not.toMatch(/seller@example|phone|address|dispute|IGNORE THE SYSTEM/i);
    expect(serialized).not.toContain('sellerId');
  });

  it('handles missing usage metadata without breaking the grounded response', async () => {
    const completeResponse = response([], plan);
    const withoutUsage = {
      model: completeResponse.model,
      output: completeResponse.output,
      output_parsed: completeResponse.output_parsed,
    };
    const client = {
      responses: { parse: vi.fn().mockResolvedValue(withoutUsage) },
    } as unknown as OpenAI;

    const result = await new OpenAiStylistAdapter('test-key-not-real', client).generate(
      request(),
      vi.fn(),
    );

    expect(result.usage).toEqual({ cachedInputTokens: 0, inputTokens: 0, outputTokens: 0 });
  });

  it('preserves billed usage when a later tool-call turn fails', async () => {
    const functionCall = {
      arguments: '{}',
      call_id: 'call_cost',
      name: 'get_personalization_context',
      parsed_arguments: {},
      type: 'function_call',
    };
    const client = {
      responses: {
        parse: vi
          .fn()
          .mockResolvedValueOnce(response([functionCall], null, 120, 40, 15))
          .mockRejectedValueOnce(new Error('provider disconnected')),
      },
    } as unknown as OpenAI;

    await expect(
      new OpenAiStylistAdapter('test-key-not-real', client).generate(
        request(),
        vi.fn().mockResolvedValue({ styles: [] }),
      ),
    ).rejects.toMatchObject({
      code: 'AI_PROVIDER_UNAVAILABLE',
      operations: {
        toolCallCount: 1,
        usage: { cachedInputTokens: 40, inputTokens: 120, outputTokens: 15 },
      },
    });
  });
});
