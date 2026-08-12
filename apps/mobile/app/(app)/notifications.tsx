import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../src/components/marketplace/marketplace-state';
import { marketplaceColors } from '../../src/components/marketplace/marketplace-theme';
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
  if (query.isLoading)
    return (
      <MarketplaceState
        loading
        title="Loading notifications"
        message="Checking marketplace activity."
      />
    );
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Activity</Text>
          <Text style={styles.subtitle}>{query.data?.unreadCount ?? 0} unread</Text>
        </View>
        <Pressable onPress={() => read.mutate()}>
          <Text style={styles.mark}>Mark all read</Text>
        </Pressable>
      </View>
      <FlatList
        data={query.data?.items ?? []}
        keyExtractor={({ id }) => id}
        ListEmptyComponent={
          <MarketplaceState
            title="All quiet"
            message="Order and message updates will appear here."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              item.orderId !== null
                ? router.push(`/orders/${item.orderId}`)
                : item.conversationId !== null
                  ? router.push(`/messages/${item.conversationId}`)
                  : undefined
            }
            style={[styles.row, item.readAt === null && styles.unread]}
          >
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  body: { color: marketplaceColors.muted, fontSize: 13, marginTop: 5 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  itemTitle: { color: marketplaceColors.text, fontWeight: '900' },
  mark: { color: marketplaceColors.forest, fontSize: 12, fontWeight: '900' },
  row: { borderBottomColor: marketplaceColors.border, borderBottomWidth: 1, padding: 18 },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  subtitle: { color: marketplaceColors.muted, marginTop: 4 },
  title: { color: marketplaceColors.text, fontSize: 30, fontWeight: '900' },
  unread: { backgroundColor: '#F0EDE4' },
});
