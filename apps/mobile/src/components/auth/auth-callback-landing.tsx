import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { routeForAuthState } from '../../lib/auth/mobile-auth-state';
import { useAuth } from '../../providers/auth-provider';
import { InlineError } from './inline-error';
import { PrimaryButton } from './primary-button';

export function AuthCallbackLanding() {
  const router = useRouter();
  const { clearDeepLinkError, deepLinkError, state } = useAuth();
  if (deepLinkError === null && state.status !== 'BOOTSTRAPPING') {
    return <Redirect href={routeForAuthState(state)} />;
  }
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {deepLinkError === null ? (
          <>
            <ActivityIndicator color="#17664F" size="large" />
            <Text style={styles.text}>Securing your authentication session…</Text>
          </>
        ) : (
          <>
            <InlineError message={deepLinkError} />
            <PrimaryButton
              onPress={() => {
                clearDeepLinkError();
                router.replace('/login');
              }}
              title="Return to sign in"
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 22, justifyContent: 'center', padding: 28 },
  safeArea: { backgroundColor: '#F3EFE5', flex: 1 },
  text: { color: '#35443D', fontSize: 16, textAlign: 'center' },
});
