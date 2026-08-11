import { mobileResetPasswordInputSchema } from '@thriftage/shared';
import { useRef, useState } from 'react';

import { AuthScreenContainer } from '../../src/components/auth/auth-screen-container';
import { InlineError } from '../../src/components/auth/inline-error';
import { PasswordField } from '../../src/components/auth/password-field';
import { PrimaryButton } from '../../src/components/auth/primary-button';
import { getMobileAuthErrorMessage } from '../../src/lib/auth/auth-error-message';
import { AsyncSubmissionGate } from '../../src/lib/forms/async-submission-gate';
import { useAuth } from '../../src/providers/auth-provider';

export default function ResetPasswordScreen() {
  const { finishPasswordRecovery, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submissionGate = useRef(new AsyncSubmissionGate()).current;

  const submit = async () => {
    await submissionGate.run(async () => {
      setSubmitting(true);
      setError(null);
      try {
        await updatePassword(mobileResetPasswordInputSchema.parse({ confirmPassword, password }));
        setPassword('');
        setConfirmPassword('');
        setUpdated(true);
      } catch (caught: unknown) {
        setError(getMobileAuthErrorMessage(caught));
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <AuthScreenContainer
      description="Choose a new password for your verified account."
      title="Create a new password"
    >
      <InlineError message={error} />
      <PasswordField
        editable={!submitting && !updated}
        label="New password"
        onChangeText={setPassword}
        value={password}
      />
      <PasswordField
        editable={!submitting && !updated}
        label="Confirm new password"
        onChangeText={setConfirmPassword}
        value={confirmPassword}
      />
      {updated ? (
        <PrimaryButton
          onPress={() => void finishPasswordRecovery()}
          title="Continue to Thriftage"
        />
      ) : (
        <PrimaryButton loading={submitting} onPress={() => void submit()} title="Update password" />
      )}
    </AuthScreenContainer>
  );
}
