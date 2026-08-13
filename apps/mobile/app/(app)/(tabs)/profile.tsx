import { MaterialIcons } from '@expo/vector-icons';
import type { ListingDetail } from '@thriftage/shared';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListingCard } from '../../../src/components/marketplace/listing-card';
import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import { marketplaceColors } from '../../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';
import { useAuth } from '../../../src/providers/auth-provider';

export default function OwnProfileScreen() {
  const { signOut, state } = useAuth();
  const username = state.status === 'AUTHENTICATED_ACTIVE' ? state.profile.username : '';
  const seller = useQuery({
    enabled: username !== '',
    queryFn: () => thriftageApiClient.getSeller(username),
    queryKey: ['marketplace', 'seller', username],
  });
  if (state.status !== 'AUTHENTICATED_ACTIVE') return null;
  const profile = seller.data?.profile;
  const items = seller.data?.listings.items ?? [];
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <FlatList<ListingDetail>
        ListEmptyComponent={
          seller.isLoading ? (
            <MarketplaceState
              loading
              message="Loading your marketplace profile."
              title="Opening profile"
            />
          ) : (
            <MarketplaceState
              message="Approved pieces you sell will appear on your public profile."
              title="No active listings"
            />
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.topRow}>
              <Text style={styles.brand}>THRIFTAGE</Text>
              <Pressable onPress={() => void signOut()}>
                <MaterialIcons color={marketplaceColors.muted} name="logout" size={22} />
              </Pressable>
            </View>
            <View style={styles.identity}>
              {state.profile.profileImageUrl === null ? (
                <View style={styles.avatarPlaceholder}>
                  <MaterialIcons color={marketplaceColors.forest} name="person" size={34} />
                </View>
              ) : (
                <Image source={state.profile.profileImageUrl} style={styles.avatar} />
              )}
              <View style={styles.nameBlock}>
                <Text style={styles.name}>{state.account.fullName}</Text>
                <Text style={styles.username}>@{state.profile.username}</Text>
              </View>
              <Pressable onPress={() => router.push('/edit-profile')} style={styles.editButton}>
                <Text style={styles.editText}>Edit</Text>
              </Pressable>
            </View>
            {state.profile.bio !== null ? (
              <Text style={styles.bio}>{state.profile.bio}</Text>
            ) : null}
            <View style={styles.stats}>
              <Stat label="Listings" value={profile?.listingCount ?? 0} />
              <Stat label="Followers" value={profile?.followerCount ?? 0} />
              <Stat label="Following" value={profile?.followingCount ?? 0} />
              <Stat label="Sales" value={profile?.completedSalesCount ?? 0} />
            </View>
            <View style={styles.hub}>
              <HubAction
                icon="chat-bubble-outline"
                label="Messages"
                onPress={() => router.push('/messages')}
              />
              <HubAction
                icon="local-shipping"
                label="Orders & sales"
                onPress={() => router.push('/orders')}
              />
              <HubAction
                icon="notifications-none"
                label="Notifications"
                onPress={() => router.push('/notifications')}
              />
              <HubAction
                icon="health-and-safety"
                label="Safety Center"
                onPress={() => router.push('/safety')}
              />
              <HubAction
                icon="style"
                label="Style profile"
                onPress={() => router.push('/style-profile')}
              />
              <HubAction
                icon="tune"
                label="Personalization & privacy"
                onPress={() => router.push('/personalization-settings')}
              />
            </View>
            <Text style={styles.section}>Active wardrobe</Text>
          </View>
        }
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={({ id }) => id}
        numColumns={2}
        renderItem={({ item }) => <ListingCard listing={item} />}
      />
    </SafeAreaView>
  );
}

function HubAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.hubAction}>
      <MaterialIcons color={marketplaceColors.forest} name={icon} size={21} />
      <Text style={styles.hubLabel}>{label}</Text>
      <MaterialIcons color={marketplaceColors.muted} name="chevron-right" size={20} />
    </Pressable>
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
  avatar: { borderRadius: 36, height: 72, width: 72 },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#E1E7E1',
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  bio: { color: marketplaceColors.text, fontSize: 14, lineHeight: 21, marginTop: 16 },
  brand: { color: marketplaceColors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 2.4 },
  content: { paddingBottom: 30, paddingHorizontal: 8 },
  editButton: {
    borderColor: marketplaceColors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  editText: { color: marketplaceColors.forest, fontSize: 12, fontWeight: '900' },
  header: { paddingBottom: 12, paddingHorizontal: 10, paddingTop: 18 },
  identity: { alignItems: 'center', flexDirection: 'row', marginTop: 24 },
  hub: {
    borderColor: marketplaceColors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
    overflow: 'hidden',
  },
  hubAction: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderBottomColor: marketplaceColors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  hubLabel: { color: marketplaceColors.text, flex: 1, fontWeight: '800' },
  name: { color: marketplaceColors.text, fontSize: 21, fontWeight: '900' },
  nameBlock: { flex: 1, marginLeft: 13 },
  safeArea: { backgroundColor: marketplaceColors.background, flex: 1 },
  section: { color: marketplaceColors.text, fontSize: 19, fontWeight: '900', marginTop: 24 },
  stat: { alignItems: 'center', flex: 1 },
  statLabel: { color: marketplaceColors.muted, fontSize: 10, marginTop: 3 },
  statValue: { color: marketplaceColors.forest, fontSize: 17, fontWeight: '900' },
  stats: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 20,
    paddingVertical: 15,
  },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  username: { color: marketplaceColors.muted, fontSize: 13, marginTop: 4 },
});
