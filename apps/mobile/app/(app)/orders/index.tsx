import { MaterialIcons } from '@expo/vector-icons';
import type { OrderPage, OrderStatus } from '@thriftage/shared';
import { type InfiniteData, useInfiniteQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import { ListRowsSkeleton } from '../../../src/components/marketplace/marketplace-skeleton';
import {
  formatMoney,
  marketplaceColors,
  marketplaceRadii,
  marketplaceShadows,
  marketplaceSpacing,
} from '../../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';

const statusLabels: Readonly<Record<OrderStatus, string>> = {
  PENDING: 'Awaiting seller',
  CONFIRMED: 'Confirmed',
  SHIPPED: 'On the way',
  DELIVERED: 'Delivered',
  COMPLETED: 'Complete',
  CANCELLED: 'Cancelled',
};

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
  if (query.isLoading) return <ListRowsSkeleton label="Loading your orders" />;
  if (query.isError) {
    return (
      <MarketplaceState
        actionLabel="Try again"
        icon="cloud-off"
        message="Your orders could not be refreshed. No order information has been changed."
        onAction={() => void query.refetch()}
        title="Orders are offline"
      />
    );
  }
  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={({ id }) => id}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <MarketplaceState
            actionLabel={role === 'purchases' ? 'Discover pieces' : 'Start selling'}
            icon={role === 'purchases' ? 'shopping-bag' : 'sell'}
            message={
              role === 'purchases'
                ? 'Your purchases and delivery progress will appear here.'
                : 'Orders for your listed pieces will appear here.'
            }
            onAction={() => router.push(role === 'purchases' ? '/' : '/sell')}
            title={role === 'purchases' ? 'Your first find awaits' : 'Ready for your first sale'}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Pressable
                accessibilityLabel="Go back"
                accessibilityRole="button"
                onPress={() => router.back()}
                style={styles.back}
              >
                <MaterialIcons color={marketplaceColors.forest} name="arrow-back" size={22} />
              </Pressable>
              <View style={styles.titleCopy}>
                <Text style={styles.eyebrow}>FROM ORDER TO OUTFIT</Text>
                <Text style={styles.title}>Orders</Text>
              </View>
              <View style={styles.back} />
            </View>
            <View style={styles.switch}>
              {(['purchases', 'sales'] as const).map((value) => (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: role === value }}
                  key={value}
                  onPress={() => setRole(value)}
                  style={[styles.choice, role === value && styles.active]}
                >
                  <MaterialIcons
                    color={role === value ? marketplaceColors.white : marketplaceColors.muted}
                    name={value === 'purchases' ? 'shopping-bag' : 'sell'}
                    size={17}
                  />
                  <Text style={role === value ? styles.activeText : styles.choiceText}>
                    {value === 'purchases' ? 'Purchases' : 'Sales'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>
                {role === 'purchases' ? 'Pieces you found' : 'Pieces finding new homes'}
              </Text>
              <Text style={styles.summaryCount}>{items.length} loaded</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/orders/${item.id}`)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            {item.listingImageUrl === null ? (
              <View style={[styles.image, styles.imagePlaceholder]}>
                <MaterialIcons color={marketplaceColors.forest} name="checkroom" size={25} />
              </View>
            ) : (
              <Image contentFit="cover" source={item.listingImageUrl} style={styles.image} />
            )}
            <View style={styles.orderCopy}>
              <View style={styles.orderTop}>
                <Text style={styles.number}>{item.orderNumber}</Text>
                <View
                  style={[
                    styles.statusPill,
                    item.status === 'CANCELLED' && styles.statusPillCancelled,
                  ]}
                >
                  <Text
                    style={[styles.status, item.status === 'CANCELLED' && styles.statusCancelled]}
                  >
                    {statusLabels[item.status]}
                  </Text>
                </View>
              </View>
              <Text numberOfLines={2} style={styles.item}>
                {item.listingTitle}
              </Text>
              <Text style={styles.amount}>{formatMoney(item.totalMinor, item.currency)}</Text>
              <View style={styles.openRow}>
                <Text style={styles.openText}>View order journey</Text>
                <MaterialIcons color={marketplaceColors.forest} name="arrow-forward" size={15} />
              </View>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  active: { backgroundColor: marketplaceColors.forest },
  activeText: { color: marketplaceColors.white, fontSize: 12, fontWeight: '900' },
  amount: { color: marketplaceColors.forest, fontSize: 14, fontWeight: '900', marginTop: 6 },
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
  choice: {
    alignItems: 'center',
    borderRadius: marketplaceRadii.md,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 44,
  },
  choiceText: { color: marketplaceColors.muted, fontSize: 12, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 34 },
  eyebrow: { color: marketplaceColors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 1.7 },
  header: { paddingBottom: marketplaceSpacing.lg },
  image: { backgroundColor: marketplaceColors.sand, height: 142, width: 108 },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  item: {
    color: marketplaceColors.text,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 19,
    marginTop: 6,
  },
  number: { color: marketplaceColors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  openRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 9 },
  openText: { color: marketplaceColors.forest, fontSize: 10, fontWeight: '900' },
  orderCopy: { flex: 1, justifyContent: 'center', padding: 13 },
  orderTop: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  pressed: { opacity: 0.74 },
  row: {
    ...marketplaceShadows.card,
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.xl,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 11,
    overflow: 'hidden',
  },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  status: { color: marketplaceColors.success, fontSize: 8, fontWeight: '900' },
  statusCancelled: { color: marketplaceColors.danger },
  statusPill: {
    backgroundColor: marketplaceColors.successSoft,
    borderRadius: marketplaceRadii.pill,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  statusPillCancelled: { backgroundColor: marketplaceColors.dangerSoft },
  summary: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  summaryCount: { color: marketplaceColors.muted, fontSize: 10, fontWeight: '800' },
  summaryTitle: { color: marketplaceColors.text, fontSize: 17, fontWeight: '900' },
  switch: {
    backgroundColor: marketplaceColors.sand,
    borderRadius: marketplaceRadii.lg,
    flexDirection: 'row',
    marginTop: marketplaceSpacing.xl,
    padding: 4,
  },
  title: { color: marketplaceColors.ink, fontSize: 29, fontWeight: '900', marginTop: 3 },
  titleCopy: { alignItems: 'center', flex: 1 },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
