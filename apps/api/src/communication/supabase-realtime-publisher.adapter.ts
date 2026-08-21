import { Injectable } from '@nestjs/common';
import { loadApiConfig } from '@thriftage/config/api';
import type { ConversationRealtimeEvent } from '@thriftage/shared';

import type { RealtimePublisher } from './realtime-publisher.interface';

@Injectable()
export class SupabaseRealtimePublisherAdapter implements RealtimePublisher {
  public async publishMessage(event: ConversationRealtimeEvent): Promise<void> {
    const config = loadApiConfig(process.env);
    if (!config.realtimeBroadcastEnabled) return;
    const response = await fetch(
      `${config.supabaseUrl}/realtime/v1/api/broadcast/conversation:${event.conversationId}/events/message-created?private=true`,
      {
        body: JSON.stringify(event),
        headers: {
          apikey: config.supabaseSecretKey,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
    if (!response.ok) throw new Error('REALTIME_BROADCAST_FAILED');
  }
}
