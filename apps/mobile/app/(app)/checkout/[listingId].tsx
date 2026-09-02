import { MaterialIcons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import type { PaymentMethod } from '@thriftage/shared';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import { DetailSkeleton } from '../../../src/components/marketplace/marketplace-skeleton';
import {
  formatMoney,
  marketplaceColors,
  marketplaceRadii,
  marketplaceShadows,
  marketplaceSpacing,
} from '../../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';
import { useRuntimeConfig } from '../../../src/hooks/use-runtime-config';

export default function CheckoutScreen() {
  const { aiGenerationId, listingId = '' } = useLocalSearchParams<{
    aiGenerationId?: string;
    listingId?: string;
  }>();
  const listing = useQuery({
    queryFn: () => thriftageApiClient.getListing(listingId),
    queryKey: ['marketplace', 'listing', listingId],
  });
  useEffect(() => {
    if (listingId !== '')
      void thriftageApiClient
        .recordRecommendationEvent({ listingId, source: 'LISTING_DETAIL', type: 'CHECKOUT' })
        .catch(() => undefined);
  }, [listingId]);
  const addresses = useQuery({
    queryFn: () => thriftageApiClient.getAddresses(),
    queryKey: ['addresses'],
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH_ON_DELIVERY');
  const runtime = useRuntimeConfig();
  const [form, setForm] = useState({
    addressLine1: '',
    city: '',
    countryCode: 'PK',
    label: 'Home',
    phone: '',
    recipientName: '',
    region: '',
  });
  const place = useMutation({
    mutationFn: async () => {
      let addressId = selected ?? addresses.data?.[0]?.id;
      if (addressId === undefined)
        addressId = (
          await thriftageApiClient.createAddress({
            ...form,
            addressLine2: null,
            deliveryInstructions: null,
            isDefault: true,
            postalCode: null,
          })
        ).id;
      return thriftageApiClient.placeOrder({
        addressId,
        idempotencyKey: Crypto.randomUUID(),
        listingId,
        paymentMethod,
      });
    },
    onSuccess: (order) => {
      if (aiGenerationId !== undefined)
        void Promise.allSettled([
          thriftageApiClient.recordStylistAttribution({
            event: 'CHECKOUT',
            generationId: aiGenerationId,
            listingId,
            orderId: order.id,
          }),
          thriftageApiClient.recordStylistAttribution({
            event: 'PURCHASE',
            generationId: aiGenerationId,
            listingId,
            orderId: order.id,
          }),
        ]);
      if (paymentMethod === 'PAYFAST_HOSTED') {
        void thriftageApiClient
          .beginPayFastCheckout(order.id)
          .then((session) => Linking.openURL(session.redirectUrl))
          .catch(() => undefined)
          .finally(() => router.replace(`/orders/${order.id}`));
        return;
      }
      router.replace(`/orders/${order.id}`);
    },
  });
  if (listing.isLoading || addresses.isLoading) return <DetailSkeleton />;
  if (listing.isError || addresses.isError)
    return (
      <MarketplaceState
        actionLabel="Try again"
        icon="cloud-off"
        title="Checkout is offline"
        message="We could not securely revalidate the piece and delivery details. No order was placed."
        onAction={() => {
          void listing.refetch();
          void addresses.refetch();
        }}
      />
    );
  if (listing.data === undefined)
    return (
      <MarketplaceState
        actionLabel="Back to discovery"
        icon="inventory-2"
        message="This piece is no longer available to order."
        onAction={() => router.replace('/')}
        title="Someone got there first"
      />
    );
  const saved = addresses.data ?? [];
  const formComplete =
    form.recipientName.trim() !== '' &&
    form.phone.trim() !== '' &&
    form.addressLine1.trim() !== '' &&
    form.city.trim() !== '' &&
    form.region.trim() !== '' &&
    form.countryCode.trim().length === 2;
  const selectedAddress = saved.find((address) => address.id === (selected ?? saved[0]?.id));
  const checkoutCity = selectedAddress?.city ?? form.city;
  const checkoutCountryCode = selectedAddress?.countryCode ?? form.countryCode;
  const hasDeliveryAddress = selectedAddress !== undefined || formComplete;
  const deliveryEligible =
    runtime.data !== undefined &&
    runtime.data.features.localCourier &&
    runtime.data.commerce.deliveryCountryCode.toUpperCase() ===
      checkoutCountryCode.trim().toUpperCase() &&
    runtime.data.commerce.deliveryCities.some(
      (city) => city.trim().toLocaleLowerCase() === checkoutCity.trim().toLocaleLowerCase(),
    );
  const canPlace = hasDeliveryAddress && deliveryEligible;
  const cover = listing.data.images[0]?.url;
  const deliveryMinor = runtime.data?.commerce.lahoreDeliveryFeeMinor ?? 0;
  const totalMinor = listing.data.priceMinor + deliveryMinor;
  const codEnabled = runtime.data?.features.cashOnDelivery ?? false;
  const payfastEnabled = runtime.data?.features.payfast ?? false;
  const paymentAvailable =
    (paymentMethod === 'CASH_ON_DELIVERY' && codEnabled) ||
    (paymentMethod === 'PAYFAST_HOSTED' && payfastEnabled);

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
          <View style={styles.titleBlock}>
            <Text style={styles.eyebrow}>SECURE CHECKOUT</Text>
            <Text style={styles.heading}>Almost yours</Text>
          </View>
          <View style={styles.back} />
        </View>

        <View style={styles.itemCard}>
          {cover === undefined ? (
            <View style={[styles.itemImage, styles.imagePlaceholder]}>
              <MaterialIcons color={marketplaceColors.forest} name="checkroom" size={28} />
            </View>
          ) : (
            <Image contentFit="cover" source={cover} style={styles.itemImage} />
          )}
          <View style={styles.itemCopy}>
            <Text style={styles.itemEyebrow}>YOUR PIECE</Text>
            <Text numberOfLines={2} style={styles.itemTitle}>
              {listing.data.title}
            </Text>
            <Text style={styles.price}>
              {formatMoney(listing.data.priceMinor, listing.data.currency)}
            </Text>
            <Text style={styles.seller}>Sold by @{listing.data.seller.username}</Text>
          </View>
        </View>

        <CheckoutSection
          icon="local-shipping"
          label="Where should it go?"
          number="1"
          subtitle="Choose a saved address or add your first one."
        />
        {saved.map((address) => {
          const active = (selected ?? saved[0]?.id) === address.id;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              key={address.id}
              onPress={() => setSelected(address.id)}
              style={[styles.addressCard, active && styles.selected]}
            >
              <View style={[styles.radio, active && styles.radioActive]}>
                {active ? <View style={styles.radioDot} /> : null}
              </View>
              <View style={styles.addressCopy}>
                <Text style={styles.cardTitle}>
                  {address.label} · {address.recipientName}
                </Text>
                <Text style={styles.cardCopy}>
                  {address.addressLine1}, {address.city}, {address.countryCode}
                </Text>
              </View>
              <MaterialIcons color={marketplaceColors.muted} name="location-on" size={20} />
            </Pressable>
          );
        })}
        {saved.length === 0 ? (
          <View style={styles.formCard}>
            <CheckoutInput
              label="Recipient name"
              onChangeText={(value) => setForm((current) => ({ ...current, recipientName: value }))}
              placeholder="Who is receiving it?"
              value={form.recipientName}
            />
            <CheckoutInput
              keyboardType="phone-pad"
              label="Phone"
              onChangeText={(value) => setForm((current) => ({ ...current, phone: value }))}
              placeholder="+92 300 1234567"
              value={form.phone}
            />
            <CheckoutInput
              label="Street address"
              onChangeText={(value) => setForm((current) => ({ ...current, addressLine1: value }))}
              placeholder="House, street, area"
              value={form.addressLine1}
            />
            <View style={styles.inputRow}>
              <CheckoutInput
                label="City"
                onChangeText={(value) => setForm((current) => ({ ...current, city: value }))}
                placeholder="Lahore"
                value={form.city}
              />
              <CheckoutInput
                label="Province / region"
                onChangeText={(value) => setForm((current) => ({ ...current, region: value }))}
                placeholder="Punjab"
                value={form.region}
              />
            </View>
            <CheckoutInput
              autoCapitalize="characters"
              label="Country code"
              maxLength={2}
              onChangeText={(value) => setForm((current) => ({ ...current, countryCode: value }))}
              placeholder="PK"
              value={form.countryCode}
            />
          </View>
        ) : null}
        {hasDeliveryAddress && runtime.data !== undefined && !deliveryEligible ? (
          <Text style={styles.error}>
            Beta delivery is currently available only in{' '}
            {runtime.data.commerce.deliveryCities.join(', ')},{' '}
            {runtime.data.commerce.deliveryCountryCode}. Choose an eligible address to continue.
          </Text>
        ) : null}

        <CheckoutSection
          icon="payments"
          label="How you'll pay"
          number="2"
          subtitle="Choose an enabled method. Both settle to Thriftage before seller payout."
        />
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{
            disabled: !payfastEnabled || !deliveryEligible,
            selected: paymentMethod === 'PAYFAST_HOSTED',
          }}
          disabled={!payfastEnabled || !deliveryEligible}
          onPress={() => setPaymentMethod('PAYFAST_HOSTED')}
          style={[
            styles.paymentCard,
            paymentMethod === 'PAYFAST_HOSTED' && styles.selected,
            (!payfastEnabled || !deliveryEligible) && styles.disabled,
          ]}
        >
          <View style={styles.paymentIcon}>
            <MaterialIcons color={marketplaceColors.forest} name="account-balance" size={23} />
          </View>
          <View style={styles.paymentCopy}>
            <Text style={styles.cardTitle}>PayFast hosted checkout</Text>
            <Text style={styles.cardCopy}>
              Pay by supported bank, wallet, card, or Raast method. The 15-minute checkout opens
              only when the beta gate is enabled.
            </Text>
          </View>
          {paymentMethod === 'PAYFAST_HOSTED' ? (
            <MaterialIcons color={marketplaceColors.success} name="check-circle" size={22} />
          ) : null}
        </Pressable>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{
            disabled: !codEnabled || !deliveryEligible,
            selected: paymentMethod === 'CASH_ON_DELIVERY',
          }}
          disabled={!codEnabled || !deliveryEligible}
          onPress={() => setPaymentMethod('CASH_ON_DELIVERY')}
          style={[
            styles.paymentCard,
            paymentMethod === 'CASH_ON_DELIVERY' && styles.selected,
            (!codEnabled || !deliveryEligible) && styles.disabled,
          ]}
        >
          <View style={styles.paymentIcon}>
            <MaterialIcons color={marketplaceColors.forest} name="payments" size={23} />
          </View>
          <View style={styles.paymentCopy}>
            <Text style={styles.cardTitle}>Cash on Delivery</Text>
            <Text style={styles.cardCopy}>
              Available only after the courier’s itemized bank-deposit drill is approved. Cash never
              goes directly to the seller.
            </Text>
          </View>
          {paymentMethod === 'CASH_ON_DELIVERY' ? (
            <MaterialIcons color={marketplaceColors.success} name="check-circle" size={22} />
          ) : null}
        </Pressable>
        {!codEnabled && !payfastEnabled ? (
          <Text style={styles.error}>
            Purchases are temporarily gated while payment and courier approvals are completed.
          </Text>
        ) : null}

        <CheckoutSection
          icon="receipt-long"
          label="Review your order"
          number="3"
          subtitle="One final check before your order is placed."
        />
        <View style={styles.summaryCard}>
          <SummaryLine
            label="Item"
            value={formatMoney(listing.data.priceMinor, listing.data.currency)}
          />
          <SummaryLine label="Delivery" value={formatMoney(deliveryMinor, listing.data.currency)} />
          <SummaryLine
            label="Payment"
            value={
              paymentMethod === 'PAYFAST_HOSTED' ? 'PayFast hosted checkout' : 'Cash on Delivery'
            }
          />
          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Order total</Text>
            <Text style={styles.totalValue}>{formatMoney(totalMinor, listing.data.currency)}</Text>
          </View>
        </View>
        <View style={styles.trustCard}>
          <MaterialIcons color={marketplaceColors.forest} name="verified-user" size={20} />
          <Text style={styles.trustText}>
            Availability is checked again when you place the order. If the piece sold, no order is
            created.
          </Text>
        </View>
        {place.isError ? (
          <View style={styles.errorCard}>
            <MaterialIcons color={marketplaceColors.danger} name="error-outline" size={19} />
            <Text style={styles.error}>
              The piece may no longer be available. No payment was taken.
            </Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={!canPlace || !paymentAvailable || place.isPending}
          onPress={() => place.mutate()}
          style={({ pressed }) => [
            styles.button,
            (!canPlace || !paymentAvailable || place.isPending) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.buttonText}>
            {place.isPending
              ? 'Placing your order…'
              : paymentMethod === 'PAYFAST_HOSTED'
                ? 'Continue to PayFast'
                : 'Place COD order'}
          </Text>
          <MaterialIcons color={marketplaceColors.white} name="arrow-forward" size={19} />
        </Pressable>
        <Text style={styles.legalCopy}>
          By placing this order, you agree to the marketplace policies shown in Thriftage.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function CheckoutSection({
  icon,
  label,
  number,
  subtitle,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  number: string;
  subtitle: string;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionNumber}>
        <Text style={styles.sectionNumberText}>{number}</Text>
      </View>
      <View style={styles.sectionCopy}>
        <View style={styles.sectionTitleRow}>
          <MaterialIcons color={marketplaceColors.forest} name={icon} size={18} />
          <Text style={styles.sectionTitle}>{label}</Text>
        </View>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function CheckoutInput(props: {
  autoCapitalize?: 'characters';
  keyboardType?: 'phone-pad';
  label: string;
  maxLength?: number;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{props.label}</Text>
      <TextInput
        accessibilityLabel={props.label}
        autoCapitalize={props.autoCapitalize}
        keyboardType={props.keyboardType}
        maxLength={props.maxLength}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={marketplaceColors.mutedLight}
        style={styles.input}
        value={props.value}
      />
    </View>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  addressCard: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    marginTop: 9,
    padding: 14,
  },
  addressCopy: { flex: 1 },
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
  button: {
    ...marketplaceShadows.floating,
    alignItems: 'center',
    backgroundColor: marketplaceColors.accent,
    borderRadius: marketplaceRadii.lg,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: marketplaceSpacing.xl,
    minHeight: 56,
  },
  buttonText: { color: marketplaceColors.white, fontSize: 15, fontWeight: '900' },
  cardCopy: { color: marketplaceColors.muted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  cardTitle: { color: marketplaceColors.text, fontSize: 13, fontWeight: '900' },
  content: { padding: 20, paddingBottom: 46 },
  disabled: { opacity: 0.45 },
  error: { color: marketplaceColors.danger, flex: 1, fontSize: 11, lineHeight: 16 },
  errorCard: {
    alignItems: 'flex-start',
    backgroundColor: marketplaceColors.dangerSoft,
    borderRadius: marketplaceRadii.md,
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    padding: 12,
  },
  eyebrow: { color: marketplaceColors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 1.8 },
  field: { flex: 1, gap: 6 },
  formCard: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.xl,
    borderWidth: 1,
    gap: 12,
    marginTop: 10,
    padding: 14,
  },
  heading: { color: marketplaceColors.ink, fontSize: 24, fontWeight: '900', marginTop: 3 },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  input: {
    backgroundColor: marketplaceColors.background,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.md,
    borderWidth: 1,
    color: marketplaceColors.text,
    fontSize: 13,
    padding: 12,
  },
  inputLabel: { color: marketplaceColors.muted, fontSize: 9, fontWeight: '900' },
  inputRow: { flexDirection: 'row', gap: 9 },
  itemCard: {
    ...marketplaceShadows.card,
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.xl,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: marketplaceSpacing.xl,
    overflow: 'hidden',
  },
  itemCopy: { flex: 1, justifyContent: 'center', padding: 14 },
  itemEyebrow: {
    color: marketplaceColors.accent,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  itemImage: { backgroundColor: marketplaceColors.sand, height: 150, width: 118 },
  itemTitle: {
    color: marketplaceColors.text,
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 21,
    marginTop: 7,
  },
  legalCopy: {
    color: marketplaceColors.muted,
    fontSize: 9,
    lineHeight: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  paymentCard: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    marginTop: 10,
    padding: 14,
  },
  paymentCopy: { flex: 1 },
  paymentIcon: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forestSoft,
    borderRadius: 17,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  price: { color: marketplaceColors.forest, fontSize: 16, fontWeight: '900', marginTop: 8 },
  radio: {
    alignItems: 'center',
    borderColor: marketplaceColors.borderStrong,
    borderRadius: 10,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  radioActive: { borderColor: marketplaceColors.forest, borderWidth: 2 },
  radioDot: { backgroundColor: marketplaceColors.forest, borderRadius: 5, height: 10, width: 10 },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  section: { alignItems: 'center', flexDirection: 'row', gap: 11, marginTop: 30 },
  sectionCopy: { flex: 1 },
  sectionNumber: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forest,
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  sectionNumberText: { color: marketplaceColors.white, fontSize: 11, fontWeight: '900' },
  sectionSubtitle: { color: marketplaceColors.muted, fontSize: 10, marginTop: 3 },
  sectionTitle: { color: marketplaceColors.text, fontSize: 17, fontWeight: '900' },
  sectionTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  selected: { borderColor: marketplaceColors.forest, borderWidth: 2 },
  seller: { color: marketplaceColors.muted, fontSize: 10, marginTop: 4 },
  summaryCard: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.xl,
    borderWidth: 1,
    gap: 11,
    marginTop: 10,
    padding: 16,
  },
  summaryLabel: { color: marketplaceColors.muted, fontSize: 12 },
  summaryLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  summaryValue: { color: marketplaceColors.text, fontSize: 12, fontWeight: '800' },
  titleBlock: { alignItems: 'center', flex: 1 },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { color: marketplaceColors.text, fontSize: 15, fontWeight: '900' },
  totalLine: {
    alignItems: 'center',
    borderTopColor: marketplaceColors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 13,
  },
  totalValue: { color: marketplaceColors.forest, fontSize: 18, fontWeight: '900' },
  trustCard: {
    alignItems: 'flex-start',
    backgroundColor: marketplaceColors.forestSoft,
    borderRadius: marketplaceRadii.md,
    flexDirection: 'row',
    gap: 8,
    marginTop: 13,
    padding: 12,
  },
  trustText: { color: marketplaceColors.forest, flex: 1, fontSize: 10, lineHeight: 15 },
});
