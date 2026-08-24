import { MaterialIcons } from '@expo/vector-icons';
import type { ListingDetail } from '@thriftage/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListingCard } from '../../../src/components/marketplace/listing-card';
import {
  SectionHeader,
  TrustPill,
} from '../../../src/components/marketplace/marketplace-primitives';
import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import { ProfileSkeleton } from '../../../src/components/marketplace/marketplace-skeleton';
import {
  marketplaceColors,
  marketplaceRadii,
  marketplaceShadows,
  marketplaceSpacing,
} from '../../../src/components/marketplace/marketplace-theme';
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
    return <ProfileSkeleton />;
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
            actionLabel="Explore other wardrobes"
            message="This seller has no active pieces right now. Check back after their next closet drop."
            onAction={() => router.push('/')}
            title="Between closet drops"
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.topRow}>
              <Pressable
                accessibilityLabel="Go back"
                accessibilityRole="button"
                onPress={() => router.back()}
                style={styles.back}
              >
                <MaterialIcons color={marketplaceColors.white} name="arrow-back" size={23} />
              </Pressable>
              {!ownProfile ? (
                <View style={styles.safetyActions}>
                  <Pressable
                    accessibilityLabel={`Report ${profile.username}`}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: reporting }}
                    onPress={() => setReporting((value) => !value)}
                    style={styles.safetyIcon}
                  >
                    <MaterialIcons color={marketplaceColors.white} name="flag" size={20} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Block ${profile.username}`}
                    accessibilityRole="button"
                    accessibilityState={{ busy: block.isPending, disabled: block.isPending }}
                    disabled={block.isPending}
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
                    style={styles.safetyIcon}
                  >
                    <MaterialIcons color={marketplaceColors.white} name="block" size={20} />
                  </Pressable>
                </View>
              ) : null}
            </View>
            <View style={styles.coverArt}>
              <View style={styles.coverOrbLarge} />
              <View style={styles.coverOrbSmall} />
              <Text style={styles.coverMark}>WARDROBE / {profile.username.toUpperCase()}</Text>
            </View>
            <View style={styles.identity}>
              {profile.profileImageUrl === null ? (
                <View style={styles.avatarPlaceholder}>
                  <MaterialIcons color={marketplaceColors.forest} name="person" size={38} />
                </View>
              ) : (
                <Image source={profile.profileImageUrl} style={styles.avatar} />
              )}
              <View style={styles.usernameRow}>
                <Text style={styles.username}>@{profile.username}</Text>
                {profile.sellerVerified ? (
                  <MaterialIcons color={marketplaceColors.success} name="verified" size={20} />
                ) : null}
              </View>
              <Text style={styles.memberSince}>
                Thrifting here since {new Date(profile.memberSince).getFullYear()}
              </Text>
              {profile.university !== null ? (
                <Text style={styles.university}>{profile.university}</Text>
              ) : null}
              {profile.bio !== null ? <Text style={styles.bio}>{profile.bio}</Text> : null}
              {!ownProfile ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{
                    busy: follow.isPending,
                    disabled: follow.isPending,
                    selected: profile.followedByViewer,
                  }}
                  disabled={follow.isPending}
                  onPress={() => follow.mutate()}
                  style={[styles.follow, profile.followedByViewer && styles.following]}
                >
                  <Text
                    style={[styles.followText, profile.followedByViewer && styles.followingText]}
                  >
                    {follow.isPending
                      ? 'Updating…'
                      : profile.followedByViewer
                        ? 'Following'
                        : 'Follow wardrobe'}
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
              accessibilityLabel={`Read reviews for ${profile.username}`}
              accessibilityRole="button"
              onPress={() => router.push(`/reviews/users/${profile.username}`)}
              style={styles.reputation}
            >
              <View style={styles.reputationIcon}>
                <MaterialIcons color={marketplaceColors.gold} name="star" size={23} />
              </View>
              <View style={styles.reputationCopy}>
                <Text style={styles.reputationTitle}>
                  {profile.sellerRating.average?.toFixed(1) ?? 'New'} seller rating
                </Text>
                <Text style={styles.reputationText}>
                  {profile.sellerRating.count} seller reviews · {profile.completedSalesCount}{' '}
                  completed sales
                </Text>
              </View>
              <MaterialIcons color={marketplaceColors.muted} name="chevron-right" size={22} />
            </Pressable>
            <View style={styles.trustRow}>
              {profile.sellerVerified ? <TrustPill label="Verified seller" /> : null}
              <TrustPill icon="payments" label="COD ready" tone="neutral" />
              <TrustPill icon="forum" label="In-app chat" tone="neutral" />
            </View>
            {reporting ? (
              <ReportPanel onClose={() => setReporting(false)} userId={profile.id} />
            ) : null}
            <View style={styles.section}>
              <SectionHeader
                eyebrow={`${profile.listingCount} PIECES AVAILABLE`}
                title="Shop the wardrobe"
              />
            </View>
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
  avatar: {
    borderColor: marketplaceColors.background,
    borderRadius: 50,
    borderWidth: 5,
    height: 100,
    width: 100,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#E1E7E1',
    borderColor: marketplaceColors.background,
    borderRadius: 50,
    borderWidth: 5,
    height: 100,
    justifyContent: 'center',
    width: 100,
  },
  back: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  bio: {
    color: marketplaceColors.text,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 12,
    maxWidth: 330,
    textAlign: 'center',
  },
  content: { paddingBottom: 35, paddingHorizontal: 8 },
  coverArt: {
    backgroundColor: marketplaceColors.forestDeep,
    borderRadius: marketplaceRadii.hero,
    height: 150,
    marginTop: 8,
    overflow: 'hidden',
    padding: marketplaceSpacing.lg,
  },
  coverMark: {
    bottom: 17,
    color: 'rgba(255,255,255,0.68)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.8,
    position: 'absolute',
    right: 17,
  },
  coverOrbLarge: {
    backgroundColor: marketplaceColors.accent,
    borderRadius: 90,
    height: 170,
    opacity: 0.5,
    position: 'absolute',
    right: -42,
    top: -80,
    width: 170,
  },
  coverOrbSmall: {
    backgroundColor: marketplaceColors.gold,
    borderRadius: 42,
    bottom: -32,
    height: 84,
    left: 52,
    opacity: 0.28,
    position: 'absolute',
    width: 84,
  },
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
  identity: { alignItems: 'center', marginTop: -50 },
  memberSince: { color: marketplaceColors.muted, fontSize: 10, marginTop: 5 },
  safeArea: { backgroundColor: marketplaceColors.background, flex: 1 },
  safetyActions: { flexDirection: 'row', gap: 18 },
  verified: { color: marketplaceColors.accent, fontSize: 12, fontWeight: '900', marginTop: 7 },
  reputation: {
    ...marketplaceShadows.card,
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    padding: 13,
  },
  reputationCopy: { flex: 1 },
  reputationIcon: {
    alignItems: 'center',
    backgroundColor: '#F8EDDA',
    borderRadius: 18,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  reputationText: {
    color: marketplaceColors.muted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },
  reputationTitle: { color: marketplaceColors.text, fontSize: 13, fontWeight: '900' },
  section: { marginTop: 28 },
  stat: { alignItems: 'center', flex: 1 },
  statLabel: { color: marketplaceColors.muted, fontSize: 10, marginTop: 3 },
  stats: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.lg,
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
    left: 10,
    paddingVertical: 18,
    position: 'absolute',
    right: 10,
    top: 0,
    zIndex: 2,
  },
  safetyIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 13 },
  university: { color: marketplaceColors.muted, fontSize: 12, marginTop: 5 },
  username: { color: marketplaceColors.text, fontSize: 23, fontWeight: '900' },
  usernameRow: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 12 },
});
