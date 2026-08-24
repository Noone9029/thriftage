import { MaterialIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  marketplaceColors,
  marketplaceRadii,
  marketplaceShadows,
  marketplaceSpacing,
} from './marketplace-theme';

export function ScreenHeader({
  action,
  eyebrow,
  subtitle,
  title,
}: {
  readonly action?: ReactNode;
  readonly eyebrow?: string;
  readonly subtitle?: string;
  readonly title: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        {eyebrow === undefined ? null : <Text style={styles.eyebrow}>{eyebrow}</Text>}
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {subtitle === undefined ? null : <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {action}
    </View>
  );
}

export function SectionHeader({
  actionLabel,
  eyebrow,
  onAction,
  title,
}: {
  readonly actionLabel?: string;
  readonly eyebrow?: string;
  readonly onAction?: () => void;
  readonly title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.headerCopy}>
        {eyebrow === undefined ? null : <Text style={styles.sectionEyebrow}>{eyebrow}</Text>}
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {title}
        </Text>
      </View>
      {actionLabel !== undefined && onAction !== undefined ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onAction}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function IconButton({
  accessibilityLabel,
  active = false,
  icon,
  onPress,
  tone = 'light',
}: {
  readonly accessibilityLabel: string;
  readonly active?: boolean;
  readonly icon: keyof typeof MaterialIcons.glyphMap;
  readonly onPress: () => void;
  readonly tone?: 'dark' | 'light';
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        tone === 'dark' && styles.iconButtonDark,
        pressed && styles.pressed,
      ]}
    >
      <MaterialIcons
        color={
          active
            ? marketplaceColors.accent
            : tone === 'dark'
              ? marketplaceColors.white
              : marketplaceColors.text
        }
        name={icon}
        size={22}
      />
    </Pressable>
  );
}

export function TrustPill({
  icon = 'verified',
  label,
  tone = 'forest',
}: {
  readonly icon?: keyof typeof MaterialIcons.glyphMap;
  readonly label: string;
  readonly tone?: 'accent' | 'forest' | 'neutral';
}) {
  const toneStyle =
    tone === 'accent'
      ? styles.trustAccent
      : tone === 'neutral'
        ? styles.trustNeutral
        : styles.trustForest;
  const color = tone === 'accent' ? marketplaceColors.accentDeep : marketplaceColors.forest;
  return (
    <View style={[styles.trustPill, toneStyle]}>
      <MaterialIcons color={color} name={icon} size={14} />
      <Text style={[styles.trustText, { color }]}>{label}</Text>
    </View>
  );
}

export function PrimaryAction({
  disabled = false,
  icon,
  label,
  onPress,
  tone = 'accent',
}: {
  readonly disabled?: boolean;
  readonly icon?: keyof typeof MaterialIcons.glyphMap;
  readonly label: string;
  readonly onPress: () => void;
  readonly tone?: 'accent' | 'forest';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        tone === 'forest' && styles.primaryForest,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {icon === undefined ? null : (
        <MaterialIcons color={marketplaceColors.white} name={icon} size={20} />
      )}
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.5 },
  eyebrow: {
    color: marketplaceColors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: marketplaceSpacing.lg,
    justifyContent: 'space-between',
  },
  headerCopy: { flex: 1 },
  iconButton: {
    ...marketplaceShadows.card,
    alignItems: 'center',
    backgroundColor: 'rgba(255,252,247,0.94)',
    borderColor: 'rgba(227,221,210,0.86)',
    borderRadius: 23,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  iconButtonDark: {
    backgroundColor: 'rgba(14,43,35,0.82)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  primary: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.accent,
    borderRadius: marketplaceRadii.lg,
    flexDirection: 'row',
    gap: marketplaceSpacing.sm,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: marketplaceSpacing.xl,
  },
  primaryForest: { backgroundColor: marketplaceColors.forest },
  primaryText: { color: marketplaceColors.white, fontSize: 15, fontWeight: '900' },
  sectionAction: { color: marketplaceColors.accentDeep, fontSize: 12, fontWeight: '900' },
  sectionEyebrow: {
    color: marketplaceColors.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  sectionHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: marketplaceSpacing.md,
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: marketplaceColors.text,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: marketplaceColors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: marketplaceSpacing.sm,
    maxWidth: 360,
  },
  title: {
    color: marketplaceColors.ink,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1.1,
    lineHeight: 37,
    marginTop: marketplaceSpacing.sm,
  },
  trustAccent: { backgroundColor: marketplaceColors.accentSoft },
  trustForest: { backgroundColor: marketplaceColors.forestSoft },
  trustNeutral: { backgroundColor: marketplaceColors.sand },
  trustPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: marketplaceRadii.pill,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  trustText: { fontSize: 10, fontWeight: '900' },
});
