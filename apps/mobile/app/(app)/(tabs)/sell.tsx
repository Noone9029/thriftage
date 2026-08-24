import { MaterialIcons } from '@expo/vector-icons';
import type { ListingDetail, ListingPage } from '@thriftage/shared';
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ScreenHeader,
  SectionHeader,
} from '../../../src/components/marketplace/marketplace-primitives';
import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import { ListRowsSkeleton } from '../../../src/components/marketplace/marketplace-skeleton';
import {
  formatMoney,
  marketplaceColors,
  marketplaceRadii,
  marketplaceShadows,
  marketplaceSpacing,
} from '../../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';

export default function SellScreen() {
  const queryClient = useQueryClient();
  const listings = useInfiniteQuery<
    ListingPage,
    Error,
    InfiniteData<ListingPage>,
    readonly unknown[],
    string | null
  >({
    getNextPageParam: (page) => page.nextCursor,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => thriftageApiClient.getMyListings(pageParam ?? undefined),
    queryKey: ['marketplace', 'seller-listings'],
  });
  const archive = useMutation({
    mutationFn: (id: string) => thriftageApiClient.archiveListing(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketplace'] }),
  });
  const items = listings.data?.pages.flatMap((page) => page.items) ?? [];
  const draftCount = items.filter(({ status }) => ['DRAFT', 'REJECTED'].includes(status)).length;
  const reviewCount = items.filter(({ status }) => status === 'PENDING_REVIEW').length;
  const liveCount = items.filter(({ status }) => status === 'ACTIVE').length;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <FlatList<ListingDetail>
        ListEmptyComponent={
          listings.isLoading ? (
            <ListRowsSkeleton label="Loading your selling wardrobe" />
          ) : listings.isError ? (
            <MarketplaceState
              actionLabel="Try again"
              icon="cloud-off"
              message="Your selling wardrobe could not be refreshed. Your drafts are still safe."
              onAction={() => void listings.refetch()}
              title="Studio is offline"
            />
          ) : (
            <MarketplaceState
              actionLabel="Create your first listing"
              icon="add-photo-alternate"
              message="Turn a great piece into someone else's favorite. Three clear photos are enough to begin."
              onAction={() => router.push('/listing-editor/new')}
              title="Your wardrobe has potential"
            />
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader
              eyebrow="YOUR SELLING STUDIO"
              subtitle="List thoughtfully, build buyer trust, and give standout style another life."
              title="Your wardrobe, ready for its next story."
            />
            <View style={styles.sellerHero}>
              <View style={styles.heroOrb} />
              <Text style={styles.heroEyebrow}>LIST IN MINUTES</Text>
              <Text style={styles.heroTitle}>Shoot it. Describe it. Send it to review.</Text>
              <View style={styles.steps}>
                <Step icon="photo-camera" label="3+ clear photos" />
                <Step icon="sell" label="Honest details" />
                <Step icon="verified-user" label="Trusted review" />
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/listing-editor/new')}
                style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}
              >
                <MaterialIcons color={marketplaceColors.forestDeep} name="add" size={21} />
                <Text style={styles.createText}>List a piece</Text>
                <MaterialIcons
                  color={marketplaceColors.forestDeep}
                  name="arrow-forward"
                  size={18}
                />
              </Pressable>
            </View>
            <View style={styles.summaryRow}>
              <Summary label="Drafts" value={draftCount} />
              <Summary label="In review" value={reviewCount} />
              <Summary label="Live" value={liveCount} />
            </View>
            <View style={styles.sectionTitle}>
              <SectionHeader eyebrow="MANAGE YOUR PIECES" title="Selling wardrobe" />
            </View>
          </View>
        }
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={({ id }) => id}
        onEndReached={() => {
          if (listings.hasNextPage && !listings.isFetchingNextPage) void listings.fetchNextPage();
        }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.images[0] === undefined ? (
              <View style={[styles.image, styles.placeholder]}>
                <MaterialIcons color={marketplaceColors.forest} name="checkroom" size={27} />
              </View>
            ) : (
              <Image contentFit="cover" source={item.images[0].url} style={styles.image} />
            )}
            <View style={styles.cardBody}>
              <View style={styles.cardTop}>
                <Text numberOfLines={1} style={styles.title}>
                  {item.title}
                </Text>
                <View style={styles.statusPill}>
                  <Text style={styles.status}>{item.status.replaceAll('_', ' ')}</Text>
                </View>
              </View>
              <Text style={styles.price}>{formatMoney(item.priceMinor, item.currency)}</Text>
              <View style={styles.actions}>
                <Pressable
                  accessibilityLabel={`${['DRAFT', 'REJECTED'].includes(item.status) ? 'Manage' : 'View'} ${item.title}`}
                  accessibilityRole="button"
                  onPress={() => router.push(`/listing-editor/${item.id}`)}
                  style={styles.manageButton}
                >
                  <Text style={styles.manage}>
                    {['DRAFT', 'REJECTED'].includes(item.status) ? 'Manage draft' : 'View status'}
                  </Text>
                  <MaterialIcons color={marketplaceColors.success} name="arrow-forward" size={15} />
                </Pressable>
                {['ACTIVE', 'PENDING_REVIEW', 'REJECTED'].includes(item.status) ? (
                  <Pressable
                    accessibilityLabel={`Archive ${item.title}`}
                    accessibilityRole="button"
                    accessibilityState={{ busy: archive.isPending, disabled: archive.isPending }}
                    disabled={archive.isPending}
                    onPress={() => archive.mutate(item.id)}
                  >
                    <Text style={styles.archive}>Archive</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function Step({ icon, label }: { icon: keyof typeof MaterialIcons.glyphMap; label: string }) {
  return (
    <View style={styles.step}>
      <MaterialIcons color="#F6BCA5" name={icon} size={17} />
      <Text style={styles.stepText}>{label}</Text>
    </View>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { alignItems: 'center', flexDirection: 'row', gap: 18, marginTop: 10 },
  archive: { color: marketplaceColors.danger, fontSize: 11, fontWeight: '800' },
  card: {
    ...marketplaceShadows.card,
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.xl,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 11,
    overflow: 'hidden',
  },
  cardBody: { flex: 1, justifyContent: 'center', padding: 13 },
  cardTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  content: { padding: 16, paddingBottom: 36 },
  createButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: marketplaceColors.white,
    borderRadius: marketplaceRadii.lg,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    marginTop: marketplaceSpacing.xl,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  createText: { color: marketplaceColors.forestDeep, fontSize: 14, fontWeight: '900' },
  header: { paddingBottom: 12 },
  heroEyebrow: { color: '#F6BCA5', fontSize: 9, fontWeight: '900', letterSpacing: 1.8 },
  heroOrb: {
    backgroundColor: marketplaceColors.accent,
    borderRadius: 100,
    height: 160,
    opacity: 0.45,
    position: 'absolute',
    right: -65,
    top: -68,
    width: 160,
  },
  heroTitle: {
    color: marketplaceColors.white,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.6,
    lineHeight: 29,
    marginTop: 9,
    maxWidth: 290,
  },
  image: { height: 134, width: 104 },
  manage: { color: marketplaceColors.success, fontSize: 11, fontWeight: '900' },
  manageButton: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  placeholder: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.sand,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  price: { color: marketplaceColors.forest, fontSize: 14, fontWeight: '900', marginTop: 7 },
  safeArea: { backgroundColor: marketplaceColors.background, flex: 1 },
  sectionTitle: { marginTop: 30 },
  sellerHero: {
    ...marketplaceShadows.floating,
    backgroundColor: marketplaceColors.forestDeep,
    borderRadius: marketplaceRadii.hero,
    marginTop: marketplaceSpacing.xl,
    overflow: 'hidden',
    padding: marketplaceSpacing.xl,
  },
  status: { color: marketplaceColors.accentDeep, fontSize: 8, fontWeight: '900' },
  statusPill: {
    backgroundColor: marketplaceColors.accentSoft,
    borderRadius: marketplaceRadii.pill,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  step: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  stepText: { color: 'rgba(255,255,255,0.76)', fontSize: 9, fontWeight: '700' },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 11, marginTop: 18 },
  summary: { alignItems: 'center', flex: 1 },
  summaryLabel: { color: marketplaceColors.muted, fontSize: 9, marginTop: 3 },
  summaryRow: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: marketplaceSpacing.md,
    paddingVertical: 13,
  },
  summaryValue: { color: marketplaceColors.forest, fontSize: 16, fontWeight: '900' },
  title: { color: marketplaceColors.text, flex: 1, fontSize: 15, fontWeight: '800' },
});
