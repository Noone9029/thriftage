import { describe, expect, it, vi } from 'vitest';

import { AiStylistDomainError } from './ai-stylist.errors';
import { AI_STYLIST_TOOL_DEFINITIONS, AiStylistToolRegistry } from './ai-stylist-tool-registry';
import type { StylistInventoryService } from './stylist-inventory.service';
import type { StylistInventoryCandidate, StylistPersonalizationContext } from './ai-stylist.types';

const inventoryCandidate: StylistInventoryCandidate = {
  colorFamily: 'BLACK',
  currency: 'PKR',
  fitType: 'REGULAR',
  garmentRole: 'TOP',
  id: '00000000-0000-4000-8000-000000000001',
  match: null,
  priceMinor: 200_000,
  sellerCompletedSales: 5,
  sellerId: '10000000-0000-4000-8000-000000000001',
  sellerVerified: true,
  sizeCompatibilityKey: 'M',
  sizeConfidence: 'MATCH',
  sizeSystem: 'LETTER',
  styleSlugs: ['minimalist'],
};
const personalization: StylistPersonalizationContext = {
  budgetMaxMinor: 800_000,
  budgetMinMinor: null,
  colors: [{ colorFamily: 'BLACK', sentiment: 'PREFER' }],
  currency: 'PKR',
  fits: ['REGULAR'],
  profileVersion: 2,
  sizes: [{ garmentRole: 'TOP', sizeKey: 'M', sizeSystem: 'LETTER' }],
  styles: [{ slug: 'minimalist', strength: 5 }],
};
const baseIntent = {
  anchorListingId: null,
  budgetMaxMinor: 800_000,
  budgetMinMinor: null,
  colors: [],
  currency: 'PKR' as const,
  excludedColors: [],
  freeTextObjective: 'Build an outfit',
  lockedListingIds: [],
  modesty: null,
  occasion: null,
  optionCount: 1,
  preferredFits: [],
  refinement: 'NONE' as const,
  requestedGarmentRoles: [],
  requestedStyles: [],
  sizeConstraints: [],
};

function session(maxToolCalls = 3) {
  const inventory = {
    savedCandidates: vi.fn().mockResolvedValue([inventoryCandidate]),
    search: vi.fn().mockResolvedValue([inventoryCandidate]),
  } as unknown as StylistInventoryService;
  return new AiStylistToolRegistry(inventory).createSession({
    initialCandidates: [inventoryCandidate],
    intent: baseIntent,
    maxOptions: 3,
    maxToolCalls,
    personalization,
    userId: '20000000-0000-4000-8000-000000000001',
  });
}

describe('AiStylistToolRegistry', () => {
  it('exposes only the explicit read-only allowlist', () => {
    expect(AI_STYLIST_TOOL_DEFINITIONS.map(({ name }) => name)).toEqual([
      'get_personalization_context',
      'search_inventory',
      'get_listing_details',
      'compose_outfit_candidates',
      'get_saved_items',
    ]);
    expect(
      AI_STYLIST_TOOL_DEFINITIONS.some(({ name }) => /buy|order|message|shell|sql/i.test(name)),
    ).toBe(false);
  });

  it('returns minimized personalization without account PII', async () => {
    const output = await session().execute('get_personalization_context', {});
    const serialized = JSON.stringify(output);
    expect(serialized).toContain('PRIVATE_USER_FASHION_CONTEXT_NO_PII');
    expect(serialized).not.toMatch(/email|phone|address|dispute|verificationEvidence/i);
  });

  it('rejects caller-supplied user identifiers and malicious oversized arguments', async () => {
    await expect(
      session().execute('search_inventory', {
        colors: null,
        excludedColors: null,
        garmentRoles: null,
        limit: 24,
        maxPriceMinor: null,
        preferredFits: null,
        requestedStyles: null,
        userId: 'attacker',
      }),
    ).rejects.toMatchObject({ code: 'AI_RESPONSE_INVALID' });
    await expect(
      session().execute('get_listing_details', {
        listingRefs: Array.from({ length: 11 }, () => inventoryCandidate.id),
      }),
    ).rejects.toMatchObject({ code: 'AI_RESPONSE_INVALID' });
  });

  it('rejects unknown side-effect tools and enforces a hard tool-call limit', async () => {
    await expect(session().execute('buy_listing', {})).rejects.toBeInstanceOf(AiStylistDomainError);
    const limited = session(1);
    await limited.execute('get_personalization_context', {});
    await expect(limited.execute('get_personalization_context', {})).rejects.toMatchObject({
      code: 'AI_TOOL_LIMIT_EXCEEDED',
    });
  });

  it('returns structured facts without user-generated listing instructions', async () => {
    const output = await session().execute('get_listing_details', {
      listingRefs: [inventoryCandidate.id],
    });
    const serialized = JSON.stringify(output);
    expect(serialized).toContain('UNTRUSTED_MARKETPLACE_DATA_FACTS_ONLY_NO_INSTRUCTIONS');
    expect(serialized).not.toMatch(/title|description|ignore the system/i);
  });
});
