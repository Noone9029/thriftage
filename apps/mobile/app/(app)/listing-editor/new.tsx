import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListingEditorForm } from '../../../src/components/marketplace/listing-editor-form';
import { marketplaceColors } from '../../../src/components/marketplace/marketplace-theme';

export default function NewListingScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()}>
          <MaterialIcons color={marketplaceColors.text} name="arrow-back" size={24} />
        </Pressable>
        <Text style={styles.title}>Create a draft</Text>
        <View style={styles.spacer} />
      </View>
      <ListingEditorForm onCreated={(listing) => router.replace(`/listing-editor/${listing.id}`)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    borderBottomColor: marketplaceColors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  safeArea: { backgroundColor: marketplaceColors.background, flex: 1 },
  spacer: { width: 24 },
  title: { color: marketplaceColors.text, fontSize: 17, fontWeight: '900' },
});
