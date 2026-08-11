import type { ListingDetail, ListingPage } from '@thriftage/shared';
import { type InfiniteData, useInfiniteQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListingCard } from '../../../src/components/marketplace/listing-card';
import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import { marketplaceColors } from '../../../src/components/marketplace/marketplace-theme';
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
            <MarketplaceState
              loading
              message="Gathering your saved pieces."
              title="Loading saves"
            />
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
              icon="bookmark-border"
              message="Save pieces while browsing to build a private shortlist here."
              title="Nothing saved yet"
            />
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>YOUR SHORTLIST</Text>
            <Text style={styles.heading}>Saved pieces</Text>
            <Text style={styles.copy}>A private collection of items you want to revisit.</Text>
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
  content: { paddingBottom: 28, paddingHorizontal: 8 },
  copy: { color: marketplaceColors.muted, fontSize: 14, marginTop: 7 },
  eyebrow: { color: marketplaceColors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  header: { paddingBottom: 18, paddingHorizontal: 10, paddingTop: 20 },
  heading: { color: marketplaceColors.forest, fontSize: 30, fontWeight: '900', marginTop: 8 },
  safeArea: { backgroundColor: marketplaceColors.background, flex: 1 },
});
