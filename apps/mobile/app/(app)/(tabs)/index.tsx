import type { FeedMode, ListingDetail, ListingPage } from '@thriftage/shared';
import { MaterialIcons } from '@expo/vector-icons';
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { router } from 'expo-router';
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
  const [hiddenListing, setHiddenListing] = useState<ListingDetail | null>(null);
  const queryClient = useQueryClient();
  const actions = useListingActions();
  const styleProfile = useQuery({
    queryFn: () => thriftageApiClient.getStyleProfile(),
    queryKey: ['personalization', 'profile'],
  });
  const feedback = useMutation({
    mutationFn: ({ hidden, listingId }: { hidden: boolean; listingId: string }) =>
      thriftageApiClient.setNotInterested(listingId, hidden),
    onSuccess: async (_result, variables) => {
      if (!variables.hidden) setHiddenListing(null);
      await queryClient.invalidateQueries({ queryKey: ['marketplace', 'feed', 'RECOMMENDED'] });
    },
  });
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
            <Pressable
              accessibilityLabel="Open AI Fashion Stylist"
              accessibilityRole="button"
              onPress={() => router.push('/stylist')}
              style={styles.stylistCard}
            >
              <View style={styles.stylistIcon}>
                <MaterialIcons color={marketplaceColors.white} name="auto-awesome" size={24} />
              </View>
              <View style={styles.stylistCopy}>
                <Text style={styles.stylistEyebrow}>AI FASHION STYLIST</Text>
                <Text style={styles.stylistTitle}>Build a look from live Thriftage pieces</Text>
                <Text style={styles.stylistBody}>
                  Try an occasion, budget, color, or item you already love.
                </Text>
              </View>
              <MaterialIcons color={marketplaceColors.forest} name="arrow-forward" size={21} />
            </Pressable>
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
            {mode === 'RECOMMENDED' && styleProfile.data?.quizStatus !== 'COMPLETED' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/style-profile')}
                style={styles.profilePrompt}
              >
                <View style={styles.promptText}>
                  <Text style={styles.promptTitle}>Make For You truly yours</Text>
                  <Text style={styles.promptBody}>
                    Complete your private style profile for stronger matches and explanations.
                  </Text>
                </View>
                <Text style={styles.promptAction}>Start</Text>
              </Pressable>
            ) : null}
            {hiddenListing !== null ? (
              <View style={styles.undo}>
                <Text numberOfLines={1} style={styles.undoText}>
                  Hidden “{hiddenListing.title}”
                </Text>
                <Pressable
                  onPress={() => feedback.mutate({ hidden: false, listingId: hiddenListing.id })}
                >
                  <Text style={styles.undoAction}>Undo</Text>
                </Pressable>
              </View>
            ) : null}
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
            {...(mode === 'RECOMMENDED'
              ? {
                  onNotInterested: (listing: ListingDetail) => {
                    setHiddenListing(listing);
                    feedback.mutate({ hidden: true, listingId: listing.id });
                  },
                }
              : {})}
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
  profilePrompt: {
    alignItems: 'center',
    backgroundColor: '#E1E7E1',
    borderRadius: 18,
    flexDirection: 'row',
    marginTop: 16,
    padding: 15,
  },
  promptAction: { color: marketplaceColors.forest, fontSize: 12, fontWeight: '900' },
  promptBody: { color: marketplaceColors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  promptText: { flex: 1, paddingRight: 12 },
  promptTitle: { color: marketplaceColors.forest, fontSize: 14, fontWeight: '900' },
  safeArea: { backgroundColor: marketplaceColors.background, flex: 1 },
  subheading: { color: marketplaceColors.muted, fontSize: 14, marginTop: 8 },
  stylistBody: { color: marketplaceColors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  stylistCard: {
    alignItems: 'center',
    backgroundColor: '#E3EAE5',
    borderColor: '#CDD9D0',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    marginTop: 18,
    padding: 13,
  },
  stylistCopy: { flex: 1 },
  stylistEyebrow: {
    color: marketplaceColors.accent,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  stylistIcon: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forest,
    borderRadius: 17,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  stylistTitle: {
    color: marketplaceColors.forest,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 17,
    marginTop: 3,
  },
  undo: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.text,
    borderRadius: 12,
    flexDirection: 'row',
    marginTop: 12,
    padding: 12,
  },
  undoAction: { color: '#E8B663', fontSize: 12, fontWeight: '900' },
  undoText: { color: marketplaceColors.white, flex: 1, fontSize: 12 },
});
