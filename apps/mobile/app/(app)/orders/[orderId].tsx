import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import {
  formatMoney,
  marketplaceColors,
} from '../../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';
import { useAuth } from '../../../src/providers/auth-provider';

export default function OrderDetailScreen() {
  const { orderId = '' } = useLocalSearchParams<{ orderId?: string }>();
  const { state } = useAuth();
  const cache = useQueryClient();
  const [courier, setCourier] = useState('Manual delivery');
  const [tracking, setTracking] = useState('');
  const query = useQuery({
    queryFn: () => thriftageApiClient.getOrder(orderId),
    queryKey: ['order', orderId],
    refetchInterval: 10_000,
  });
  const action = useMutation({
    mutationFn: async (kind: 'confirm' | 'cancel' | 'ship' | 'delivery') => {
      if (kind === 'confirm') return thriftageApiClient.confirmOrder(orderId);
      if (kind === 'ship')
        return thriftageApiClient.shipOrder(orderId, {
          providerDisplayName: courier,
          trackingNumber: tracking.trim() || null,
          trackingUrl: null,
        });
      if (kind === 'delivery') return thriftageApiClient.confirmDelivery(orderId);
      const role =
        query.data?.seller.id === (state.status === 'AUTHENTICATED_ACTIVE' ? state.account.id : '')
          ? 'seller'
          : 'buyer';
      return thriftageApiClient.cancelOrder(orderId, role, 'Cancelled by marketplace participant');
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['order', orderId] });
      void cache.invalidateQueries({ queryKey: ['orders'] });
    },
  });
  if (query.isLoading)
    return (
      <MarketplaceState loading title="Opening order" message="Loading transaction history." />
    );
  if (query.data === undefined)
    return (
      <MarketplaceState
        title="Order unavailable"
        message="You may not have access to this order."
      />
    );
  const order = query.data;
  const ownId = state.status === 'AUTHENTICATED_ACTIVE' ? state.account.id : '';
  const seller = order.seller.id === ownId;
  const buyer = order.buyer.id === ownId;
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.number}>{order.orderNumber}</Text>
        <Text style={styles.title}>{order.listingTitle}</Text>
        <Text style={styles.status}>{order.status}</Text>
        <View style={styles.card}>
          <Line label="Item" value={formatMoney(order.priceMinor, order.currency)} />
          <Line label="Shipping" value={formatMoney(order.shippingMinor, order.currency)} />
          <Line
            label="Payment"
            value={`${order.payment.method.replaceAll('_', ' ')} · ${order.payment.status}`}
          />
          <Line label="Total" value={formatMoney(order.totalMinor, order.currency)} />
        </View>
        <Text style={styles.section}>Delivery</Text>
        <Text style={styles.address}>
          {order.address.recipientName}
          {'\n'}
          {order.address.addressLine1}
          {'\n'}
          {order.address.city}, {order.address.region} · {order.address.countryCode}
        </Text>
        {order.shipment !== null ? (
          <View style={styles.card}>
            <Line label="Courier" value={order.shipment.providerDisplayName} />
            <Line label="Tracking" value={order.shipment.trackingNumber ?? 'Not provided'} />
          </View>
        ) : null}
        <Text style={styles.section}>Progress</Text>
        {order.events.map((event) => (
          <View key={event.id} style={styles.event}>
            <Text style={styles.dot}>●</Text>
            <Text style={styles.eventText}>{event.type.replaceAll('_', ' ')}</Text>
          </View>
        ))}
        {order.conversationId !== null ? (
          <Pressable
            style={styles.secondary}
            onPress={() => router.push(`/messages/${order.conversationId}`)}
          >
            <Text style={styles.secondaryText}>Open conversation</Text>
          </Pressable>
        ) : null}
        {seller && order.status === 'PENDING' ? (
          <Pressable style={styles.primary} onPress={() => action.mutate('confirm')}>
            <Text style={styles.primaryText}>Confirm order</Text>
          </Pressable>
        ) : null}
        {seller && order.status === 'CONFIRMED' ? (
          <View style={styles.form}>
            <TextInput
              onChangeText={setCourier}
              placeholder="Courier or delivery method"
              style={styles.input}
              value={courier}
            />
            <TextInput
              onChangeText={setTracking}
              placeholder="Tracking number (optional)"
              style={styles.input}
              value={tracking}
            />
            <Pressable style={styles.primary} onPress={() => action.mutate('ship')}>
              <Text style={styles.primaryText}>Mark shipped</Text>
            </Pressable>
          </View>
        ) : null}
        {buyer && order.status === 'SHIPPED' ? (
          <Pressable style={styles.primary} onPress={() => action.mutate('delivery')}>
            <Text style={styles.primaryText}>I received this order</Text>
          </Pressable>
        ) : null}
        {(buyer && order.status === 'PENDING') ||
        (seller && ['PENDING', 'CONFIRMED'].includes(order.status)) ? (
          <Pressable style={styles.cancel} onPress={() => action.mutate('cancel')}>
            <Text style={styles.cancelText}>Cancel order</Text>
          </Pressable>
        ) : null}
        {action.isError ? (
          <Text style={styles.error}>
            That action is no longer available. Refresh and try again.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  address: { color: marketplaceColors.text, lineHeight: 22, marginTop: 10 },
  cancel: { alignItems: 'center', padding: 16 },
  cancelText: { color: marketplaceColors.danger, fontWeight: '900' },
  card: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 18,
    padding: 15,
  },
  content: { padding: 20 },
  dot: { color: marketplaceColors.accent, fontSize: 10, marginRight: 10 },
  error: { color: marketplaceColors.danger, marginTop: 12 },
  event: { alignItems: 'center', flexDirection: 'row', marginTop: 11 },
  eventText: { color: marketplaceColors.text, fontSize: 13 },
  form: { gap: 9, marginTop: 15 },
  input: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 13,
  },
  label: { color: marketplaceColors.muted },
  line: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 6 },
  number: { color: marketplaceColors.muted, fontSize: 11, letterSpacing: 1 },
  primary: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.accent,
    borderRadius: 15,
    marginTop: 18,
    padding: 16,
  },
  primaryText: { color: '#fff', fontWeight: '900' },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  secondary: {
    alignItems: 'center',
    borderColor: marketplaceColors.forest,
    borderRadius: 15,
    borderWidth: 1,
    marginTop: 22,
    padding: 15,
  },
  secondaryText: { color: marketplaceColors.forest, fontWeight: '900' },
  section: { color: marketplaceColors.text, fontSize: 18, fontWeight: '900', marginTop: 25 },
  status: { color: marketplaceColors.accent, fontSize: 13, fontWeight: '900', marginTop: 8 },
  title: { color: marketplaceColors.text, fontSize: 27, fontWeight: '900', marginTop: 8 },
  value: { color: marketplaceColors.text, fontWeight: '800' },
});
