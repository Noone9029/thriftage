import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface AuthScreenContainerProps extends PropsWithChildren {
  readonly description: string;
  readonly footer?: ReactNode;
  readonly title: string;
}

export function AuthScreenContainer({
  children,
  description,
  footer,
  title,
}: AuthScreenContainerProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <View style={styles.brandMark} />
            <Text style={styles.brand}>THRIFTAGE</Text>
          </View>
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Text style={styles.description}>{description}</Text>
            <View style={styles.form}>{children}</View>
            {footer === undefined ? null : <View style={styles.footer}>{footer}</View>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  brand: { color: '#144C3D', fontSize: 13, fontWeight: '800', letterSpacing: 2.8 },
  brandMark: { backgroundColor: '#D66B45', borderRadius: 8, height: 16, width: 16 },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 28 },
  card: {
    backgroundColor: '#FFFDF8',
    borderColor: '#E7E1D5',
    borderRadius: 28,
    borderWidth: 1,
    maxWidth: 560,
    padding: 24,
    width: '100%',
  },
  content: { alignItems: 'center', flexGrow: 1, justifyContent: 'center', padding: 24 },
  description: { color: '#605D56', fontSize: 16, lineHeight: 24, marginTop: 10 },
  flex: { flex: 1 },
  footer: {
    alignItems: 'center',
    borderTopColor: '#EEE9DE',
    borderTopWidth: 1,
    marginTop: 24,
    paddingTop: 20,
  },
  form: { gap: 16, marginTop: 26 },
  safeArea: { backgroundColor: '#F3EFE5', flex: 1 },
  title: { color: '#1D2924', fontSize: 34, fontWeight: '700', letterSpacing: -0.8 },
});
