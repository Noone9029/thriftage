import { MaterialIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../src/components/marketplace/marketplace-state';
import { ListRowsSkeleton } from '../../src/components/marketplace/marketplace-skeleton';
import {
  marketplaceColors,
  marketplaceRadii,
  marketplaceShadows,
  marketplaceSpacing,
} from '../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../src/lib/auth/auth-composition';

export default function NotificationsScreen() {
  const cache = useQueryClient();
  const query = useQuery({
    queryFn: () => thriftageApiClient.getNotifications(),
    queryKey: ['notifications'],
  });
  const read = useMutation({
    mutationFn: () => thriftageApiClient.markAllNotificationsRead(),
    onSuccess: () => void cache.invalidateQueries({ queryKey: ['notifications'] }),
  });
  if (query.isLoading) return <ListRowsSkeleton label="Loading marketplace activity" />;
  if (query.isError)
    return (
      <MarketplaceState
        actionLabel="Try again"
        icon="notifications-off"
        message="Your activity could not be refreshed. Nothing has been removed."
        onAction={() => void query.refetch()}
        title="Activity is offline"
      />
    );
  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        contentContainerStyle={styles.content}
        data={query.data?.items ?? []}
        keyExtractor={({ id }) => id}
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
                <Text style={styles.eyebrow}>WHAT'S HAPPENING</Text>
                <Text style={styles.title}>Activity</Text>
              </View>
              <View style={styles.back} />
            </View>
            <View style={styles.summary}>
              <View style={styles.summaryIcon}>
                <MaterialIcons
                  color={marketplaceColors.forest}
                  name="notifications-active"
                  size={22}
                />
              </View>
              <View style={styles.summaryCopy}>
                <Text style={styles.summaryTitle}>
                  {query.data?.unreadCount ?? 0} updates waiting
                </Text>
                <Text style={styles.summaryText}>
                  Orders, messages, followers, and listing decisions.
                </Text>
              </View>
              {(query.data?.unreadCount ?? 0) > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ busy: read.isPending, disabled: read.isPending }}
                  disabled={read.isPending}
                  onPress={() => read.mutate()}
                >
                  <Text style={styles.mark}>Read all</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          <MarketplaceState
            actionLabel="Explore the rack"
            icon="notifications-none"
            message="Order updates, messages, followers, and listing news will land here."
            onAction={() => router.push('/')}
            title="You're all caught up"
          />
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityLabel={item.title}
            accessibilityRole="button"
            accessibilityState={{
              disabled: item.orderId === null && item.conversationId === null,
            }}
            disabled={item.orderId === null && item.conversationId === null}
            onPress={() =>
              item.orderId !== null
                ? router.push(`/orders/${item.orderId}`)
                : item.conversationId !== null
                  ? router.push(`/messages/${item.conversationId}`)
                  : undefined
            }
            style={({ pressed }) => [
              styles.row,
              item.readAt === null && styles.unread,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.itemIcon, item.readAt === null && styles.itemIconUnread]}>
              <MaterialIcons
                color={
                  item.readAt === null ? marketplaceColors.accentDeep : marketplaceColors.forest
                }
                name={
                  item.orderId !== null
                    ? 'local-shipping'
                    : item.conversationId !== null
                      ? 'forum'
                      : 'auto-awesome'
                }
                size={20}
              />
            </View>
            <View style={styles.itemCopy}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
            {item.readAt === null ? <View style={styles.unreadDot} /> : null}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 21,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  body: { color: marketplaceColors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  content: { padding: 16, paddingBottom: 34 },
  eyebrow: { color: marketplaceColors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 1.7 },
  header: { paddingBottom: marketplaceSpacing.lg },
  itemCopy: { flex: 1 },
  itemIcon: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forestSoft,
    borderRadius: 17,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  itemIconUnread: { backgroundColor: marketplaceColors.accentSoft },
  itemTitle: { color: marketplaceColors.text, fontSize: 13, fontWeight: '900' },
  mark: { color: marketplaceColors.accentDeep, fontSize: 10, fontWeight: '900' },
  pressed: { opacity: 0.74 },
  row: {
    ...marketplaceShadows.card,
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    marginBottom: 9,
    minHeight: 74,
    padding: 12,
  },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  summary: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forestSoft,
    borderRadius: marketplaceRadii.xl,
    flexDirection: 'row',
    gap: 10,
    marginTop: marketplaceSpacing.lg,
    padding: 13,
  },
  summaryCopy: { flex: 1 },
  summaryIcon: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderRadius: 18,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  summaryText: { color: marketplaceColors.muted, fontSize: 9, lineHeight: 13, marginTop: 3 },
  summaryTitle: { color: marketplaceColors.forest, fontSize: 12, fontWeight: '900' },
  title: { color: marketplaceColors.ink, fontSize: 29, fontWeight: '900', marginTop: 3 },
  titleCopy: { alignItems: 'center', flex: 1 },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  unread: { borderColor: '#F0C3B1', borderWidth: 1.5 },
  unreadDot: { backgroundColor: marketplaceColors.accent, borderRadius: 4, height: 8, width: 8 },
});
