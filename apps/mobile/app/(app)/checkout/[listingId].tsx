import * as Crypto from 'expo-crypto';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import {
  formatMoney,
  marketplaceColors,
} from '../../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';

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
        paymentMethod: 'CASH_ON_DELIVERY',
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
      router.replace(`/orders/${order.id}`);
    },
  });
  if (listing.isLoading || addresses.isLoading)
    return (
      <MarketplaceState loading title="Preparing checkout" message="Revalidating this item." />
    );
  if (listing.data === undefined)
    return (
      <MarketplaceState title="Item unavailable" message="This listing cannot be purchased." />
    );
  const saved = addresses.data ?? [];
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>SECURE CHECKOUT</Text>
        <Text style={styles.title}>{listing.data.title}</Text>
        <Text style={styles.price}>
          {formatMoney(listing.data.priceMinor, listing.data.currency)}
        </Text>
        <Text style={styles.section}>Delivery address</Text>
        {saved.map((address) => (
          <Pressable
            key={address.id}
            onPress={() => setSelected(address.id)}
            style={[styles.card, (selected ?? saved[0]?.id) === address.id && styles.selected]}
          >
            <Text style={styles.cardTitle}>
              {address.label} · {address.recipientName}
            </Text>
            <Text style={styles.cardCopy}>
              {address.addressLine1}, {address.city}, {address.countryCode}
            </Text>
          </Pressable>
        ))}
        {saved.length === 0 ? (
          <View style={styles.form}>
            {(
              ['recipientName', 'phone', 'addressLine1', 'city', 'region', 'countryCode'] as const
            ).map((field) => (
              <TextInput
                key={field}
                autoCapitalize={field === 'countryCode' ? 'characters' : 'sentences'}
                maxLength={field === 'countryCode' ? 2 : 180}
                onChangeText={(value) => setForm((current) => ({ ...current, [field]: value }))}
                placeholder={field.replace(/([A-Z])/g, ' $1')}
                style={styles.input}
                value={form[field]}
              />
            ))}
          </View>
        ) : null}
        <Text style={styles.section}>Payment</Text>
        <View style={[styles.card, styles.selected]}>
          <Text style={styles.cardTitle}>Cash on Delivery</Text>
          <Text style={styles.cardCopy}>
            Payment is recorded as pending until delivery is confirmed.
          </Text>
        </View>
        <View style={styles.total}>
          <Text style={styles.cardTitle}>Total</Text>
          <Text style={styles.totalValue}>
            {formatMoney(listing.data.priceMinor, listing.data.currency)}
          </Text>
        </View>
        {place.isError ? (
          <Text style={styles.error}>
            The item may no longer be available. No payment was taken.
          </Text>
        ) : null}
        <Pressable disabled={place.isPending} onPress={() => place.mutate()} style={styles.button}>
          <Text style={styles.buttonText}>
            {place.isPending ? 'Placing order…' : 'Place COD order'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.accent,
    borderRadius: 16,
    marginTop: 24,
    padding: 17,
  },
  buttonText: { color: '#fff', fontWeight: '900' },
  card: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 15,
    borderWidth: 1,
    marginTop: 10,
    padding: 15,
  },
  cardCopy: { color: marketplaceColors.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  cardTitle: { color: marketplaceColors.text, fontWeight: '900' },
  content: { padding: 20 },
  error: { color: marketplaceColors.danger, marginTop: 16 },
  eyebrow: { color: marketplaceColors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  form: { gap: 9, marginTop: 10 },
  input: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 13,
  },
  price: { color: marketplaceColors.forest, fontSize: 20, fontWeight: '900', marginTop: 8 },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  section: { color: marketplaceColors.text, fontSize: 18, fontWeight: '900', marginTop: 26 },
  selected: { borderColor: marketplaceColors.forest, borderWidth: 2 },
  title: { color: marketplaceColors.text, fontSize: 28, fontWeight: '900', marginTop: 8 },
  total: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25 },
  totalValue: { color: marketplaceColors.forest, fontSize: 18, fontWeight: '900' },
});
