import type { PublicUserProfile } from '@thriftage/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileSummary } from '../../../src/components/profiles/profile-summary';
import { MobileApiError } from '../../../src/lib/api/mobile-api-error';
import { getMobileAuthErrorMessage } from '../../../src/lib/auth/auth-error-message';
import { useAuth } from '../../../src/providers/auth-provider';

export default function PublicProfileScreen() {
  const { getPublicProfile } = useAuth();
  const params = useLocalSearchParams<{ username?: string }>();
  const username = typeof params.username === 'string' ? params.username : '';
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setProfile(null);
    setError(null);
    void getPublicProfile(username)
      .then((result) => {
        if (active) setProfile(result);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(
            caught instanceof MobileApiError && caught.code === 'PROFILE_NOT_FOUND'
              ? 'This profile is not available.'
              : getMobileAuthErrorMessage(caught),
          );
        }
      });
    return () => {
      active = false;
    };
  }, [getPublicProfile, username]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        {error !== null ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : profile === null ? (
          <View accessibilityLabel="Loading public profile" style={styles.loading}>
            <ActivityIndicator color="#17664F" size="large" />
            <Text style={styles.loadingText}>Loading profile…</Text>
          </View>
        ) : (
          <ProfileSummary profile={profile} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  back: { color: '#17664F', fontSize: 15, fontWeight: '700' },
  content: { flex: 1, gap: 46, padding: 28 },
  error: { color: '#A23C2A', fontSize: 15, textAlign: 'center' },
  loading: { alignItems: 'center', gap: 14, justifyContent: 'center' },
  loadingText: { color: '#5D625E', fontSize: 15 },
  safeArea: { backgroundColor: '#F3EFE5', flex: 1 },
});
