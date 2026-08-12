import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import { marketplaceColors } from '../../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';
import { selectDisputeEvidence } from '../../../src/lib/trust/dispute-evidence-picker';

export default function DisputeDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const cache = useQueryClient();
  const query = useQuery({
    queryFn: () => thriftageApiClient.getDispute(id),
    queryKey: ['dispute', id],
  });
  const upload = useMutation({
    mutationFn: async () => {
      const form = await selectDisputeEvidence();
      return form === null ? null : thriftageApiClient.uploadDisputeEvidence(id, form);
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: ['dispute', id] }),
  });
  if (query.isLoading)
    return (
      <MarketplaceState
        loading
        title="Opening case"
        message="Loading the private dispute timeline."
      />
    );
  if (!query.data)
    return (
      <MarketplaceState
        title="Case unavailable"
        message="You may not have access to this dispute."
      />
    );
  const dispute = query.data;
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>{dispute.orderNumber}</Text>
        <Text style={styles.title}>{dispute.reason.replaceAll('_', ' ')}</Text>
        <Text style={styles.status}>{dispute.status.replaceAll('_', ' ')}</Text>
        <View style={styles.card}>
          <Text style={styles.description}>{dispute.description}</Text>
        </View>
        <Text style={styles.section}>Timeline</Text>
        {dispute.timeline
          .filter((event) => event.visibility === 'PARTICIPANTS')
          .map((event) => (
            <View key={event.id} style={styles.event}>
              <View style={styles.dot} />
              <View style={styles.eventCopy}>
                <Text style={styles.eventTitle}>{event.type.replaceAll('_', ' ')}</Text>
                {event.message ? <Text style={styles.message}>{event.message}</Text> : null}
                <Text style={styles.date}>{new Date(event.createdAt).toLocaleString()}</Text>
              </View>
            </View>
          ))}
        {dispute.resolution ? (
          <View style={styles.resolution}>
            <Text style={styles.eventTitle}>Resolution</Text>
            <Text style={styles.description}>{dispute.resolution}</Text>
          </View>
        ) : null}
        {['OPEN', 'UNDER_REVIEW', 'AWAITING_INFORMATION'].includes(dispute.status) ? (
          <Pressable
            disabled={upload.isPending}
            onPress={() => upload.mutate()}
            style={styles.button}
          >
            <Text style={styles.buttonText}>
              {upload.isPending ? 'Uploading…' : 'Add private evidence'}
            </Text>
          </Pressable>
        ) : null}
        {upload.isError ? <Text style={styles.error}>Evidence could not be uploaded.</Text> : null}
        <Text style={styles.privacy}>
          Evidence is private and available only to case participants and authorized operations
          staff.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderColor: marketplaceColors.forest,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 22,
    padding: 15,
  },
  buttonText: { color: marketplaceColors.forest, fontWeight: '900' },
  card: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  content: { padding: 22 },
  date: { color: marketplaceColors.muted, fontSize: 11, marginTop: 5 },
  description: { color: marketplaceColors.text, lineHeight: 21 },
  dot: {
    backgroundColor: marketplaceColors.accent,
    borderRadius: 5,
    height: 10,
    marginTop: 5,
    width: 10,
  },
  event: { flexDirection: 'row', marginTop: 16 },
  eventCopy: { flex: 1, marginLeft: 12 },
  eventTitle: { color: marketplaceColors.text, fontWeight: '900' },
  error: { color: marketplaceColors.danger, marginTop: 10 },
  eyebrow: { color: marketplaceColors.muted, fontSize: 11, letterSpacing: 1.2 },
  message: { color: marketplaceColors.text, marginTop: 4 },
  privacy: { color: marketplaceColors.muted, fontSize: 12, lineHeight: 18, marginTop: 26 },
  resolution: { backgroundColor: '#E7EFEA', borderRadius: 14, marginTop: 22, padding: 16 },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  section: { color: marketplaceColors.text, fontSize: 19, fontWeight: '900', marginTop: 24 },
  status: { color: marketplaceColors.accent, fontWeight: '900', marginBottom: 18, marginTop: 8 },
  title: { color: marketplaceColors.text, fontSize: 25, fontWeight: '900', marginTop: 8 },
});
