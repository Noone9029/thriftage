import { profileUpdateInputSchema } from '@thriftage/shared';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '../../src/components/auth/form-field';
import { InlineError } from '../../src/components/auth/inline-error';
import { PrimaryButton } from '../../src/components/auth/primary-button';
import { getMobileAuthErrorMessage } from '../../src/lib/auth/auth-error-message';
import { AsyncSubmissionGate } from '../../src/lib/forms/async-submission-gate';
import { selectProfileImage } from '../../src/lib/profiles/profile-image-picker';
import { useAuth } from '../../src/providers/auth-provider';

export default function EditProfileScreen() {
  const { removeProfileImage, state, updateProfile, uploadProfileImage } = useAuth();
  const profile = state.status === 'AUTHENTICATED_ACTIVE' ? state.profile : null;
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [university, setUniversity] = useState(profile?.university ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gate = useRef(new AsyncSubmissionGate()).current;
  if (profile === null) return null;

  const run = async (operation: () => Promise<void>) => {
    await gate.run(async () => {
      setBusy(true);
      setError(null);
      try {
        await operation();
      } catch (caught: unknown) {
        setError(
          caught instanceof Error && caught.message.startsWith('Profile images')
            ? caught.message
            : getMobileAuthErrorMessage(caught),
        );
      } finally {
        setBusy(false);
      }
    });
  };

  const replaceImage = async () => {
    const selected = await selectProfileImage();
    if (selected !== null) await uploadProfileImage(selected.form);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.back}>← Profile</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          Edit profile
        </Text>
        <Text style={styles.description}>
          Public fields only. Account status, role, identity, and verification cannot be edited
          here.
        </Text>
        <InlineError message={error} />
        {profile.profileImageUrl === null ? (
          <Text style={styles.noImage}>No profile picture</Text>
        ) : (
          <Image source={{ uri: profile.profileImageUrl }} style={styles.image} />
        )}
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void run(replaceImage)}
        >
          <Text style={styles.link}>
            {profile.profileImageUrl === null ? 'Add picture' : 'Replace picture'}
          </Text>
        </Pressable>
        {profile.profileImageUrl === null ? null : (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void run(removeProfileImage)}
          >
            <Text style={styles.remove}>Remove picture</Text>
          </Pressable>
        )}
        <FormField
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          label="Username"
          maxLength={30}
          onChangeText={(value) => setUsername(value.toLowerCase())}
          value={username}
        />
        <FormField
          editable={!busy}
          label="Bio"
          maxLength={500}
          multiline
          onChangeText={setBio}
          value={bio}
        />
        <FormField
          editable={!busy}
          label="University"
          maxLength={160}
          onChangeText={setUniversity}
          value={university}
        />
        <PrimaryButton
          loading={busy}
          onPress={() =>
            void run(async () => {
              await updateProfile(profileUpdateInputSchema.parse({ bio, university, username }));
              router.back();
            })
          }
          title="Save changes"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  back: { color: '#17664F', fontSize: 15, fontWeight: '700' },
  content: { alignSelf: 'center', gap: 16, maxWidth: 560, padding: 26, width: '100%' },
  description: { color: '#605D56', fontSize: 15, lineHeight: 23 },
  image: { alignSelf: 'center', borderRadius: 56, height: 112, width: 112 },
  link: { color: '#17664F', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  noImage: { color: '#77746D', fontSize: 14, textAlign: 'center' },
  remove: { color: '#A23C2A', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  safeArea: { backgroundColor: '#F3EFE5', flex: 1 },
  title: { color: '#1D2924', fontSize: 34, fontWeight: '700', marginTop: 8 },
});
