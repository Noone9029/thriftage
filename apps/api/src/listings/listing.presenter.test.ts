import { describe, expect, it, vi } from 'vitest';

import type { ViewerListingState } from './listing.repository';
import { ListingPresenter } from './listing.presenter';

describe('ListingPresenter', () => {
  it('loads viewer, storage, rating, and verification state concurrently', async () => {
    let resolveViewerState: ((state: ViewerListingState) => void) | undefined;
    const viewerState = new Promise<ViewerListingState>((resolve) => {
      resolveViewerState = resolve;
    });
    const storage = { createSignedUrls: vi.fn().mockResolvedValue(new Map()) };
    const reputation = {
      summaries: vi.fn().mockResolvedValue(new Map()),
      verified: vi.fn().mockResolvedValue(new Set()),
    };
    const presenter = new ListingPresenter(storage as never, reputation as never);

    const presentation = presenter.presentMany([], viewerState);

    expect(storage.createSignedUrls).toHaveBeenCalledWith([]);
    expect(reputation.summaries).toHaveBeenCalledWith([], 'BUYER_TO_SELLER');
    expect(reputation.verified).toHaveBeenCalledWith([]);
    resolveViewerState?.({ likedIds: new Set(), savedIds: new Set() });
    await expect(presentation).resolves.toEqual([]);
  });
});
