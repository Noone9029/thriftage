import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FormField } from './form-field';

interface PasswordFieldProps {
  readonly editable?: boolean | undefined;
  readonly error?: string | undefined;
  readonly label: string;
  readonly onChangeText: (value: string) => void;
  readonly value: string;
}

export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <FormField
        autoCapitalize="none"
        autoComplete="off"
        editable={props.editable}
        error={props.error}
        label={props.label}
        onChangeText={props.onChangeText}
        secureTextEntry={!visible}
        value={props.value}
      />
      <Pressable
        accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${props.label.toLowerCase()}`}
        accessibilityRole="button"
        hitSlop={10}
        onPress={() => setVisible((current) => !current)}
        style={styles.toggle}
      >
        <Text style={styles.toggleText}>{visible ? 'Hide' : 'Show'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    alignSelf: 'flex-end',
    marginTop: 8,
    minHeight: 36,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  toggleText: { color: '#17664F', fontSize: 14, fontWeight: '700' },
});
