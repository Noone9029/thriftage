import { MaterialIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import {
  formatMoney,
  marketplaceColors,
  marketplaceRadii,
  marketplaceShadows,
  marketplaceSpacing,
} from '../../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';
import { useAuth } from '../../../src/providers/auth-provider';

const eventLabels: Readonly<Record<string, string>> = {
  ORDER_CREATED: 'Order placed',
  SELLER_CONFIRMED: 'Seller confirmed',
  SELLER_CANCELLED: 'Cancelled by seller',
  BUYER_CANCELLED: 'Cancelled by buyer',
  MARKED_SHIPPED: 'On the way',
  MARKED_DELIVERED: 'Delivered',
  COMPLETED: 'Order complete',
  PAYMENT_STATUS_CHANGED: 'Payment updated',
};

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
      <MarketplaceState
        loading
        title="Opening your order"
        message="Refreshing every step of the transaction."
      />
    );
  if (query.data === undefined)
    return (
      <MarketplaceState
        actionLabel="Go back"
        icon="receipt-long"
        message="This order is unavailable or you no longer have access."
        onAction={() => router.back()}
        title="Order unavailable"
      />
    );
  const order = query.data;
  const ownId = state.status === 'AUTHENTICATED_ACTIVE' ? state.account.id : '';
  const seller = order.seller.id === ownId;
  const buyer = order.buyer.id === ownId;
  const counterpart = seller ? order.buyer : order.seller;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.back}
          >
            <MaterialIcons color={marketplaceColors.forest} name="arrow-back" size={22} />
          </Pressable>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>ORDER JOURNEY</Text>
            <Text style={styles.number}>{order.orderNumber}</Text>
          </View>
          <View style={styles.back} />
        </View>

        <View style={styles.hero}>
          {order.listingImageUrl === null ? (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <MaterialIcons color={marketplaceColors.forest} name="checkroom" size={28} />
            </View>
          ) : (
            <Image contentFit="cover" source={order.listingImageUrl} style={styles.image} />
          )}
          <View style={styles.heroCopy}>
            <View style={styles.statusPill}>
              <Text style={styles.status}>{order.status.replaceAll('_', ' ')}</Text>
            </View>
            <Text numberOfLines={2} style={styles.title}>
              {order.listingTitle}
            </Text>
            <Text style={styles.counterpart}>
              {seller ? 'Buyer' : 'Seller'} · @{counterpart.username}
            </Text>
            <Text style={styles.total}>{formatMoney(order.totalMinor, order.currency)}</Text>
          </View>
        </View>

        <Text style={styles.sectionEyebrow}>ORDER SUMMARY</Text>
        <View style={styles.card}>
          <Line label="Item" value={formatMoney(order.priceMinor, order.currency)} />
          <Line label="Shipping" value={formatMoney(order.shippingMinor, order.currency)} />
          <Line label="Payment method" value={order.payment.method.replaceAll('_', ' ')} />
          <Line label="Payment status" value={order.payment.status.replaceAll('_', ' ')} />
          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatMoney(order.totalMinor, order.currency)}</Text>
          </View>
        </View>

        <Text style={styles.sectionEyebrow}>DELIVERY</Text>
        <View style={styles.deliveryCard}>
          <View style={styles.deliveryIcon}>
            <MaterialIcons color={marketplaceColors.forest} name="location-on" size={22} />
          </View>
          <View style={styles.deliveryCopy}>
            <Text style={styles.deliveryName}>{order.address.recipientName}</Text>
            <Text style={styles.address}>
              {order.address.addressLine1}
              {'\n'}
              {order.address.city}, {order.address.region} · {order.address.countryCode}
            </Text>
          </View>
        </View>
        {order.shipment !== null ? (
          <View style={styles.shipmentCard}>
            <MaterialIcons color={marketplaceColors.accent} name="local-shipping" size={22} />
            <View style={styles.shipmentCopy}>
              <Text style={styles.shipmentTitle}>{order.shipment.providerDisplayName}</Text>
              <Text style={styles.shipmentText}>
                {order.shipment.trackingNumber ?? 'Tracking number not provided'}
              </Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.status}>{order.shipment.status.replaceAll('_', ' ')}</Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionEyebrow}>PROGRESS</Text>
        <View style={styles.timeline}>
          {order.events.map((event, index) => (
            <View key={event.id} style={styles.event}>
              <View style={styles.eventRail}>
                <View style={styles.eventDot}>
                  <MaterialIcons color={marketplaceColors.white} name="check" size={13} />
                </View>
                {index < order.events.length - 1 ? <View style={styles.eventLine} /> : null}
              </View>
              <View style={styles.eventCopy}>
                <Text style={styles.eventTitle}>
                  {eventLabels[event.type] ?? event.type.replaceAll('_', ' ')}
                </Text>
                <Text style={styles.eventMeta}>
                  {new Date(event.createdAt).toLocaleDateString([], {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {' · '}
                  {new Date(event.createdAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
                {event.reason === null ? null : (
                  <Text style={styles.eventReason}>{event.reason}</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.supportActions}>
          {order.conversationId !== null ? (
            <OrderAction
              icon="forum"
              label="Open conversation"
              onPress={() => router.push(`/messages/${order.conversationId}`)}
            />
          ) : null}
          {order.status === 'COMPLETED' ? (
            <OrderAction
              icon="star-outline"
              label="Review transaction"
              onPress={() => router.push(`/reviews/${order.id}`)}
            />
          ) : null}
          {['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(order.status) ? (
            <OrderAction
              icon="report-problem"
              label="Report an order problem"
              onPress={() => router.push(`/disputes/new/${order.id}`)}
            />
          ) : null}
        </View>

        {seller && order.status === 'PENDING' ? (
          <PrimaryOrderAction
            disabled={action.isPending}
            icon="check-circle"
            label="Confirm this order"
            onPress={() => action.mutate('confirm')}
          />
        ) : null}
        {seller && order.status === 'CONFIRMED' ? (
          <View style={styles.form}>
            <Text style={styles.formTitle}>Add delivery details</Text>
            <Text style={styles.formCopy}>
              Tell the buyer how the piece is moving. Only mark it shipped after handoff.
            </Text>
            <TextInput
              onChangeText={setCourier}
              placeholder="Courier or delivery method"
              placeholderTextColor={marketplaceColors.mutedLight}
              style={styles.input}
              value={courier}
            />
            <TextInput
              onChangeText={setTracking}
              placeholder="Tracking number (optional)"
              placeholderTextColor={marketplaceColors.mutedLight}
              style={styles.input}
              value={tracking}
            />
            <PrimaryOrderAction
              disabled={action.isPending || courier.trim() === ''}
              icon="local-shipping"
              label="Mark as shipped"
              onPress={() => action.mutate('ship')}
            />
          </View>
        ) : null}
        {buyer && order.status === 'SHIPPED' ? (
          <PrimaryOrderAction
            disabled={action.isPending}
            icon="inventory"
            label="I received this order"
            onPress={() => action.mutate('delivery')}
          />
        ) : null}
        {(buyer && order.status === 'PENDING') ||
        (seller && ['PENDING', 'CONFIRMED'].includes(order.status)) ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: action.isPending, disabled: action.isPending }}
            disabled={action.isPending}
            onPress={() => action.mutate('cancel')}
            style={[styles.cancel, action.isPending && styles.disabled]}
          >
            <Text style={styles.cancelText}>Cancel order</Text>
          </Pressable>
        ) : null}
        {action.isError ? (
          <View style={styles.errorCard}>
            <MaterialIcons color={marketplaceColors.danger} name="error-outline" size={19} />
            <Text style={styles.error}>
              That action is no longer available. Refresh and try again.
            </Text>
          </View>
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

function OrderAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.secondary}
    >
      <MaterialIcons color={marketplaceColors.forest} name={icon} size={19} />
      <Text style={styles.secondaryText}>{label}</Text>
      <MaterialIcons color={marketplaceColors.muted} name="chevron-right" size={20} />
    </Pressable>
  );
}

function PrimaryOrderAction({
  disabled = false,
  icon,
  label,
  onPress,
}: {
  disabled?: boolean;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.primary, disabled && styles.disabled]}
    >
      <MaterialIcons color={marketplaceColors.white} name={icon} size={20} />
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  address: { color: marketplaceColors.muted, fontSize: 11, lineHeight: 17, marginTop: 4 },
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
  cancel: { alignItems: 'center', padding: 16 },
  cancelText: { color: marketplaceColors.danger, fontSize: 12, fontWeight: '900' },
  card: {
    ...marketplaceShadows.card,
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.xl,
    borderWidth: 1,
    gap: 4,
    marginTop: 9,
    padding: 16,
  },
  content: { padding: 20, paddingBottom: 50 },
  counterpart: { color: marketplaceColors.muted, fontSize: 10, marginTop: 5 },
  deliveryCard: {
    alignItems: 'flex-start',
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    marginTop: 9,
    padding: 14,
  },
  deliveryCopy: { flex: 1 },
  deliveryIcon: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forestSoft,
    borderRadius: 17,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  deliveryName: { color: marketplaceColors.text, fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  error: { color: marketplaceColors.danger, flex: 1, fontSize: 11, lineHeight: 16 },
  errorCard: {
    alignItems: 'flex-start',
    backgroundColor: marketplaceColors.dangerSoft,
    borderRadius: marketplaceRadii.md,
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    padding: 12,
  },
  event: { flexDirection: 'row', gap: 12 },
  eventCopy: { flex: 1, paddingBottom: 20 },
  eventDot: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forest,
    borderRadius: 13,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  eventLine: {
    backgroundColor: marketplaceColors.borderStrong,
    flex: 1,
    marginVertical: 4,
    width: 2,
  },
  eventMeta: { color: marketplaceColors.muted, fontSize: 9, marginTop: 4 },
  eventRail: { alignItems: 'center', width: 26 },
  eventReason: { color: marketplaceColors.muted, fontSize: 10, lineHeight: 15, marginTop: 5 },
  eventTitle: { color: marketplaceColors.text, fontSize: 13, fontWeight: '900' },
  eyebrow: { color: marketplaceColors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 1.7 },
  form: {
    backgroundColor: marketplaceColors.forestSoft,
    borderRadius: marketplaceRadii.xl,
    gap: 9,
    marginTop: 16,
    padding: 15,
  },
  formCopy: { color: marketplaceColors.muted, fontSize: 10, lineHeight: 15 },
  formTitle: { color: marketplaceColors.forest, fontSize: 16, fontWeight: '900' },
  headingCopy: { alignItems: 'center', flex: 1 },
  hero: {
    ...marketplaceShadows.card,
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.xl,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: marketplaceSpacing.xl,
    overflow: 'hidden',
  },
  heroCopy: { flex: 1, justifyContent: 'center', padding: 14 },
  image: { backgroundColor: marketplaceColors.sand, height: 158, width: 116 },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  input: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.md,
    borderWidth: 1,
    color: marketplaceColors.text,
    padding: 13,
  },
  label: { color: marketplaceColors.muted, fontSize: 11 },
  line: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 6 },
  number: { color: marketplaceColors.ink, fontSize: 16, fontWeight: '900', marginTop: 3 },
  primary: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.accent,
    borderRadius: marketplaceRadii.lg,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 54,
  },
  primaryText: { color: marketplaceColors.white, fontSize: 14, fontWeight: '900' },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  secondary: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    minHeight: 52,
    paddingHorizontal: 13,
  },
  secondaryText: { color: marketplaceColors.forest, flex: 1, fontSize: 12, fontWeight: '900' },
  sectionEyebrow: {
    color: marketplaceColors.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginTop: 28,
  },
  shipmentCard: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.accentSoft,
    borderRadius: marketplaceRadii.lg,
    flexDirection: 'row',
    gap: 10,
    marginTop: 9,
    padding: 13,
  },
  shipmentCopy: { flex: 1 },
  shipmentText: { color: marketplaceColors.muted, fontSize: 10, marginTop: 3 },
  shipmentTitle: { color: marketplaceColors.text, fontSize: 12, fontWeight: '900' },
  status: { color: marketplaceColors.success, fontSize: 8, fontWeight: '900' },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: marketplaceColors.successSoft,
    borderRadius: marketplaceRadii.pill,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  supportActions: { gap: 8, marginTop: 18 },
  timeline: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.xl,
    borderWidth: 1,
    marginTop: 9,
    padding: 16,
    paddingBottom: 0,
  },
  title: {
    color: marketplaceColors.text,
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 21,
    marginTop: 8,
  },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  total: { color: marketplaceColors.forest, fontSize: 16, fontWeight: '900', marginTop: 8 },
  totalLabel: { color: marketplaceColors.text, fontSize: 14, fontWeight: '900' },
  totalLine: {
    borderTopColor: marketplaceColors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
    paddingTop: 12,
  },
  totalValue: { color: marketplaceColors.forest, fontSize: 16, fontWeight: '900' },
  value: { color: marketplaceColors.text, fontSize: 11, fontWeight: '800' },
});
