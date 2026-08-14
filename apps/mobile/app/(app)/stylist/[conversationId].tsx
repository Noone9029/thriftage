import { MaterialIcons } from '@expo/vector-icons';
import type { AiStylistMessage, AiStylistOutfit, ListingDetail } from '@thriftage/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import { marketplaceColors } from '../../../src/components/marketplace/marketplace-theme';
import { OutfitCard } from '../../../src/components/stylist/outfit-card';
import {
  isAbortError,
  refinementLabel,
  refinementMessage,
  stylistErrorMessage,
  stylistStarterPrompts,
} from '../../../src/lib/ai-stylist/stylist-mobile';
import { MobileApiError } from '../../../src/lib/api/mobile-api-error';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';

export default function StylistConversationScreen() {
  const {
    anchorListingId,
    conversationId = '',
    starter,
  } = useLocalSearchParams<{
    anchorListingId?: string;
    conversationId?: string;
    starter?: string;
  }>();
  const [body, setBody] = useState(starter ?? '');
  const [pendingBody, setPendingBody] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<{
    readonly requestId: string;
    readonly text: string;
  } | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [savedOutfitIds, setSavedOutfitIds] = useState<ReadonlySet<string>>(new Set());
  const abortController = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();
  const conversation = useQuery({
    enabled: conversationId !== '',
    queryFn: () => thriftageApiClient.getStylistConversation(conversationId),
    queryKey: ['ai-stylist', 'conversation', conversationId],
  });
  const styleProfile = useQuery({
    queryFn: () => thriftageApiClient.getStyleProfile(),
    queryKey: ['personalization', 'profile'],
  });
  const send = useMutation({
    mutationFn: async ({ requestId, text }: { requestId: string; text: string }) => {
      const controller = new AbortController();
      abortController.current = controller;
      return thriftageApiClient.sendStylistMessage(
        conversationId,
        {
          ...(anchorListingId === undefined || conversation.data?.messages.length !== 0
            ? {}
            : { anchorListingId }),
          body: text,
          requestId,
        },
        controller.signal,
      );
    },
    onError: (error) => {
      if (isAbortError(error)) setCancelled(true);
    },
    onSettled: () => {
      abortController.current = null;
      setPendingBody(null);
    },
    onSuccess: async () => {
      setBody('');
      setCancelled(false);
      setLastRequest(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ai-stylist', 'conversation', conversationId] }),
        queryClient.invalidateQueries({ queryKey: ['ai-stylist', 'conversations'] }),
      ]);
    },
  });
  const saveOutfit = useMutation({
    mutationFn: ({ generationId, outfit }: { generationId: string; outfit: AiStylistOutfit }) =>
      thriftageApiClient.saveStylistOutfit({ generationId, outfitId: outfit.id }),
    onSuccess: (_saved, { outfit }) => {
      setSavedOutfitIds((current) => new Set([...current, outfit.id]));
      void queryClient.invalidateQueries({ queryKey: ['ai-stylist', 'saved-outfits'] });
    },
  });
  const messageSeller = useMutation({
    mutationFn: (listingId: string) => thriftageApiClient.startConversation(listingId),
    onSuccess: (marketplaceConversation) => {
      router.push(`/messages/${marketplaceConversation.id}`);
    },
  });

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (trimmed === '' || send.isPending) return;
    setCancelled(false);
    setPendingBody(trimmed);
    const request = { requestId: Crypto.randomUUID(), text: trimmed };
    setLastRequest(request);
    send.mutate(request);
  };

  if (conversation.isLoading)
    return (
      <MarketplaceState
        loading
        message="Revalidating the latest marketplace pieces."
        title="Opening your look"
      />
    );
  if (conversation.data === undefined)
    return (
      <MarketplaceState
        actionLabel="Back to Stylist"
        message="This conversation does not exist or does not belong to your account."
        onAction={() => router.replace('/stylist')}
        title="Conversation unavailable"
      />
    );

  const messages = conversation.data.messages;
  const latestAssistant = [...messages].reverse().find(({ role }) => role === 'ASSISTANT');
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Stylist history"
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <MaterialIcons color={marketplaceColors.forest} name="arrow-back" size={22} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={styles.headerTitle}>
            {conversation.data.title}
          </Text>
          <Text style={styles.headerSubtitle}>Grounded in current Thriftage inventory</Text>
        </View>
        <Pressable
          accessibilityLabel="Saved outfits"
          onPress={() => router.push('/stylist/saved-outfits')}
          style={styles.iconButton}
        >
          <MaterialIcons color={marketplaceColors.forest} name="collections-bookmark" size={21} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled">
        <View style={styles.contextPill}>
          <MaterialIcons color={marketplaceColors.success} name="tune" size={16} />
          <Text style={styles.contextText}>
            {styleProfile.data?.quizStatus === 'COMPLETED'
              ? 'Using your private Style Profile as a preference—not a restriction.'
              : 'No completed Style Profile needed. Tell me what you want today.'}
          </Text>
        </View>
        {messages.length === 0 ? (
          <View style={styles.welcome}>
            <MaterialIcons color={marketplaceColors.accent} name="auto-awesome" size={32} />
            <Text style={styles.welcomeTitle}>What are you dressing for?</Text>
            <Text style={styles.welcomeCopy}>
              Add an occasion, budget, colors, fit, or a style direction. I’ll only recommend
              verified marketplace items.
            </Text>
            <View style={styles.starters}>
              {stylistStarterPrompts.map((prompt) => (
                <Pressable key={prompt} onPress={() => setBody(prompt)} style={styles.starter}>
                  <Text style={styles.starterText}>{prompt}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        {messages.map((message) => (
          <StylistMessageView
            key={message.id}
            message={message}
            onOpen={(generationId, listingId) => {
              void thriftageApiClient
                .recordStylistAttribution({ event: 'OPEN', generationId, listingId })
                .catch(() => undefined);
              router.push(`/listings/${listingId}?aiGenerationId=${generationId}`);
            }}
            onMessageSeller={(listingId) => messageSeller.mutate(listingId)}
            onSaveItem={(generationId, listing) => {
              void Promise.allSettled([
                thriftageApiClient.setSaved(listing.id, true),
                thriftageApiClient.recordStylistAttribution({
                  event: 'SAVE',
                  generationId,
                  listingId: listing.id,
                }),
              ]).then(() => queryClient.invalidateQueries({ queryKey: ['marketplace', 'saved'] }));
            }}
            onSaveOutfit={(generationId, outfit) => saveOutfit.mutate({ generationId, outfit })}
            onShop={(generationId, listingId) =>
              router.push(`/checkout/${listingId}?aiGenerationId=${generationId}`)
            }
            savedOutfitIds={savedOutfitIds}
            saving={saveOutfit.isPending}
            startingMessage={messageSeller.isPending}
          />
        ))}
        {pendingBody !== null ? (
          <>
            <View style={[styles.bubble, styles.userBubble]}>
              <Text style={styles.userText}>{pendingBody}</Text>
            </View>
            <View style={styles.thinking}>
              <ActivityIndicator color={marketplaceColors.accent} />
              <View style={styles.thinkingCopy}>
                <Text style={styles.thinkingTitle}>Building from live inventory…</Text>
                <Text style={styles.thinkingText}>
                  Checking budget, size, availability, blocks, and outfit cohesion.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Stop waiting for Stylist"
                onPress={() => abortController.current?.abort()}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          </>
        ) : null}
        {cancelled ? (
          <View style={styles.cancelledCard}>
            <Text style={styles.notice}>
              You stopped waiting. The server request remains bounded and may still finish safely.
            </Text>
            {lastRequest !== null ? (
              <Pressable
                disabled={send.isPending}
                onPress={() => {
                  setCancelled(false);
                  setPendingBody(lastRequest.text);
                  send.mutate(lastRequest);
                }}
                style={styles.reconcileButton}
              >
                <Text style={styles.reconcileText}>Check the same request</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {send.isError && !isAbortError(send.error) ? (
          <View style={styles.errorCard}>
            <MaterialIcons color={marketplaceColors.danger} name="error-outline" size={19} />
            <Text style={styles.errorText}>
              {stylistErrorMessage(
                send.error instanceof MobileApiError ? send.error.code : undefined,
              )}
            </Text>
          </View>
        ) : null}
        {saveOutfit.isError ? (
          <Text style={styles.notice}>
            That outfit could not be saved. Try again without regenerating it.
          </Text>
        ) : null}
        {messageSeller.isError ? (
          <Text style={styles.notice}>
            Seller messaging could not start. Open the item to review its current eligibility.
          </Text>
        ) : null}
        {latestAssistant?.assistantPayload !== null &&
        latestAssistant?.assistantPayload !== undefined ? (
          <View style={styles.refinements}>
            <Text style={styles.refinementTitle}>Refine this look</Text>
            <View style={styles.refinementRow}>
              {latestAssistant.assistantPayload.quickRefinements.map((refinement) => (
                <Pressable
                  disabled={send.isPending}
                  key={refinement}
                  onPress={() => submit(refinementMessage(refinement))}
                  style={styles.refinement}
                >
                  <Text style={styles.refinementText}>{refinementLabel(refinement)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="Ask your fashion stylist"
            editable={!send.isPending}
            maxLength={2000}
            multiline
            onChangeText={setBody}
            placeholder="Try “make it cheaper” or “more streetwear”…"
            placeholderTextColor={marketplaceColors.muted}
            style={styles.input}
            value={body}
          />
          <Pressable
            accessibilityLabel="Send to Stylist"
            disabled={body.trim() === '' || send.isPending}
            onPress={() => submit(body)}
            style={[
              styles.sendButton,
              (body.trim() === '' || send.isPending) && styles.sendDisabled,
            ]}
          >
            <MaterialIcons color={marketplaceColors.white} name="arrow-upward" size={21} />
          </Pressable>
        </View>
        <Text style={styles.disclaimer}>
          Recommendations do not reserve inventory or guarantee fit. Recheck listing details before
          buying.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StylistMessageView({
  message,
  onOpen,
  onMessageSeller,
  onSaveItem,
  onSaveOutfit,
  onShop,
  savedOutfitIds,
  saving,
  startingMessage,
}: {
  readonly message: AiStylistMessage;
  readonly onMessageSeller: (listingId: string) => void;
  readonly onOpen: (generationId: string, listingId: string) => void;
  readonly onSaveItem: (generationId: string, listing: ListingDetail) => void;
  readonly onSaveOutfit: (generationId: string, outfit: AiStylistOutfit) => void;
  readonly onShop: (generationId: string, listingId: string) => void;
  readonly savedOutfitIds: ReadonlySet<string>;
  readonly saving: boolean;
  readonly startingMessage: boolean;
}) {
  if (message.role === 'USER')
    return (
      <View style={[styles.bubble, styles.userBubble]}>
        <Text style={styles.userText}>{message.content}</Text>
      </View>
    );
  const payload = message.assistantPayload;
  return (
    <View style={styles.assistantBlock}>
      <View style={styles.assistantLabel}>
        <MaterialIcons color={marketplaceColors.accent} name="auto-awesome" size={16} />
        <Text style={styles.assistantLabelText}>THRIFTAGE STYLIST</Text>
        {payload?.fallbackUsed === true ? (
          <Text style={styles.fallbackPill}>GROUNDED FALLBACK</Text>
        ) : null}
      </View>
      <Text style={styles.assistantText}>{message.content}</Text>
      {payload?.outfits.map((outfit) => (
        <OutfitCard
          key={outfit.id}
          messaging={startingMessage}
          onMessageSeller={onMessageSeller}
          onOpenListing={(listingId) => onOpen(payload.generationId, listingId)}
          onSaveItem={(listing) => onSaveItem(payload.generationId, listing)}
          onSaveOutfit={(selection) => onSaveOutfit(payload.generationId, selection)}
          onShopListing={(listingId) => onShop(payload.generationId, listingId)}
          outfit={outfit}
          saved={savedOutfitIds.has(outfit.id)}
          saving={saving}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  assistantBlock: { gap: 12, marginTop: 20 },
  assistantLabel: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  assistantLabelText: {
    color: marketplaceColors.forest,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  assistantText: { color: marketplaceColors.text, fontSize: 15, lineHeight: 22 },
  bubble: {
    borderRadius: 18,
    marginTop: 18,
    maxWidth: '88%',
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  cancelButton: {
    borderColor: marketplaceColors.border,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  cancelText: { color: marketplaceColors.forest, fontSize: 10, fontWeight: '900' },
  cancelledCard: { alignItems: 'flex-start', gap: 8, marginTop: 12 },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: marketplaceColors.background,
    borderTopColor: marketplaceColors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  contextPill: {
    alignItems: 'flex-start',
    backgroundColor: '#E3EBE5',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    padding: 11,
  },
  contextText: { color: marketplaceColors.forest, flex: 1, fontSize: 11, lineHeight: 16 },
  disclaimer: {
    backgroundColor: marketplaceColors.background,
    color: marketplaceColors.muted,
    fontSize: 9,
    lineHeight: 13,
    paddingBottom: 9,
    paddingHorizontal: 14,
    paddingTop: 6,
    textAlign: 'center',
  },
  errorCard: {
    alignItems: 'flex-start',
    backgroundColor: '#F8E7E4',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    padding: 12,
  },
  errorText: { color: marketplaceColors.danger, flex: 1, fontSize: 12, lineHeight: 18 },
  fallbackPill: {
    backgroundColor: '#E4E9E5',
    borderRadius: 999,
    color: marketplaceColors.success,
    fontSize: 8,
    fontWeight: '900',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: marketplaceColors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  headerCopy: { flex: 1 },
  headerSubtitle: { color: marketplaceColors.muted, fontSize: 9, marginTop: 2 },
  headerTitle: { color: marketplaceColors.forest, fontSize: 15, fontWeight: '900' },
  iconButton: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  input: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    fontSize: 14,
    maxHeight: 108,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  messages: { padding: 15, paddingBottom: 24 },
  notice: { color: marketplaceColors.muted, fontSize: 11, lineHeight: 16, marginTop: 13 },
  refinement: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  refinementRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  refinementText: { color: marketplaceColors.forest, fontSize: 10, fontWeight: '800' },
  refinementTitle: { color: marketplaceColors.text, fontSize: 12, fontWeight: '900' },
  refinements: { gap: 9, marginTop: 20 },
  reconcileButton: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  reconcileText: { color: marketplaceColors.forest, fontSize: 10, fontWeight: '900' },
  safe: { backgroundColor: marketplaceColors.background, flex: 1 },
  sendButton: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.accent,
    borderRadius: 23,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  sendDisabled: { opacity: 0.45 },
  starter: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  starterText: { color: marketplaceColors.forest, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  starters: { gap: 8, marginTop: 18, width: '100%' },
  thinking: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    padding: 12,
  },
  thinkingCopy: { flex: 1 },
  thinkingText: { color: marketplaceColors.muted, fontSize: 10, lineHeight: 14, marginTop: 2 },
  thinkingTitle: { color: marketplaceColors.forest, fontSize: 12, fontWeight: '900' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: marketplaceColors.forest },
  userText: { color: marketplaceColors.white, fontSize: 14, lineHeight: 20 },
  welcome: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 36 },
  welcomeCopy: {
    color: marketplaceColors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  welcomeTitle: { color: marketplaceColors.forest, fontSize: 22, fontWeight: '900', marginTop: 12 },
});
