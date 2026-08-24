import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { marketplaceColors, marketplaceRadii, marketplaceSpacing } from './marketplace-theme';

interface MarketplaceStateProps {
  readonly actionLabel?: string;
  readonly icon?: keyof typeof MaterialIcons.glyphMap;
  readonly message: string;
  readonly onAction?: () => void;
  readonly title: string;
  readonly loading?: boolean;
}

export function MarketplaceState({
  actionLabel,
  icon = 'checkroom',
  loading = false,
  message,
  onAction,
  title,
}: MarketplaceStateProps) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.container}>
      <View style={styles.glow} />
      {loading ? (
        <View style={styles.icon}>
          <ActivityIndicator color={marketplaceColors.accent} size="small" />
        </View>
      ) : (
        <View style={styles.icon}>
          <MaterialIcons color={marketplaceColors.forest} name={icon} size={30} />
        </View>
      )}
      <Text style={styles.eyebrow}>{loading ? 'CURATING' : 'THRIFTAGE'}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel !== undefined && onAction !== undefined ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
          <MaterialIcons color={marketplaceColors.white} name="arrow-forward" size={17} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forest,
    borderRadius: marketplaceRadii.pill,
    flexDirection: 'row',
    gap: marketplaceSpacing.sm,
    marginTop: marketplaceSpacing.sm,
    paddingHorizontal: marketplaceSpacing.xl,
    paddingVertical: 13,
  },
  actionPressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  actionText: { color: marketplaceColors.white, fontSize: 14, fontWeight: '900' },
  container: {
    alignItems: 'center',
    minHeight: 310,
    overflow: 'hidden',
    paddingHorizontal: marketplaceSpacing.xxxl,
    paddingVertical: 54,
  },
  eyebrow: {
    color: marketplaceColors.accent,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2.2,
    marginTop: marketplaceSpacing.lg,
  },
  glow: {
    backgroundColor: marketplaceColors.accentSoft,
    borderRadius: 120,
    height: 190,
    opacity: 0.56,
    position: 'absolute',
    right: -85,
    top: -60,
    width: 190,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forestSoft,
    borderColor: marketplaceColors.white,
    borderRadius: 35,
    borderWidth: 5,
    height: 70,
    justifyContent: 'center',
    width: 70,
  },
  message: {
    color: marketplaceColors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: marketplaceSpacing.sm,
    maxWidth: 320,
    textAlign: 'center',
  },
  title: {
    color: marketplaceColors.ink,
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: marketplaceSpacing.sm,
  },
});
