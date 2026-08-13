import { describe, expect, it } from 'vitest';

import {
  listingPersonalizationInputSchema,
  recommendationConfigurationInputSchema,
  styleProfileInputSchema,
} from './personalization-contracts';

describe('personalization contracts', () => {
  it('rejects duplicate styles and inverted budgets', () => {
    const styleId = 'f0000000-0000-4000-8000-000000000001';
    const result = styleProfileInputSchema.safeParse({
      budgetMaxMinor: 100,
      budgetMinMinor: 200,
      colors: [],
      currency: 'PKR',
      expressions: [],
      fits: [],
      lifestyles: [],
      priorities: [],
      quizStep: 1,
      sizes: [],
      styles: [
        { strength: 5, styleDefinitionId: styleId },
        { strength: 4, styleDefinitionId: styleId },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('requires complete normalized listing metadata', () => {
    expect(
      listingPersonalizationInputSchema.safeParse({
        colorFamily: 'BLACK',
        fitType: 'RELAXED',
        garmentRole: 'TOP',
        sizeCompatibilityKey: '',
        sizeSystem: 'ALPHA',
        styleDefinitionIds: [],
      }).success,
    ).toBe(false);
  });

  it('requires versioned ranking weights to total 100', () => {
    expect(
      recommendationConfigurationInputSchema.safeParse({
        behaviorWeight: 15,
        candidateLimit: 200,
        engagementWeight: 7,
        explorationPercent: 10,
        explorationWeight: 6,
        freshnessWeight: 12,
        maxPerSeller: 2,
        maxPerStyle: 4,
        personalWeight: 45,
        sellerWeight: 8,
        trustWeight: 8,
        version: 'rules-v2',
      }).success,
    ).toBe(false);
  });
});
