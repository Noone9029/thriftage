import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

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
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={styles.text}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: '#17664F',
    borderRadius: 15,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 18,
  },
  disabled: { opacity: 0.55 },
  pressed: { backgroundColor: '#0E4E3B' },
  text: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
