import type { ListingDetail } from '@thriftage/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { thriftageApiClient } from '../lib/auth/auth-composition';

export function useListingActions() {
  const queryClient = useQueryClient();
  const refresh = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['marketplace'] });
  };
  const like = useMutation({
    mutationFn: (listing: ListingDetail) =>
      thriftageApiClient.setLike(listing.id, !listing.likedByViewer),
    onSuccess: refresh,
  });
  const save = useMutation({
    mutationFn: (listing: ListingDetail) =>
      thriftageApiClient.setSaved(listing.id, !listing.savedByViewer),
    onSuccess: refresh,
  });
  return { like, save };
}
