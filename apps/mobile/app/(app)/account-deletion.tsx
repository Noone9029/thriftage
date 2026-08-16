import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { marketplaceColors } from '../../src/components/marketplace/marketplace-theme';
import { getMobileApiErrorMessage } from '../../src/lib/api/mobile-api-error';
import { useAuth } from '../../src/providers/auth-provider';

export default function AccountDeletionScreen() {
  const { requestAccountDeletion, signOut, state } = useAuth();
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  if (state.status !== 'AUTHENTICATED_ACTIVE') return null;

  const requiresPassword = state.account.email !== null;
  const eligible =
    confirmation === 'DELETE' && (!requiresPassword || password.length > 0) && !submitting;

  const submit = async (): Promise<void> => {
    if (!eligible) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await requestAccountDeletion(password);
      Alert.alert(
        'Deletion requested',
        result.status === 'COMPLETED'
          ? 'Your account deletion is complete.'
          : 'Your account is disabled and cleanup is processing. You will no longer be able to access it.',
        [
          {
            onPress: () => void signOut(),
            text: 'Sign out',
          },
        ],
        { cancelable: false },
      );
    } catch (reason: unknown) {
      setError(getMobileApiErrorMessage(reason));
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}>
            <MaterialIcons color={marketplaceColors.text} name="arrow-back" size={24} />
          </Pressable>
          <View style={styles.warningIcon}>
            <MaterialIcons color="#9F2F2F" name="delete-forever" size={30} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            Delete your account
          </Text>
          <Text style={styles.copy}>
            This disables access immediately. Thriftage then removes your profile, listing media,
            messages you sent, personalization, saved items and outfits, push devices, and AI
            conversations.
          </Text>
          <Text style={styles.copy}>
            Completed transaction and safety records may be retained in anonymized form when they
            are required for audit, fraud prevention, or dispute handling.
          </Text>

          {requiresPassword ? (
            <View style={styles.field}>
              <Text style={styles.label}>Confirm your password</Text>
              <TextInput
                accessibilityLabel="Password"
                autoCapitalize="none"
                autoComplete="current-password"
                onChangeText={setPassword}
                secureTextEntry
                style={styles.input}
                value={password}
              />
            </View>
          ) : (
            <Text style={styles.note}>
              Phone-only accounts must have signed in by OTP within the last 10 minutes.
            </Text>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Type DELETE to confirm</Text>
            <TextInput
              accessibilityLabel="Type DELETE to confirm account deletion"
              autoCapitalize="characters"
              onChangeText={setConfirmation}
              placeholder="DELETE"
              placeholderTextColor={marketplaceColors.muted}
              style={styles.input}
              value={confirmation}
            />
          </View>

          {error === null ? null : (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            disabled={!eligible}
            onPress={() => void submit()}
            style={[styles.deleteButton, !eligible && styles.disabled]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.deleteText}>Permanently delete account</Text>
            )}
          </Pressable>
          <Pressable
            disabled={submitting}
            onPress={() => router.back()}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelText}>Keep my account</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', padding: 8 },
  cancelButton: { alignItems: 'center', padding: 14 },
  cancelText: { color: marketplaceColors.forest, fontSize: 15, fontWeight: '800' },
  content: { padding: 24, paddingBottom: 48 },
  copy: { color: marketplaceColors.muted, fontSize: 15, lineHeight: 23, marginTop: 12 },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: '#9F2F2F',
    borderRadius: 14,
    minHeight: 52,
    justifyContent: 'center',
    marginTop: 24,
    paddingHorizontal: 18,
  },
  deleteText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  error: { color: '#9F2F2F', fontSize: 14, marginTop: 14 },
  field: { gap: 8, marginTop: 24 },
  flex: { flex: 1 },
  input: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: marketplaceColors.text,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  label: { color: marketplaceColors.text, fontSize: 14, fontWeight: '800' },
  note: {
    backgroundColor: '#F4EBD7',
    borderRadius: 12,
    color: marketplaceColors.text,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 24,
    padding: 14,
  },
  safeArea: { backgroundColor: marketplaceColors.background, flex: 1 },
  title: { color: marketplaceColors.text, fontSize: 28, fontWeight: '900', marginTop: 18 },
  warningIcon: {
    alignItems: 'center',
    backgroundColor: '#F7DEDC',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    marginTop: 20,
    width: 48,
  },
});
