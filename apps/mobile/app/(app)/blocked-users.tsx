import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../src/components/marketplace/marketplace-state';
import { marketplaceColors } from '../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../src/lib/auth/auth-composition';

export default function BlockedUsersScreen() {
  const cache = useQueryClient();
  const query = useQuery({
    queryFn: () => thriftageApiClient.getBlockedUsers(),
    queryKey: ['blocks'],
  });
  const unblock = useMutation({
    mutationFn: (id: string) => thriftageApiClient.unblockUser(id),
    onSuccess: () => cache.invalidateQueries({ queryKey: ['blocks'] }),
  });
  if (query.isLoading)
    return (
      <MarketplaceState loading title="Blocked users" message="Loading your safety preferences." />
    );
  if (!query.data?.length)
    return (
      <MarketplaceState title="No blocked users" message="Accounts you block will appear here." />
    );
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.title}>Blocked users</Text>
        {query.data.map((item) => (
          <View key={item.blockedUserId} style={styles.row}>
            <Text style={styles.name}>@{item.username}</Text>
            <Pressable onPress={() => unblock.mutate(item.blockedUserId)}>
              <Text style={styles.action}>Unblock</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  action: { color: marketplaceColors.danger, fontWeight: '900' },
  content: { gap: 12, padding: 22 },
  name: { color: marketplaceColors.text, fontWeight: '800' },
  row: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  title: { color: marketplaceColors.text, fontSize: 28, fontWeight: '900', marginBottom: 8 },
});
