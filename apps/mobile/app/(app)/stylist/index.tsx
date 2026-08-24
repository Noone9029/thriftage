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
import {
  marketplaceColors,
  marketplaceRadii,
  marketplaceShadows,
  marketplaceSpacing,
} from '../../../src/components/marketplace/marketplace-theme';
import { useRuntimeConfig } from '../../../src/hooks/use-runtime-config';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';
import { stylistStarterPrompts } from '../../../src/lib/ai-stylist/stylist-mobile';

export default function StylistHomeScreen() {
  const [includeArchived, setIncludeArchived] = useState(false);
  const queryClient = useQueryClient();
  const runtime = useRuntimeConfig();
  const conversations = useInfiniteQuery<
    AiStylistConversationPage,
    Error,
    InfiniteData<AiStylistConversationPage>,
    readonly unknown[],
    string | undefined
  >({
    enabled: runtime.isSuccess && runtime.data.features.aiStylist,
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
  const stylistEnabled = runtime.data?.features.aiStylist === true;

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        ListEmptyComponent={
          runtime.isLoading ? (
            <MarketplaceState
              loading
              message="Checking Stylist availability."
              title="Opening Stylist"
            />
          ) : runtime.isError ? (
            <MarketplaceState
              actionLabel="Try again"
              icon="cloud-off"
              message="Stylist availability could not be checked. Your marketplace browsing still works."
              onAction={() => void runtime.refetch()}
              title="Stylist status unavailable"
            />
          ) : !stylistEnabled ? (
            <View style={styles.empty}>
              <MaterialIcons color={marketplaceColors.accent} name="auto-awesome" size={34} />
              <Text style={styles.emptyTitle}>Ideas ready for later</Text>
              <Text style={styles.emptyCopy}>
                When the live Stylist returns, start with an occasion, budget, color, or favorite
                piece. Recommendations will use only eligible Thriftage inventory.
              </Text>
            </View>
          ) : conversations.isLoading ? (
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
                accessibilityRole="button"
                onPress={() => router.back()}
                style={styles.iconButton}
              >
                <MaterialIcons color={marketplaceColors.forest} name="arrow-back" size={22} />
              </Pressable>
              <Pressable
                accessibilityLabel="Open saved outfits"
                accessibilityRole="button"
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
            <View style={styles.hero}>
              <View style={styles.heroOrb} />
              <Text style={styles.eyebrow}>THRIFTAGE STYLIST</Text>
              <Text style={styles.title}>Style your next chapter.</Text>
              <Text style={styles.copy}>
                Outfit intelligence grounded only in real marketplace pieces—never invented
                products.
              </Text>
              {stylistEnabled ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={create.isPending}
                  onPress={() => create.mutate()}
                  style={styles.newButton}
                >
                  <MaterialIcons
                    color={marketplaceColors.forestDeep}
                    name="auto-awesome"
                    size={20}
                  />
                  <Text style={styles.newButtonText}>
                    {create.isPending ? 'Starting…' : 'Create a new look'}
                  </Text>
                  <MaterialIcons
                    color={marketplaceColors.forestDeep}
                    name="arrow-forward"
                    size={18}
                  />
                </Pressable>
              ) : (
                <View style={styles.pausedCard}>
                  <View style={styles.pausedIcon}>
                    <MaterialIcons color={marketplaceColors.forest} name="style" size={21} />
                  </View>
                  <View style={styles.pausedCopy}>
                    <Text style={styles.pausedTitle}>The live Stylist is resting</Text>
                    <Text style={styles.pausedText}>
                      Your saved looks remain available, and your style profile still shapes For
                      You.
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push('/style-profile')}
                  >
                    <Text style={styles.pausedAction}>Tune style</Text>
                  </Pressable>
                </View>
              )}
            </View>
            <View style={styles.promptSection}>
              <Text style={styles.promptLabel}>
                {stylistEnabled ? 'TRY ASKING' : 'WHEN IT RETURNS, TRY'}
              </Text>
              <View style={styles.promptGrid}>
                {stylistStarterPrompts.slice(0, 3).map((prompt, index) => (
                  <View key={prompt} style={styles.promptCard}>
                    <MaterialIcons
                      color={marketplaceColors.accent}
                      name={index === 0 ? 'school' : index === 1 ? 'celebration' : 'weekend'}
                      size={18}
                    />
                    <Text numberOfLines={2} style={styles.promptText}>
                      {prompt}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
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
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: includeArchived }}
                onPress={() => setIncludeArchived((current) => !current)}
              >
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
          <Pressable
            accessibilityLabel={`Open Stylist conversation ${item.title}`}
            accessibilityRole="button"
            onPress={() => router.push(`/stylist/${item.id}`)}
            style={styles.conversation}
          >
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
                accessibilityRole="button"
                accessibilityState={{ busy: archive.isPending, disabled: archive.isPending }}
                disabled={archive.isPending}
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
                accessibilityRole="button"
                accessibilityState={{ busy: remove.isPending, disabled: remove.isPending }}
                disabled={remove.isPending}
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
    ...marketplaceShadows.card,
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.xl,
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
  copy: { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 20, marginTop: 9 },
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
    marginTop: 0,
  },
  header: { paddingBottom: 12, paddingTop: 8 },
  hero: {
    ...marketplaceShadows.floating,
    backgroundColor: marketplaceColors.forestDeep,
    borderRadius: marketplaceRadii.hero,
    marginTop: marketplaceSpacing.xl,
    overflow: 'hidden',
    padding: marketplaceSpacing.xl,
  },
  heroOrb: {
    backgroundColor: marketplaceColors.accent,
    borderRadius: 110,
    height: 190,
    opacity: 0.48,
    position: 'absolute',
    right: -78,
    top: -82,
    width: 190,
  },
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
    backgroundColor: marketplaceColors.white,
    borderRadius: marketplaceRadii.lg,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    marginTop: 20,
    padding: 16,
  },
  newButtonText: { color: marketplaceColors.forestDeep, fontSize: 14, fontWeight: '900' },
  pausedAction: { color: marketplaceColors.accentDeep, fontSize: 10, fontWeight: '900' },
  pausedCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: marketplaceRadii.lg,
    flexDirection: 'row',
    gap: 9,
    marginTop: marketplaceSpacing.xl,
    padding: 11,
  },
  pausedCopy: { flex: 1 },
  pausedIcon: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forestSoft,
    borderRadius: 15,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  pausedText: { color: marketplaceColors.muted, fontSize: 9, lineHeight: 13, marginTop: 2 },
  pausedTitle: { color: marketplaceColors.forest, fontSize: 11, fontWeight: '900' },
  preview: { color: marketplaceColors.muted, fontSize: 11, marginTop: 4 },
  privacyCard: {
    alignItems: 'flex-start',
    backgroundColor: marketplaceColors.forestSoft,
    borderRadius: marketplaceRadii.lg,
    flexDirection: 'row',
    gap: 9,
    marginTop: 13,
    padding: 12,
  },
  privacyText: { color: marketplaceColors.forest, flex: 1, fontSize: 11, lineHeight: 16 },
  promptCard: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 58,
    padding: 10,
    width: '48.5%',
  },
  promptGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  promptLabel: {
    color: marketplaceColors.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 9,
  },
  promptSection: { marginTop: marketplaceSpacing.lg },
  promptText: {
    color: marketplaceColors.text,
    flex: 1,
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 13,
  },
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
    color: marketplaceColors.white,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: 38,
    marginTop: 9,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
