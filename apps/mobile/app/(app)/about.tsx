import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { marketplaceColors } from '../../src/components/marketplace/marketplace-theme';
import { mobileConfig } from '../../src/config/mobile-config';
import { useRuntimeConfig } from '../../src/hooks/use-runtime-config';

function nativeBuildNumber(): string {
  if (Platform.OS === 'android') return String(Constants.expoConfig?.android?.versionCode ?? 'dev');
  if (Platform.OS === 'ios') return Constants.expoConfig?.ios?.buildNumber ?? 'dev';
  return 'web';
}

export default function AboutScreen() {
  const runtime = useRuntimeConfig();
  const server = runtime.data;
  const environmentMismatch =
    server !== undefined && server.environment !== mobileConfig.deploymentEnvironment;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
          <MaterialIcons color={marketplaceColors.forest} name="arrow-back" size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>About & diagnostics</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Thriftage</Text>
        <Text style={styles.copy}>
          Safe release details for closed-beta support. No account, message, order, address, token,
          or AI conversation data appears here.
        </Text>
        <View style={styles.card}>
          <DiagnosticRow
            label="App version"
            value={Constants.expoConfig?.version ?? 'development'}
          />
          <DiagnosticRow label="Native build" value={nativeBuildNumber()} />
          <DiagnosticRow label="Platform" value={Platform.OS} />
          <DiagnosticRow label="Build environment" value={mobileConfig.deploymentEnvironment} />
          <DiagnosticRow label="Build release" value={mobileConfig.releaseVersion} />
          <DiagnosticRow
            label="API environment"
            value={runtime.isLoading ? 'checking…' : (server?.environment ?? 'unavailable')}
          />
          <DiagnosticRow
            label="API release"
            value={runtime.isLoading ? 'checking…' : (server?.releaseVersion ?? 'unavailable')}
          />
        </View>
        {environmentMismatch ? (
          <Text accessibilityRole="alert" style={styles.warning}>
            Build and API environments do not match. Stop testing and contact the beta operator.
          </Text>
        ) : null}
        {runtime.isError ? (
          <Pressable onPress={() => void runtime.refetch()} style={styles.retry}>
            <Text style={styles.retryText}>Retry API diagnostics</Text>
          </Pressable>
        ) : null}
        <Text style={styles.section}>Help and policies</Text>
        {server?.links.support ? <ExternalLink label="Support" url={server.links.support} /> : null}
        {server?.links.privacyPolicy ? (
          <ExternalLink label="Privacy Policy" url={server.links.privacyPolicy} />
        ) : null}
        {server?.links.termsOfUse ? (
          <ExternalLink label="Terms of Use" url={server.links.termsOfUse} />
        ) : null}
        {server?.links.communityGuidelines ? (
          <ExternalLink label="Community Guidelines" url={server.links.communityGuidelines} />
        ) : null}
        {server === undefined || Object.values(server.links).every((value) => value === null) ? (
          <Text style={styles.copy}>
            Public support and policy links are not configured for this environment.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DiagnosticRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

function ExternalLink({ label, url }: { readonly label: string; readonly url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => void Linking.openURL(url)}
      style={styles.link}
    >
      <Text style={styles.linkText}>{label}</Text>
      <MaterialIcons color={marketplaceColors.forest} name="open-in-new" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  card: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  content: { gap: 14, padding: 20 },
  copy: { color: marketplaceColors.muted, fontSize: 14, lineHeight: 21 },
  header: {
    alignItems: 'center',
    borderBottomColor: marketplaceColors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: 8,
  },
  headerTitle: { color: marketplaceColors.text, fontSize: 17, fontWeight: '800', marginLeft: 8 },
  label: { color: marketplaceColors.muted, fontSize: 12, fontWeight: '700' },
  link: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  linkText: { color: marketplaceColors.forest, fontSize: 14, fontWeight: '800' },
  retry: { alignSelf: 'flex-start', paddingVertical: 6 },
  retryText: { color: marketplaceColors.forest, fontSize: 14, fontWeight: '800' },
  row: { borderBottomColor: marketplaceColors.border, borderBottomWidth: 1, gap: 4, padding: 14 },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  section: { color: marketplaceColors.text, fontSize: 18, fontWeight: '900', marginTop: 8 },
  title: { color: marketplaceColors.text, fontSize: 28, fontWeight: '900' },
  value: { color: marketplaceColors.text, fontSize: 14, fontWeight: '700' },
  warning: {
    backgroundColor: '#FFF0E8',
    borderRadius: 12,
    color: marketplaceColors.danger,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    padding: 14,
  },
});
