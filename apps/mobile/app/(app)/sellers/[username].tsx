import { MaterialIcons } from '@expo/vector-icons';
import type { ListingDetail } from '@thriftage/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListingCard } from '../../../src/components/marketplace/listing-card';
import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import { marketplaceColors } from '../../../src/components/marketplace/marketplace-theme';
import { ReportPanel } from '../../../src/components/marketplace/report-panel';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';
import { useAuth } from '../../../src/providers/auth-provider';

export default function SellerProfileScreen() {
  const { username = '' } = useLocalSearchParams<{ username?: string }>();
  const { state } = useAuth();
  const queryClient = useQueryClient();
  const [reporting, setReporting] = useState(false);
  const seller = useQuery({
    queryFn: () => thriftageApiClient.getSeller(username),
    queryKey: ['marketplace', 'seller', username],
  });
  const follow = useMutation({
    mutationFn: () => {
      if (seller.data === undefined) return Promise.reject(new Error('Seller unavailable.'));
      return thriftageApiClient.setFollow(
        seller.data.profile.id,
        !seller.data.profile.followedByViewer,
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['marketplace', 'seller', username] }),
  });
  const block = useMutation({
    mutationFn: () => thriftageApiClient.blockUser(seller.data!.profile.id),
    onSuccess: () => router.back(),
  });
  if (seller.isLoading) {
    return (
      <MarketplaceState
        loading
        message="Loading this seller's public wardrobe."
        title="Opening profile"
      />
    );
  }
  if (seller.isError || seller.data === undefined) {
    return (
      <MarketplaceState
        actionLabel="Go back"
        message="This profile is unavailable."
        onAction={() => router.back()}
        title="Seller not found"
      />
    );
  }
  const profile = seller.data.profile;
  const ownProfile = state.status === 'AUTHENTICATED_ACTIVE' && state.account.id === profile.id;
  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList<ListingDetail>
        ListEmptyComponent={
          <MarketplaceState
            message="This seller has no active marketplace listings."
            title="Wardrobe is empty"
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.topRow}>
              <Pressable onPress={() => router.back()} style={styles.back}>
                <MaterialIcons color={marketplaceColors.text} name="arrow-back" size={23} />
              </Pressable>
              {!ownProfile ? (
                <View style={styles.safetyActions}>
                  <Pressable onPress={() => setReporting((value) => !value)}>
                    <MaterialIcons color={marketplaceColors.muted} name="flag" size={21} />
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      Alert.alert(
                        `Block @${profile.username}?`,
                        'You will no longer see each other in discovery or be able to start new social interactions. Existing transaction records remain available.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Block', style: 'destructive', onPress: () => block.mutate() },
                        ],
                      )
                    }
                  >
                    <MaterialIcons color={marketplaceColors.danger} name="block" size={21} />
                  </Pressable>
                </View>
              ) : null}
            </View>
            <View style={styles.identity}>
              {profile.profileImageUrl === null ? (
                <View style={styles.avatarPlaceholder}>
                  <MaterialIcons color={marketplaceColors.forest} name="person" size={38} />
                </View>
              ) : (
                <Image source={profile.profileImageUrl} style={styles.avatar} />
              )}
              <Text style={styles.username}>@{profile.username}</Text>
              {profile.sellerVerified ? (
                <Text style={styles.verified}>✓ Verified seller</Text>
              ) : null}
              {profile.university !== null ? (
                <Text style={styles.university}>{profile.university}</Text>
              ) : null}
              {profile.bio !== null ? <Text style={styles.bio}>{profile.bio}</Text> : null}
              {!ownProfile ? (
                <Pressable
                  onPress={() => follow.mutate()}
                  style={[styles.follow, profile.followedByViewer && styles.following]}
                >
                  <Text
                    style={[styles.followText, profile.followedByViewer && styles.followingText]}
                  >
                    {profile.followedByViewer ? 'Following' : 'Follow seller'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.stats}>
              <Stat label="Listings" value={profile.listingCount} />
              <Stat label="Followers" value={profile.followerCount} />
              <Stat label="Following" value={profile.followingCount} />
              <Stat label="Sales" value={profile.completedSalesCount} />
            </View>
            <Pressable
              onPress={() => router.push(`/reviews/users/${profile.username}`)}
              style={styles.reputation}
            >
              <Text style={styles.reputationText}>
                Seller {profile.sellerRating.average?.toFixed(1) ?? '—'} ★ ·{' '}
                {profile.sellerRating.count} reviews
              </Text>
              <Text style={styles.reputationText}>
                Buyer {profile.buyerRating.average?.toFixed(1) ?? '—'} ★ ·{' '}
                {profile.buyerRating.count} reviews
              </Text>
              <Text style={styles.reviewLink}>View seller reviews</Text>
            </Pressable>
            {reporting ? (
              <ReportPanel onClose={() => setReporting(false)} userId={profile.id} />
            ) : null}
            <Text style={styles.section}>Active listings</Text>
          </View>
        }
        contentContainerStyle={styles.content}
        data={seller.data.listings.items}
        keyExtractor={({ id }) => id}
        numColumns={2}
        renderItem={({ item }) => <ListingCard listing={item} />}
      />
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { borderRadius: 47, height: 94, width: 94 },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#E1E7E1',
    borderRadius: 47,
    height: 94,
    justifyContent: 'center',
    width: 94,
  },
  back: { padding: 3 },
  bio: {
    color: marketplaceColors.text,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 12,
    maxWidth: 330,
    textAlign: 'center',
  },
  content: { paddingBottom: 35, paddingHorizontal: 8 },
  follow: {
    backgroundColor: marketplaceColors.forest,
    borderRadius: 999,
    marginTop: 17,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  followText: { color: marketplaceColors.white, fontSize: 13, fontWeight: '900' },
  following: {
    backgroundColor: 'transparent',
    borderColor: marketplaceColors.forest,
    borderWidth: 1,
  },
  followingText: { color: marketplaceColors.forest },
  header: { paddingBottom: 12, paddingHorizontal: 10 },
  identity: { alignItems: 'center', marginTop: 6 },
  safeArea: { backgroundColor: marketplaceColors.background, flex: 1 },
  safetyActions: { flexDirection: 'row', gap: 18 },
  verified: { color: marketplaceColors.accent, fontSize: 12, fontWeight: '900', marginTop: 7 },
  reputation: { gap: 5, marginTop: 13, paddingHorizontal: 6 },
  reputationText: {
    color: marketplaceColors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  reviewLink: {
    color: marketplaceColors.accent,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
    textAlign: 'center',
  },
  section: { color: marketplaceColors.text, fontSize: 19, fontWeight: '900', marginTop: 25 },
  stat: { alignItems: 'center', flex: 1 },
  statLabel: { color: marketplaceColors.muted, fontSize: 10, marginTop: 3 },
  stats: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 22,
    paddingVertical: 14,
  },
  statValue: { color: marketplaceColors.forest, fontSize: 17, fontWeight: '900' },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  university: { color: marketplaceColors.muted, fontSize: 12, marginTop: 5 },
  username: { color: marketplaceColors.text, fontSize: 23, fontWeight: '900', marginTop: 12 },
});
