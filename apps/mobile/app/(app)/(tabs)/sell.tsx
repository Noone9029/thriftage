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

import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import {
  formatMoney,
  marketplaceColors,
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

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <FlatList<ListingDetail>
        ListEmptyComponent={
          listings.isLoading ? (
            <MarketplaceState
              loading
              message="Loading your selling workspace."
              title="Opening wardrobe"
            />
          ) : (
            <MarketplaceState
              actionLabel="Create your first listing"
              icon="add-photo-alternate"
              message="Photograph a piece, add the details, and submit it for marketplace review."
              onAction={() => router.push('/listing-editor/new')}
              title="Start selling"
            />
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>YOUR WARDROBE</Text>
            <Text style={styles.heading}>Sell with confidence</Text>
            <Text style={styles.copy}>
              Draft privately, add up to ten photos, then submit for review.
            </Text>
            <Pressable
              onPress={() => router.push('/listing-editor/new')}
              style={styles.createButton}
            >
              <MaterialIcons color={marketplaceColors.white} name="add" size={21} />
              <Text style={styles.createText}>Create listing</Text>
            </Pressable>
            <Text style={styles.sectionTitle}>Your listings</Text>
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
                <MaterialIcons color={marketplaceColors.muted} name="checkroom" size={27} />
              </View>
            ) : (
              <Image contentFit="cover" source={item.images[0].url} style={styles.image} />
            )}
            <View style={styles.cardBody}>
              <View style={styles.cardTop}>
                <Text numberOfLines={1} style={styles.title}>
                  {item.title}
                </Text>
                <Text style={styles.status}>{item.status.replaceAll('_', ' ')}</Text>
              </View>
              <Text style={styles.price}>{formatMoney(item.priceMinor, item.currency)}</Text>
              <View style={styles.actions}>
                <Pressable onPress={() => router.push(`/listing-editor/${item.id}`)}>
                  <Text style={styles.manage}>
                    {['DRAFT', 'REJECTED'].includes(item.status) ? 'Manage draft' : 'View status'}
                  </Text>
                </Pressable>
                {['ACTIVE', 'PENDING_REVIEW', 'REJECTED'].includes(item.status) ? (
                  <Pressable onPress={() => archive.mutate(item.id)}>
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

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 20, marginTop: 9 },
  archive: { color: marketplaceColors.danger, fontSize: 12, fontWeight: '800' },
  card: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardBody: { flex: 1, justifyContent: 'center', padding: 13 },
  cardTop: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  content: { padding: 16, paddingBottom: 36 },
  copy: {
    color: marketplaceColors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 360,
  },
  createButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: marketplaceColors.accent,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 7,
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  createText: { color: marketplaceColors.white, fontSize: 14, fontWeight: '900' },
  eyebrow: { color: marketplaceColors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  header: { paddingBottom: 12 },
  heading: { color: marketplaceColors.forest, fontSize: 30, fontWeight: '900', marginTop: 8 },
  image: { height: 120, width: 94 },
  manage: { color: marketplaceColors.success, fontSize: 12, fontWeight: '900' },
  placeholder: { alignItems: 'center', backgroundColor: '#E9E4DA', justifyContent: 'center' },
  price: { color: marketplaceColors.forest, fontSize: 14, fontWeight: '800', marginTop: 7 },
  safeArea: { backgroundColor: marketplaceColors.background, flex: 1 },
  sectionTitle: { color: marketplaceColors.text, fontSize: 19, fontWeight: '900', marginTop: 28 },
  status: { color: marketplaceColors.accent, fontSize: 9, fontWeight: '900' },
  title: { color: marketplaceColors.text, flex: 1, fontSize: 15, fontWeight: '800' },
});
