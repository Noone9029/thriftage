import type { MessagePage } from '@thriftage/shared';
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
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
import { marketplaceColors } from '../../../src/components/marketplace/marketplace-theme';
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
    return <MarketplaceState loading title="Opening conversation" message="Loading messages." />;
  if (conversation.data === undefined || messages.data === undefined)
    return (
      <MarketplaceState
        title="Conversation unavailable"
        message="You may not have access to this conversation."
      />
    );
  const ownId = state.status === 'AUTHENTICATED_ACTIVE' ? state.account.id : '';
  const messageItems = messages.data.pages.flatMap(({ items }) => items);
  return (
    <SafeAreaView style={styles.safe}>
      <Pressable
        style={styles.context}
        onPress={() => router.push(`/listings/${conversation.data.listing.id}`)}
      >
        <Text style={styles.back}>‹</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>@{conversation.data.counterparty.username}</Text>
          <Text numberOfLines={1} style={styles.listing}>
            {conversation.data.listing.title}
          </Text>
        </View>
      </Pressable>
      <FlatList
        inverted
        data={messageItems}
        keyExtractor={({ id }) => id}
        onEndReached={() => {
          if (messages.hasNextPage && !messages.isFetchingNextPage) void messages.fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        contentContainerStyle={styles.messages}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.senderId === ownId ? styles.mine : styles.theirs]}>
            <Text style={item.senderId === ownId ? styles.mineText : styles.theirText}>
              {item.body}
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
            style={styles.input}
            value={body}
          />
          <Pressable
            disabled={body.trim() === '' || send.isPending}
            onPress={() => send.mutate(body.trim())}
            style={styles.send}
          >
            <Text style={styles.sendText}>Send</Text>
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
  back: { color: marketplaceColors.forest, fontSize: 32, marginRight: 12 },
  bubble: {
    borderRadius: 18,
    marginVertical: 4,
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  composer: {
    alignItems: 'flex-end',
    borderTopColor: marketplaceColors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 9,
    padding: 12,
  },
  context: {
    alignItems: 'center',
    borderBottomColor: marketplaceColors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    padding: 14,
  },
  error: { color: marketplaceColors.danger, fontSize: 12, paddingBottom: 8, paddingHorizontal: 15 },
  input: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    maxHeight: 110,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  listing: { color: marketplaceColors.muted, fontSize: 12, marginTop: 2 },
  messages: { padding: 14 },
  mine: { alignSelf: 'flex-end', backgroundColor: marketplaceColors.forest },
  mineText: { color: '#fff' },
  name: { color: marketplaceColors.text, fontSize: 16, fontWeight: '900' },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  send: {
    backgroundColor: marketplaceColors.accent,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  sendText: { color: '#fff', fontWeight: '900' },
  theirText: { color: marketplaceColors.text },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#E8E4DB' },
});
