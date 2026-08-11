import { describe, expect, it } from 'vitest';

import { categoryCreateInputSchema } from './category-contracts';
import { listingDraftInputSchema, listingSearchQuerySchema } from './listing-contracts';
import { moderationReportUpdateInputSchema } from './moderation-contracts';

describe('marketplace contracts', () => {
  it('normalizes category slugs and rejects unsafe shapes', () => {
    expect(
      categoryCreateInputSchema.parse({ name: 'Vintage', slug: ' Vintage ', sortOrder: 4 }),
    ).toMatchObject({ slug: 'vintage' });
    expect(() =>
      categoryCreateInputSchema.parse({ name: 'Vintage', slug: '../vintage', sortOrder: 4 }),
    ).toThrow();
  });

  it('requires precise positive minor-unit prices', () => {
    const base = {
      categoryId: '7cb38bef-7795-4eb7-890f-92a487fab682',
      condition: 'GOOD',
      currency: 'PKR',
      description: 'A carefully described pre-owned garment.',
      size: 'M',
      title: 'Vintage overshirt',
    } as const;
    expect(listingDraftInputSchema.parse({ ...base, priceMinor: 150_000 }).priceMinor).toBe(
      150_000,
    );
    expect(() => listingDraftInputSchema.parse({ ...base, priceMinor: 1500.25 })).toThrow();
  });

  it('rejects an inverted search price range', () => {
    expect(() =>
      listingSearchQuerySchema.parse({ maxPriceMinor: '100', minPriceMinor: '200' }),
    ).toThrow();
  });

  it('requires a resolution before closing a report', () => {
    expect(() => moderationReportUpdateInputSchema.parse({ status: 'ACTIONED' })).toThrow();
    expect(
      moderationReportUpdateInputSchema.parse({
        resolution: 'Listing removed after review.',
        status: 'ACTIONED',
      }).status,
    ).toBe('ACTIONED');
  });
});
