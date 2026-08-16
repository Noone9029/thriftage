import { MaterialIcons } from '@expo/vector-icons';
import type { BetaFeedbackInput } from '@thriftage/shared';
import { useMutation } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router, usePathname } from 'expo-router';
import { useState } from 'react';
import {
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
import { MobileApiError } from '../../src/lib/api/mobile-api-error';
import { thriftageApiClient } from '../../src/lib/auth/auth-composition';

const categories: ReadonlyArray<{
  readonly label: string;
  readonly value: BetaFeedbackInput['category'];
}> = [
  { label: 'Bug', value: 'BUG' },
  { label: 'Usability', value: 'USABILITY' },
  { label: 'Performance', value: 'PERFORMANCE' },
  { label: 'Safety', value: 'SAFETY' },
  { label: 'Other', value: 'OTHER' },
];

function buildNumber(): string {
  if (Platform.OS === 'android') return String(Constants.expoConfig?.android?.versionCode ?? 'dev');
  if (Platform.OS === 'ios') return Constants.expoConfig?.ios?.buildNumber ?? 'dev';
  return Constants.expoConfig?.version ?? 'web';
}

export default function BetaFeedbackScreen() {
  const route = usePathname();
  const [category, setCategory] = useState<BetaFeedbackInput['category']>('BUG');
  const [description, setDescription] = useState('');
  const submit = useMutation({
    mutationFn: () =>
      thriftageApiClient.submitBetaFeedback({
        appVersion: Constants.expoConfig?.version ?? 'development',
        buildNumber: buildNumber(),
        category,
        description,
        platform: Platform.OS === 'ios' ? 'IOS' : Platform.OS === 'android' ? 'ANDROID' : 'WEB',
        route,
      }),
    onSuccess: () => setDescription(''),
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
          <MaterialIcons color={marketplaceColors.forest} name="arrow-back" size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>Beta feedback</Text>
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Help make Thriftage beta-ready</Text>
          <Text style={styles.copy}>
            Describe one issue or suggestion. The app sends only this text, the current route, and
            app/build version. It does not attach screenshots, messages, orders, addresses, tokens,
            or AI conversations.
          </Text>
          <Text style={styles.label}>Category</Text>
          <View accessibilityRole="radiogroup" style={styles.categories}>
            {categories.map((item) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: category === item.value }}
                key={item.value}
                onPress={() => setCategory(item.value)}
                style={[styles.category, category === item.value && styles.categorySelected]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    category === item.value && styles.categoryTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>What happened?</Text>
          <TextInput
            accessibilityLabel="Beta feedback description"
            maxLength={2000}
            multiline
            onChangeText={setDescription}
            placeholder="Include what you expected, what happened, and whether you could continue."
            placeholderTextColor={marketplaceColors.muted}
            style={styles.input}
            value={description}
          />
          {submit.isSuccess ? (
            <View accessibilityRole="alert" style={styles.success}>
              <MaterialIcons color={marketplaceColors.success} name="check-circle" size={20} />
              <Text style={styles.successText}>Feedback received. Thank you.</Text>
            </View>
          ) : null}
          {submit.isError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {submit.error instanceof MobileApiError &&
              submit.error.code === 'FEEDBACK_RATE_LIMITED'
                ? 'You have reached today’s feedback limit. Try again later.'
                : 'Feedback could not be sent. Check your connection and try again.'}
            </Text>
          ) : null}
          <Pressable
            accessibilityLabel="Send beta feedback"
            disabled={description.trim().length < 10 || submit.isPending}
            onPress={() => submit.mutate()}
            style={[
              styles.submit,
              (description.trim().length < 10 || submit.isPending) && styles.disabled,
            ]}
          >
            <Text style={styles.submitText}>{submit.isPending ? 'Sending…' : 'Send feedback'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  back: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  category: {
    borderColor: marketplaceColors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  categorySelected: {
    backgroundColor: marketplaceColors.forest,
    borderColor: marketplaceColors.forest,
  },
  categoryText: { color: marketplaceColors.text, fontSize: 13, fontWeight: '700' },
  categoryTextSelected: { color: marketplaceColors.white },
  content: { gap: 14, padding: 20 },
  copy: { color: marketplaceColors.muted, fontSize: 14, lineHeight: 21 },
  disabled: { opacity: 0.45 },
  error: { color: marketplaceColors.danger, fontSize: 13, lineHeight: 19 },
  flex: { flex: 1 },
  header: {
    alignItems: 'center',
    borderBottomColor: marketplaceColors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: 8,
  },
  headerTitle: { color: marketplaceColors.text, fontSize: 17, fontWeight: '800', marginLeft: 8 },
  input: {
    borderColor: marketplaceColors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: marketplaceColors.text,
    fontSize: 15,
    minHeight: 150,
    padding: 14,
    textAlignVertical: 'top',
  },
  label: { color: marketplaceColors.text, fontSize: 13, fontWeight: '800', marginTop: 6 },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  submit: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forest,
    borderRadius: 14,
    minHeight: 48,
    justifyContent: 'center',
    marginTop: 4,
  },
  submitText: { color: marketplaceColors.white, fontSize: 15, fontWeight: '900' },
  success: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  successText: { color: marketplaceColors.success, flex: 1, fontSize: 14, fontWeight: '700' },
  title: { color: marketplaceColors.text, fontSize: 24, fontWeight: '900' },
});
