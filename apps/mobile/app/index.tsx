import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text accessibilityRole="header" style={styles.eyebrow}>
          THRIFTAGE
        </Text>
        <Text style={styles.title}>Style deserves a second story.</Text>
        <Text style={styles.copy}>
          The mobile foundation is ready. Marketplace discovery will arrive in approved feature
          phases.
        </Text>
        <View accessibilityLabel="Engineering foundation ready" style={styles.status}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Foundation ready</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  copy: {
    color: '#4B4A45',
    fontSize: 17,
    lineHeight: 26,
    marginTop: 18,
  },
  eyebrow: {
    color: '#167552',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
  },
  safeArea: {
    backgroundColor: '#F7F5EE',
    flex: 1,
  },
  status: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 9,
    marginTop: 36,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  statusDot: {
    backgroundColor: '#25A878',
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  statusText: {
    color: '#22211E',
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    color: '#1D1C19',
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1.5,
    lineHeight: 52,
    marginTop: 20,
    maxWidth: 520,
  },
});
