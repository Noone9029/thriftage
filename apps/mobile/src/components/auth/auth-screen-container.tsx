import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  marketplaceColors,
  marketplaceRadii,
  marketplaceShadows,
} from '../marketplace/marketplace-theme';

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
          <View style={styles.orbLarge} />
          <View style={styles.orbSmall} />
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandLetter}>T</Text>
            </View>
            <View>
              <Text style={styles.brand}>THRIFTAGE</Text>
              <Text style={styles.brandNote}>STYLE, REWORN</Text>
            </View>
          </View>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>WELCOME TO YOUR NEXT FIND</Text>
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
  brand: { color: marketplaceColors.forest, fontSize: 14, fontWeight: '900', letterSpacing: 3 },
  brandLetter: { color: marketplaceColors.white, fontSize: 14, fontWeight: '900' },
  brandMark: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.accent,
    borderRadius: 13,
    height: 38,
    justifyContent: 'center',
    transform: [{ rotate: '-7deg' }],
    width: 38,
  },
  brandNote: {
    color: marketplaceColors.accentDeep,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1.9,
    marginTop: 3,
  },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: 11, marginBottom: 24 },
  card: {
    ...marketplaceShadows.floating,
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.hero,
    borderWidth: 1,
    maxWidth: 560,
    padding: 24,
    width: '100%',
  },
  content: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 24,
  },
  description: { color: marketplaceColors.muted, fontSize: 15, lineHeight: 23, marginTop: 10 },
  eyebrow: {
    color: marketplaceColors.accent,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.7,
    marginBottom: 8,
  },
  flex: { flex: 1 },
  footer: {
    alignItems: 'center',
    borderTopColor: marketplaceColors.border,
    borderTopWidth: 1,
    marginTop: 24,
    paddingTop: 20,
  },
  form: { gap: 16, marginTop: 26 },
  orbLarge: {
    backgroundColor: marketplaceColors.accentSoft,
    borderRadius: 160,
    height: 280,
    opacity: 0.76,
    position: 'absolute',
    right: -150,
    top: -80,
    width: 280,
  },
  orbSmall: {
    backgroundColor: marketplaceColors.forestSoft,
    borderRadius: 100,
    bottom: -60,
    height: 180,
    left: -100,
    opacity: 0.8,
    position: 'absolute',
    width: 180,
  },
  safeArea: { backgroundColor: marketplaceColors.background, flex: 1 },
  title: {
    color: marketplaceColors.ink,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.1,
    lineHeight: 39,
  },
});
