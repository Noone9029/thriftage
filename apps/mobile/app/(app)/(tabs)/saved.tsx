import type { ListingDetail, ListingPage } from '@thriftage/shared';
import { type InfiniteData, useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListingCard } from '../../../src/components/marketplace/listing-card';
import {
  ScreenHeader,
  TrustPill,
} from '../../../src/components/marketplace/marketplace-primitives';
import { ListingGridSkeleton } from '../../../src/components/marketplace/marketplace-skeleton';
import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import {
  marketplaceColors,
  marketplaceRadii,
  marketplaceSpacing,
} from '../../../src/components/marketplace/marketplace-theme';
import { useListingActions } from '../../../src/hooks/use-listing-actions';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';

export default function SavedScreen() {
  const actions = useListingActions();
  const saved = useInfiniteQuery<
    ListingPage,
    Error,
    InfiniteData<ListingPage>,
    readonly unknown[],
    string | null
  >({
    getNextPageParam: (page) => page.nextCursor,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => thriftageApiClient.getSavedListings(pageParam ?? undefined),
    queryKey: ['marketplace', 'saved'],
  });
  const items = saved.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <FlatList<ListingDetail>
        ListEmptyComponent={
          saved.isLoading ? (
            <ListingGridSkeleton />
          ) : saved.isError ? (
            <MarketplaceState
              actionLabel="Retry"
              icon="cloud-off"
              message="Saved items could not be loaded."
              onAction={() => void saved.refetch()}
              title="Saves unavailable"
            />
          ) : (
            <MarketplaceState
              actionLabel="Keep discovering"
              icon="bookmark-border"
              message="Tap the bookmark on anything you love. Your private edit will come together here."
              onAction={() => router.push('/')}
              title="Start your personal edit"
            />
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader
              eyebrow="YOUR PRIVATE EDIT"
              subtitle="Keep the pieces worth a second look in one beautifully simple shortlist."
              title="Saved for later"
            />
            <View style={styles.summary}>
              <TrustPill icon="lock" label="Only you can see this" tone="neutral" />
              <Text style={styles.count}>{items.length} pieces</Text>
            </View>
          </View>
        }
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={({ id }) => id}
        numColumns={2}
        onEndReached={() => {
          if (saved.hasNextPage && !saved.isFetchingNextPage) void saved.fetchNextPage();
        }}
        renderItem={({ item }) => (
          <ListingCard
            listing={item}
            onLike={(listing) => actions.like.mutate(listing)}
            onSave={(listing) => actions.save.mutate(listing)}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32, paddingHorizontal: 8 },
  count: { color: marketplaceColors.muted, fontSize: 11, fontWeight: '800' },
  header: { paddingBottom: 18, paddingHorizontal: 10, paddingTop: 18 },
  safeArea: { backgroundColor: marketplaceColors.background, flex: 1 },
  summary: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: marketplaceSpacing.xl,
    padding: marketplaceSpacing.md,
  },
});
