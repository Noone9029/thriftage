import type { ConversationRealtimeEvent } from '@thriftage/shared';

export const REALTIME_PUBLISHER = Symbol('REALTIME_PUBLISHER');

export interface RealtimePublisher {
  publishMessage(event: ConversationRealtimeEvent): Promise<void>;
}
