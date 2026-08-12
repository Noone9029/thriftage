import type { OrderPage } from '@thriftage/shared';
import { type InfiniteData, useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import {
  formatMoney,
  marketplaceColors,
} from '../../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';

export default function OrdersScreen() {
  const [role, setRole] = useState<'purchases' | 'sales'>('purchases');
  const query = useInfiniteQuery<
    OrderPage,
    Error,
    InfiniteData<OrderPage>,
    readonly ['orders', 'purchases' | 'sales'],
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      role === 'purchases'
        ? thriftageApiClient.getPurchases(pageParam)
        : thriftageApiClient.getSales(pageParam),
    queryKey: ['orders', role] as const,
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <View style={styles.switch}>
          {(['purchases', 'sales'] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => setRole(value)}
              style={[styles.choice, role === value && styles.active]}
            >
              <Text style={role === value ? styles.activeText : styles.choiceText}>
                {value === 'purchases' ? 'Purchases' : 'Sales'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {query.isLoading ? (
        <MarketplaceState
          loading
          title="Loading orders"
          message="Retrieving transaction history."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={({ id }) => id}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <MarketplaceState
              title="No orders yet"
              message={
                role === 'purchases'
                  ? 'Your purchases will appear here.'
                  : 'Orders for your pieces will appear here.'
              }
            />
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/orders/${item.id}`)} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.number}>{item.orderNumber}</Text>
                <Text style={styles.item}>{item.listingTitle}</Text>
                <Text style={styles.amount}>{formatMoney(item.totalMinor, item.currency)}</Text>
              </View>
              <Text style={styles.status}>{item.status}</Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  active: { backgroundColor: marketplaceColors.forest },
  activeText: { color: '#fff', fontWeight: '900' },
  amount: { color: marketplaceColors.forest, fontWeight: '900', marginTop: 5 },
  choice: { borderRadius: 12, flex: 1, padding: 11 },
  choiceText: { color: marketplaceColors.muted, fontWeight: '800', textAlign: 'center' },
  header: { padding: 20 },
  item: { color: marketplaceColors.text, fontSize: 16, fontWeight: '900', marginTop: 5 },
  number: { color: marketplaceColors.muted, fontSize: 11 },
  row: {
    alignItems: 'center',
    borderBottomColor: marketplaceColors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    padding: 20,
  },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  status: { color: marketplaceColors.accent, fontSize: 11, fontWeight: '900' },
  switch: {
    backgroundColor: '#E9E5DD',
    borderRadius: 14,
    flexDirection: 'row',
    marginTop: 18,
    padding: 3,
  },
  title: { color: marketplaceColors.text, fontSize: 30, fontWeight: '900' },
});
