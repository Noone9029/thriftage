import { describe, expect, it, vi } from 'vitest';

import { DiscoveryService } from './discovery.service';

describe('DiscoveryService chronological feed', () => {
  it('hydrates NEW feed records directly without a separate rank query', async () => {
    const rank = vi.fn();
    const listNewFeed = vi.fn().mockResolvedValue({ hasMore: false, records: [] });
    const getViewerState = vi.fn().mockResolvedValue({
      likedIds: new Set<string>(),
      savedIds: new Set<string>(),
    });
    const presentMany = vi.fn().mockResolvedValue([]);
    const service = new DiscoveryService(
      { rank } as never,
      { getViewerState, listNewFeed } as never,
      { presentMany } as never,
      { rankForYou: vi.fn() } as never,
    );
    const viewerId = '00000000-0000-4000-8000-000000000001';

    await expect(service.feed({ limit: 20, mode: 'NEW' }, viewerId)).resolves.toEqual({
      items: [],
      nextCursor: null,
    });

    expect(listNewFeed).toHaveBeenCalledWith(viewerId, expect.any(Date), null, 20);
    expect(rank).not.toHaveBeenCalled();
    expect(presentMany).toHaveBeenCalledWith([], expect.any(Promise));
  });
});
