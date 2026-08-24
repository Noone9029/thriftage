import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import { ListRowsSkeleton } from '../../../src/components/marketplace/marketplace-skeleton';
import {
  marketplaceColors,
  marketplaceRadii,
  marketplaceShadows,
  marketplaceSpacing,
} from '../../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';

function formatConversationTime(value: string): string {
  const date = new Date(value);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export default function InboxScreen() {
  const query = useQuery({
    queryFn: () => thriftageApiClient.getConversations(),
    queryKey: ['conversations'],
  });
  if (query.isLoading) return <ListRowsSkeleton label="Loading marketplace conversations" />;
  if (query.isError || query.data === undefined)
    return (
      <MarketplaceState
        title="Inbox stepped away"
        message="Your conversations are safe. Check your connection and try once more."
        actionLabel="Retry"
        onAction={() => void query.refetch()}
      />
    );
  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        contentContainerStyle={styles.content}
        data={query.data.items}
        keyExtractor={({ id }) => id}
        ListEmptyComponent={
          <MarketplaceState
            actionLabel="Find a piece"
            icon="forum"
            message="Ask about fit, condition, or delivery from any active listing."
            onAction={() => router.push('/')}
            title="Start a marketplace chat"
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
                <MaterialIcons color={marketplaceColors.forest} name="arrow-back" size={22} />
              </Pressable>
              <View style={styles.titleCopy}>
                <Text style={styles.eyebrow}>MARKETPLACE CONVERSATIONS</Text>
                <Text style={styles.title}>Messages</Text>
              </View>
              {query.data.totalUnread > 0 ? (
                <View style={styles.unreadPill}>
                  <Text style={styles.unreadPillText}>{query.data.totalUnread} new</Text>
                </View>
              ) : (
                <View style={styles.back} />
              )}
            </View>
            <View style={styles.safetyCard}>
              <View style={styles.safetyIcon}>
                <MaterialIcons color={marketplaceColors.forest} name="shield" size={20} />
              </View>
              <Text style={styles.safetyText}>
                Keep chats and transactions inside Thriftage so our safety tools can protect you.
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/messages/${item.id}`)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.visual}>
              {item.listing.imageUrl === null ? (
                <View style={[styles.listingImage, styles.imagePlaceholder]}>
                  <MaterialIcons color={marketplaceColors.forest} name="checkroom" size={24} />
                </View>
              ) : (
                <Image source={item.listing.imageUrl} style={styles.listingImage} />
              )}
              {item.counterparty.profileImageUrl === null ? (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarText}>
                    {item.counterparty.username.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              ) : (
                <Image source={item.counterparty.profileImageUrl} style={styles.avatar} />
              )}
            </View>
            <View style={styles.copy}>
              <View style={styles.line}>
                <Text numberOfLines={1} style={styles.name}>
                  @{item.counterparty.username}
                </Text>
                <Text style={styles.time}>{formatConversationTime(item.updatedAt)}</Text>
              </View>
              <Text numberOfLines={1} style={styles.listing}>
                {item.listing.title}
              </Text>
              <View style={styles.previewRow}>
                <Text
                  numberOfLines={1}
                  style={[styles.preview, item.unreadCount > 0 && styles.previewUnread]}
                >
                  {item.lastMessage?.body ?? 'Say hello and ask about the piece'}
                </Text>
                {item.unreadCount > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.unreadCount}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderColor: marketplaceColors.paper,
    borderRadius: 15,
    borderWidth: 2,
    bottom: -4,
    height: 30,
    position: 'absolute',
    right: -5,
    width: 30,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forestSoft,
    justifyContent: 'center',
  },
  avatarText: { color: marketplaceColors.forest, fontSize: 10, fontWeight: '900' },
  back: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.accent,
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    minWidth: 20,
    paddingHorizontal: 5,
  },
  badgeText: { color: marketplaceColors.white, fontSize: 9, fontWeight: '900' },
  content: { paddingBottom: 30, paddingHorizontal: 16 },
  copy: { flex: 1 },
  eyebrow: {
    color: marketplaceColors.accent,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  header: { paddingBottom: marketplaceSpacing.lg, paddingTop: 5 },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  line: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  listing: { color: marketplaceColors.forest, fontSize: 11, fontWeight: '900', marginTop: 5 },
  listingImage: {
    backgroundColor: marketplaceColors.sand,
    borderRadius: marketplaceRadii.lg,
    height: 72,
    width: 60,
  },
  name: { color: marketplaceColors.text, flex: 1, fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.72 },
  preview: { color: marketplaceColors.muted, flex: 1, fontSize: 11, marginTop: 5 },
  previewRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  previewUnread: { color: marketplaceColors.text, fontWeight: '800' },
  row: {
    ...marketplaceShadows.card,
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 10,
    padding: 12,
  },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  safetyCard: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forestSoft,
    borderRadius: marketplaceRadii.lg,
    flexDirection: 'row',
    gap: 10,
    marginTop: marketplaceSpacing.lg,
    padding: marketplaceSpacing.md,
  },
  safetyIcon: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderRadius: 16,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  safetyText: { color: marketplaceColors.forest, flex: 1, fontSize: 10, lineHeight: 15 },
  time: { color: marketplaceColors.mutedLight, fontSize: 9 },
  title: {
    color: marketplaceColors.ink,
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 3,
  },
  titleCopy: { alignItems: 'center', flex: 1 },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  unreadPill: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.accentSoft,
    borderRadius: marketplaceRadii.pill,
    minWidth: 48,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  unreadPillText: { color: marketplaceColors.accentDeep, fontSize: 9, fontWeight: '900' },
  visual: { position: 'relative' },
});
