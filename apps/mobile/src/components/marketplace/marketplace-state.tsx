import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { marketplaceColors } from './marketplace-theme';

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
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={marketplaceColors.forest} size="large" />
      ) : (
        <View style={styles.icon}>
          <MaterialIcons color={marketplaceColors.forest} name={icon} size={28} />
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel !== undefined && onAction !== undefined ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.action}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    backgroundColor: marketplaceColors.forest,
    borderRadius: 999,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  actionText: { color: marketplaceColors.white, fontSize: 14, fontWeight: '800' },
  container: { alignItems: 'center', gap: 10, paddingHorizontal: 32, paddingVertical: 48 },
  icon: {
    alignItems: 'center',
    backgroundColor: '#E4EAE4',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  message: {
    color: marketplaceColors.muted,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 320,
    textAlign: 'center',
  },
  title: { color: marketplaceColors.text, fontSize: 20, fontWeight: '800' },
});
