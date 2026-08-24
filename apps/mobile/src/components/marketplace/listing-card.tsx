import { MaterialIcons } from '@expo/vector-icons';
import type { ListingDetail } from '@thriftage/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  formatMoney,
  marketplaceColors,
  marketplaceRadii,
  marketplaceShadows,
  marketplaceSpacing,
} from './marketplace-theme';

interface ListingCardProps {
  readonly listing: ListingDetail;
  readonly onLike?: (listing: ListingDetail) => void;
  readonly onSave?: (listing: ListingDetail) => void;
  readonly onNotInterested?: (listing: ListingDetail) => void;
}

export function ListingCard({ listing, onLike, onSave, onNotInterested }: ListingCardProps) {
  const cover = listing.images[0]?.url;
  const condition = listing.condition === 'LIKE_NEW' ? 'Like new' : listing.condition.toLowerCase();
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityLabel={`View ${listing.title}, ${formatMoney(listing.priceMinor, listing.currency)}`}
        accessibilityRole="button"
        onPress={() => router.push(`/listings/${listing.id}`)}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <View>
          {cover === undefined ? (
            <View style={[styles.image, styles.placeholder]}>
              <View style={styles.placeholderMark}>
                <MaterialIcons color={marketplaceColors.forest} name="checkroom" size={28} />
              </View>
              <Text style={styles.placeholderText}>A fresh find</Text>
            </View>
          ) : (
            <Image
              cachePolicy="memory-disk"
              contentFit="cover"
              recyclingKey={listing.id}
              source={cover}
              style={styles.image}
              transition={180}
            />
          )}
          <View style={styles.imageShade} />
          <View style={styles.badges}>
            {listing.match !== null ? (
              <View style={styles.matchBadge}>
                <MaterialIcons color={marketplaceColors.white} name="auto-awesome" size={12} />
                <Text style={styles.matchText}>{listing.match.score}%</Text>
              </View>
            ) : null}
            <View style={styles.conditionBadge}>
              <Text style={styles.conditionText}>{condition}</Text>
            </View>
          </View>
          {onSave !== undefined ? (
            <Pressable
              accessibilityLabel={listing.savedByViewer ? 'Remove saved item' : 'Save item'}
              accessibilityRole="button"
              hitSlop={6}
              onPress={(event) => {
                event.stopPropagation();
                onSave(listing);
              }}
              style={styles.saveButton}
            >
              <MaterialIcons
                color={listing.savedByViewer ? marketplaceColors.accent : marketplaceColors.ink}
                name={listing.savedByViewer ? 'bookmark' : 'bookmark-border'}
                size={21}
              />
            </Pressable>
          ) : null}
          <View style={styles.imageMeta}>
            <Text numberOfLines={1} style={styles.imageMetaText}>
              {listing.brand ?? listing.category.name}
            </Text>
            <Text style={styles.imageMetaText}>Size {listing.size}</Text>
          </View>
        </View>
        <View style={styles.body}>
          <Text numberOfLines={2} style={styles.title}>
            {listing.title}
          </Text>
          <Text style={styles.price}>{formatMoney(listing.priceMinor, listing.currency)}</Text>
          <View style={styles.sellerRow}>
            {listing.seller.profileImageUrl === null ? (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarLetter}>
                  {listing.seller.username.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            ) : (
              <Image source={listing.seller.profileImageUrl} style={styles.avatar} />
            )}
            <Text numberOfLines={1} style={styles.seller}>
              @{listing.seller.username}
            </Text>
            {listing.seller.sellerVerified ? (
              <MaterialIcons color={marketplaceColors.success} name="verified" size={14} />
            ) : null}
          </View>
          {listing.match?.reasons[0] !== undefined ? (
            <View style={styles.reasonRow}>
              <View style={styles.reasonDot} />
              <Text numberOfLines={1} style={styles.reason}>
                {listing.match.reasons[0]}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      {onLike !== undefined || onNotInterested !== undefined ? (
        <View style={styles.actions}>
          {onLike !== undefined ? (
            <Pressable
              accessibilityLabel={listing.likedByViewer ? 'Unlike item' : 'Like item'}
              accessibilityRole="button"
              onPress={() => onLike(listing)}
              style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            >
              <MaterialIcons
                color={listing.likedByViewer ? marketplaceColors.accent : marketplaceColors.muted}
                name={listing.likedByViewer ? 'favorite' : 'favorite-border'}
                size={18}
              />
              <Text style={styles.count}>{listing.likeCount}</Text>
            </Pressable>
          ) : (
            <View />
          )}
          {onNotInterested !== undefined ? (
            <Pressable
              accessibilityLabel="Show me fewer items like this"
              accessibilityRole="button"
              onPress={() => onNotInterested(listing)}
              style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            >
              <MaterialIcons color={marketplaceColors.muted} name="visibility-off" size={17} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    minHeight: 34,
    paddingHorizontal: 2,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: marketplaceSpacing.sm,
    paddingHorizontal: marketplaceSpacing.md,
  },
  avatar: { borderRadius: 10, height: 20, width: 20 },
  avatarLetter: { color: marketplaceColors.forest, fontSize: 9, fontWeight: '900' },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forestSoft,
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  badges: {
    flexDirection: 'row',
    gap: 5,
    left: marketplaceSpacing.sm,
    position: 'absolute',
    top: marketplaceSpacing.sm,
  },
  body: { gap: 5, padding: marketplaceSpacing.md },
  card: {
    ...marketplaceShadows.card,
    backgroundColor: marketplaceColors.paper,
    borderColor: 'rgba(227,221,210,0.8)',
    borderRadius: marketplaceRadii.xl,
    borderWidth: 1,
    flex: 1,
    margin: 6,
    overflow: 'hidden',
  },
  conditionBadge: {
    backgroundColor: 'rgba(255,252,247,0.92)',
    borderRadius: marketplaceRadii.pill,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  conditionText: {
    color: marketplaceColors.forest,
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  count: { color: marketplaceColors.muted, fontSize: 11, fontWeight: '800' },
  image: { aspectRatio: 0.74, backgroundColor: marketplaceColors.sand, width: '100%' },
  imageMeta: {
    alignItems: 'center',
    bottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 10,
    position: 'absolute',
    right: 10,
  },
  imageMetaText: {
    color: marketplaceColors.white,
    fontSize: 9,
    fontWeight: '900',
    maxWidth: '62%',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 3,
    textTransform: 'uppercase',
  },
  imageShade: {
    backgroundColor: 'rgba(14,28,23,0.13)',
    bottom: 0,
    height: 56,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  matchBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(22,61,50,0.92)',
    borderRadius: marketplaceRadii.pill,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  matchText: { color: marketplaceColors.white, fontSize: 9, fontWeight: '900' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderMark: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  placeholderText: {
    color: marketplaceColors.muted,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 9,
  },
  pressed: { opacity: 0.78 },
  price: { color: marketplaceColors.forest, fontSize: 15, fontWeight: '900' },
  reason: { color: marketplaceColors.accentDeep, flex: 1, fontSize: 9, fontWeight: '800' },
  reasonDot: {
    backgroundColor: marketplaceColors.accent,
    borderRadius: 3,
    height: 5,
    width: 5,
  },
  reasonRow: { alignItems: 'center', flexDirection: 'row', gap: 5, marginTop: 2 },
  saveButton: {
    ...marketplaceShadows.card,
    alignItems: 'center',
    backgroundColor: 'rgba(255,252,247,0.94)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: marketplaceSpacing.sm,
    top: marketplaceSpacing.sm,
    width: 36,
  },
  seller: { color: marketplaceColors.muted, flex: 1, fontSize: 10, fontWeight: '700' },
  sellerRow: { alignItems: 'center', flexDirection: 'row', gap: 5, marginTop: 2 },
  title: {
    color: marketplaceColors.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.15,
    lineHeight: 18,
    minHeight: 36,
  },
});
