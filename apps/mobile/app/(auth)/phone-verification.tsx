import { phoneVerificationVerifyInputSchema } from '@thriftage/shared';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AuthScreenContainer } from '../../src/components/auth/auth-screen-container';
import { FormField } from '../../src/components/auth/form-field';
import { InlineError } from '../../src/components/auth/inline-error';
import { PrimaryButton } from '../../src/components/auth/primary-button';
import { getMobileAuthErrorMessage } from '../../src/lib/auth/auth-error-message';
import { AsyncSubmissionGate } from '../../src/lib/forms/async-submission-gate';
import { useAuth } from '../../src/providers/auth-provider';

function secondsUntil(value: string | null): number {
  if (value === null) return 0;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 1000));
}

export default function RequiredPhoneVerificationScreen() {
  const {
    cancelRequiredPhone,
    resendRequiredPhone,
    signOut,
    startPhoneVerification,
    state,
    verifyRequiredPhone,
  } = useAuth();
  const challenge = state.status === 'PHONE_VERIFICATION_REQUIRED' ? state.challenge : null;
  const suggested = state.status === 'PHONE_VERIFICATION_REQUIRED' ? state.suggestedPhone : null;
  const [phone, setPhone] = useState(suggested ?? '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(secondsUntil(challenge?.resendAvailableAt ?? null));
  const gate = useRef(new AsyncSubmissionGate()).current;

  useEffect(() => {
    setRemaining(secondsUntil(challenge?.resendAvailableAt ?? null));
    const timer = setInterval(
      () => setRemaining(secondsUntil(challenge?.resendAvailableAt ?? null)),
      1000,
    );
    return () => clearInterval(timer);
  }, [challenge?.resendAvailableAt]);

  const run = async (operation: () => Promise<void>) => {
    await gate.run(async () => {
      setBusy(true);
      setError(null);
      try {
        await operation();
      } catch (caught: unknown) {
        setError(getMobileAuthErrorMessage(caught));
      } finally {
        setBusy(false);
      }
    });
  };

  if (challenge === null) {
    return (
      <AuthScreenContainer
        description="A verified phone protects your account and enables phone sign-in. Pakistan numbers may be entered locally; international numbers should include + and the country code."
        footer={
          <Pressable accessibilityRole="button" onPress={() => void signOut()}>
            <Text style={styles.link}>Sign out</Text>
          </Pressable>
        }
        title="Verify your phone"
      >
        <InlineError message={error} />
        <FormField
          autoComplete="tel"
          editable={!busy}
          keyboardType="phone-pad"
          label="Phone number"
          onChangeText={setPhone}
          placeholder="0300 1234567 or +44 7700 900123"
          value={phone}
        />
        <PrimaryButton
          loading={busy}
          onPress={() => void run(() => startPhoneVerification(phone))}
          title="Send verification code"
        />
      </AuthScreenContainer>
    );
  }

  return (
    <AuthScreenContainer
      description={`Enter the code sent to ${challenge.maskedPhone}. Codes are checked by the server and are never stored by Thriftage.`}
      footer={
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void run(cancelRequiredPhone)}
        >
          <Text style={styles.link}>Use a different phone number</Text>
        </Pressable>
      }
      title="Enter your code"
    >
      <InlineError message={error} />
      <FormField
        autoComplete="sms-otp"
        editable={!busy}
        keyboardType="number-pad"
        label="Verification code"
        maxLength={10}
        onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
        placeholder="000000"
        textContentType="oneTimeCode"
        value={code}
      />
      <PrimaryButton
        loading={busy}
        onPress={() =>
          void run(async () => {
            phoneVerificationVerifyInputSchema.parse({ attemptId: challenge.attemptId, code });
            await verifyRequiredPhone(code);
          })
        }
        title="Verify phone"
      />
      <Pressable
        accessibilityRole="button"
        disabled={busy || remaining > 0}
        onPress={() => void run(resendRequiredPhone)}
      >
        <Text style={[styles.link, remaining > 0 ? styles.disabled : null]}>
          {remaining > 0 ? `Send another code in ${remaining}s` : 'Send another code'}
        </Text>
      </Pressable>
    </AuthScreenContainer>
  );
}

const styles = StyleSheet.create({
  disabled: { color: '#8B8A84' },
  link: { color: '#17664F', fontSize: 14, fontWeight: '700', textAlign: 'center' },
});
