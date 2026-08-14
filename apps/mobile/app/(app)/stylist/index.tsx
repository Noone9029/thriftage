import type { AiStylistConversationPage } from '@thriftage/shared';
import { MaterialIcons } from '@expo/vector-icons';
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import { marketplaceColors } from '../../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';

export default function StylistHomeScreen() {
  const [includeArchived, setIncludeArchived] = useState(false);
  const queryClient = useQueryClient();
  const conversations = useInfiniteQuery<
    AiStylistConversationPage,
    Error,
    InfiniteData<AiStylistConversationPage>,
    readonly unknown[],
    string | undefined
  >({
    getNextPageParam: ({ nextCursor }) => nextCursor ?? undefined,
    initialPageParam: undefined,
    queryFn: ({ pageParam }) =>
      thriftageApiClient.getStylistConversations(pageParam, includeArchived),
    queryKey: ['ai-stylist', 'conversations', includeArchived],
  });
  const create = useMutation({
    mutationFn: () => thriftageApiClient.createStylistConversation(),
    onSuccess: (conversation) => {
      void queryClient.invalidateQueries({ queryKey: ['ai-stylist', 'conversations'] });
      router.push(`/stylist/${conversation.id}`);
    },
  });
  const archive = useMutation({
    mutationFn: ({ archived, id }: { archived: boolean; id: string }) =>
      thriftageApiClient.setStylistConversationArchived(id, archived),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-stylist', 'conversations'] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => thriftageApiClient.deleteStylistConversation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-stylist', 'conversations'] }),
  });
  const items = conversations.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        ListEmptyComponent={
          conversations.isLoading ? (
            <MarketplaceState
              loading
              message="Loading your private outfit history."
              title="Opening Stylist"
            />
          ) : conversations.isError ? (
            <MarketplaceState
              actionLabel="Try again"
              icon="cloud-off"
              message="Your Stylist history could not be loaded."
              onAction={() => void conversations.refetch()}
              title="History unavailable"
            />
          ) : (
            <View style={styles.empty}>
              <MaterialIcons color={marketplaceColors.accent} name="auto-awesome" size={34} />
              <Text style={styles.emptyTitle}>Your first look starts here</Text>
              <Text style={styles.emptyCopy}>
                Ask for an occasion, budget, color, or style. Every item comes from eligible
                Thriftage inventory.
              </Text>
            </View>
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.topRow}>
              <Pressable
                accessibilityLabel="Go back"
                onPress={() => router.back()}
                style={styles.iconButton}
              >
                <MaterialIcons color={marketplaceColors.forest} name="arrow-back" size={22} />
              </Pressable>
              <Pressable
                onPress={() => router.push('/stylist/saved-outfits')}
                style={styles.savedButton}
              >
                <MaterialIcons
                  color={marketplaceColors.forest}
                  name="collections-bookmark"
                  size={18}
                />
                <Text style={styles.savedText}>Saved outfits</Text>
              </Pressable>
            </View>
            <Text style={styles.eyebrow}>THRIFTAGE STYLIST</Text>
            <Text style={styles.title}>Style your next chapter.</Text>
            <Text style={styles.copy}>
              Personalized outfit intelligence grounded only in live marketplace pieces—never
              invented products.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={create.isPending}
              onPress={() => create.mutate()}
              style={styles.newButton}
            >
              <MaterialIcons color={marketplaceColors.white} name="auto-awesome" size={20} />
              <Text style={styles.newButtonText}>
                {create.isPending ? 'Starting…' : 'Start a new outfit'}
              </Text>
            </Pressable>
            {create.isError ? (
              <Text style={styles.error}>
                The Stylist could not start. Check your connection and try again.
              </Text>
            ) : null}
            <View style={styles.privacyCard}>
              <MaterialIcons color={marketplaceColors.success} name="lock-outline" size={18} />
              <Text style={styles.privacyText}>
                Your stylist conversations are private. Marketplace sellers and other users cannot
                see them.
              </Text>
            </View>
            <View style={styles.historyRow}>
              <Text style={styles.historyTitle}>Your conversations</Text>
              <Pressable onPress={() => setIncludeArchived((current) => !current)}>
                <Text style={styles.archiveToggle}>
                  {includeArchived ? 'Active only' : 'Include archived'}
                </Text>
              </Pressable>
            </View>
          </View>
        }
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={({ id }) => id}
        onEndReached={() => {
          if (conversations.hasNextPage && !conversations.isFetchingNextPage)
            void conversations.fetchNextPage();
        }}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/stylist/${item.id}`)} style={styles.conversation}>
            <View style={styles.conversationIcon}>
              <MaterialIcons color={marketplaceColors.accent} name="auto-awesome" size={20} />
            </View>
            <View style={styles.conversationCopy}>
              <View style={styles.conversationTitleRow}>
                <Text numberOfLines={1} style={styles.conversationTitle}>
                  {item.title}
                </Text>
                {item.archivedAt !== null ? (
                  <Text style={styles.archivedPill}>ARCHIVED</Text>
                ) : null}
              </View>
              <Text numberOfLines={1} style={styles.preview}>
                {item.preview ?? 'Ready for your first request'}
              </Text>
              <Text style={styles.timestamp}>{new Date(item.updatedAt).toLocaleDateString()}</Text>
            </View>
            <View style={styles.rowActions}>
              <Pressable
                accessibilityLabel={
                  item.archivedAt === null ? 'Archive conversation' : 'Restore conversation'
                }
                onPress={(event) => {
                  event.stopPropagation();
                  archive.mutate({ archived: item.archivedAt === null, id: item.id });
                }}
                style={styles.smallIcon}
              >
                <MaterialIcons
                  color={marketplaceColors.muted}
                  name={item.archivedAt === null ? 'archive' : 'unarchive'}
                  size={19}
                />
              </Pressable>
              <Pressable
                accessibilityLabel="Delete conversation"
                onPress={(event) => {
                  event.stopPropagation();
                  Alert.alert(
                    'Delete this conversation?',
                    'This removes the conversation and its messages. Saved outfits remain available.',
                    [
                      { style: 'cancel', text: 'Keep' },
                      {
                        onPress: () => remove.mutate(item.id),
                        style: 'destructive',
                        text: 'Delete',
                      },
                    ],
                  );
                }}
                style={styles.smallIcon}
              >
                <MaterialIcons color={marketplaceColors.danger} name="delete-outline" size={19} />
              </Pressable>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  archiveToggle: { color: marketplaceColors.accent, fontSize: 11, fontWeight: '900' },
  archivedPill: {
    backgroundColor: '#E5E1D8',
    borderRadius: 999,
    color: marketplaceColors.muted,
    fontSize: 8,
    fontWeight: '900',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  content: { paddingBottom: 30, paddingHorizontal: 16 },
  conversation: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    padding: 13,
  },
  conversationCopy: { flex: 1 },
  conversationIcon: {
    alignItems: 'center',
    backgroundColor: '#F4E5DC',
    borderRadius: 16,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  conversationTitle: { color: marketplaceColors.text, flex: 1, fontSize: 14, fontWeight: '900' },
  conversationTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  copy: { color: marketplaceColors.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  empty: { alignItems: 'center', paddingHorizontal: 30, paddingVertical: 46 },
  emptyCopy: {
    color: marketplaceColors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyTitle: { color: marketplaceColors.forest, fontSize: 18, fontWeight: '900', marginTop: 12 },
  error: { color: marketplaceColors.danger, fontSize: 12, lineHeight: 17, marginTop: 9 },
  eyebrow: {
    color: marketplaceColors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.3,
    marginTop: 22,
  },
  header: { paddingBottom: 12, paddingTop: 8 },
  historyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 25,
  },
  historyTitle: { color: marketplaceColors.text, fontSize: 18, fontWeight: '900' },
  iconButton: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  newButton: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forest,
    borderRadius: 17,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    marginTop: 20,
    padding: 16,
  },
  newButtonText: { color: marketplaceColors.white, fontSize: 14, fontWeight: '900' },
  preview: { color: marketplaceColors.muted, fontSize: 11, marginTop: 4 },
  privacyCard: {
    alignItems: 'flex-start',
    backgroundColor: '#E2EAE4',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 9,
    marginTop: 13,
    padding: 12,
  },
  privacyText: { color: marketplaceColors.forest, flex: 1, fontSize: 11, lineHeight: 16 },
  rowActions: { flexDirection: 'row' },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  savedButton: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  savedText: { color: marketplaceColors.forest, fontSize: 11, fontWeight: '900' },
  smallIcon: { padding: 5 },
  timestamp: { color: marketplaceColors.muted, fontSize: 9, marginTop: 5 },
  title: {
    color: marketplaceColors.forest,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: 38,
    marginTop: 9,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
