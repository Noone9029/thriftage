import { mobileForgotPasswordInputSchema } from '@thriftage/shared';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AuthScreenContainer } from '../../src/components/auth/auth-screen-container';
import { FormField } from '../../src/components/auth/form-field';
import { InlineError } from '../../src/components/auth/inline-error';
import { PrimaryButton } from '../../src/components/auth/primary-button';
import { getMobileAuthErrorMessage } from '../../src/lib/auth/auth-error-message';
import { AsyncSubmissionGate } from '../../src/lib/forms/async-submission-gate';
import { useAuth } from '../../src/providers/auth-provider';

export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submissionGate = useRef(new AsyncSubmissionGate()).current;

  const submit = async () => {
    await submissionGate.run(async () => {
      setSubmitting(true);
      setError(null);
      try {
        await requestPasswordReset(mobileForgotPasswordInputSchema.parse({ email }));
        setSent(true);
      } catch (caught: unknown) {
        setError(getMobileAuthErrorMessage(caught));
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <AuthScreenContainer
      description="Enter your email and we’ll send password recovery instructions."
      title="Reset your password"
    >
      <InlineError message={error} />
      {sent ? (
        <Text accessibilityLiveRegion="polite" style={styles.success}>
          If an account can receive recovery email, instructions are on the way.
        </Text>
      ) : null}
      <FormField
        autoCapitalize="none"
        autoComplete="email"
        editable={!submitting}
        keyboardType="email-address"
        label="Email"
        onChangeText={setEmail}
        value={email}
      />
      <PrimaryButton
        loading={submitting}
        onPress={() => void submit()}
        title="Send recovery email"
      />
      <Link href="/login" style={styles.link}>
        Back to sign in
      </Link>
    </AuthScreenContainer>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'center', color: '#17664F', fontSize: 14, fontWeight: '700' },
  success: {
    backgroundColor: '#E8F5EE',
    borderRadius: 12,
    color: '#205B45',
    fontSize: 14,
    lineHeight: 20,
    padding: 13,
  },
});
