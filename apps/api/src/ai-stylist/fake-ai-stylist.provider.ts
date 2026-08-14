import { AiStylistDomainError } from './ai-stylist.errors';
import type {
  AiProviderRequest,
  AiProviderResult,
  AiStylistProvider,
  AiToolExecutor,
  ProviderStylistPlan,
} from './ai-stylist.types';

export class FakeAiStylistProvider implements AiStylistProvider {
  public readonly requests: AiProviderRequest[] = [];

  public constructor(
    private readonly fixture?: ProviderStylistPlan,
    private readonly failure?: ConstructorParameters<typeof AiStylistDomainError>[0],
    private readonly toolCalls: readonly { readonly input: unknown; readonly name: string }[] = [],
  ) {}

  public async generate(
    request: AiProviderRequest,
    executeTool: AiToolExecutor,
  ): Promise<AiProviderResult> {
    this.requests.push(request);
    if (this.failure !== undefined) throw new AiStylistDomainError(this.failure);
    for (const call of this.toolCalls) await executeTool(call.name, call.input);
    const first = request.initialCandidates[0];
    const plan: ProviderStylistPlan = this.fixture ?? {
      assistantMessage:
        first === undefined
          ? 'I could not find a complete eligible outfit for those constraints.'
          : 'Here is a grounded outfit built from current Thriftage inventory.',
      kind: first === undefined ? 'NO_MATCH' : 'OUTFITS',
      quickRefinements: first === undefined ? [] : ['CHEAPER', 'DIFFERENT_SHOES', 'ANOTHER_OPTION'],
      selections:
        first === undefined
          ? []
          : [
              {
                candidateId: first.id,
                explanation: 'The pieces form a cohesive, practical look.',
                title: 'Your Thriftage look',
              },
            ],
    };
    return {
      latencyMs: 5,
      plan,
      returnedModel: request.model,
      toolCallCount: this.toolCalls.length,
      usage: { cachedInputTokens: 0, inputTokens: 120, outputTokens: 60 },
    };
  }
}

export class UnavailableAiStylistProvider implements AiStylistProvider {
  public async generate(): Promise<never> {
    throw new AiStylistDomainError('AI_PROVIDER_UNAVAILABLE');
  }
}
