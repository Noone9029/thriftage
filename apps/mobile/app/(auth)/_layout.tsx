import { Stack } from 'expo-router';

import { useAuth } from '../../src/providers/auth-provider';

export default function AuthLayout() {
  const { state } = useAuth();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={state.status === 'SIGNED_OUT'}>
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>
      <Stack.Protected guard={state.status === 'PHONE_LOGIN_PENDING'}>
        <Stack.Screen name="phone-login" />
      </Stack.Protected>
      <Stack.Protected guard={state.status === 'EMAIL_VERIFICATION_PENDING'}>
        <Stack.Screen name="verify-email" />
      </Stack.Protected>
      <Stack.Protected guard={state.status === 'AUTHENTICATED_UNPROVISIONED'}>
        <Stack.Screen name="complete-account" />
      </Stack.Protected>
      <Stack.Protected guard={state.status === 'PHONE_VERIFICATION_REQUIRED'}>
        <Stack.Screen name="phone-verification" />
      </Stack.Protected>
      <Stack.Protected guard={state.status === 'PROFILE_ONBOARDING_REQUIRED'}>
        <Stack.Screen name="profile-onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={state.status === 'PASSWORD_RECOVERY'}>
        <Stack.Screen name="reset-password" />
      </Stack.Protected>
    </Stack>
  );
}
