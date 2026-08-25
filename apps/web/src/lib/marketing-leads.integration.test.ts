import { createPrismaClient } from '@thriftage/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MarketingLeadRateLimitError, MarketingLeadStore } from './marketing-leads';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl === undefined) throw new Error('TEST_DATABASE_URL is required.');
const prisma = createPrismaClient(databaseUrl);
const store = new MarketingLeadStore(prisma, 3, 60_000);

async function clear(): Promise<void> {
  await prisma.marketingLead.deleteMany();
  await prisma.marketingLeadRateLimitBucket.deleteMany();
}

describe.sequential('public marketing lead persistence', () => {
  beforeAll(async () => {
    await prisma.$connect();
    await clear();
  });

  afterAll(async () => {
    await clear();
    await prisma.$disconnect();
  });

  it('persists beta and seller leads, deduplicates each kind, and rate limits fingerprints', async () => {
    const now = new Date('2026-08-24T20:00:00.000Z');
    const betaInput = {
      audience: 'BOTH' as const,
      city: 'Lahore',
      email: 'person@example.com',
      source: 'integration-test',
    };

    await expect(
      store.submit({ input: betaInput, kind: 'BETA' }, 'a'.repeat(64), now),
    ).resolves.toEqual({ status: 'CREATED' });
    await expect(
      store.submit({ input: betaInput, kind: 'BETA' }, 'a'.repeat(64), now),
    ).resolves.toEqual({ status: 'ALREADY_REGISTERED' });
    const sellerLead = {
      input: {
        city: 'Lahore',
        email: 'person@example.com',
        itemVolume: 'ONE_TO_TEN' as const,
        name: 'A Seller',
        sellerType: 'CLOSET_SELLER' as const,
        source: 'integration-test',
      },
      kind: 'SELLER' as const,
    };
    await expect(store.submit(sellerLead, 'b'.repeat(64), now)).resolves.toEqual({
      status: 'CREATED',
    });
    await expect(store.submit(sellerLead, 'b'.repeat(64), now)).resolves.toEqual({
      status: 'ALREADY_REGISTERED',
    });

    for (const suffix of ['one', 'two', 'three']) {
      await expect(
        store.submit(
          {
            input: { ...betaInput, email: `rate-${suffix}@example.com` },
            kind: 'BETA',
          },
          'c'.repeat(64),
          now,
        ),
      ).resolves.toEqual({ status: 'CREATED' });
    }
    await expect(
      store.submit(
        { input: { ...betaInput, email: 'rate-four@example.com' }, kind: 'BETA' },
        'c'.repeat(64),
        now,
      ),
    ).rejects.toBeInstanceOf(MarketingLeadRateLimitError);

    expect(await prisma.marketingLead.count()).toBe(5);
    expect(JSON.stringify(await prisma.marketingLead.findMany())).not.toContain('a'.repeat(64));
  });
});
