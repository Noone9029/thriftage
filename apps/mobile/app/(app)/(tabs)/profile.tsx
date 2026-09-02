import { MaterialIcons } from '@expo/vector-icons';
import type { ListingDetail } from '@thriftage/shared';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
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
  if (seller.isLoading) return <ProfileSkeleton />;
  if (seller.isError) {
    return (
      <MarketplaceState
        actionLabel="Try again"
        icon="cloud-off"
        message="Your public wardrobe could not be refreshed. Your account details are still safe."
        onAction={() => void seller.refetch()}
        title="Profile is offline"
      />
    );
  }
  const profile = seller.data?.profile;
  const items = seller.data?.listings.items ?? [];
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <FlatList<ListingDetail>
        ListEmptyComponent={
          <MarketplaceState
            actionLabel="List a piece"
            icon="add-photo-alternate"
            message="Your approved pieces will become the public edit buyers see here."
            onAction={() => router.push('/listing-editor/new')}
            title="Build your wardrobe"
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.topRow}>
              <View>
                <Text style={styles.brand}>THRIFTAGE</Text>
                <Text style={styles.brandNote}>MY SPACE</Text>
              </View>
              <Pressable
                accessibilityLabel="Open notifications"
                accessibilityRole="button"
                onPress={() => router.push('/notifications')}
                style={styles.topButton}
              >
                <MaterialIcons
                  color={marketplaceColors.forest}
                  name="notifications-none"
                  size={23}
                />
              </Pressable>
            </View>

            <View style={styles.profileHero}>
              <View style={styles.heroOrb} />
              <View style={styles.identity}>
                {state.profile.profileImageUrl === null ? (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>
                      {state.account.fullName.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                ) : (
                  <Image source={state.profile.profileImageUrl} style={styles.avatar} />
                )}
                <View style={styles.nameBlock}>
                  <Text numberOfLines={1} style={styles.name}>
                    {state.account.fullName}
                  </Text>
                  <Text style={styles.username}>@{state.profile.username}</Text>
                </View>
                <Pressable
                  accessibilityLabel="Edit profile"
                  accessibilityRole="button"
                  onPress={() => router.push('/edit-profile')}
                  style={styles.editButton}
                >
                  <MaterialIcons color={marketplaceColors.forestDeep} name="edit" size={16} />
                  <Text style={styles.editText}>Edit</Text>
                </Pressable>
              </View>
              {state.profile.bio !== null ? (
                <Text style={styles.bio}>{state.profile.bio}</Text>
              ) : null}
              <View style={styles.profilePills}>
                {profile?.sellerVerified === true ? (
                  <TrustPill label="Verified seller" tone="accent" />
                ) : null}
                {state.profile.university !== null ? (
                  <TrustPill icon="school" label={state.profile.university} tone="neutral" />
                ) : null}
              </View>
            </View>

            <View style={styles.stats}>
              <Stat label="Listings" value={profile?.listingCount ?? 0} />
              <Stat label="Followers" value={profile?.followerCount ?? 0} />
              <Stat label="Following" value={profile?.followingCount ?? 0} />
              <Stat label="Sales" value={profile?.completedSalesCount ?? 0} />
            </View>

            <View style={styles.quickGrid}>
              <QuickAction
                icon="local-shipping"
                label="Orders"
                note="Buying & selling"
                onPress={() => router.push('/orders')}
              />
              <QuickAction
                icon="chat-bubble-outline"
                label="Messages"
                note="Marketplace chats"
                onPress={() => router.push('/messages')}
              />
              <QuickAction
                icon="style"
                label="Style profile"
                note="Tune your edit"
                onPress={() => router.push('/style-profile')}
              />
              <QuickAction
                icon="add-photo-alternate"
                label="Selling"
                note="Manage wardrobe"
                onPress={() => router.push('/sell')}
              />
            </View>

            <Text style={styles.groupTitle}>Marketplace & preferences</Text>
            <View style={styles.hub}>
              <HubAction
                icon="account-balance-wallet"
                label="Payouts & seller statement"
                onPress={() => router.push('/payout-settings' as never)}
              />
              <HubAction
                icon="tune"
                label="Personalization & privacy"
                onPress={() => router.push('/personalization-settings')}
              />
              <HubAction
                icon="health-and-safety"
                label="Safety Center"
                onPress={() => router.push('/safety')}
              />
              <HubAction
                icon="feedback"
                label="Share beta feedback"
                onPress={() => router.push('/beta-feedback')}
              />
            </View>

            <Text style={styles.groupTitle}>Account & support</Text>
            <View style={styles.hub}>
              <HubAction
                icon="info-outline"
                label="About Thriftage"
                onPress={() => router.push('/about')}
              />
              <HubAction
                icon="delete-outline"
                label="Delete account"
                onPress={() => router.push('/account-deletion')}
                danger
              />
              <HubAction icon="logout" label="Sign out" onPress={() => void signOut()} />
            </View>

            <View style={styles.section}>
              <SectionHeader
                actionLabel="Manage"
                eyebrow="YOUR PUBLIC EDIT"
                onAction={() => router.push('/sell')}
                title="Active wardrobe"
              />
            </View>
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

function QuickAction({
  icon,
  label,
  note,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  note: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
    >
      <View style={styles.quickIcon}>
        <MaterialIcons color={marketplaceColors.forest} name={icon} size={22} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
      <Text style={styles.quickNote}>{note}</Text>
    </Pressable>
  );
}

function HubAction({
  danger = false,
  icon,
  label,
  onPress,
}: {
  danger?: boolean;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.hubAction, pressed && styles.pressed]}
    >
      <View style={[styles.hubIcon, danger && styles.hubIconDanger]}>
        <MaterialIcons
          color={danger ? marketplaceColors.danger : marketplaceColors.forest}
          name={icon}
          size={19}
        />
      </View>
      <Text style={[styles.hubLabel, danger && styles.hubLabelDanger]}>{label}</Text>
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
  avatar: { borderRadius: 34, height: 68, width: 68 },
  avatarInitial: { color: marketplaceColors.forest, fontSize: 25, fontWeight: '900' },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  bio: {
    color: 'rgba(255,255,255,0.77)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: marketplaceSpacing.md,
    maxWidth: 330,
  },
  brand: { color: marketplaceColors.forest, fontSize: 15, fontWeight: '900', letterSpacing: 2.8 },
  brandNote: {
    color: marketplaceColors.accent,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.8,
    marginTop: 3,
  },
  content: { paddingBottom: 32, paddingHorizontal: 8 },
  editButton: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.white,
    borderRadius: marketplaceRadii.pill,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  editText: { color: marketplaceColors.forestDeep, fontSize: 11, fontWeight: '900' },
  groupTitle: {
    color: marketplaceColors.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 24,
    textTransform: 'uppercase',
  },
  header: { paddingBottom: 12, paddingHorizontal: 10, paddingTop: 14 },
  heroOrb: {
    backgroundColor: marketplaceColors.accent,
    borderRadius: 90,
    height: 170,
    opacity: 0.44,
    position: 'absolute',
    right: -64,
    top: -72,
    width: 170,
  },
  hub: {
    ...marketplaceShadows.card,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  hubAction: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderBottomColor: marketplaceColors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 13,
  },
  hubIcon: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forestSoft,
    borderRadius: 14,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  hubIconDanger: { backgroundColor: marketplaceColors.dangerSoft },
  hubLabel: { color: marketplaceColors.text, flex: 1, fontSize: 13, fontWeight: '800' },
  hubLabelDanger: { color: marketplaceColors.danger },
  identity: { alignItems: 'center', flexDirection: 'row' },
  name: { color: marketplaceColors.white, fontSize: 20, fontWeight: '900' },
  nameBlock: { flex: 1, marginLeft: 12 },
  pressed: { opacity: 0.74 },
  profileHero: {
    ...marketplaceShadows.floating,
    backgroundColor: marketplaceColors.forestDeep,
    borderRadius: marketplaceRadii.hero,
    marginTop: marketplaceSpacing.lg,
    overflow: 'hidden',
    padding: marketplaceSpacing.xl,
  },
  profilePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: marketplaceSpacing.md,
  },
  quickAction: {
    ...marketplaceShadows.card,
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.xl,
    borderWidth: 1,
    minHeight: 126,
    padding: 13,
    width: '48.5%',
  },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 12 },
  quickIcon: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forestSoft,
    borderRadius: 16,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  quickLabel: { color: marketplaceColors.text, fontSize: 13, fontWeight: '900', marginTop: 10 },
  quickNote: { color: marketplaceColors.muted, fontSize: 9, marginTop: 3 },
  safeArea: { backgroundColor: marketplaceColors.background, flex: 1 },
  section: { marginTop: 30 },
  stat: { alignItems: 'center', flex: 1 },
  statLabel: { color: marketplaceColors.muted, fontSize: 9, marginTop: 3 },
  statValue: { color: marketplaceColors.forest, fontSize: 17, fontWeight: '900' },
  stats: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 11,
    paddingVertical: 14,
  },
  topButton: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  username: { color: 'rgba(255,255,255,0.66)', fontSize: 12, marginTop: 4 },
});
