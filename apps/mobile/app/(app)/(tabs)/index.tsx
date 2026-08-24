import { MaterialIcons } from '@expo/vector-icons';
import type { FeedMode, ListingDetail, ListingPage } from '@thriftage/shared';
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListingCard } from '../../../src/components/marketplace/listing-card';
import { SectionHeader } from '../../../src/components/marketplace/marketplace-primitives';
import { ListingGridSkeleton } from '../../../src/components/marketplace/marketplace-skeleton';
import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import {
  marketplaceColors,
  marketplaceRadii,
  marketplaceShadows,
  marketplaceSpacing,
} from '../../../src/components/marketplace/marketplace-theme';
import { useListingActions } from '../../../src/hooks/use-listing-actions';
import { useRuntimeConfig } from '../../../src/hooks/use-runtime-config';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';

const modes: readonly {
  readonly icon: keyof typeof MaterialIcons.glyphMap;
  readonly label: string;
  readonly value: FeedMode;
}[] = [
  { icon: 'auto-awesome', label: 'For you', value: 'RECOMMENDED' },
  { icon: 'local-fire-department', label: 'Trending', value: 'TRENDING' },
  { icon: 'new-releases', label: 'Fresh', value: 'NEW' },
];

const edits = [
  { icon: 'checkroom' as const, label: 'Clothing' },
  { icon: 'hiking' as const, label: 'Shoes' },
  { icon: 'watch' as const, label: 'Accessories' },
] as const;

