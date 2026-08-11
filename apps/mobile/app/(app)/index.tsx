import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '../../src/components/auth/form-field';
import { PrimaryButton } from '../../src/components/auth/primary-button';
import { ProfileSummary } from '../../src/components/profiles/profile-summary';
import { useAuth } from '../../src/providers/auth-provider';

export default function OwnProfileScreen() {
  const { signOut, state } = useAuth();
  const [lookup, setLookup] = useState('');
  if (state.status !== 'AUTHENTICATED_ACTIVE') return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <View style={styles.brandMark} />
          <Text style={styles.brand}>THRIFTAGE</Text>
        </View>
        <Text style={styles.eyebrow}>YOUR PROFILE</Text>
        <Text style={styles.name}>{state.account.fullName}</Text>
        <ProfileSummary profile={state.profile} />
        <View style={styles.actions}>
          <PrimaryButton onPress={() => router.push('/edit-profile')} title="Edit profile" />
          <Pressable accessibilityRole="button" onPress={() => void signOut()}>
            <Text style={styles.link}>Sign out</Text>
          </Pressable>
        </View>
        <View style={styles.lookupCard}>
          <Text style={styles.lookupTitle}>View a public profile</Text>
          <FormField
            autoCapitalize="none"
            autoCorrect={false}
            label="Username"
            onChangeText={setLookup}
            placeholder="username"
            value={lookup}
          />
          <PrimaryButton
            disabled={lookup.trim().length === 0}
            onPress={() =>
              router.push({
                pathname: '/profiles/[username]',
                params: { username: lookup.trim().toLowerCase() },
              })
            }
            title="View profile"
          />
        </View>
        <Text style={styles.scopeNote}>
          Marketplace features begin in the next development goal and are intentionally absent.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 18, marginTop: 26, maxWidth: 320, width: '100%' },
  brand: { color: '#144C3D', fontSize: 13, fontWeight: '800', letterSpacing: 2.8 },
  brandMark: { backgroundColor: '#D66B45', borderRadius: 8, height: 16, width: 16 },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 34 },
  content: { alignItems: 'center', padding: 28, paddingBottom: 56 },
  eyebrow: { color: '#17664F', fontSize: 12, fontWeight: '800', letterSpacing: 2.2 },
  link: { color: '#17664F', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  lookupCard: {
    backgroundColor: '#FFFDF8',
    borderColor: '#E7E1D5',
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    marginTop: 40,
    maxWidth: 520,
    padding: 20,
    width: '100%',
  },
  lookupTitle: { color: '#1D2924', fontSize: 18, fontWeight: '700' },
  name: { color: '#5D625E', fontSize: 16, marginBottom: 24, marginTop: 6 },
  safeArea: { backgroundColor: '#F3EFE5', flex: 1 },
  scopeNote: { color: '#77746D', fontSize: 12, marginTop: 28, textAlign: 'center' },
});
