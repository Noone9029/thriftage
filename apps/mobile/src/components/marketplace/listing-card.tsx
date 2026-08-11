import { MaterialIcons } from '@expo/vector-icons';
import type { ListingDetail } from '@thriftage/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney, marketplaceColors } from './marketplace-theme';

interface ListingCardProps {
  readonly listing: ListingDetail;
  readonly onLike?: (listing: ListingDetail) => void;
  readonly onSave?: (listing: ListingDetail) => void;
}

export function ListingCard({ listing, onLike, onSave }: ListingCardProps) {
  const cover = listing.images[0]?.url;
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityLabel={`View ${listing.title}`}
        accessibilityRole="button"
        onPress={() => router.push(`/listings/${listing.id}`)}
      >
        {cover === undefined ? (
          <View style={[styles.image, styles.placeholder]}>
            <MaterialIcons color={marketplaceColors.muted} name="checkroom" size={32} />
          </View>
        ) : (
          <Image
            cachePolicy="memory-disk"
            contentFit="cover"
            recyclingKey={listing.id}
            source={cover}
            style={styles.image}
            transition={160}
          />
        )}
        <View style={styles.body}>
          <Text numberOfLines={1} style={styles.title}>
            {listing.title}
          </Text>
          <Text style={styles.price}>{formatMoney(listing.priceMinor, listing.currency)}</Text>
          <View style={styles.metaRow}>
            <Text numberOfLines={1} style={styles.meta}>
              @{listing.seller.username} · {listing.size}
            </Text>
            <Text style={styles.condition}>{listing.condition.replaceAll('_', ' ')}</Text>
          </View>
        </View>
      </Pressable>
      {onLike !== undefined || onSave !== undefined ? (
        <View style={styles.actions}>
          {onLike !== undefined ? (
            <Pressable
              accessibilityLabel={listing.likedByViewer ? 'Unlike item' : 'Like item'}
              onPress={() => onLike(listing)}
              style={styles.iconButton}
            >
              <MaterialIcons
                color={listing.likedByViewer ? marketplaceColors.accent : marketplaceColors.muted}
                name={listing.likedByViewer ? 'favorite' : 'favorite-border'}
                size={20}
              />
              <Text style={styles.count}>{listing.likeCount}</Text>
            </Pressable>
          ) : null}
          {onSave !== undefined ? (
            <Pressable
              accessibilityLabel={listing.savedByViewer ? 'Remove saved item' : 'Save item'}
              onPress={() => onSave(listing)}
              style={styles.iconButton}
            >
              <MaterialIcons
                color={listing.savedByViewer ? marketplaceColors.forest : marketplaceColors.muted}
                name={listing.savedByViewer ? 'bookmark' : 'bookmark-border'}
                size={21}
              />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 10,
    paddingHorizontal: 10,
  },
  body: { gap: 4, padding: 10 },
  card: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    margin: 6,
    overflow: 'hidden',
  },
  condition: { color: marketplaceColors.success, fontSize: 9, fontWeight: '800' },
  count: { color: marketplaceColors.muted, fontSize: 11, fontWeight: '700' },
  iconButton: { alignItems: 'center', flexDirection: 'row', gap: 3, padding: 3 },
  image: { aspectRatio: 0.82, backgroundColor: '#E9E4DA', width: '100%' },
  meta: { color: marketplaceColors.muted, flex: 1, fontSize: 11 },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  price: { color: marketplaceColors.forest, fontSize: 14, fontWeight: '900' },
  title: { color: marketplaceColors.text, fontSize: 14, fontWeight: '700' },
});
