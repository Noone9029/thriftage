import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../src/components/marketplace/marketplace-state';
import { marketplaceColors } from '../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../src/lib/auth/auth-composition';

export default function PoliciesScreen() {
  const cache = useQueryClient();
  const query = useQuery({
    queryFn: () => thriftageApiClient.getCurrentPolicies(),
    queryKey: ['policies'],
  });
  const accept = useMutation({
    mutationFn: () =>
      thriftageApiClient.acceptPolicies(
        (query.data?.items ?? []).filter((item) => item.requiredForUgc).map((item) => item.id),
      ),
    onSuccess: () => cache.invalidateQueries({ queryKey: ['policies'] }),
  });
  if (query.isLoading)
    return (
      <MarketplaceState loading title="Loading policies" message="Checking current versions." />
    );
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Marketplace policies</Text>
        <Text style={styles.copy}>
          These rules protect buyers, sellers, and the Thriftage community.
        </Text>
        {(query.data?.items ?? []).map((item) => (
          <Pressable
            key={item.id}
            onPress={() => void Linking.openURL(item.url)}
            style={styles.card}
          >
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.status}>{item.accepted ? 'Accepted' : 'Review'}</Text>
            </View>
            <Text style={styles.version}>Version {item.version}</Text>
          </Pressable>
        ))}
        {!query.data?.acceptedForUgc && (query.data?.items.length ?? 0) > 0 ? (
          <Pressable
            disabled={accept.isPending}
            onPress={() => accept.mutate()}
            style={styles.button}
          >
            <Text style={styles.buttonText}>
              {accept.isPending ? 'Accepting…' : 'Accept current policies'}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.accepted}>You are up to date.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  accepted: { color: marketplaceColors.forest, fontWeight: '800' },
  button: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.accent,
    borderRadius: 14,
    padding: 16,
  },
  buttonText: { color: '#fff', fontWeight: '900' },
  card: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  cardTitle: { color: marketplaceColors.text, fontSize: 16, fontWeight: '900' },
  content: { gap: 14, padding: 22 },
  copy: { color: marketplaceColors.muted, lineHeight: 21 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  status: { color: marketplaceColors.accent, fontSize: 12, fontWeight: '800' },
  title: { color: marketplaceColors.text, fontSize: 29, fontWeight: '900' },
  version: { color: marketplaceColors.muted, marginTop: 8 },
});