export default function DiscoveryScreen() {
  const [mode, setMode] = useState<FeedMode>('RECOMMENDED');
  const [hiddenListing, setHiddenListing] = useState<ListingDetail | null>(null);
  const queryClient = useQueryClient();
  const actions = useListingActions();
  const runtime = useRuntimeConfig();
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
  const stylistEnabled = runtime.data?.features.aiStylist === true;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <FlatList<ListingDetail>
        ListEmptyComponent={
          feed.isLoading ? (
            <ListingGridSkeleton />
          ) : feed.isError ? (
            <MarketplaceState
              actionLabel="Try again"
              icon="cloud-off"
              message="We could not refresh the rack. Check your connection and try once more."
              onAction={() => void feed.refetch()}
              title="The edit is offline"
            />
          ) : (
            <MarketplaceState
              actionLabel="Start selling"
              icon="add-photo-alternate"
              message="Be the first to add a standout piece while this edit is taking shape."
              onAction={() => router.push('/listing-editor/new')}
              title="A fresh rack is coming"
            />
          )
        }
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <ActivityIndicator color={marketplaceColors.accent} style={styles.footerLoader} />
          ) : null
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View>
                <Text style={styles.brand}>THRIFTAGE</Text>
                <Text style={styles.brandNote}>STYLE, REWORN</Text>
              </View>
              <View style={styles.headerActions}>
                <Pressable
                  accessibilityLabel="Open messages"
                  accessibilityRole="button"
                  onPress={() => router.push('/messages')}
                  style={styles.headerIcon}
                >
                  <MaterialIcons color={marketplaceColors.forest} name="forum" size={21} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Open notifications"
                  accessibilityRole="button"
                  onPress={() => router.push('/notifications')}
                  style={styles.headerIcon}
                >
                  <MaterialIcons
                    color={marketplaceColors.forest}
                    name="notifications-none"
                    size={23}
                  />
                </Pressable>
              </View>
            </View>

            <View style={styles.hero}>
              <View style={styles.heroOrb} />
              <Text style={styles.heroEyebrow}>THE DAILY EDIT</Text>
              <Text style={styles.heroTitle}>Find the piece that feels like you.</Text>
              <Text style={styles.heroCopy}>
                One-of-one wardrobes, trusted sellers, and style that gets better with every find.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/search')}
                style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}
              >
                <Text style={styles.heroButtonText}>Explore the marketplace</Text>
                <MaterialIcons
                  color={marketplaceColors.forestDeep}
                  name="arrow-forward"
                  size={18}
                />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.editRow}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {edits.map((edit) => (
                <Pressable
                  accessibilityRole="button"
                  key={edit.label}
                  onPress={() => router.push({ pathname: '/search', params: { q: edit.label } })}
                  style={({ pressed }) => [styles.editChip, pressed && styles.pressed]}
                >
                  <View style={styles.editIcon}>
                    <MaterialIcons color={marketplaceColors.forest} name={edit.icon} size={19} />
                  </View>
                  <Text style={styles.editText}>{edit.label}</Text>
                  <MaterialIcons color={marketplaceColors.muted} name="north-east" size={14} />
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              accessibilityLabel={
                stylistEnabled ? 'Open AI Fashion Stylist' : 'Open stylist preview'
              }
              accessibilityRole="button"
              onPress={() => router.push(stylistEnabled ? '/stylist' : '/style-profile')}
              style={({ pressed }) => [
                styles.stylistCard,
                !stylistEnabled && styles.stylistCardPaused,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.stylistIcon}>
                <MaterialIcons
                  color={marketplaceColors.white}
                  name={stylistEnabled ? 'auto-awesome' : 'style'}
                  size={23}
                />
              </View>
              <View style={styles.stylistCopy}>
                <Text style={styles.stylistEyebrow}>
                  {stylistEnabled ? 'YOUR AI STYLIST' : 'YOUR STYLE PROFILE'}
                </Text>
                <Text style={styles.stylistTitle}>
                  {stylistEnabled
                    ? 'Turn an idea into a shoppable look'
                    : 'Teach Thriftage what catches your eye'}
                </Text>
                <Text style={styles.stylistBody}>
                  {stylistEnabled
                    ? 'Try an occasion, budget, color, or favorite piece.'
                    : 'The live stylist is resting; your private preferences still shape discovery.'}
                </Text>
              </View>
              <MaterialIcons color={marketplaceColors.forest} name="arrow-forward" size={20} />
            </Pressable>

            <View style={styles.feedHeading}>
              <SectionHeader
                eyebrow="CURATED FOR THE MOMENT"
                title={modes.find((item) => item.value === mode)?.label ?? 'Discover'}
              />
              <View style={styles.modeRow}>
                {modes.map((item) => (
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityState={{ selected: mode === item.value }}
                    key={item.value}
                    onPress={() => setMode(item.value)}
                    style={[styles.mode, mode === item.value && styles.modeActive]}
                  >
                    <MaterialIcons
                      color={
                        mode === item.value ? marketplaceColors.white : marketplaceColors.muted
                      }
                      name={item.icon}
                      size={15}
                    />
                    <Text style={[styles.modeText, mode === item.value && styles.modeTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {mode === 'RECOMMENDED' && styleProfile.data?.quizStatus !== 'COMPLETED' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/style-profile')}
                style={({ pressed }) => [styles.profilePrompt, pressed && styles.pressed]}
              >
                <View style={styles.promptProgress}>
                  <Text style={styles.promptProgressText}>
                    {Math.min(styleProfile.data?.quizStep ?? 0, 5)}/6
                  </Text>
                </View>
                <View style={styles.promptText}>
                  <Text style={styles.promptTitle}>Make this edit unmistakably yours</Text>
                  <Text style={styles.promptBody}>
                    Finish your private style profile for stronger matches and explanations.
                  </Text>
                </View>
                <MaterialIcons color={marketplaceColors.forest} name="arrow-forward" size={19} />
              </Pressable>
            ) : null}
            {hiddenListing !== null ? (
              <View style={styles.undo}>
                <Text numberOfLines={1} style={styles.undoText}>
                  Showing fewer pieces like “{hiddenListing.title}”
                </Text>
                <Pressable
                  accessibilityLabel="Undo not interested"
                  accessibilityRole="button"
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
  brand: {
    color: marketplaceColors.forest,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 3.2,
  },
  brandNote: {
    color: marketplaceColors.accent,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 3,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  content: { paddingBottom: 32, paddingHorizontal: 8 },
  editChip: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 126,
    padding: 9,
    paddingRight: 11,
  },
  editIcon: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.sand,
    borderRadius: 13,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  editRow: { gap: 9, paddingRight: 18 },
  editText: { color: marketplaceColors.text, flex: 1, fontSize: 12, fontWeight: '900' },
  feedHeading: { marginTop: marketplaceSpacing.xxxl },
  footerLoader: { marginVertical: marketplaceSpacing.xl },
  header: { paddingBottom: 14, paddingHorizontal: 10, paddingTop: 15 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerIcon: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  hero: {
    ...marketplaceShadows.floating,
    backgroundColor: marketplaceColors.forestDeep,
    borderRadius: marketplaceRadii.hero,
    marginBottom: marketplaceSpacing.md,
    marginTop: marketplaceSpacing.xl,
    minHeight: 282,
    overflow: 'hidden',
    padding: marketplaceSpacing.xxl,
  },
  heroButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: marketplaceColors.white,
    borderRadius: marketplaceRadii.pill,
    flexDirection: 'row',
    gap: 9,
    marginTop: marketplaceSpacing.xl,
    paddingHorizontal: 17,
    paddingVertical: 13,
  },
  heroButtonText: { color: marketplaceColors.forestDeep, fontSize: 12, fontWeight: '900' },
  heroCopy: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 11,
    maxWidth: 285,
  },
  heroEyebrow: {
    color: '#F6BFA9',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.2,
  },
  heroOrb: {
    backgroundColor: marketplaceColors.accent,
    borderRadius: 150,
    height: 210,
    opacity: 0.5,
    position: 'absolute',
    right: -88,
    top: -70,
    width: 210,
  },
  heroTitle: {
    color: marketplaceColors.white,
    fontSize: 37,
    fontWeight: '900',
    letterSpacing: -1.6,
    lineHeight: 40,
    marginTop: 16,
    maxWidth: 305,
  },
  mode: {
    alignItems: 'center',
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  modeActive: { backgroundColor: marketplaceColors.forest, borderColor: marketplaceColors.forest },
  modeRow: { flexDirection: 'row', gap: 6, marginTop: 15 },
  modeText: { color: marketplaceColors.muted, fontSize: 11, fontWeight: '900' },
  modeTextActive: { color: marketplaceColors.white },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  profilePrompt: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forestSoft,
    borderColor: '#CFDDD4',
    borderRadius: marketplaceRadii.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    marginTop: marketplaceSpacing.lg,
    padding: marketplaceSpacing.md,
  },
  promptBody: {
    color: marketplaceColors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  promptProgress: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forest,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  promptProgressText: { color: marketplaceColors.white, fontSize: 11, fontWeight: '900' },
  promptText: { flex: 1 },
  promptTitle: { color: marketplaceColors.forest, fontSize: 13, fontWeight: '900' },
  safeArea: { backgroundColor: marketplaceColors.background, flex: 1 },
  stylistBody: {
    color: marketplaceColors.muted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  stylistCard: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.accentSoft,
    borderColor: '#F3CCBC',
    borderRadius: marketplaceRadii.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    marginTop: marketplaceSpacing.md,
    padding: marketplaceSpacing.md,
  },
  stylistCardPaused: {
    backgroundColor: marketplaceColors.forestSoft,
    borderColor: '#CFDDD4',
  },
  stylistCopy: { flex: 1 },
  stylistEyebrow: {
    color: marketplaceColors.accentDeep,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  stylistIcon: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forest,
    borderRadius: 18,
    height: 50,
    justifyContent: 'center',
    width: 50,
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
    backgroundColor: marketplaceColors.ink,
    borderRadius: marketplaceRadii.md,
    flexDirection: 'row',
    marginTop: marketplaceSpacing.md,
    padding: marketplaceSpacing.md,
  },
  undoAction: { color: '#F4B85B', fontSize: 12, fontWeight: '900' },
  undoText: { color: marketplaceColors.white, flex: 1, fontSize: 11 },
});
