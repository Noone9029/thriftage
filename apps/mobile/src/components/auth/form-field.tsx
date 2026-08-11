import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

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
        placeholderTextColor="#969187"
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
  error: { color: '#A23C2A', fontSize: 13, lineHeight: 18 },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8D2C6',
    borderRadius: 14,
    borderWidth: 1,
    color: '#1D2924',
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  inputError: { borderColor: '#C95F48' },
  label: { color: '#293A33', fontSize: 14, fontWeight: '600' },
});
