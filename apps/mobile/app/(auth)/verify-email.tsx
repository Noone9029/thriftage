import { StyleSheet, Text } from 'react-native';

import { AuthScreenContainer } from '../../src/components/auth/auth-screen-container';
import { PrimaryButton } from '../../src/components/auth/primary-button';
import { useAuth } from '../../src/providers/auth-provider';

export default function VerifyEmailScreen() {
  const { abandonSignup, state } = useAuth();
  const email = state.status === 'EMAIL_VERIFICATION_PENDING' ? state.email : 'your email';
  return (
    <AuthScreenContainer
      description={`We sent a confirmation link to ${email}. Open it on this device to continue, or sign in later after confirming elsewhere.`}
      title="Check your email"
    >
      <Text style={styles.note}>
        You can safely close the app. Your password is never stored; only the pending full name and
        canonical phone number are retained for onboarding continuity.
      </Text>
      <PrimaryButton onPress={() => void abandonSignup()} title="Use a different account" />
    </AuthScreenContainer>
  );
}

const styles = StyleSheet.create({ note: { color: '#625E56', fontSize: 14, lineHeight: 22 } });
