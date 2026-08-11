import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { queryClient } from '../src/lib/query-client';
import { AuthProvider, useAuth } from '../src/providers/auth-provider';

function RootNavigator() {
  const { state } = useAuth();
  if (state.status === 'BOOTSTRAPPING') {
    return (
      <View accessibilityLabel="Restoring your session" style={styles.loading}>
        <ActivityIndicator color="#17664F" size="large" />
        <Text style={styles.loadingText}>Restoring your session…</Text>
      </View>
    );
  }

  const authAllowed = [
    'SIGNED_OUT',
    'EMAIL_VERIFICATION_PENDING',
    'AUTHENTICATED_UNPROVISIONED',
    'PASSWORD_RECOVERY',
  ].includes(state.status);
  const blocked = ['ACCOUNT_SUSPENDED', 'ACCOUNT_DEACTIVATED'].includes(state.status);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={authAllowed}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={state.status === 'AUTHENTICATED_ACTIVE'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={blocked}>
        <Stack.Screen name="(blocked)" />
      </Stack.Protected>
      <Stack.Screen name="auth" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    backgroundColor: '#F3EFE5',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
  },
  loadingText: { color: '#35443D', fontSize: 16, fontWeight: '600' },
});
