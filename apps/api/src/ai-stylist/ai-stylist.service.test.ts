import type { ListingDetail } from '@thriftage/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MarketplaceEventPublisher } from '../common/marketplace-event-publisher';
import type { AiStylistRepository } from './ai-stylist.repository';
import { AiStylistDomainError } from './ai-stylist.errors';
import { AiStylistService } from './ai-stylist.service';
import { AiStylistToolRegistry } from './ai-stylist-tool-registry';
import type {
  AiStylistProvider,
  ProviderStylistPlan,
  StylistInventoryCandidate,
  StylistPersonalizationContext,
} from './ai-stylist.types';
import { FakeAiStylistProvider } from './fake-ai-stylist.provider';
import type { StylistInventoryService } from './stylist-inventory.service';

const userId = '10000000-0000-4000-8000-000000000001';
const conversationId = '20000000-0000-4000-8000-000000000001';
const generationId = '30000000-0000-4000-8000-000000000001';
const listingIds = [
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003',
] as const;

const roles = ['TOP', 'BOTTOM', 'SHOES'] as const;
const prices = [200_000, 250_000, 300_000] as const;

function candidate(index: number): StylistInventoryCandidate {
  return {
    colorFamily: index === 1 ? 'BEIGE' : 'BLACK',
    currency: 'PKR',
    fitType: 'REGULAR',
    garmentRole: roles[index] ?? 'OTHER',
    id: listingIds[index] ?? listingIds[0],
    match: null,
    priceMinor: prices[index] ?? 100_000,
    sellerCompletedSales: 5,
    sellerId: `50000000-0000-4000-8000-00000000000${index + 1}`,
    sellerVerified: true,
    sizeCompatibilityKey: 'M',
    sizeConfidence: 'MATCH',
    sizeSystem: 'ALPHA',
    styleSlugs: ['minimalist'],
  };
}

function listing(index: number, priceDelta = 0): ListingDetail {
  const now = '2026-08-13T20:00:00.000Z';
  return {
    activatedAt: now,
    archivedAt: null,
    brand: null,
    category: {
      description: null,
      id: '60000000-0000-4000-8000-000000000001',
      isActive: true,
      name: 'Clothing',
      parentId: null,
      slug: 'clothing',
      sortOrder: 0,
    },
    color: index === 1 ? 'Beige' : 'Black',
    condition: 'GOOD',
    createdAt: now,
    currency: 'PKR',
    description: 'Authoritative listing description that is never sent to the provider.',
    id: listingIds[index] ?? listingIds[0],
    images: [],
    likeCount: 0,
    likedByViewer: false,
    match: null,
    moderatedAt: now,
    personalization: {
      colorFamily: index === 1 ? 'BEIGE' : 'BLACK',
      fitType: 'REGULAR',
      garmentRole: roles[index] ?? 'OTHER',
      sizeCompatibilityKey: 'M',
      sizeSystem: 'ALPHA',
      styles: [],
    },
    priceMinor: (prices[index] ?? 100_000) + priceDelta,
    stockAvailable: 1,
    stockReserved: 0,
    stockSold: 0,
    stockQuantity: 1,
    rejectionReason: null,
    saveCount: 0,
    savedByViewer: false,
    seller: {
      id: `50000000-0000-4000-8000-00000000000${index + 1}`,
      profileImageUrl: null,
      sellerRating: {
        average: 4.5,
        count: 2,
        distribution: { '1': 0, '2': 0, '3': 0, '4': 1, '5': 1 },
      },
      sellerVerified: true,
      username: `seller${index}`,
    },
    size: 'M',
    status: 'ACTIVE',
    submittedAt: now,
    title: `Item ${index}`,
    updatedAt: now,
  };
}

const personalization: StylistPersonalizationContext = {
  budgetMaxMinor: 900_000,
  budgetMinMinor: null,
  colors: [],
  currency: 'PKR',
  fits: ['REGULAR'],
  profileVersion: 1,
  sizes: roles.map((garmentRole) => ({ garmentRole, sizeKey: 'M', sizeSystem: 'ALPHA' })),
  styles: [{ slug: 'minimalist', strength: 5 }],
};

