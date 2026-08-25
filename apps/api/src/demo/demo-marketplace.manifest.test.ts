import { describe, expect, it } from 'vitest';

import {
  activeDemoListings,
  demoListings,
  demoQaProfiles,
  demoSellers,
} from './demo-marketplace.manifest';

describe('demo marketplace manifest', () => {
  it('contains the approved modest staging scale and lifecycle coverage', () => {
    expect(demoSellers).toHaveLength(12);
    expect(activeDemoListings).toHaveLength(60);
    expect(demoListings).toHaveLength(75);
    expect(
      Object.fromEntries(
        ['ACTIVE', 'SOLD', 'DRAFT', 'PENDING_REVIEW', 'REJECTED', 'ARCHIVED'].map((status) => [
          status,
          demoListings.filter((listing) => listing.status === status).length,
        ]),
      ),
    ).toEqual({ ACTIVE: 60, SOLD: 8, DRAFT: 2, PENDING_REVIEW: 2, REJECTED: 1, ARCHIVED: 2 });
  });

  it('keeps product identity, pricing, imagery, and seller ownership deterministic', () => {
    expect(new Set(demoSellers.map(({ username }) => username)).size).toBe(demoSellers.length);
    expect(new Set(demoListings.map(({ title }) => title)).size).toBe(demoListings.length);
    expect(
      demoListings.every(({ panel, priceMinor }) => panel >= 0 && panel <= 4 && priceMinor > 0),
    ).toBe(true);
    expect(
      demoListings.every(({ seller }) => demoSellers.some(({ username }) => username === seller)),
    ).toBe(true);
    expect(demoListings.every(({ styles }) => styles.length >= 1)).toBe(true);
  });

  it('covers search, style intelligence, and stylist garment roles', () => {
    const roles = new Set(demoListings.map(({ garmentRole }) => garmentRole));
    expect(roles).toEqual(
      new Set([
        'TOP',
        'BOTTOM',
        'DRESS',
        'OUTERWEAR',
        'SHOES',
        'BAG',
        'JEWELRY',
        'ACCESSORY',
        'OTHER',
      ]),
    );
    expect(new Set(demoListings.flatMap(({ styles }) => styles))).toEqual(
      new Set([
        'minimalist',
        'smart-casual',
        'old-money',
        'formal',
        'streetwear',
        'techwear',
        'vintage',
        'gothic',
        'y2k',
        'athleisure',
      ]),
    );
    expect(new Set(demoListings.map(({ condition }) => condition))).toEqual(
      new Set(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR']),
    );
    const alphaSizes = new Set(
      demoListings.filter(({ sizeSystem }) => sizeSystem === 'ALPHA').map(({ sizeKey }) => sizeKey),
    );
    for (const size of ['XS', 'S', 'M', 'L', 'XL']) expect(alphaSizes).toContain(size);
    expect(Math.min(...demoListings.map(({ priceMinor }) => priceMinor))).toBeLessThanOrEqual(
      100_000,
    );
    expect(Math.max(...demoListings.map(({ priceMinor }) => priceMinor))).toBeGreaterThanOrEqual(
      2_000_000,
    );
    expect(demoQaProfiles).toHaveLength(3);
  });
});
