import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListingEditorForm } from '../../../src/components/marketplace/listing-editor-form';
import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import { marketplaceColors } from '../../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';

export default function EditListingScreen() {
  const { listingId = '' } = useLocalSearchParams<{ listingId?: string }>();
  const listing = useQuery({
    queryFn: () => thriftageApiClient.getMyListing(listingId),
    queryKey: ['marketplace', 'seller-listing', listingId],
  });
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()}>
          <MaterialIcons color={marketplaceColors.text} name="arrow-back" size={24} />
        </Pressable>
        <Text style={styles.title}>Manage listing</Text>
        <View style={styles.spacer} />
      </View>
      {listing.isLoading ? (
        <MarketplaceState loading message="Loading your private draft." title="Opening listing" />
      ) : listing.isError || listing.data === undefined ? (
        <MarketplaceState
          actionLabel="Retry"
          message="This listing could not be loaded."
          onAction={() => void listing.refetch()}
          title="Listing unavailable"
        />
      ) : (
        <ListingEditorForm listing={listing.data} onDeleted={() => router.back()} />
      )}
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
