import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import { marketplaceColors } from '../../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';

export default function DisputesScreen() {
  const query = useQuery({
    queryFn: () => thriftageApiClient.getDisputes(),
    queryKey: ['disputes'],
  });
  if (query.isLoading)
    return <MarketplaceState loading title="Cases" message="Loading dispute history." />;
  if (!query.data?.items.length)
    return (
      <MarketplaceState
        title="No disputes"
        message="Eligible order issues can be opened from order details."
      />
    );
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Disputes</Text>
        {query.data.items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => router.push(`/disputes/${item.id}`)}
            style={styles.card}
          >
            <View style={styles.row}>
              <Text style={styles.order}>{item.orderNumber}</Text>
              <Text style={styles.status}>{item.status.replaceAll('_', ' ')}</Text>
            </View>
            <Text style={styles.reason}>{item.reason.replaceAll('_', ' ')}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 15,
    borderWidth: 1,
    padding: 16,
  },
  content: { gap: 12, padding: 22 },
  order: { color: marketplaceColors.text, fontWeight: '900' },
  reason: { color: marketplaceColors.muted, marginTop: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  status: { color: marketplaceColors.accent, fontSize: 11, fontWeight: '900' },
  title: { color: marketplaceColors.text, fontSize: 29, fontWeight: '900', marginBottom: 8 },
});
