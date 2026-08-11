import type { FeedMode, ListingDetail, ListingPage } from '@thriftage/shared';
import { type InfiniteData, useInfiniteQuery } from '@tanstack/react-query';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListingCard } from '../../../src/components/marketplace/listing-card';
import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import { marketplaceColors } from '../../../src/components/marketplace/marketplace-theme';
import { useListingActions } from '../../../src/hooks/use-listing-actions';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';
import { useState } from 'react';

const modes: readonly { readonly label: string; readonly value: FeedMode }[] = [
  { label: 'New', value: 'NEW' },
  { label: 'Trending', value: 'TRENDING' },
  { label: 'For you', value: 'RECOMMENDED' },
];

export default function DiscoveryScreen() {
  const [mode, setMode] = useState<FeedMode>('NEW');
  const actions = useListingActions();
  const feed = useInfiniteQuery<
    ListingPage,
    Error,
    InfiniteData<ListingPage>,
    readonly unknown[],
    string | null
  >({
    getNextPageParam: (page) => page.nextCursor,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => thriftageApiClient.getFeed(mode, pageParam ?? undefined),
    queryKey: ['marketplace', 'feed', mode],
  });
  const listings = feed.data?.pages.flatMap(({ items }) => items) ?? [];

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <FlatList<ListingDetail>
        ListEmptyComponent={
          feed.isLoading ? (
            <MarketplaceState
              loading
              message="Curating the latest wardrobe drops."
              title="Loading discovery"
            />
          ) : feed.isError ? (
            <MarketplaceState
              actionLabel="Try again"
              icon="cloud-off"
              message="The marketplace could not be loaded. Check your connection and retry."
              onAction={() => void feed.refetch()}
              title="Discovery is unavailable"
            />
          ) : (
            <MarketplaceState
              message="Approved listings will appear here as the community starts selling."
              title="The rack is ready"
            />
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.brand}>THRIFTAGE</Text>
            <Text style={styles.heading}>Find your next favorite piece.</Text>
            <Text style={styles.subheading}>Curated resale, real wardrobes, better style.</Text>
            <View style={styles.modeRow}>
              {modes.map((item) => (
                <Pressable
                  accessibilityRole="button"
                  key={item.value}
                  onPress={() => setMode(item.value)}
                  style={[styles.mode, mode === item.value && styles.modeActive]}
                >
                  <Text style={[styles.modeText, mode === item.value && styles.modeTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        contentContainerStyle={styles.content}
        data={listings}
        keyExtractor={({ id }) => id}
        numColumns={2}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            colors={[marketplaceColors.forest]}
            onRefresh={() => void feed.refetch()}
            refreshing={feed.isRefetching && !feed.isFetchingNextPage}
            tintColor={marketplaceColors.forest}
          />
        }
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
  brand: { color: marketplaceColors.accent, fontSize: 12, fontWeight: '900', letterSpacing: 3 },
  content: { paddingBottom: 24, paddingHorizontal: 8 },
  header: { paddingBottom: 16, paddingHorizontal: 10, paddingTop: 20 },
  heading: {
    color: marketplaceColors.forest,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1.1,
    lineHeight: 36,
    marginTop: 12,
    maxWidth: 340,
  },
  mode: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  modeActive: { backgroundColor: marketplaceColors.forest },
  modeRow: { flexDirection: 'row', gap: 6, marginTop: 22 },
  modeText: { color: marketplaceColors.muted, fontSize: 13, fontWeight: '800' },
  modeTextActive: { color: marketplaceColors.white },
  safeArea: { backgroundColor: marketplaceColors.background, flex: 1 },
  subheading: { color: marketplaceColors.muted, fontSize: 14, marginTop: 8 },
});
