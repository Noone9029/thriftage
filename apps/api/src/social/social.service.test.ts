import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SocialService } from './social.service';

const userId = '00000000-0000-4000-8000-000000000001';
const targetUserId = '00000000-0000-4000-8000-000000000002';
const listingId = '00000000-0000-4000-8000-000000000003';

describe('SocialService response serialization', () => {
  const social = {
    setFollow: vi.fn(),
    setLike: vi.fn(),
    setSaved: vi.fn(),
  };
  const events = { publish: vi.fn() };
  const policies = { assertUgcAccepted: vi.fn() };
  const safety = {
    assertListingPairAllowed: vi.fn(),
    assertPairAllowed: vi.fn(),
    assertScopeAllowed: vi.fn(),
  };
  const personalization = { recordEvent: vi.fn().mockResolvedValue(undefined) };
  const service = new SocialService(
    social as never,
    {} as never,
    {} as never,
    {} as never,
    events as never,
    policies as never,
    safety as never,
    {} as never,
    personalization as never,
  );

  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['like', 'setLike', 'item_liked'],
    ['save', 'setSaved', 'item_saved'],
  ] as const)(
    'removes repository metadata from the public %s response',
    async (_, method, event) => {
      social[method].mockResolvedValue({ active: true, changed: true, count: 1 });

      await expect(service[method](userId, listingId, true)).resolves.toEqual({
        active: true,
        count: 1,
      });
      expect(events.publish).toHaveBeenCalledWith({
        actorId: userId,
        listingId,
        name: event,
      });
    },
  );

  it('removes repository metadata from the public follow response', async () => {
    social.setFollow.mockResolvedValue({ active: true, changed: true, count: 2 });

    await expect(service.setFollow(userId, targetUserId, true)).resolves.toEqual({
      active: true,
      count: 2,
    });
    expect(events.publish).toHaveBeenCalledWith({
      actorId: userId,
      name: 'seller_followed',
      targetUserId,
    });
  });
});
