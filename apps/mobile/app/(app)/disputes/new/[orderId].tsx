import type { DisputeCreateInput } from '@thriftage/shared';
import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { marketplaceColors } from '../../../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../../../src/lib/auth/auth-composition';

const reasons: readonly DisputeCreateInput['reason'][] = [
  'ITEM_NOT_RECEIVED',
  'ITEM_NOT_AS_DESCRIBED',
  'DAMAGED_ITEM',
  'COUNTERFEIT_SUSPECTED',
  'DELIVERY_PROBLEM',
  'PAYMENT_OR_COD_ISSUE',
  'HARASSMENT_OR_SAFETY',
  'OTHER',
];
export default function NewDisputeScreen() {
  const { orderId = '' } = useLocalSearchParams<{ orderId?: string }>();
  const [reason, setReason] = useState<DisputeCreateInput['reason']>('ITEM_NOT_AS_DESCRIBED');
  const [description, setDescription] = useState('');
  const create = useMutation({
    mutationFn: () =>
      thriftageApiClient.createDispute({ orderId, reason, description: description.trim() }),
    onSuccess: (result) => router.replace(`/disputes/${result.id}`),
  });
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>ORDER SUPPORT</Text>
        <Text style={styles.title}>Open a dispute</Text>
        <Text style={styles.copy}>
          Choose the closest reason and describe what happened. Thriftage does not promise a refund
          or escrow outcome.
        </Text>
        {reasons.map((value) => (
          <Pressable
            key={value}
            onPress={() => setReason(value)}
            style={[styles.reason, value === reason && styles.reasonActive]}
          >
            <Text style={[styles.reasonText, value === reason && styles.reasonTextActive]}>
              {value.replaceAll('_', ' ')}
            </Text>
          </Pressable>
        ))}
        <TextInput
          multiline
          maxLength={3000}
          onChangeText={setDescription}
          placeholder="Include relevant dates, condition, communication, and delivery facts"
          placeholderTextColor={marketplaceColors.muted}
          style={styles.input}
          value={description}
        />
        <Pressable
          disabled={description.trim().length < 20 || create.isPending}
          onPress={() => create.mutate()}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{create.isPending ? 'Opening…' : 'Open dispute'}</Text>
        </Pressable>
        {create.isError ? (
          <Text style={styles.error}>This order is not eligible or a case already exists.</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.accent,
    borderRadius: 14,
    padding: 16,
  },
  buttonText: { color: '#fff', fontWeight: '900' },
  content: { gap: 12, padding: 22 },
  copy: { color: marketplaceColors.muted, lineHeight: 21, marginBottom: 5 },
  error: { color: marketplaceColors.danger },
  eyebrow: { color: marketplaceColors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  input: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: marketplaceColors.text,
    minHeight: 140,
    padding: 14,
    textAlignVertical: 'top',
  },
  reason: { borderColor: marketplaceColors.border, borderRadius: 12, borderWidth: 1, padding: 13 },
  reasonActive: {
    backgroundColor: marketplaceColors.forest,
    borderColor: marketplaceColors.forest,
  },
  reasonText: { color: marketplaceColors.text, fontSize: 12, fontWeight: '800' },
  reasonTextActive: { color: '#fff' },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  title: { color: marketplaceColors.text, fontSize: 29, fontWeight: '900' },
});
