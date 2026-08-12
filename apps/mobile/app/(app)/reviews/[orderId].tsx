import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import { marketplaceColors } from '../../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';

export default function ReviewOrderScreen() {
  const { orderId = '' } = useLocalSearchParams<{ orderId?: string }>();
  const cache = useQueryClient();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const eligibility = useQuery({
    queryFn: () => thriftageApiClient.getReviewEligibility(orderId),
    queryKey: ['review-eligibility', orderId],
  });
  const submit = useMutation({
    mutationFn: () =>
      thriftageApiClient.createReview({
        orderId,
        rating,
        ...(text.trim() === '' ? {} : { text: text.trim() }),
      }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['review-eligibility', orderId] });
      router.back();
    },
  });
  if (eligibility.isLoading)
    return <MarketplaceState loading title="Checking review" message="Confirming eligibility." />;
  if (!eligibility.data?.eligible)
    return (
      <MarketplaceState
        title={eligibility.data?.review ? 'Review submitted' : 'Review unavailable'}
        message="Reviews are available once an eligible transaction is completed."
      />
    );
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>TRANSACTION REVIEW</Text>
        <Text style={styles.title}>How did it go?</Text>
        <Text style={styles.copy}>Share a factual, respectful review of this transaction.</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable
              key={value}
              accessibilityLabel={`${value} stars`}
              onPress={() => setRating(value)}
            >
              <Text style={[styles.star, value <= rating && styles.starActive]}>★</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          multiline
          maxLength={1000}
          onChangeText={setText}
          placeholder="Optional details about communication, accuracy, and handoff"
          placeholderTextColor={marketplaceColors.muted}
          style={styles.input}
          value={text}
        />
        <Pressable
          disabled={submit.isPending}
          onPress={() => submit.mutate()}
          style={styles.button}
        >
          <Text style={styles.buttonText}>
            {submit.isPending ? 'Submitting…' : 'Submit review'}
          </Text>
        </Pressable>
        {submit.isError ? (
          <Text style={styles.error}>The review could not be submitted.</Text>
        ) : null}
      </View>
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
  content: { gap: 18, padding: 22 },
  copy: { color: marketplaceColors.muted, lineHeight: 21 },
  error: { color: marketplaceColors.danger },
  eyebrow: { color: marketplaceColors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
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
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  star: { color: marketplaceColors.border, fontSize: 38 },
  starActive: { color: '#D8973C' },
  stars: { flexDirection: 'row', gap: 7 },
  title: { color: marketplaceColors.text, fontSize: 30, fontWeight: '900' },
});
