import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { marketplaceColors } from '../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../src/lib/auth/auth-composition';

export default function SafetyCenterScreen() {
  const status = useQuery({
    queryFn: () => thriftageApiClient.getSafetyStatus(),
    queryKey: ['safety-status'],
  });
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>TRUST & SAFETY</Text>
        <Text style={styles.title}>Safety Center</Text>
        <Text style={styles.copy}>
          Manage community protections and view marketplace account restrictions.
        </Text>
        {status.data?.restrictions.map((restriction) => (
          <View key={restriction.id} style={styles.warning}>
            <Text style={styles.warningTitle}>{restriction.scope} restricted</Text>
            <Text style={styles.copy}>{restriction.reason}</Text>
            <Text style={styles.date}>
              {restriction.expiresAt
                ? `Until ${new Date(restriction.expiresAt).toLocaleString()}`
                : 'No scheduled expiry'}
            </Text>
          </View>
        ))}
        {status.data?.actions.length ? (
          <>
            <Text style={styles.sectionTitle}>Enforcement history</Text>
            {status.data.actions.map((action) => (
              <View key={action.id} style={styles.historyCard}>
                <Text style={styles.historyTitle}>{action.type.replaceAll('_', ' ')}</Text>
                <Text style={styles.copy}>{action.reason}</Text>
                <Text style={styles.historyDate}>
                  {new Date(action.createdAt).toLocaleString()}
                </Text>
              </View>
            ))}
          </>
        ) : null}
        <Link label="Marketplace policies" onPress={() => router.push('/policies')} />
        <Link label="Blocked users" onPress={() => router.push('/blocked-users')} />
        <Link label="Disputes" onPress={() => router.push('/disputes')} />
        <Link label="Seller verification" onPress={() => router.push('/seller-verification')} />
        {status.data?.supportUrl ? (
          <Link
            label="Contact support"
            onPress={() => void Linking.openURL(status.data.supportUrl!)}
          />
        ) : null}
        <Text style={styles.help}>
          For immediate danger, contact local emergency services. Thriftage support is not an
          emergency service.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.link}>
      <Text style={styles.linkText}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  chevron: { color: marketplaceColors.muted, fontSize: 25 },
  content: { gap: 12, padding: 22 },
  copy: { color: marketplaceColors.muted, lineHeight: 21 },
  date: { color: marketplaceColors.danger, fontSize: 11, marginTop: 8 },
  eyebrow: { color: marketplaceColors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  help: { color: marketplaceColors.muted, fontSize: 12, lineHeight: 18, marginTop: 14 },
  historyCard: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  historyDate: { color: marketplaceColors.muted, fontSize: 11, marginTop: 8 },
  historyTitle: { color: marketplaceColors.text, fontWeight: '900', marginBottom: 6 },
  link: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  linkText: { color: marketplaceColors.text, fontWeight: '900' },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  sectionTitle: { color: marketplaceColors.text, fontSize: 18, fontWeight: '900', marginTop: 8 },
  title: { color: marketplaceColors.text, fontSize: 30, fontWeight: '900' },
  warning: { backgroundColor: '#FCEAE5', borderRadius: 14, padding: 16 },
  warningTitle: { color: marketplaceColors.danger, fontWeight: '900', marginBottom: 6 },
});
