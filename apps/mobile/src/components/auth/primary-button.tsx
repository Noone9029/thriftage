import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { marketplaceColors, marketplaceRadii } from '../marketplace/marketplace-theme';

interface PrimaryButtonProps {
  readonly disabled?: boolean | undefined;
  readonly loading?: boolean | undefined;
  readonly onPress: () => void;
  readonly title: string;
}

export function PrimaryButton({ disabled, loading, onPress, title }: PrimaryButtonProps) {
  const unavailable = disabled === true || loading === true;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: unavailable }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        unavailable ? styles.disabled : null,
        pressed && !unavailable ? styles.pressed : null,
      ]}
    >
      {loading === true ? (
        <ActivityIndicator color={marketplaceColors.white} />
      ) : (
        <Text style={styles.text}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.accent,
    borderRadius: marketplaceRadii.lg,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 18,
  },
  disabled: { opacity: 0.55 },
  pressed: { backgroundColor: marketplaceColors.accentDeep, transform: [{ scale: 0.99 }] },
  text: { color: marketplaceColors.white, fontSize: 15, fontWeight: '900' },
});
