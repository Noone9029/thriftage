import { mobileLoginInputSchema } from '@thriftage/shared';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AuthScreenContainer } from '../../src/components/auth/auth-screen-container';
import { FormField } from '../../src/components/auth/form-field';
import { InlineError } from '../../src/components/auth/inline-error';
import { PasswordField } from '../../src/components/auth/password-field';
import { PrimaryButton } from '../../src/components/auth/primary-button';
import { getMobileAuthErrorMessage } from '../../src/lib/auth/auth-error-message';
import { AsyncSubmissionGate } from '../../src/lib/forms/async-submission-gate';
import { useAuth } from '../../src/providers/auth-provider';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submissionGate = useRef(new AsyncSubmissionGate()).current;

  const submit = async () => {
    await submissionGate.run(async () => {
      setSubmitting(true);
      setError(null);
      try {
        await signIn(mobileLoginInputSchema.parse({ email, password }));
      } catch (caught: unknown) {
        setError(getMobileAuthErrorMessage(caught));
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <AuthScreenContainer
      description="Sign in with the email attached to your Thriftage account."
      footer={
        <Text style={styles.footerText}>
          New to Thriftage?{' '}
          <Link href="/signup" style={styles.link}>
            Create an account
          </Link>
        </Text>
      }
      title="Welcome back"
    >
      <InlineError message={error} />
      <FormField
        autoCapitalize="none"
        autoComplete="email"
        editable={!submitting}
        keyboardType="email-address"
        label="Email"
        onChangeText={setEmail}
        returnKeyType="next"
        value={email}
      />
      <PasswordField
        editable={!submitting}
        label="Password"
        onChangeText={setPassword}
        value={password}
      />
      <Link href="/forgot-password" style={styles.forgot}>
        Forgot password?
      </Link>
      <PrimaryButton loading={submitting} onPress={() => void submit()} title="Sign in" />
    </AuthScreenContainer>
  );
}

const styles = StyleSheet.create({
  footerText: { color: '#625E56', fontSize: 14 },
  forgot: { alignSelf: 'flex-end', color: '#17664F', fontSize: 14, fontWeight: '700' },
  link: { color: '#17664F', fontWeight: '700' },
});
