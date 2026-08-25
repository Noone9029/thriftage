import { describe, expect, it } from 'vitest';

import { betaInterestInputSchema, sellerInterestInputSchema } from './marketing-lead-contracts';

describe('marketing lead contracts', () => {
  it('normalizes beta email and removes empty optional style input', () => {
    expect(
      betaInterestInputSchema.parse({
        audience: 'BOTH',
        city: ' Lahore ',
        email: ' PERSON@Example.COM ',
        styleInterest: ' ',
      }),
    ).toEqual({
      audience: 'BOTH',
      city: 'Lahore',
      email: 'person@example.com',
      source: 'public-web',
    });
  });

  it('rejects honeypot and unknown fields', () => {
    expect(() =>
      sellerInterestInputSchema.parse({
        city: 'Karachi',
        email: 'seller@example.com',
        itemVolume: 'ONE_TO_TEN',
        name: 'A Seller',
        sellerType: 'CLOSET_SELLER',
        website: 'spam.example',
      }),
    ).toThrow();
    expect(() =>
      betaInterestInputSchema.parse({
        audience: 'BUYER',
        city: 'Islamabad',
        email: 'buyer@example.com',
        secretRole: 'ADMIN',
      }),
    ).toThrow();
  });
});
