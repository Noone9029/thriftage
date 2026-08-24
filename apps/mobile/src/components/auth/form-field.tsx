import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { marketplaceColors, marketplaceRadii } from '../marketplace/marketplace-theme';

interface FormFieldProps extends TextInputProps {
  readonly error?: string | undefined;
  readonly label: string;
}

export function FormField({ error, label, ...inputProps }: FormFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityState={{ disabled: inputProps.editable === false }}
        placeholderTextColor={marketplaceColors.mutedLight}
        style={[styles.input, error === undefined ? null : styles.inputError]}
        {...inputProps}
      />
      {error === undefined ? null : (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 7 },
  error: { color: marketplaceColors.danger, fontSize: 13, lineHeight: 18 },
  input: {
    backgroundColor: marketplaceColors.background,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.md,
    borderWidth: 1,
    color: marketplaceColors.text,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  inputError: { borderColor: marketplaceColors.danger },
  label: { color: marketplaceColors.text, fontSize: 13, fontWeight: '800' },
});
