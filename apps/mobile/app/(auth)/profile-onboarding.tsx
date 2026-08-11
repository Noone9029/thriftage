import { profileCreateInputSchema, usernameSchema } from '@thriftage/shared';
import { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text } from 'react-native';

import { AuthScreenContainer } from '../../src/components/auth/auth-screen-container';
import { FormField } from '../../src/components/auth/form-field';
import { InlineError } from '../../src/components/auth/inline-error';
import { PrimaryButton } from '../../src/components/auth/primary-button';
import { getMobileAuthErrorMessage } from '../../src/lib/auth/auth-error-message';
import { AsyncSubmissionGate } from '../../src/lib/forms/async-submission-gate';
import {
  selectProfileImage,
  type SelectedProfileImage,
} from '../../src/lib/profiles/profile-image-picker';
import { useAuth } from '../../src/providers/auth-provider';

function messageFor(error: unknown): string {
  return error instanceof Error && error.message.startsWith('Profile images')
    ? error.message
    : getMobileAuthErrorMessage(error);
}

export default function ProfileOnboardingScreen() {
  const { completeProfile, getUsernameAvailability, signOut } = useAuth();
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [university, setUniversity] = useState('');
  const [image, setImage] = useState<SelectedProfileImage | null>(null);
  const [availability, setAvailability] = useState<{
    readonly available: boolean;
    readonly message: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gate = useRef(new AsyncSubmissionGate()).current;

  const chooseImage = async () => {
    setError(null);
    try {
      const selected = await selectProfileImage();
      if (selected !== null) setImage(selected);
    } catch (caught: unknown) {
      setError(messageFor(caught));
    }
  };

  const checkUsername = async () => {
    setAvailability(null);
    setError(null);
    try {
      const parsed = usernameSchema.parse(username);
      const result = await getUsernameAvailability(parsed);
      setUsername(result.username);
      setAvailability({
        available: result.available,
        message: result.available ? 'Username is available.' : 'Username is already taken.',
      });
    } catch (caught: unknown) {
      setError(getMobileAuthErrorMessage(caught));
    }
  };

  const submit = async () => {
    await gate.run(async () => {
      setBusy(true);
      setError(null);
      try {
        const input = profileCreateInputSchema.parse({ bio, university, username });
        await completeProfile(input, image?.form ?? null);
      } catch (caught: unknown) {
        setError(messageFor(caught));
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <AuthScreenContainer
      description="Choose your public identity. Username is required; photo, bio, and university are optional and can be changed later."
      footer={
        <Pressable accessibilityRole="button" onPress={() => void signOut()}>
          <Text style={styles.link}>Sign out</Text>
        </Pressable>
      }
      title="Create your profile"
    >
      <InlineError message={error} />
      <Pressable accessibilityLabel="Choose profile picture" onPress={() => void chooseImage()}>
        {image === null ? (
          <Text style={styles.imagePlaceholder}>Add profile picture</Text>
        ) : (
          <Image
            accessibilityLabel="Selected profile picture"
            source={{ uri: image.uri }}
            style={styles.image}
          />
        )}
      </Pressable>
      <FormField
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
        label="Username"
        maxLength={30}
        onChangeText={(value) => {
          setAvailability(null);
          setUsername(value.toLowerCase());
        }}
        placeholder="your_username"
        value={username}
      />
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void checkUsername()}>
        <Text style={styles.link}>Check availability</Text>
      </Pressable>
      {availability === null ? null : (
        <Text
          accessibilityLiveRegion="polite"
          style={availability.available ? styles.availability : styles.unavailable}
        >
          {availability.message}
        </Text>
      )}
      <FormField
        editable={!busy}
        label="Bio (optional)"
        maxLength={500}
        multiline
        onChangeText={setBio}
        placeholder="Tell the community about your style."
        value={bio}
      />
      <FormField
        editable={!busy}
        label="University (optional)"
        maxLength={160}
        onChangeText={setUniversity}
        placeholder="Your university"
        value={university}
      />
      <PrimaryButton loading={busy} onPress={() => void submit()} title="Finish profile" />
    </AuthScreenContainer>
  );
}

const styles = StyleSheet.create({
  availability: { color: '#17664F', fontSize: 13, fontWeight: '600' },
  image: { borderRadius: 52, height: 104, width: 104 },
  imagePlaceholder: {
    backgroundColor: '#E7E1D5',
    borderRadius: 52,
    color: '#17664F',
    fontSize: 13,
    fontWeight: '700',
    height: 104,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingTop: 42,
    textAlign: 'center',
    width: 104,
  },
  link: { color: '#17664F', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  unavailable: { color: '#A23C2A', fontSize: 13, fontWeight: '600' },
});
