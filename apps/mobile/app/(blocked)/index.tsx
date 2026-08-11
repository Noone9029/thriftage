import { AuthScreenContainer } from '../../src/components/auth/auth-screen-container';
import { PrimaryButton } from '../../src/components/auth/primary-button';
import { useAuth } from '../../src/providers/auth-provider';

export default function BlockedAccountScreen() {
  const { signOut, state } = useAuth();
  const suspended = state.status === 'ACCOUNT_SUSPENDED';
  return (
    <AuthScreenContainer
      description={
        suspended
          ? 'Your Thriftage account is suspended. A valid Supabase session cannot bypass this application restriction.'
          : 'Your Thriftage account is deactivated and cannot access authenticated application routes.'
      }
      title={suspended ? 'Account suspended' : 'Account deactivated'}
    >
      <PrimaryButton onPress={() => void signOut()} title="Sign out" />
    </AuthScreenContainer>
  );
}
