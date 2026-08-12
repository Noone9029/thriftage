import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import {
  formatMoney,
  marketplaceColors,
} from '../../../src/components/marketplace/marketplace-theme';
import { ReportPanel } from '../../../src/components/marketplace/report-panel';
import { useListingActions } from '../../../src/hooks/use-listing-actions';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';
import { useAuth } from '../../../src/providers/auth-provider';

export default function ListingDetailScreen() {
  const { width } = useWindowDimensions();
  const { listingId = '' } = useLocalSearchParams<{ listingId?: string }>();
  const [reporting, setReporting] = useState(false);
  const { state } = useAuth();
  const actions = useListingActions();
  const [startingConversation, setStartingConversation] = useState(false);
  const query = useQuery({
    queryFn: () => thriftageApiClient.getListing(listingId),
    queryKey: ['marketplace', 'listing', listingId],
  });
  if (query.isLoading) {
    return <MarketplaceState loading message="Loading listing details." title="Opening piece" />;
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
          <Pressable
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.topButton}
          >
            <MaterialIcons color={marketplaceColors.text} name="arrow-back" size={23} />
          </Pressable>
          {!ownListing ? (
            <View style={styles.topActions}>
              <Pressable onPress={() => actions.like.mutate(listing)} style={styles.topButton}>
                <MaterialIcons
                  color={listing.likedByViewer ? marketplaceColors.accent : marketplaceColors.text}
                  name={listing.likedByViewer ? 'favorite' : 'favorite-border'}
                  size={23}
                />
              </Pressable>
              <Pressable onPress={() => actions.save.mutate(listing)} style={styles.topButton}>
                <MaterialIcons
                  color={marketplaceColors.forest}
                  name={listing.savedByViewer ? 'bookmark' : 'bookmark-border'}
                  size={23}
                />
              </Pressable>
            </View>
          ) : null}
        </View>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
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
        <View style={styles.body}>
          <Text style={styles.category}>{listing.category.name.toUpperCase()}</Text>
          <Text style={styles.title}>{listing.title}</Text>
          <Text style={styles.price}>{formatMoney(listing.priceMinor, listing.currency)}</Text>
          {listing.status !== 'ACTIVE' ? (
            <Text style={styles.unavailableBanner}>
              {listing.status === 'SOLD' ? 'SOLD' : 'RESERVED — checkout unavailable'}
            </Text>
          ) : null}
          <Pressable
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
              <Text style={styles.username}>@{listing.seller.username}</Text>
            </View>
            <MaterialIcons color={marketplaceColors.muted} name="chevron-right" size={24} />
          </Pressable>
          <View style={styles.specs}>
            <Spec label="Condition" value={listing.condition.replaceAll('_', ' ')} />
            <Spec label="Size" value={listing.size} />
            <Spec label="Brand" value={listing.brand ?? 'Not specified'} />
            <Spec label="Color" value={listing.color ?? 'Not specified'} />
          </View>
          <Text style={styles.sectionTitle}>About this piece</Text>
          <Text style={styles.description}>{listing.description}</Text>
          <View style={styles.engagement}>
            <Text style={styles.engagementText}>{listing.likeCount} likes</Text>
            <Text style={styles.engagementText}>{listing.saveCount} saves</Text>
          </View>
          {!ownListing ? (
            <Pressable onPress={() => setReporting((value) => !value)}>
              <Text style={styles.reportLink}>Report this listing</Text>
            </Pressable>
          ) : null}
          {reporting ? (
            <ReportPanel listingId={listing.id} onClose={() => setReporting(false)} />
          ) : null}
          {!ownListing && listing.status === 'ACTIVE' ? (
            <View style={styles.commerceActions}>
              <Pressable
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
                <Text style={styles.messageButtonText}>Message seller</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push(`/checkout/${listing.id}`)}
                style={styles.buyButton}
              >
                <Text style={styles.buyButtonText}>Buy now</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>
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
    borderRadius: 15,
    flex: 1,
    padding: 16,
  },
  buyButtonText: { color: '#fff', fontWeight: '900' },
  commerceActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  messageButton: {
    alignItems: 'center',
    borderColor: marketplaceColors.forest,
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    padding: 16,
  },
  messageButtonText: { color: marketplaceColors.forest, fontWeight: '900' },
  avatar: { borderRadius: 24, height: 48, width: 48 },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#E2E8E2',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  body: { padding: 20 },
  category: {
    color: marketplaceColors.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  content: { paddingBottom: 40 },
  description: { color: marketplaceColors.text, fontSize: 14, lineHeight: 23, marginTop: 9 },
  engagement: {
    borderTopColor: marketplaceColors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 18,
    marginTop: 25,
    paddingTop: 15,
  },
  engagementText: { color: marketplaceColors.muted, fontSize: 12, fontWeight: '700' },
  price: { color: marketplaceColors.forest, fontSize: 22, fontWeight: '900', marginTop: 9 },
  reportLink: {
    color: marketplaceColors.danger,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 24,
    textAlign: 'center',
  },
  safeArea: { backgroundColor: marketplaceColors.background, flex: 1 },
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
  sellerText: { flex: 1, marginLeft: 11 },
  soldBy: { color: marketplaceColors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  spec: { width: '48%' },
  specLabel: { color: marketplaceColors.muted, fontSize: 10, fontWeight: '700' },
  specs: {
    backgroundColor: '#EAE6DD',
    borderRadius: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 18,
    padding: 15,
  },
  specValue: { color: marketplaceColors.text, fontSize: 13, fontWeight: '800', marginTop: 4 },
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
  topButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,253,248,0.92)',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
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