function setEnvironment(): void {
  Object.assign(process.env, {
    AI_STYLIST_ENABLED: 'true',
    SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${'a'.repeat(24)}`,
    SUPABASE_SECRET_KEY: `sb_secret_${'b'.repeat(24)}`,
    SUPABASE_URL: 'https://example.supabase.co',
    TWILIO_ACCOUNT_SID: `AC${'a'.repeat(32)}`,
    TWILIO_API_KEY_SECRET: 'not-a-real-secret-value',
    TWILIO_API_KEY_SID: `SK${'b'.repeat(32)}`,
    TWILIO_VERIFY_SERVICE_SID: `VA${'c'.repeat(32)}`,
  });
}

function harness(provider: AiStylistProvider) {
  const assistantMessageId = '70000000-0000-4000-8000-000000000001';
  const repository = {
    completeGeneration: vi.fn(async (_generationId, _conversationId, input) => ({
      assistantPayload: input.assistantPayload,
      content: input.assistantContent,
      createdAt: '2026-08-13T20:00:05.000Z',
      id: assistantMessageId,
      role: 'ASSISTANT',
    })),
    conversation: vi.fn().mockResolvedValue({
      archivedAt: null,
      createdAt: '2026-08-13T20:00:00.000Z',
      id: conversationId,
      messages: [],
      preview: 'A response',
      title: 'University outfit',
      updatedAt: '2026-08-13T20:00:05.000Z',
    }),
    failGeneration: vi.fn().mockResolvedValue(undefined),
    rawConversation: vi.fn().mockResolvedValue({ context: {}, title: 'New outfit' }),
    startGeneration: vi.fn().mockResolvedValue({
      conversationId,
      existingStatus: null,
      generationId,
      idempotentResult: null,
      wasExisting: false,
    }),
    usageSnapshot: vi.fn().mockResolvedValue({
      dailyCostMicroUsd: 0,
      globalActive: 1,
      perDay: 1,
      perMinute: 1,
      sessionTurns: 1,
      userActive: 1,
    }),
  } as unknown as AiStylistRepository;
  const inventory = {
    personalizationContext: vi.fn().mockResolvedValue(personalization),
    presentEligible: vi
      .fn()
      .mockResolvedValue(
        new Map(listingIds.map((id, index) => [id, listing(index, index === 0 ? 1_000 : 0)])),
      ),
    search: vi.fn().mockResolvedValue(listingIds.map((_, index) => candidate(index))),
  } as unknown as StylistInventoryService;
  const published: unknown[] = [];
  const events: MarketplaceEventPublisher = { publish: (event) => published.push(event) };
  const service = new AiStylistService(
    repository,
    inventory,
    new AiStylistToolRegistry(inventory),
    provider,
    events,
  );
  return { inventory, provider, published, repository, service };
}

describe('AiStylistService generation pipeline', () => {
  beforeEach(() => setEnvironment());

  it('returns provider-selected inventory with server-authoritative current prices', async () => {
    const provider = new FakeAiStylistProvider();
    const { repository, service } = harness(provider);
    const result = await service.generate(userId, conversationId, {
      body: 'Build a minimalist university outfit under PKR 9,000',
      requestId: '80000000-0000-4000-8000-000000000001',
    });

    expect(result.status).toBe('SUCCEEDED');
    expect(result.message.assistantPayload?.outfits[0]?.totalPriceMinor).toBe(751_000);
    expect(result.message.assistantPayload?.outfits[0]?.items[0]?.listing.priceMinor).toBe(201_000);
    expect(
      result.message.assistantPayload?.outfits[0]?.items.every(({ available }) => available),
    ).toBe(true);
    expect(repository.completeGeneration).toHaveBeenCalledWith(
      generationId,
      conversationId,
      expect.objectContaining({ status: 'SUCCEEDED' }),
    );
  });

  it('uses grounded deterministic fallback when the provider is unavailable', async () => {
    const provider = new FakeAiStylistProvider(undefined, 'AI_PROVIDER_UNAVAILABLE');
    const { published, service } = harness(provider);
    const result = await service.generate(userId, conversationId, {
      body: 'Give me a smart casual outfit under 9k',
      requestId: '80000000-0000-4000-8000-000000000002',
    });

    expect(result.status).toBe('FALLBACK');
    expect(result.message.assistantPayload?.fallbackUsed).toBe(true);
    expect(
      result.message.assistantPayload?.outfits[0]?.items.map(({ listing }) => listing.id),
    ).toEqual(listingIds);
    expect(JSON.stringify(published)).toContain('ai_fallback_used');
  });

  it('persists a safe provider refusal as a normal refusal response', async () => {
    const provider = new FakeAiStylistProvider({
      assistantMessage: 'I can help with safe fashion and outfit requests instead.',
      kind: 'REFUSAL',
      quickRefinements: [],
      selections: [],
    });
    const { repository, service } = harness(provider);

    const result = await service.generate(userId, conversationId, {
      body: 'Build a safe university outfit',
      requestId: '80000000-0000-4000-8000-000000000010',
    });

    expect(result.status).toBe('REFUSED');
    expect(result.message.assistantPayload).toMatchObject({ kind: 'REFUSAL', outfits: [] });
    expect(repository.completeGeneration).toHaveBeenCalledWith(
      generationId,
      conversationId,
      expect.objectContaining({ status: 'REFUSED' }),
    );
  });

  it('accounts for provider usage already incurred before a grounded fallback', async () => {
    const provider: AiStylistProvider = {
      generate: vi.fn().mockRejectedValue(
        new AiStylistDomainError('AI_PROVIDER_UNAVAILABLE', {
          latencyMs: 912,
          toolCallCount: 2,
          usage: { cachedInputTokens: 40, inputTokens: 120, outputTokens: 15 },
        }),
      ),
    };
    const { repository, service } = harness(provider);

    const result = await service.generate(userId, conversationId, {
      body: 'Build a smart casual outfit under 9k',
      requestId: '80000000-0000-4000-8000-000000000008',
    });

    expect(result.status).toBe('FALLBACK');
    expect(repository.completeGeneration).toHaveBeenCalledWith(
      generationId,
      conversationId,
      expect.objectContaining({
        estimatedCostMicroUsd: 348,
        toolCallCount: 2,
        usage: { cachedInputTokens: 40, inputTokens: 120, outputTokens: 15 },
      }),
    );
  });

  it('rejects fabricated candidate IDs and unsafe model copy by recomputing a safe fallback', async () => {
    const fixture: ProviderStylistPlan = {
      assistantMessage: 'This definitely fits perfectly and is guaranteed authentic.',
      kind: 'OUTFITS',
      quickRefinements: [],
      selections: [
        {
          candidateId: '90000000-0000-4000-8000-000000000001',
          explanation: 'A fabricated item.',
          title: 'Fake option',
        },
      ],
    };
    const { service } = harness(new FakeAiStylistProvider(fixture));
    const result = await service.generate(userId, conversationId, {
      body: 'Build a minimalist outfit under 9k',
      requestId: '80000000-0000-4000-8000-000000000003',
    });

    expect(result.status).toBe('FALLBACK');
    expect(result.message.content).not.toMatch(/definitely fits|guaranteed authentic/i);
    expect(
      result.message.assistantPayload?.outfits[0]?.items.map(({ listing }) => listing.id),
    ).toEqual(listingIds);
  });

  it('returns an idempotent completed generation without a second provider call', async () => {
    const provider = new FakeAiStylistProvider();
    const { repository, service } = harness(provider);
    const priorMessage = {
      assistantPayload: null,
      content: 'Prior result',
      createdAt: '2026-08-13T20:00:05.000Z',
      id: '70000000-0000-4000-8000-000000000009',
      role: 'ASSISTANT' as const,
    };
    vi.mocked(repository.startGeneration).mockResolvedValue({
      conversationId,
      existingStatus: 'SUCCEEDED',
      generationId,
      idempotentResult: {
        conversation: {
          archivedAt: null,
          createdAt: '2026-08-13T20:00:00.000Z',
          id: conversationId,
          preview: 'Prior result',
          title: 'Prior',
          updatedAt: '2026-08-13T20:00:05.000Z',
        },
        message: priorMessage,
        status: 'SUCCEEDED',
      },
      wasExisting: true,
    });
    const result = await service.generate(userId, conversationId, {
      body: 'Build a university outfit',
      requestId: '80000000-0000-4000-8000-000000000004',
    });
    expect(result.message).toEqual(priorMessage);
    expect(provider.requests).toHaveLength(0);
  });

  it('enforces rate and input gates before provider spend', async () => {
    const provider = new FakeAiStylistProvider();
    const { repository, service } = harness(provider);
    vi.mocked(repository.usageSnapshot).mockResolvedValue({
      dailyCostMicroUsd: 0,
      globalActive: 1,
      perDay: 1,
      perMinute: 5,
      sessionTurns: 1,
      userActive: 1,
    });
    await expect(
      service.generate(userId, conversationId, {
        body: 'Build a university outfit',
        requestId: '80000000-0000-4000-8000-000000000005',
      }),
    ).rejects.toMatchObject({ code: 'AI_RATE_LIMITED' });
    expect(provider.requests).toHaveLength(0);

    await expect(
      service.generate(userId, conversationId, {
        body: `Outfit ${'x'.repeat(2_100)}`,
        requestId: '80000000-0000-4000-8000-000000000006',
      }),
    ).rejects.toBeDefined();
    expect(provider.requests).toHaveLength(0);
  });

  it('revalidates reopened outfits and marks stale inventory unavailable', async () => {
    const { inventory, repository, service } = harness(new FakeAiStylistProvider());
    const generated = await service.generate(userId, conversationId, {
      body: 'Build a university outfit under 9k',
      requestId: '80000000-0000-4000-8000-000000000007',
    });
    vi.mocked(repository.conversation).mockResolvedValue({
      archivedAt: null,
      createdAt: '2026-08-13T20:00:00.000Z',
      id: conversationId,
      messages: [generated.message],
      preview: generated.message.content,
      title: 'University outfit',
      updatedAt: '2026-08-13T20:00:05.000Z',
    });
    vi.mocked(inventory.presentEligible).mockResolvedValue(
      new Map([
        [listingIds[0], listing(0, 50_000)],
        [listingIds[1], listing(1)],
      ]),
    );

    const reopened = await service.conversation(userId, conversationId);
    const outfit = reopened.messages[0]?.assistantPayload?.outfits[0];

    expect(outfit?.items[0]?.listing.priceMinor).toBe(250_000);
    expect(outfit?.items[2]?.available).toBe(false);
    expect(outfit?.items[2]?.listing.id).toBe(listingIds[2]);
    expect(outfit?.totalPriceMinor).toBeNull();
    expect(outfit?.unmetConstraints).toContain('One or more items are no longer available.');
  });

  it('rejects stale size metadata during final inventory revalidation', async () => {
    const { inventory, service } = harness(new FakeAiStylistProvider());
    const changedSize = listing(0);
    changedSize.personalization!.sizeCompatibilityKey = 'XS';
    vi.mocked(inventory.presentEligible).mockResolvedValue(
      new Map([
        [listingIds[0], changedSize],
        [listingIds[1], listing(1)],
        [listingIds[2], listing(2)],
      ]),
    );

    const result = await service.generate(userId, conversationId, {
      body: 'Build a minimalist university outfit under PKR 9,000',
      requestId: '80000000-0000-4000-8000-000000000009',
    });

    expect(result.status).toBe('FALLBACK');
    expect(result.message.assistantPayload?.kind).toBe('NO_MATCH');
    expect(result.message.assistantPayload?.outfits).toEqual([]);
  });
});
