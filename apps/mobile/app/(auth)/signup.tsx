import { mobileSignupInputSchema } from '@thriftage/shared';
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

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submissionGate = useRef(new AsyncSubmissionGate()).current;

  const submit = async () => {
    await submissionGate.run(async () => {
      setSubmitting(true);
      setError(null);
      try {
        await signUp(mobileSignupInputSchema.parse({ confirmPassword, email, fullName, password }));
      } catch (caught: unknown) {
        setError(getMobileAuthErrorMessage(caught));
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <AuthScreenContainer
      description="Create your account with email. Phone identity will be added in a later phase."
      footer={
        <Text style={styles.footerText}>
          Already registered?{' '}
          <Link href="/login" style={styles.link}>
            Sign in
          </Link>
        </Text>
      }
      title="Join Thriftage"
    >
      <InlineError message={error} />
      <FormField
        autoCapitalize="words"
        autoComplete="name"
        editable={!submitting}
        label="Full name"
        onChangeText={setFullName}
        value={fullName}
      />
      <FormField
        autoCapitalize="none"
        autoComplete="email"
        editable={!submitting}
        keyboardType="email-address"
        label="Email"
        onChangeText={setEmail}
        value={email}
      />
      <PasswordField
        editable={!submitting}
        label="Password"
        onChangeText={setPassword}
        value={password}
      />
      <PasswordField
        editable={!submitting}
        label="Confirm password"
        onChangeText={setConfirmPassword}
        value={confirmPassword}
      />
      <Text style={styles.hint}>
        Use at least 8 characters with uppercase, lowercase, and a number.
      </Text>
      <PrimaryButton loading={submitting} onPress={() => void submit()} title="Create account" />
    </AuthScreenContainer>
  );
}

const styles = StyleSheet.create({
  footerText: { color: '#625E56', fontSize: 14 },
  hint: { color: '#706B62', fontSize: 13, lineHeight: 19 },
  link: { color: '#17664F', fontWeight: '700' },
});
