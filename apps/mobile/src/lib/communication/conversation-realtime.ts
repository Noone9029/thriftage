import { conversationRealtimeEventSchema, type ConversationRealtimeEvent } from '@thriftage/shared';

import { supabaseClient } from '../auth/supabase-client';

export function subscribeToConversation(
  conversationId: string,
  onMessage: (event: ConversationRealtimeEvent) => void,
): () => void {
  const channel = supabaseClient
    .channel(`conversation:${conversationId}`, { config: { private: true } })
    .on('broadcast', { event: 'message-created' }, ({ payload }) => {
      const parsed = conversationRealtimeEventSchema.safeParse(payload);
      if (parsed.success) onMessage(parsed.data);
    })
    .subscribe();
  return () => {
    void supabaseClient.removeChannel(channel);
  };
}
