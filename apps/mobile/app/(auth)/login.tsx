import { mobileLoginInputSchema } from '@thriftage/shared';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthScreenContainer } from '../../src/components/auth/auth-screen-container';
import { FormField } from '../../src/components/auth/form-field';
import { InlineError } from '../../src/components/auth/inline-error';
import { PasswordField } from '../../src/components/auth/password-field';
import { PrimaryButton } from '../../src/components/auth/primary-button';
import { getMobileAuthErrorMessage } from '../../src/lib/auth/auth-error-message';
import { AsyncSubmissionGate } from '../../src/lib/forms/async-submission-gate';
import { useRuntimeConfig } from '../../src/hooks/use-runtime-config';
import { useAuth } from '../../src/providers/auth-provider';

export default function LoginScreen() {
  const { signIn, startPhoneLogin } = useAuth();
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submissionGate = useRef(new AsyncSubmissionGate()).current;
  const runtime = useRuntimeConfig();
  const phoneAuthEnabled = runtime.data?.features.phoneAuth === true;
  const registrationEnabled = runtime.data?.features.registration === true;
  const methods: readonly ('email' | 'phone')[] = phoneAuthEnabled ? ['email', 'phone'] : ['email'];

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

  const submitPhone = async () => {
    await submissionGate.run(async () => {
      setSubmitting(true);
      setError(null);
      try {
        await startPhoneLogin({ phone });
      } catch (caught: unknown) {
        setError(getMobileAuthErrorMessage(caught));
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <AuthScreenContainer
      description="Use your email and password or a verified phone number."
      footer={
        <Text style={styles.footerText}>
          {registrationEnabled ? (
            <>
              New to Thriftage?{' '}
              <Link href="/signup" style={styles.link}>
                Create an account
              </Link>
            </>
          ) : (
            'Closed-beta registration is currently paused.'
          )}
        </Text>
      }
      title="Welcome back"
    >
      <InlineError message={error} />
      <View accessibilityRole="tablist" style={styles.tabs}>
        {methods.map((value) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: method === value }}
            key={value}
            onPress={() => {
              setError(null);
              setMethod(value);
            }}
            style={[styles.tab, method === value ? styles.tabActive : null]}
          >
            <Text style={[styles.tabText, method === value ? styles.tabTextActive : null]}>
              {value === 'email' ? 'Email' : 'Phone'}
            </Text>
          </Pressable>
        ))}
      </View>
      {runtime.isError ? (
        <Text style={styles.phoneHint}>
          Live feature availability could not be checked. Email sign-in remains available.
        </Text>
      ) : null}
      {method === 'email' ? (
        <>
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
        </>
      ) : (
        <>
          <FormField
            autoComplete="tel"
            editable={!submitting}
            keyboardType="phone-pad"
            label="Verified phone number"
            onChangeText={setPhone}
            placeholder="0300 1234567 or +44 7700 900123"
            value={phone}
          />
          <Text style={styles.phoneHint}>
            Only existing accounts with a verified phone can sign in this way.
          </Text>
          <PrimaryButton
            loading={submitting}
            onPress={() => void submitPhone()}
            title="Send sign-in code"
          />
        </>
      )}
    </AuthScreenContainer>
  );
}

const styles = StyleSheet.create({
  footerText: { color: '#625E56', fontSize: 14 },
  forgot: { alignSelf: 'flex-end', color: '#17664F', fontSize: 14, fontWeight: '700' },
  link: { color: '#17664F', fontWeight: '700' },
  phoneHint: { color: '#706B62', fontSize: 13, lineHeight: 19 },
  tab: { alignItems: 'center', borderRadius: 11, flex: 1, paddingVertical: 11 },
  tabActive: { backgroundColor: '#FFFFFF' },
  tabText: { color: '#6C6A64', fontSize: 14, fontWeight: '700' },
  tabTextActive: { color: '#17664F' },
  tabs: { backgroundColor: '#EAE5DA', borderRadius: 14, flexDirection: 'row', padding: 4 },
});
