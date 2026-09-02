import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import { ListingCard } from '../../../src/components/marketplace/listing-card';
import {
  IconButton,
  SectionHeader,
  TrustPill,
} from '../../../src/components/marketplace/marketplace-primitives';
import { DetailSkeleton } from '../../../src/components/marketplace/marketplace-skeleton';
import {
  formatMoney,
  marketplaceColors,
  marketplaceRadii,
  marketplaceShadows,
} from '../../../src/components/marketplace/marketplace-theme';
import { ReportPanel } from '../../../src/components/marketplace/report-panel';
import { useListingActions } from '../../../src/hooks/use-listing-actions';
import { useRuntimeConfig } from '../../../src/hooks/use-runtime-config';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';
import { useAuth } from '../../../src/providers/auth-provider';

export default function ListingDetailScreen() {
  const { width } = useWindowDimensions();
  const { listingId = '' } = useLocalSearchParams<{ listingId?: string }>();
  const [reporting, setReporting] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const { state } = useAuth();
  const actions = useListingActions();
  const runtime = useRuntimeConfig();
  const [startingConversation, setStartingConversation] = useState(false);
  const [startingStylist, setStartingStylist] = useState(false);
  const query = useQuery({
    queryFn: () => thriftageApiClient.getListing(listingId),
    queryKey: ['marketplace', 'listing', listingId],
  });
  const similar = useQuery({
    enabled: listingId !== '',
    queryFn: () => thriftageApiClient.getSimilarListings(listingId),
    queryKey: ['marketplace', 'listing', listingId, 'similar'],
  });
  if (query.isLoading) {
    return <DetailSkeleton />;
  }
  if (query.isError || query.data === undefined) {
    return (
      <MarketplaceState
        actionLabel="Go back"
        message="This listing is unavailable or no longer active."
        onAction={() => router.back()}
        title="Listing unavailable"
      />
    );
  }
  const listing = query.data;
  const ownListing =
    state.status === 'AUTHENTICATED_ACTIVE' && state.account.id === listing.seller.id;
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <IconButton
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            icon="arrow-back"
          />
          {!ownListing ? (
            <View style={styles.topActions}>
              <IconButton
                accessibilityLabel="Share listing"
                icon="ios-share"
                onPress={() =>
                  void Share.share({
                    message: `See ${listing.title} on Thriftage — ${formatMoney(listing.priceMinor, listing.currency)}`,
                  })
                }
              />
              <IconButton
                accessibilityLabel={listing.likedByViewer ? 'Unlike item' : 'Like item'}
                active={listing.likedByViewer}
                icon={listing.likedByViewer ? 'favorite' : 'favorite-border'}
                onPress={() => actions.like.mutate(listing)}
              />
              <IconButton
                accessibilityLabel={listing.savedByViewer ? 'Remove saved item' : 'Save item'}
                active={listing.savedByViewer}
                icon={listing.savedByViewer ? 'bookmark' : 'bookmark-border'}
                onPress={() => actions.save.mutate(listing)}
              />
            </View>
          ) : null}
        </View>
        <View style={styles.gallery}>
          <ScrollView
            horizontal
            onMomentumScrollEnd={(event) =>
              setActiveImage(Math.round(event.nativeEvent.contentOffset.x / width))
            }
            pagingEnabled
            showsHorizontalScrollIndicator={false}
          >
            {listing.images.map((image) => (
              <Image
                cachePolicy="memory-disk"
                contentFit="cover"
                key={image.id}
                source={image.url}
                style={{ height: Math.min(width * 1.12, 620), width }}
              />
            ))}
          </ScrollView>
          {listing.images.length > 1 ? (
            <View style={styles.galleryCount}>
              <MaterialIcons color={marketplaceColors.white} name="collections" size={14} />
              <Text style={styles.galleryCountText}>
                {activeImage + 1}/{listing.images.length}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.body}>
          <View style={styles.identityRow}>
            <Text style={styles.category}>{listing.category.name.toUpperCase()}</Text>
            <Text style={styles.posted}>
              {listing.stockAvailable === 1
                ? 'LAST AVAILABLE PIECE'
                : `${listing.stockAvailable} AVAILABLE`}
            </Text>
          </View>
          <Text style={styles.title}>{listing.title}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatMoney(listing.priceMinor, listing.currency)}</Text>
            <TrustPill icon="verified-user" label="Protected checkout" tone="neutral" />
          </View>
          {listing.match !== null ? (
            <View style={styles.matchPanel}>
              <View style={styles.matchScore}>
                <Text style={styles.matchNumber}>{listing.match.score}%</Text>
                <Text style={styles.matchLabel}>STYLE MATCH</Text>
              </View>
              <View style={styles.matchReasons}>
                {listing.match.reasons.map((reason) => (
                  <View key={reason} style={styles.reasonRow}>
                    <MaterialIcons color={marketplaceColors.accent} name="check-circle" size={16} />
                    <Text style={styles.reasonText}>{reason}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {listing.status !== 'ACTIVE' ? (
            <Text style={styles.unavailableBanner}>
              {listing.status === 'SOLD' ? 'SOLD' : 'RESERVED — checkout unavailable'}
            </Text>
          ) : null}
          <Pressable
            accessibilityLabel={`View seller ${listing.seller.username}`}
            accessibilityRole="button"
            onPress={() => router.push(`/sellers/${listing.seller.username}`)}
            style={styles.seller}
          >
            {listing.seller.profileImageUrl === null ? (
              <View style={styles.avatarPlaceholder}>
                <MaterialIcons color={marketplaceColors.forest} name="person" size={24} />
              </View>
            ) : (
              <Image source={listing.seller.profileImageUrl} style={styles.avatar} />
            )}
            <View style={styles.sellerText}>
              <Text style={styles.soldBy}>SOLD BY</Text>
              <View style={styles.sellerNameRow}>
                <Text style={styles.username}>@{listing.seller.username}</Text>
                {listing.seller.sellerVerified ? (
                  <MaterialIcons color={marketplaceColors.success} name="verified" size={16} />
                ) : null}
              </View>
              <Text style={styles.sellerRating}>
                {listing.seller.sellerRating.average?.toFixed(1) ?? 'New'} ★ ·{' '}
                {listing.seller.sellerRating.count} reviews
              </Text>
            </View>
            <MaterialIcons color={marketplaceColors.muted} name="chevron-right" size={24} />
          </Pressable>
          <View style={styles.specs}>
            <Spec label="Condition" value={listing.condition.replaceAll('_', ' ')} />
            <Spec label="Size" value={listing.size} />
            <Spec label="Available" value={String(listing.stockAvailable)} />
            <Spec label="Brand" value={listing.brand ?? 'Not specified'} />
            <Spec label="Color" value={listing.color ?? 'Not specified'} />
          </View>
          <View style={styles.detailSectionHeader}>
            <SectionHeader eyebrow="THE DETAILS" title="About this piece" />
          </View>
          <Text style={styles.description}>{listing.description}</Text>
          {listing.personalization !== null ? (
            <View style={styles.tags}>
              {listing.personalization.styles.map((style) => (
                <Text key={style.id} style={styles.tag}>
                  {style.displayName}
                </Text>
              ))}
              <Text style={styles.tag}>{listing.personalization.fitType.replaceAll('_', ' ')}</Text>
              <Text style={styles.tag}>
                {listing.personalization.colorFamily.replaceAll('_', ' ')}
              </Text>
            </View>
          ) : null}
          <View style={styles.engagement}>
            <TrustPill icon="favorite" label={`${listing.likeCount} likes`} tone="accent" />
            <TrustPill icon="bookmark" label={`${listing.saveCount} saves`} tone="neutral" />
          </View>
          {!ownListing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: reporting }}
              onPress={() => setReporting((value) => !value)}
            >
              <Text style={styles.reportLink}>Report this listing</Text>
            </Pressable>
          ) : null}
          {reporting ? (
            <ReportPanel listingId={listing.id} onClose={() => setReporting(false)} />
          ) : null}
          {listing.status === 'ACTIVE' && runtime.data?.features.aiStylist === true ? (
            <Pressable
              accessibilityLabel={`Build an outfit around ${listing.title}`}
              accessibilityRole="button"
              accessibilityState={{ busy: startingStylist, disabled: startingStylist }}
              disabled={startingStylist}
              onPress={() => {
                setStartingStylist(true);
                void thriftageApiClient
                  .createStylistConversation({ anchorListingId: listing.id })
                  .then((conversation) =>
                    router.push({
                      pathname: '/stylist/[conversationId]',
                      params: {
                        anchorListingId: listing.id,
                        conversationId: conversation.id,
                        starter: 'Build an outfit around this piece.',
                      },
                    }),
                  )
                  .finally(() => setStartingStylist(false));
              }}
              style={styles.styleThisButton}
            >
              <MaterialIcons color={marketplaceColors.forest} name="auto-awesome" size={20} />
              <View style={styles.styleThisCopy}>
                <Text style={styles.styleThisTitle}>
                  {startingStylist ? 'Opening Stylist…' : 'Style this piece'}
                </Text>
                <Text style={styles.styleThisText}>
                  Build a complete look around it using eligible marketplace inventory.
                </Text>
              </View>
              <MaterialIcons color={marketplaceColors.forest} name="arrow-forward" size={20} />
            </Pressable>
          ) : null}
          {(similar.data?.items.length ?? 0) > 0 ? (
            <View style={styles.similarSection}>
              <SectionHeader eyebrow="KEEP EXPLORING" title="More like this" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.similarScroll}
              >
                {similar.data?.items.map((item) => (
                  <View key={item.id} style={styles.similarCard}>
                    <ListingCard listing={item} />
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </ScrollView>
      {!ownListing && listing.status === 'ACTIVE' ? (
        <View style={styles.stickyBar}>
          <View style={styles.stickyCopy}>
            <Text style={styles.stickyPrice}>
              {formatMoney(listing.priceMinor, listing.currency)}
            </Text>
            <Text style={styles.stickyHint}>Thriftage protected checkout</Text>
          </View>
          <Pressable
            accessibilityLabel="Message seller"
            accessibilityRole="button"
            accessibilityState={{ busy: startingConversation, disabled: startingConversation }}
            disabled={startingConversation}
            onPress={() => {
              setStartingConversation(true);
              void thriftageApiClient
                .startConversation(listing.id)
                .then((conversation) => router.push(`/messages/${conversation.id}`))
                .finally(() => setStartingConversation(false));
            }}
            style={styles.messageButton}
          >
            <MaterialIcons color={marketplaceColors.forest} name="chat-bubble-outline" size={20} />
          </Pressable>
          <Pressable
            accessibilityLabel={`Buy ${listing.title}`}
            accessibilityRole="button"
            onPress={() => router.push(`/checkout/${listing.id}`)}
            style={styles.buyButton}
          >
            <Text style={styles.buyButtonText}>Buy now</Text>
            <MaterialIcons color={marketplaceColors.white} name="arrow-forward" size={18} />
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.spec}>
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={styles.specValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  buyButton: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.accent,
    borderRadius: marketplaceRadii.lg,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 20,
  },
  buyButtonText: { color: '#fff', fontWeight: '900' },
  messageButton: {
    alignItems: 'center',
    borderColor: marketplaceColors.forest,
    borderRadius: marketplaceRadii.lg,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  styleThisButton: {
    alignItems: 'center',
    backgroundColor: '#E3EAE5',
    borderColor: '#CBD9CF',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
    padding: 14,
  },
  styleThisCopy: { flex: 1 },
  styleThisText: { color: marketplaceColors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  styleThisTitle: { color: marketplaceColors.forest, fontSize: 14, fontWeight: '900' },
  avatar: { borderRadius: 24, height: 48, width: 48 },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#E2E8E2',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  body: {
    backgroundColor: marketplaceColors.background,
    borderTopLeftRadius: marketplaceRadii.hero,
    borderTopRightRadius: marketplaceRadii.hero,
    marginTop: -24,
    padding: 20,
    paddingTop: 27,
  },
  category: {
    color: marketplaceColors.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  content: { paddingBottom: 120 },
  description: { color: marketplaceColors.text, fontSize: 14, lineHeight: 23, marginTop: 9 },
  engagement: { flexDirection: 'row', gap: 8, marginTop: 25 },
  gallery: { position: 'relative' },
  galleryCount: {
    alignItems: 'center',
    backgroundColor: 'rgba(14,43,35,0.78)',
    borderRadius: marketplaceRadii.pill,
    bottom: 38,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    position: 'absolute',
    right: 14,
    zIndex: 2,
  },
  galleryCountText: { color: marketplaceColors.white, fontSize: 10, fontWeight: '900' },
  detailSectionHeader: { marginTop: 25 },
  identityRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  matchLabel: { color: marketplaceColors.white, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  matchNumber: { color: marketplaceColors.white, fontSize: 24, fontWeight: '900' },
  matchPanel: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forest,
    borderRadius: 18,
    flexDirection: 'row',
    marginTop: 16,
    padding: 16,
  },
  matchReasons: { flex: 1, gap: 7, paddingLeft: 16 },
  matchScore: {
    alignItems: 'center',
    borderRightColor: 'rgba(255,255,255,0.25)',
    borderRightWidth: 1,
    paddingRight: 16,
  },
  reasonRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  reasonText: { color: marketplaceColors.white, flex: 1, fontSize: 11, fontWeight: '700' },
  posted: { color: marketplaceColors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  price: { color: marketplaceColors.forest, fontSize: 24, fontWeight: '900' },
  priceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  reportLink: {
    color: marketplaceColors.danger,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 24,
    textAlign: 'center',
  },
  safeArea: { backgroundColor: marketplaceColors.background, flex: 1 },
  similarCard: { width: 190 },
  similarScroll: { marginHorizontal: -6, marginTop: 10 },
  similarSection: { marginTop: 12 },
  sectionTitle: { color: marketplaceColors.text, fontSize: 18, fontWeight: '900', marginTop: 25 },
  seller: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 20,
    padding: 12,
  },
  sellerNameRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  sellerRating: { color: marketplaceColors.muted, fontSize: 10, marginTop: 4 },
  sellerText: { flex: 1, marginLeft: 11 },
  soldBy: { color: marketplaceColors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  spec: { width: '48%' },
  specLabel: { color: marketplaceColors.muted, fontSize: 10, fontWeight: '700' },
  specs: {
    backgroundColor: marketplaceColors.sand,
    borderRadius: marketplaceRadii.xl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 18,
    padding: 15,
  },
  specValue: { color: marketplaceColors.text, fontSize: 13, fontWeight: '800', marginTop: 4 },
  tag: {
    backgroundColor: '#E1E7E1',
    borderRadius: 999,
    color: marketplaceColors.forest,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
    textTransform: 'capitalize',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 18 },
  title: {
    color: marketplaceColors.text,
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 34,
    marginTop: 7,
  },
  topActions: { flexDirection: 'row', gap: 8 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    padding: 12,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
  stickyBar: {
    ...marketplaceShadows.floating,
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderTopColor: marketplaceColors.border,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    gap: 9,
    left: 0,
    padding: 12,
    position: 'absolute',
    right: 0,
  },
  stickyCopy: { flex: 1 },
  stickyHint: { color: marketplaceColors.muted, fontSize: 9, marginTop: 2 },
  stickyPrice: { color: marketplaceColors.forest, fontSize: 14, fontWeight: '900' },
  username: { color: marketplaceColors.forest, fontSize: 14, fontWeight: '900', marginTop: 3 },
  unavailableBanner: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8E4DB',
    borderRadius: 999,
    color: marketplaceColors.muted,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
});
