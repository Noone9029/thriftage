import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import { marketplaceColors } from '../../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';

export default function InboxScreen() {
  const query = useQuery({
    queryFn: () => thriftageApiClient.getConversations(),
    queryKey: ['conversations'],
  });
  if (query.isLoading)
    return <MarketplaceState loading title="Opening inbox" message="Loading conversations." />;
  if (query.isError || query.data === undefined)
    return (
      <MarketplaceState
        title="Inbox unavailable"
        message="Check your connection and try again."
        actionLabel="Retry"
        onAction={() => void query.refetch()}
      />
    );
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.subtitle}>{query.data.totalUnread} unread</Text>
      </View>
      <FlatList
        data={query.data.items}
        keyExtractor={({ id }) => id}
        ListEmptyComponent={
          <MarketplaceState
            title="No conversations"
            message="Message a seller from an active listing."
          />
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/messages/${item.id}`)}>
            {item.listing.imageUrl === null ? (
              <View style={styles.image} />
            ) : (
              <Image source={item.listing.imageUrl} style={styles.image} />
            )}
            <View style={styles.copy}>
              <View style={styles.line}>
                <Text style={styles.name}>@{item.counterparty.username}</Text>
                {item.unreadCount > 0 ? <Text style={styles.badge}>{item.unreadCount}</Text> : null}
              </View>
              <Text numberOfLines={1} style={styles.listing}>
                {item.listing.title}
              </Text>
              <Text numberOfLines={1} style={styles.preview}>
                {item.lastMessage?.body ?? 'Start the conversation'}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  badge: {
    backgroundColor: marketplaceColors.accent,
    borderRadius: 12,
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  copy: { flex: 1 },
  header: { padding: 20 },
  image: { backgroundColor: '#DDD8CE', borderRadius: 13, height: 68, marginRight: 13, width: 58 },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
  listing: { color: marketplaceColors.forest, fontSize: 12, fontWeight: '800', marginTop: 5 },
  name: { color: marketplaceColors.text, fontSize: 15, fontWeight: '900' },
  preview: { color: marketplaceColors.muted, fontSize: 13, marginTop: 5 },
  row: {
    alignItems: 'center',
    borderBottomColor: marketplaceColors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  subtitle: { color: marketplaceColors.muted, marginTop: 5 },
  title: { color: marketplaceColors.text, fontSize: 30, fontWeight: '900' },
});
