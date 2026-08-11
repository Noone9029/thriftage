import { useRef, useState } from 'react';

import { AuthScreenContainer } from '../../src/components/auth/auth-screen-container';
import { FormField } from '../../src/components/auth/form-field';
import { InlineError } from '../../src/components/auth/inline-error';
import { PrimaryButton } from '../../src/components/auth/primary-button';
import { getMobileAuthErrorMessage } from '../../src/lib/auth/auth-error-message';
import { AsyncSubmissionGate } from '../../src/lib/forms/async-submission-gate';
import { useAuth } from '../../src/providers/auth-provider';

export default function CompleteAccountScreen() {
  const { completeAccount, signOut } = useAuth();
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submissionGate = useRef(new AsyncSubmissionGate()).current;

  const submit = async () => {
    await submissionGate.run(async () => {
      setSubmitting(true);
      setError(null);
      try {
        await completeAccount(fullName);
      } catch (caught: unknown) {
        setError(getMobileAuthErrorMessage(caught));
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <AuthScreenContainer
      description="Your email is authenticated, but this device does not have the name from your original signup. Add only the name needed to create your Thriftage account."
      title="Complete your account"
    >
      <InlineError message={error} />
      <FormField
        autoCapitalize="words"
        editable={!submitting}
        label="Full name"
        onChangeText={setFullName}
        value={fullName}
      />
      <PrimaryButton loading={submitting} onPress={() => void submit()} title="Continue" />
      <PrimaryButton disabled={submitting} onPress={() => void signOut()} title="Sign out" />
    </AuthScreenContainer>
  );
}
