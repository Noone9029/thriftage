import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../src/components/marketplace/marketplace-state';
import { marketplaceColors } from '../../src/components/marketplace/marketplace-theme';
import { useRuntimeConfig } from '../../src/hooks/use-runtime-config';
import { thriftageApiClient } from '../../src/lib/auth/auth-composition';

export default function SellerVerificationScreen() {
  const runtime = useRuntimeConfig();
  const cache = useQueryClient();
  const [statement, setStatement] = useState('');
  const query = useQuery({
    queryFn: () => thriftageApiClient.getSellerVerificationEligibility(),
    queryKey: ['seller-verification'],
  });
  const apply = useMutation({
    mutationFn: () => thriftageApiClient.applyForSellerVerification(statement.trim()),
    onSuccess: () => cache.invalidateQueries({ queryKey: ['seller-verification'] }),
  });
  if (runtime.isLoading)
    return (
      <MarketplaceState
        loading
        title="Seller verification"
        message="Checking feature availability."
      />
    );
  if (runtime.data?.features.sellerVerification !== true)
    return (
      <MarketplaceState
        title="Verification unavailable"
        message="Seller verification is currently paused for this beta."
      />
    );
  if (query.isLoading)
    return (
      <MarketplaceState
        loading
        title="Seller verification"
        message="Checking account eligibility."
      />
    );
  const data = query.data;
  if (!data)
    return <MarketplaceState title="Verification unavailable" message="Try again later." />;
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Seller verification</Text>
        <Text style={styles.copy}>{data.badgeExplanation}</Text>
        {data.requirements.map((item) => (
          <View key={item.key} style={styles.requirement}>
            <Text style={styles.icon}>{item.met ? '✓' : '○'}</Text>
            <Text style={styles.label}>{item.label}</Text>
          </View>
        ))}
        {data.current ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{data.current.status.replaceAll('_', ' ')}</Text>
            <Text style={styles.copy}>
              {data.current.decisionReason ?? 'Your account-review case is being assessed.'}
            </Text>
          </View>
        ) : data.eligible ? (
          <>
            <TextInput
              multiline
              maxLength={1500}
              onChangeText={setStatement}
              placeholder="Describe how you sell responsibly and represent items accurately"
              placeholderTextColor={marketplaceColors.muted}
              style={styles.input}
              value={statement}
            />
            <Pressable
              disabled={statement.trim().length < 20 || apply.isPending}
              onPress={() => apply.mutate()}
              style={styles.button}
            >
              <Text style={styles.buttonText}>
                {apply.isPending ? 'Submitting…' : 'Request account review'}
              </Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.notice}>Complete the unmet requirements before applying.</Text>
        )}
        <Text style={styles.footnote}>
          Verification is a platform account-review badge. It is not identity verification,
          authenticity certification, or a transaction guarantee.
        </Text>
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
  card: { backgroundColor: '#E7EFEA', borderRadius: 14, padding: 16 },
  cardTitle: { color: marketplaceColors.forest, fontSize: 18, fontWeight: '900', marginBottom: 8 },
  content: { gap: 13, padding: 22 },
  copy: { color: marketplaceColors.muted, lineHeight: 21 },
  footnote: { color: marketplaceColors.muted, fontSize: 12, lineHeight: 18, marginTop: 12 },
  icon: { color: marketplaceColors.accent, fontSize: 18, fontWeight: '900' },
  input: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: marketplaceColors.text,
    minHeight: 130,
    padding: 14,
    textAlignVertical: 'top',
  },
  label: { color: marketplaceColors.text, flex: 1, fontWeight: '700' },
  notice: { color: marketplaceColors.danger, fontWeight: '700' },
  requirement: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  title: { color: marketplaceColors.text, fontSize: 29, fontWeight: '900' },
});
