import { MaterialIcons } from '@expo/vector-icons';
import type { AiStylistOutfit, ListingDetail } from '@thriftage/shared';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatMoney, marketplaceColors } from '../marketplace/marketplace-theme';

interface OutfitCardProps {
  readonly messaging: boolean;
  readonly outfit: AiStylistOutfit;
  readonly onMessageSeller: (listingId: string) => void;
  readonly onOpenListing: (listingId: string) => void;
  readonly onSaveItem: (listing: ListingDetail) => void;
  readonly onSaveOutfit: (outfit: AiStylistOutfit) => void;
  readonly onShopListing: (listingId: string) => void;
  readonly saved: boolean;
  readonly saving: boolean;
}

export function OutfitCard({
  messaging,
  outfit,
  onMessageSeller,
  onOpenListing,
  onSaveItem,
  onSaveOutfit,
  onShopListing,
  saved,
  saving,
}: OutfitCardProps) {
  const unavailableCount = outfit.items.filter(({ available }) => !available).length;
  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>{outfit.matchScore}% OUTFIT MATCH</Text>
          <Text style={styles.title}>{outfit.title}</Text>
        </View>
        <View style={styles.totalPill}>
          <Text style={styles.totalText}>
            {outfit.totalPriceMinor === null || outfit.currency === null
              ? 'Check items'
              : formatMoney(outfit.totalPriceMinor, outfit.currency)}
          </Text>
        </View>
      </View>
      <Text style={styles.explanation}>{outfit.explanation}</Text>
      {unavailableCount > 0 ? (
        <View style={styles.warning}>
          <MaterialIcons color={marketplaceColors.danger} name="inventory-2" size={17} />
          <Text style={styles.warningText}>
            {unavailableCount} {unavailableCount === 1 ? 'piece is' : 'pieces are'} unavailable.
            Your saved history is intact; request a replacement before shopping.
          </Text>
        </View>
      ) : null}
      <ScrollView
        accessibilityLabel={`${outfit.title} marketplace items`}
        contentContainerStyle={styles.items}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {outfit.items.map(({ available, listing, role, uncertainConstraints }) => {
          const cover = listing.images[0]?.url;
          return (
            <View key={`${outfit.id}-${role}-${listing.id}`} style={styles.item}>
              <Pressable
                accessibilityLabel={
                  available ? `View ${listing.title}` : `${listing.title} is unavailable`
                }
                accessibilityRole="button"
                disabled={!available}
                onPress={() => onOpenListing(listing.id)}
              >
                {cover === undefined ? (
                  <View style={[styles.image, styles.placeholder]}>
                    <MaterialIcons color={marketplaceColors.muted} name="checkroom" size={28} />
                  </View>
                ) : (
                  <Image
                    cachePolicy="memory-disk"
                    contentFit="cover"
                    recyclingKey={listing.id}
                    source={cover}
                    style={[styles.image, !available && styles.unavailableImage]}
                  />
                )}
                {!available ? (
                  <View style={styles.unavailableBadge}>
                    <Text style={styles.unavailableText}>UNAVAILABLE</Text>
                  </View>
                ) : null}
                <Text style={styles.role}>{role.replaceAll('_', ' ')}</Text>
                <Text numberOfLines={2} style={styles.itemTitle}>
                  {listing.title}
                </Text>
                <Text style={styles.price}>
                  {formatMoney(listing.priceMinor, listing.currency)}
                </Text>
                <Text numberOfLines={1} style={styles.size}>
                  Size {listing.size} · @{listing.seller.username}
                </Text>
              </Pressable>
              {uncertainConstraints.map((uncertainty) => (
                <Text key={uncertainty} numberOfLines={2} style={styles.uncertainty}>
                  {uncertainty}
                </Text>
              ))}
              {available ? (
                <View style={styles.itemActions}>
                  <Pressable
                    accessibilityLabel={`Save ${listing.title}`}
                    onPress={() => onSaveItem(listing)}
                    style={styles.secondaryAction}
                  >
                    <MaterialIcons
                      color={marketplaceColors.forest}
                      name="bookmark-border"
                      size={17}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Message seller about ${listing.title}`}
                    disabled={messaging}
                    onPress={() => onMessageSeller(listing.id)}
                    style={styles.messageAction}
                  >
                    <Text style={styles.messageText}>{messaging ? 'Opening...' : 'Message'}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Shop ${listing.title}`}
                    onPress={() => onShopListing(listing.id)}
                    style={styles.shopAction}
                  >
                    <Text style={styles.shopText}>Shop</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
      {outfit.unmetConstraints.map((constraint) => (
        <View key={constraint} style={styles.constraintRow}>
          <MaterialIcons color={marketplaceColors.muted} name="info-outline" size={16} />
          <Text style={styles.constraintText}>{constraint}</Text>
        </View>
      ))}
      <Pressable
        accessibilityLabel={saved ? `${outfit.title} saved` : `Save ${outfit.title}`}
        disabled={saved || saving}
        onPress={() => onSaveOutfit(outfit)}
        style={[styles.saveOutfit, saved && styles.saveOutfitDone]}
      >
        {saving ? (
          <ActivityIndicator color={marketplaceColors.white} size="small" />
        ) : (
          <MaterialIcons
            color={saved ? marketplaceColors.forest : marketplaceColors.white}
            name={saved ? 'check-circle' : 'library-add'}
            size={19}
          />
        )}
        <Text style={[styles.saveOutfitText, saved && styles.saveOutfitTextDone]}>
          {saved ? 'Outfit saved' : 'Save this outfit'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    overflow: 'hidden',
    paddingBottom: 16,
    paddingTop: 18,
  },
  constraintRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 18,
  },
  constraintText: { color: marketplaceColors.muted, flex: 1, fontSize: 11, lineHeight: 16 },
  explanation: {
    color: marketplaceColors.text,
    fontSize: 14,
    lineHeight: 21,
    paddingHorizontal: 18,
  },
  eyebrow: { color: marketplaceColors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  headingCopy: { flex: 1, paddingRight: 10 },
  headingRow: { alignItems: 'flex-start', flexDirection: 'row', paddingHorizontal: 18 },
  image: { backgroundColor: '#E9E4DA', borderRadius: 14, height: 156, width: '100%' },
  item: { width: 154 },
  itemActions: { flexDirection: 'row', gap: 7, marginTop: 10 },
  itemTitle: {
    color: marketplaceColors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
    marginTop: 5,
  },
  items: { gap: 11, paddingHorizontal: 18 },
  messageAction: {
    alignItems: 'center',
    borderColor: marketplaceColors.forest,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 9,
  },
  messageText: { color: marketplaceColors.forest, fontSize: 10, fontWeight: '900' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  price: { color: marketplaceColors.forest, fontSize: 13, fontWeight: '900', marginTop: 5 },
  role: {
    color: marketplaceColors.accent,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 9,
  },
  saveOutfit: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: marketplaceColors.forest,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginHorizontal: 18,
    marginTop: 2,
    padding: 14,
  },
  saveOutfitDone: { backgroundColor: '#DDE7E1' },
  saveOutfitText: { color: marketplaceColors.white, fontSize: 13, fontWeight: '900' },
  saveOutfitTextDone: { color: marketplaceColors.forest },
  secondaryAction: {
    alignItems: 'center',
    borderColor: marketplaceColors.border,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  shopAction: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.accent,
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 9,
  },
  shopText: { color: marketplaceColors.white, fontSize: 11, fontWeight: '900' },
  size: { color: marketplaceColors.muted, fontSize: 10, marginTop: 3 },
  title: {
    color: marketplaceColors.forest,
    fontSize: 21,
    fontWeight: '900',
    lineHeight: 25,
    marginTop: 4,
  },
  totalPill: {
    backgroundColor: '#E3EAE5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  totalText: { color: marketplaceColors.forest, fontSize: 10, fontWeight: '900' },
  unavailableBadge: {
    backgroundColor: marketplaceColors.danger,
    borderRadius: 999,
    left: 7,
    paddingHorizontal: 7,
    paddingVertical: 5,
    position: 'absolute',
    top: 7,
  },
  unavailableImage: { opacity: 0.48 },
  unavailableText: { color: marketplaceColors.white, fontSize: 8, fontWeight: '900' },
  uncertainty: { color: marketplaceColors.muted, fontSize: 9, lineHeight: 13, marginTop: 5 },
  warning: {
    alignItems: 'flex-start',
    backgroundColor: '#F8E7E4',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 7,
    marginHorizontal: 18,
    padding: 10,
  },
  warningText: { color: marketplaceColors.danger, flex: 1, fontSize: 11, lineHeight: 16 },
});
