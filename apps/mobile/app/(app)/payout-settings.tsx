import { MaterialIcons } from '@expo/vector-icons';
import type { PayoutDestinationType, SellerPayoutProfileInput } from '@thriftage/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  marketplaceColors,
  marketplaceRadii,
  marketplaceSpacing,
} from '../../src/components/marketplace/marketplace-theme';
import { useRuntimeConfig } from '../../src/hooks/use-runtime-config';
import { thriftageApiClient } from '../../src/lib/auth/auth-composition';

const destinations = ['BANK_IBAN', 'EASYPAISA', 'JAZZCASH'] as const;

export default function PayoutSettingsScreen() {
  const runtime = useRuntimeConfig();
  const queryClient = useQueryClient();
  const enabled = runtime.data?.features.payouts === true;
  const [type, setType] = useState<PayoutDestinationType>('BANK_IBAN');
  const [destination, setDestination] = useState('');
  const [accountTitle, setAccountTitle] = useState('');
  const profiles = useQuery({
    enabled,
    queryFn: () => thriftageApiClient.getPayoutProfiles(),
    queryKey: ['seller-finance', 'payout-profiles'],
  });
  const statement = useQuery({
    enabled,
    queryFn: () => thriftageApiClient.getSellerStatement(),
    queryKey: ['seller-finance', 'statement'],
  });
  const save = useMutation({
    mutationFn: () =>
      thriftageApiClient.createPayoutProfile({
        accountTitle,
        destination,
        type,
      } as SellerPayoutProfileInput),
    onSuccess: async () => {
      setDestination('');
      await queryClient.invalidateQueries({ queryKey: ['seller-finance'] });
    },
  });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}>
            <MaterialIcons color={marketplaceColors.forest} name="arrow-back" size={22} />
          </Pressable>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>SELLER COMMERCE</Text>
            <Text style={styles.heading}>Payouts & statements</Text>
          </View>
          <View style={styles.back} />
        </View>

        {!enabled ? (
          <View style={styles.gateCard}>
            <MaterialIcons color={marketplaceColors.accent} name="lock-clock" size={24} />
            <Text style={styles.cardTitle}>Payout onboarding is gated</Text>
            <Text style={styles.copy}>
              Payout destinations stay unavailable until legal, provider, encryption-key, and
              operations approvals are recorded. You can keep listing and testing non-money flows.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Add a payout destination</Text>
              <Text style={styles.copy}>
                Changes require a recent sign-in, finance review, and a 72-hour hold. Wallet numbers
                must match your verified account phone.
              </Text>
              <View style={styles.choices}>
                {destinations.map((candidate) => (
                  <Pressable
                    key={candidate}
                    onPress={() => setType(candidate)}
                    style={[styles.choice, type === candidate && styles.choiceActive]}
                  >
                    <Text
                      style={[styles.choiceText, type === candidate && styles.choiceTextActive]}
                    >
                      {candidate.replaceAll('_', ' ')}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                accessibilityLabel="Account title"
                onChangeText={setAccountTitle}
                placeholder="Account title"
                placeholderTextColor={marketplaceColors.mutedLight}
                style={styles.input}
                value={accountTitle}
              />
              <TextInput
                accessibilityLabel="Payout destination"
                autoCapitalize={type === 'BANK_IBAN' ? 'characters' : 'none'}
                keyboardType={type === 'BANK_IBAN' ? 'default' : 'phone-pad'}
                onChangeText={setDestination}
                placeholder={type === 'BANK_IBAN' ? 'PK00XXXXXXXXXXXXXXXXXXXX' : '+923001234567'}
                placeholderTextColor={marketplaceColors.mutedLight}
                style={styles.input}
                value={destination}
              />
              {save.isError ? (
                <Text style={styles.error}>
                  Could not save. Verify the destination and sign in again before retrying.
                </Text>
              ) : null}
              <Pressable
                disabled={
                  save.isPending || accountTitle.trim().length < 2 || destination.trim().length < 7
                }
                onPress={() => save.mutate()}
                style={[
                  styles.primary,
                  (save.isPending ||
                    accountTitle.trim().length < 2 ||
                    destination.trim().length < 7) &&
                    styles.disabled,
                ]}
              >
                <Text style={styles.primaryText}>
                  {save.isPending ? 'Saving securely…' : 'Submit for review'}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>Destinations</Text>
            {(profiles.data ?? []).map((profile) => (
              <View key={profile.id} style={styles.rowCard}>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{profile.accountTitle}</Text>
                  <Text style={styles.copy}>
                    {profile.displayLabel} · {profile.status.replaceAll('_', ' ')}
                  </Text>
                </View>
                <MaterialIcons
                  color={
                    profile.status === 'ACTIVE'
                      ? marketplaceColors.success
                      : marketplaceColors.muted
                  }
                  name={profile.status === 'ACTIVE' ? 'verified' : 'schedule'}
                  size={21}
                />
              </View>
            ))}

            <Text style={styles.sectionTitle}>Statement</Text>
            {(statement.data ?? []).map((entry) => (
              <View key={entry.id} style={styles.rowCard}>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{entry.type.replaceAll('_', ' ')}</Text>
                  <Text style={styles.copy}>{new Date(entry.createdAt).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.amount}>PKR {(entry.amountMinor / 100).toLocaleString()}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  amount: { color: marketplaceColors.forest, fontSize: 13, fontWeight: '900' },
  back: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  card: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.xl,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  cardTitle: { color: marketplaceColors.ink, fontSize: 17, fontWeight: '900' },
  choice: {
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  choiceActive: {
    backgroundColor: marketplaceColors.forest,
    borderColor: marketplaceColors.forest,
  },
  choiceText: { color: marketplaceColors.muted, fontSize: 9, fontWeight: '800' },
  choiceTextActive: { color: marketplaceColors.white },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  content: { gap: 14, padding: 20, paddingBottom: 60 },
  copy: { color: marketplaceColors.muted, fontSize: 11, lineHeight: 17 },
  disabled: { opacity: 0.45 },
  error: { color: marketplaceColors.danger, fontSize: 11, lineHeight: 16 },
  eyebrow: { color: marketplaceColors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  gateCard: {
    alignItems: 'flex-start',
    backgroundColor: marketplaceColors.forestSoft,
    borderRadius: marketplaceRadii.xl,
    gap: 9,
    padding: 18,
  },
  header: { alignItems: 'center', flexDirection: 'row' },
  heading: { color: marketplaceColors.ink, fontSize: 22, fontWeight: '900' },
  headingCopy: { alignItems: 'center', flex: 1 },
  input: {
    backgroundColor: marketplaceColors.background,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.md,
    borderWidth: 1,
    color: marketplaceColors.text,
    padding: 12,
  },
  primary: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.accent,
    borderRadius: marketplaceRadii.md,
    padding: 14,
  },
  primaryText: { color: marketplaceColors.white, fontWeight: '900' },
  rowCard: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  rowCopy: { flex: 1 },
  rowTitle: { color: marketplaceColors.text, fontSize: 13, fontWeight: '900' },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  sectionTitle: {
    color: marketplaceColors.ink,
    fontSize: 16,
    fontWeight: '900',
    marginTop: marketplaceSpacing.md,
  },
});
