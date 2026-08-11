import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '../../src/components/auth/primary-button';
import { useAuth } from '../../src/providers/auth-provider';

export default function AuthenticatedPlaceholderScreen() {
  const { signOut, state } = useAuth();
  const fullName =
    state.status === 'AUTHENTICATED_ACTIVE' ? state.account.fullName : 'Thriftage user';
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>AUTHENTICATED</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Welcome, {fullName}.
        </Text>
        <Text style={styles.copy}>
          Your email session and Thriftage account are connected. Marketplace discovery is
          intentionally not part of this phase.
        </Text>
        <View style={styles.action}>
          <PrimaryButton onPress={() => void signOut()} title="Sign out" />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  action: { marginTop: 32, maxWidth: 240 },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  copy: { color: '#595C57', fontSize: 17, lineHeight: 27, marginTop: 18, maxWidth: 560 },
  eyebrow: { color: '#17664F', fontSize: 13, fontWeight: '800', letterSpacing: 2.4 },
  safeArea: { backgroundColor: '#F3EFE5', flex: 1 },
  title: {
    color: '#1D2924',
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -1.1,
    lineHeight: 48,
    marginTop: 14,
  },
});
