import { mobilePhoneLoginVerifyInputSchema } from '@thriftage/shared';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AuthScreenContainer } from '../../src/components/auth/auth-screen-container';
import { FormField } from '../../src/components/auth/form-field';
import { InlineError } from '../../src/components/auth/inline-error';
import { PrimaryButton } from '../../src/components/auth/primary-button';
import { getMobileAuthErrorMessage } from '../../src/lib/auth/auth-error-message';
import { AsyncSubmissionGate } from '../../src/lib/forms/async-submission-gate';
import { useAuth } from '../../src/providers/auth-provider';

export default function PhoneLoginScreen() {
  const { abandonPhoneLogin, resendPhoneLogin, state, verifyPhoneLogin } = useAuth();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gate = useRef(new AsyncSubmissionGate()).current;
  const phone = state.status === 'PHONE_LOGIN_PENDING' ? state.phone : '';

  const verify = async () => {
    await gate.run(async () => {
      setSubmitting(true);
      setError(null);
      try {
        await verifyPhoneLogin(mobilePhoneLoginVerifyInputSchema.parse({ code, phone }));
      } catch (caught: unknown) {
        setError(getMobileAuthErrorMessage(caught));
      } finally {
        setSubmitting(false);
      }
    });
  };

  const resend = async () => {
    setResending(true);
    setError(null);
    try {
      await resendPhoneLogin();
    } catch (caught: unknown) {
      setError(getMobileAuthErrorMessage(caught));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthScreenContainer
      description="Enter the six-digit code sent by your configured SMS provider."
      footer={
        <Pressable accessibilityRole="button" onPress={abandonPhoneLogin}>
          <Text style={styles.link}>Use another sign-in method</Text>
        </Pressable>
      }
      title="Check your phone"
    >
      <InlineError message={error} />
      <Text style={styles.destination}>{phone}</Text>
      <FormField
        autoComplete="sms-otp"
        editable={!submitting}
        keyboardType="number-pad"
        label="Verification code"
        maxLength={6}
        onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
        placeholder="000000"
        textContentType="oneTimeCode"
        value={code}
      />
      <PrimaryButton
        loading={submitting}
        onPress={() => void verify()}
        title="Verify and sign in"
      />
      <Pressable
        accessibilityRole="button"
        disabled={resending || submitting}
        onPress={() => void resend()}
      >
        <Text style={styles.link}>{resending ? 'Sending…' : 'Send another code'}</Text>
      </Pressable>
    </AuthScreenContainer>
  );
}

const styles = StyleSheet.create({
  destination: { color: '#293A33', fontSize: 15, fontWeight: '700' },
  link: { color: '#17664F', fontSize: 14, fontWeight: '700', textAlign: 'center' },
});
