import { Linking } from 'react-native';

import { AuthScreenContainer } from '../../src/components/auth/auth-screen-container';
import { PrimaryButton } from '../../src/components/auth/primary-button';
import { mobileConfig } from '../../src/config/mobile-config';
import { useAuth } from '../../src/providers/auth-provider';

export default function BlockedAccountScreen() {
  const { signOut, state } = useAuth();
  const suspended = state.status === 'ACCOUNT_SUSPENDED';
  const supportUrl = mobileConfig.supportUrl;
  return (
    <AuthScreenContainer
      description={
        suspended
          ? 'Your Thriftage account is suspended. A valid Supabase session cannot bypass this application restriction.'
          : 'Your Thriftage account is deactivated and cannot access authenticated application routes.'
      }
      title={suspended ? 'Account suspended' : 'Account deactivated'}
    >
      {suspended && supportUrl ? (
        <PrimaryButton onPress={() => void Linking.openURL(supportUrl)} title="Contact support" />
      ) : null}
      <PrimaryButton onPress={() => void signOut()} title="Sign out" />
    </AuthScreenContainer>
  );
}
