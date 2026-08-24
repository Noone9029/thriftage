import type { MessagePage } from '@thriftage/shared';
import { MaterialIcons } from '@expo/vector-icons';
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import { ListRowsSkeleton } from '../../../src/components/marketplace/marketplace-skeleton';
import { marketplaceColors } from '../../../src/components/marketplace/marketplace-theme';
import {
  marketplaceRadii,
  marketplaceShadows,
} from '../../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';
import { subscribeToConversation } from '../../../src/lib/communication/conversation-realtime';
import { useAuth } from '../../../src/providers/auth-provider';

export default function ConversationScreen() {
  const { conversationId = '' } = useLocalSearchParams<{ conversationId?: string }>();
  const [body, setBody] = useState('');
  const client = useQueryClient();
  const { state } = useAuth();
  const conversation = useQuery({
    queryFn: () => thriftageApiClient.getConversation(conversationId),
    queryKey: ['conversation', conversationId],
  });
  const messages = useInfiniteQuery<
    MessagePage,
    Error,
    InfiniteData<MessagePage>,
    readonly ['messages', string],
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => thriftageApiClient.getMessages(conversationId, pageParam),
    queryKey: ['messages', conversationId] as const,
  });
  useEffect(() => {
    if (conversationId === '') return;
    void thriftageApiClient.markConversationRead(conversationId);
    return subscribeToConversation(conversationId, () => {
      void client.invalidateQueries({ queryKey: ['messages', conversationId] });
    });
  }, [client, conversationId]);
  const send = useMutation({
    mutationFn: (text: string) => thriftageApiClient.sendMessage(conversationId, text),
    onSuccess: () => {
      setBody('');
      void client.invalidateQueries({ queryKey: ['messages', conversationId] });
    },
  });
  if (conversation.isLoading || messages.isLoading)
    return <ListRowsSkeleton label="Loading conversation" />;
  if (
    conversation.isError ||
    messages.isError ||
    conversation.data === undefined ||
    messages.data === undefined
  )
    return (
      <MarketplaceState
        actionLabel="Try again"
        icon="cloud-off"
        title="Conversation unavailable"
        message="This conversation could not be refreshed. Check your connection or return to the inbox."
        onAction={() => {
          void conversation.refetch();
          void messages.refetch();
        }}
      />
    );
  const ownId = state.status === 'AUTHENTICATED_ACTIVE' ? state.account.id : '';
  const messageItems = messages.data.pages.flatMap(({ items }) => items);
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.context}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.back}
        >
          <MaterialIcons color={marketplaceColors.forest} name="arrow-back" size={21} />
        </Pressable>
        <Pressable
          accessibilityLabel={`View ${conversation.data.listing.title}`}
          accessibilityRole="button"
          onPress={() => router.push(`/listings/${conversation.data.listing.id}`)}
          style={styles.listingContext}
        >
          {conversation.data.listing.imageUrl === null ? (
            <View style={[styles.contextImage, styles.contextPlaceholder]}>
              <MaterialIcons color={marketplaceColors.forest} name="checkroom" size={20} />
            </View>
          ) : (
            <Image source={conversation.data.listing.imageUrl} style={styles.contextImage} />
          )}
          <View style={styles.contextCopy}>
            <Text style={styles.name}>@{conversation.data.counterparty.username}</Text>
            <Text numberOfLines={1} style={styles.listing}>
              {conversation.data.listing.title}
            </Text>
          </View>
          <MaterialIcons color={marketplaceColors.muted} name="chevron-right" size={20} />
        </Pressable>
      </View>
      <View style={styles.safetyStrip}>
        <MaterialIcons color={marketplaceColors.forest} name="shield" size={15} />
        <Text style={styles.safetyText}>Keep payment and contact details inside Thriftage.</Text>
      </View>
      <FlatList
        inverted
        data={messageItems}
        keyExtractor={({ id }) => id}
        ListEmptyComponent={
          <View style={styles.emptyConversation}>
            <View style={styles.emptyConversationIcon}>
              <MaterialIcons color={marketplaceColors.forest} name="waving-hand" size={25} />
            </View>
            <Text style={styles.emptyConversationTitle}>Start with the piece</Text>
            <Text style={styles.emptyConversationText}>
              Ask about fit, condition, or delivery. Keep personal contact and payment details out
              of the chat.
            </Text>
          </View>
        }
        onEndReached={() => {
          if (messages.hasNextPage && !messages.isFetchingNextPage) void messages.fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        contentContainerStyle={[styles.messages, messageItems.length === 0 && styles.messagesEmpty]}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.senderId === ownId ? styles.mine : styles.theirs]}>
            <Text style={item.senderId === ownId ? styles.mineText : styles.theirText}>
              {item.body}
            </Text>
            <Text style={item.senderId === ownId ? styles.mineTime : styles.theirTime}>
              {new Date(item.createdAt).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })}
              {item.senderId === ownId && item.readAt !== null ? ' · Read' : ''}
            </Text>
          </View>
        )}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="Message"
            maxLength={2000}
            multiline
            onChangeText={setBody}
            placeholder="Keep it inside Thriftage…"
            placeholderTextColor={marketplaceColors.mutedLight}
            style={styles.input}
            value={body}
          />
          <Pressable
            accessibilityLabel="Send message"
            accessibilityRole="button"
            accessibilityState={{ disabled: body.trim() === '' || send.isPending }}
            disabled={body.trim() === '' || send.isPending}
            onPress={() => send.mutate(body.trim())}
            style={[styles.send, (body.trim() === '' || send.isPending) && styles.sendDisabled]}
          >
            <MaterialIcons color={marketplaceColors.white} name="arrow-upward" size={20} />
          </Pressable>
        </View>
        {send.isError ? (
          <Text style={styles.error}>
            Keep communication inside Thriftage for your protection, or try again.
          </Text>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  back: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.background,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  bubble: {
    borderRadius: marketplaceRadii.lg,
    marginVertical: 4,
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: marketplaceColors.paper,
    flexDirection: 'row',
    gap: 9,
    padding: 12,
  },
  context: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderBottomColor: marketplaceColors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },
  contextCopy: { flex: 1 },
  contextImage: {
    backgroundColor: marketplaceColors.sand,
    borderRadius: 12,
    height: 44,
    width: 38,
  },
  contextPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  error: { color: marketplaceColors.danger, fontSize: 12, paddingBottom: 8, paddingHorizontal: 15 },
  emptyConversation: { alignItems: 'center', paddingHorizontal: 28 },
  emptyConversationIcon: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forestSoft,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  emptyConversationText: {
    color: marketplaceColors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
    textAlign: 'center',
  },
  emptyConversationTitle: {
    color: marketplaceColors.text,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 12,
  },
  input: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    maxHeight: 110,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  listing: { color: marketplaceColors.muted, fontSize: 12, marginTop: 2 },
  listingContext: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 10 },
  messages: { padding: 14, paddingBottom: 20 },
  messagesEmpty: { flexGrow: 1, justifyContent: 'center' },
  mine: {
    ...marketplaceShadows.card,
    alignSelf: 'flex-end',
    backgroundColor: marketplaceColors.forest,
    borderBottomRightRadius: 5,
  },
  mineText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  mineTime: { color: 'rgba(255,255,255,0.58)', fontSize: 8, marginTop: 5, textAlign: 'right' },
  name: { color: marketplaceColors.text, fontSize: 16, fontWeight: '900' },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  send: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.accent,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  sendDisabled: { opacity: 0.42 },
  safetyStrip: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forestSoft,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  safetyText: { color: marketplaceColors.forest, fontSize: 9, fontWeight: '700' },
  theirText: { color: marketplaceColors.text, fontSize: 14, lineHeight: 20 },
  theirTime: { color: marketplaceColors.mutedLight, fontSize: 8, marginTop: 5 },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: marketplaceColors.sand,
    borderBottomLeftRadius: 5,
  },
});
