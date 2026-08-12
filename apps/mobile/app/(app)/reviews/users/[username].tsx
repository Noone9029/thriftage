import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../../../src/components/marketplace/marketplace-state';
import { marketplaceColors } from '../../../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../../../src/lib/auth/auth-composition';

export default function UserReviewsScreen() {
  const { username = '' } = useLocalSearchParams<{ username?: string }>();
  const cache = useQueryClient();
  const query = useQuery({
    queryFn: () => thriftageApiClient.getUserReviews(username),
    queryKey: ['reviews', username],
  });
  const report = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: 'HARASSMENT' | 'SPAM' | 'OTHER' }) =>
      thriftageApiClient.reportReview(id, { reason }),
    onSuccess: () => cache.invalidateQueries({ queryKey: ['reviews', username] }),
  });
  if (query.isLoading)
    return (
      <MarketplaceState
        loading
        title="Seller reviews"
        message="Loading transaction-backed feedback."
      />
    );
  if (!query.data?.items.length)
    return (
      <MarketplaceState
        title="No seller reviews"
        message="Completed transaction reviews will appear here."
      />
    );
  const submitReport = (id: string) =>
    Alert.alert(
      'Report this review',
      'Choose the closest reason. Reports are reviewed by authorized operations staff.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Harassment', onPress: () => report.mutate({ id, reason: 'HARASSMENT' }) },
        { text: 'Spam', onPress: () => report.mutate({ id, reason: 'SPAM' }) },
        { text: 'Other', onPress: () => report.mutate({ id, reason: 'OTHER' }) },
      ],
    );
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>@{username} reviews</Text>
        <Text style={styles.summary}>
          {query.data.summary.average?.toFixed(1) ?? '—'} ★ · {query.data.summary.count} seller
          reviews
        </Text>
        {query.data.items.map((review) => (
          <View key={review.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rating}>{review.rating} ★</Text>
              <Text style={styles.date}>{new Date(review.createdAt).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.author}>From @{review.reviewerUsername}</Text>
            <Text style={styles.copy}>{review.text ?? 'Review text is not visible.'}</Text>
            <Pressable onPress={() => submitReport(review.id)}>
              <Text style={styles.report}>Report review</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  author: { color: marketplaceColors.muted, fontSize: 12, marginTop: 5 },
  card: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 15,
    borderWidth: 1,
    padding: 16,
  },
  content: { gap: 12, padding: 22 },
  copy: { color: marketplaceColors.text, lineHeight: 21, marginTop: 13 },
  date: { color: marketplaceColors.muted, fontSize: 11 },
  rating: { color: '#B56F20', fontWeight: '900' },
  report: { color: marketplaceColors.danger, fontSize: 12, fontWeight: '800', marginTop: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  summary: { color: marketplaceColors.muted, marginBottom: 8 },
  title: { color: marketplaceColors.text, fontSize: 27, fontWeight: '900' },
});
