import { MaterialIcons } from '@expo/vector-icons';
import type { SavedOutfit, SavedOutfitPage } from '@thriftage/shared';
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import {
  formatMoney,
  marketplaceColors,
} from '../../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';

export default function SavedStylistOutfitsScreen() {
  const queryClient = useQueryClient();
  const outfits = useInfiniteQuery<
    SavedOutfitPage,
    Error,
    InfiniteData<SavedOutfitPage>,
    readonly unknown[],
    string | undefined
  >({
    getNextPageParam: ({ nextCursor }) => nextCursor ?? undefined,
    initialPageParam: undefined,
    queryFn: ({ pageParam }) => thriftageApiClient.getSavedStylistOutfits(pageParam),
    queryKey: ['ai-stylist', 'saved-outfits'],
  });
  const replace = useMutation({
    mutationFn: ({ itemId, outfitId }: { itemId: string; outfitId: string }) =>
      thriftageApiClient.replaceSavedStylistOutfitItem(outfitId, itemId, {
        requestId: Crypto.randomUUID(),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-stylist', 'saved-outfits'] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => thriftageApiClient.deleteSavedStylistOutfit(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-stylist', 'saved-outfits'] }),
  });
  const items = outfits.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList<SavedOutfit>
        ListEmptyComponent={
          outfits.isLoading ? (
            <MarketplaceState
              loading
              message="Rechecking each item’s current availability."
              title="Loading saved outfits"
            />
          ) : outfits.isError ? (
            <MarketplaceState
              actionLabel="Try again"
              icon="cloud-off"
              message="Saved outfits could not be loaded."
              onAction={() => void outfits.refetch()}
              title="Outfits unavailable"
            />
          ) : (
            <MarketplaceState
              icon="collections-bookmark"
              message="Save a complete look from a Stylist conversation to keep it here."
              title="No saved outfits yet"
            />
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              style={styles.back}
            >
              <MaterialIcons color={marketplaceColors.forest} name="arrow-back" size={22} />
            </Pressable>
            <Text style={styles.eyebrow}>PRIVATE COLLECTION</Text>
            <Text style={styles.title}>Saved outfits</Text>
            <Text style={styles.copy}>
              Listing status and prices are checked again whenever you open this collection.
            </Text>
          </View>
        }
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={({ id }) => id}
        onEndReached={() => {
          if (outfits.hasNextPage && !outfits.isFetchingNextPage) void outfits.fetchNextPage();
        }}
        renderItem={({ item: outfit }) => (
          <View style={styles.outfitCard}>
            <View style={styles.outfitHeading}>
              <View style={styles.outfitHeadingCopy}>
                <Text style={styles.outfitTitle}>{outfit.title}</Text>
                <Text style={styles.date}>
                  Saved {new Date(outfit.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Pressable
                accessibilityLabel={`Delete ${outfit.title}`}
                onPress={() =>
                  Alert.alert(
                    'Delete saved outfit?',
                    'The original Stylist conversation is not affected.',
                    [
                      { style: 'cancel', text: 'Keep' },
                      {
                        onPress: () => remove.mutate(outfit.id),
                        style: 'destructive',
                        text: 'Delete',
                      },
                    ],
                  )
                }
                style={styles.deleteButton}
              >
                <MaterialIcons color={marketplaceColors.danger} name="delete-outline" size={20} />
              </Pressable>
            </View>
            <View style={styles.outfitItems}>
              {outfit.items.map((item) => {
                const listing = item.listing;
                return (
                  <View key={item.id} style={styles.itemCard}>
                    {listing?.images[0]?.url === undefined ? (
                      <View style={[styles.itemImage, styles.placeholder]}>
                        <MaterialIcons color={marketplaceColors.muted} name="checkroom" size={27} />
                      </View>
                    ) : (
                      <Pressable
                        disabled={!item.available}
                        onPress={() => router.push(`/listings/${listing.id}`)}
                      >
                        <Image
                          source={listing.images[0].url}
                          style={[styles.itemImage, !item.available && styles.unavailableImage]}
                        />
                      </Pressable>
                    )}
                    <Text style={styles.role}>{item.role.replaceAll('_', ' ')}</Text>
                    <Text numberOfLines={1} style={styles.itemTitle}>
                      {listing?.title ?? 'Historical listing'}
                    </Text>
                    {listing === null ? (
                      <Text style={styles.unavailable}>UNAVAILABLE</Text>
                    ) : (
                      <>
                        <Text style={styles.price}>
                          {formatMoney(listing.priceMinor, listing.currency)}
                        </Text>
                        <Text style={styles.size}>Size {listing.size}</Text>
                      </>
                    )}
                    {!item.available ? (
                      <Pressable
                        disabled={replace.isPending}
                        onPress={() => replace.mutate({ itemId: item.id, outfitId: outfit.id })}
                        style={styles.replaceButton}
                      >
                        <MaterialIcons color={marketplaceColors.white} name="autorenew" size={15} />
                        <Text style={styles.replaceText}>
                          {replace.isPending ? 'Finding…' : 'Find replacement'}
                        </Text>
                      </Pressable>
                    ) : listing !== null ? (
                      <Pressable
                        onPress={() =>
                          router.push(
                            outfit.sourceGenerationId === null
                              ? `/checkout/${listing.id}`
                              : `/checkout/${listing.id}?aiGenerationId=${outfit.sourceGenerationId}`,
                          )
                        }
                        style={styles.shopButton}
                      >
                        <Text style={styles.shopText}>Shop item</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
            {replace.isError ? (
              <Text style={styles.error}>
                No eligible replacement is available for that role yet.
              </Text>
            ) : null}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  content: { paddingBottom: 30, paddingHorizontal: 15 },
  copy: { color: marketplaceColors.muted, fontSize: 13, lineHeight: 19, marginTop: 7 },
  date: { color: marketplaceColors.muted, fontSize: 10, marginTop: 4 },
  deleteButton: { padding: 7 },
  error: { color: marketplaceColors.danger, fontSize: 11, marginTop: 11 },
  eyebrow: {
    color: marketplaceColors.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 20,
  },
  header: { paddingBottom: 18, paddingTop: 8 },
  itemCard: { backgroundColor: '#F8F5EE', borderRadius: 14, padding: 9, width: '48%' },
  itemImage: { backgroundColor: '#E9E4DA', borderRadius: 11, height: 140, width: '100%' },
  itemTitle: { color: marketplaceColors.text, fontSize: 11, fontWeight: '800', marginTop: 4 },
  outfitCard: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 21,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  outfitHeading: { alignItems: 'flex-start', flexDirection: 'row', marginBottom: 12 },
  outfitHeadingCopy: { flex: 1 },
  outfitItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  outfitTitle: { color: marketplaceColors.forest, fontSize: 18, fontWeight: '900' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  price: { color: marketplaceColors.forest, fontSize: 11, fontWeight: '900', marginTop: 5 },
  replaceButton: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.accent,
    borderRadius: 9,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    marginTop: 8,
    paddingHorizontal: 7,
    paddingVertical: 8,
  },
  replaceText: { color: marketplaceColors.white, fontSize: 9, fontWeight: '900' },
  role: {
    color: marketplaceColors.accent,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 7,
  },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  shopButton: {
    alignItems: 'center',
    borderColor: marketplaceColors.forest,
    borderRadius: 9,
    borderWidth: 1,
    marginTop: 8,
    padding: 8,
  },
  shopText: { color: marketplaceColors.forest, fontSize: 9, fontWeight: '900' },
  size: { color: marketplaceColors.muted, fontSize: 9, marginTop: 3 },
  title: {
    color: marketplaceColors.forest,
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: 7,
  },
  unavailable: { color: marketplaceColors.danger, fontSize: 9, fontWeight: '900', marginTop: 6 },
  unavailableImage: { opacity: 0.45 },
});
