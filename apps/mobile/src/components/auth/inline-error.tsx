import { StyleSheet, Text, View } from 'react-native';

export function InlineError({ message }: { readonly message: string | null }) {
  if (message === null) return null;
  return (
    <View accessibilityLiveRegion="assertive" style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#FFF0EB', borderRadius: 12, padding: 13 },
  text: { color: '#8B3425', fontSize: 14, lineHeight: 20 },
});
