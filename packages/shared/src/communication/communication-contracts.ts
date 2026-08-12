import { z } from 'zod';

import { cursorPageQuerySchema, listingStatusSchema } from '../marketplace/listing-contracts';

export const messageModerationStateValues = ['CLEAR', 'FLAGGED', 'BLOCKED'] as const;
export const messageFlagCategoryValues = [
  'PHONE_NUMBER',
  'EMAIL_ADDRESS',
  'WHATSAPP',
  'SOCIAL_HANDLE',
  'OBFUSCATED_CONTACT',
] as const;
export const messageFlagStatusValues = ['OPEN', 'UNDER_REVIEW', 'ACTIONED', 'DISMISSED'] as const;

export const messageModerationStateSchema = z.enum(messageModerationStateValues);
export const messageFlagCategorySchema = z.enum(messageFlagCategoryValues);
export const messageFlagStatusSchema = z.enum(messageFlagStatusValues);

export const conversationStartInputSchema = z.strictObject({ listingId: z.string().uuid() });
export const messageSendInputSchema = z.strictObject({
  body: z.string().trim().min(1).max(2000),
});

export const conversationParticipantSchema = z.strictObject({
  id: z.string().uuid(),
  profileImageUrl: z.string().url().nullable(),
  username: z.string().min(3).max(30),
});

export const conversationListingContextSchema = z.strictObject({
  id: z.string().uuid(),
  imageUrl: z.string().url().nullable(),
  status: listingStatusSchema,
  title: z.string().min(1).max(120),
});

export const messageSchema = z.strictObject({
  body: z.string().max(2000),
  conversationId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  moderationState: messageModerationStateSchema,
  readAt: z.string().datetime({ offset: true }).nullable(),
  senderId: z.string().uuid(),
});

export const conversationSummarySchema = z.strictObject({
  counterparty: conversationParticipantSchema,
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  lastMessage: messageSchema.nullable(),
  listing: conversationListingContextSchema,
  unreadCount: z.number().int().nonnegative(),
  updatedAt: z.string().datetime({ offset: true }),
});

export const conversationDetailSchema = z.strictObject({
  ...conversationSummarySchema.shape,
  buyer: conversationParticipantSchema,
  seller: conversationParticipantSchema,
});

export const conversationPageSchema = z.strictObject({
  items: z.array(conversationSummarySchema),
  nextCursor: z.string().max(2048).nullable(),
  totalUnread: z.number().int().nonnegative(),
});

export const messagePageSchema = z.strictObject({
  items: z.array(messageSchema),
  nextCursor: z.string().max(2048).nullable(),
});

export const conversationRealtimeEventSchema = z.strictObject({
  conversationId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  messageId: z.string().uuid(),
});

export const messageFlagSchema = z.strictObject({
  blocked: z.boolean(),
  category: messageFlagCategorySchema,
  confidence: z.number().int().min(0).max(100),
  conversationId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  detector: z.string().min(1).max(64),
  id: z.string().uuid(),
  message: messageSchema,
  requiresReview: z.boolean(),
  resolution: z.string().nullable(),
  reviewedAt: z.string().datetime({ offset: true }).nullable(),
  reviewerId: z.string().uuid().nullable(),
  status: messageFlagStatusSchema,
  updatedAt: z.string().datetime({ offset: true }),
});

export const messageFlagPageSchema = z.strictObject({
  items: z.array(messageFlagSchema),
  nextCursor: z.string().max(2048).nullable(),
});

export const messageFlagQuerySchema = cursorPageQuerySchema.extend({
  status: messageFlagStatusSchema.optional(),
});

export const messageFlagReviewInputSchema = z
  .strictObject({
    resolution: z.string().trim().min(5).max(1000).optional(),
    status: z.enum(['UNDER_REVIEW', 'ACTIONED', 'DISMISSED']),
  })
  .superRefine(({ resolution, status }, context) => {
    if ((status === 'ACTIONED' || status === 'DISMISSED') && resolution === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'A resolution is required when closing a message flag.',
        path: ['resolution'],
      });
    }
  });

export const adminConversationDetailSchema = z.strictObject({
  audits: z.array(
    z.strictObject({
      action: z.string().min(1),
      actorId: z.string().uuid(),
      createdAt: z.string().datetime({ offset: true }),
      id: z.string().uuid(),
      reason: z.string().nullable(),
    }),
  ),
  conversation: conversationDetailSchema,
  messages: z.array(messageSchema),
});

export const communicationErrorCodeValues = [
  'CONVERSATION_FORBIDDEN',
  'CONVERSATION_NOT_FOUND',
  'MESSAGE_CONTACT_SHARING_BLOCKED',
  'MESSAGE_RATE_LIMITED',
  'MESSAGE_FLAG_NOT_FOUND',
  'MESSAGE_INVALID',
  'MESSAGING_SERVICE_ERROR',
] as const;
export const communicationErrorCodeSchema = z.enum(communicationErrorCodeValues);

export type AdminConversationDetail = z.infer<typeof adminConversationDetailSchema>;
export type CommunicationErrorCode = z.infer<typeof communicationErrorCodeSchema>;
export type ConversationDetail = z.infer<typeof conversationDetailSchema>;
export type ConversationPage = z.infer<typeof conversationPageSchema>;
export type ConversationRealtimeEvent = z.infer<typeof conversationRealtimeEventSchema>;
export type ConversationStartInput = z.infer<typeof conversationStartInputSchema>;
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;
export type Message = z.infer<typeof messageSchema>;
export type MessageFlag = z.infer<typeof messageFlagSchema>;
export type MessageFlagPage = z.infer<typeof messageFlagPageSchema>;
export type MessageFlagQuery = z.infer<typeof messageFlagQuerySchema>;
export type MessageFlagReviewInput = z.infer<typeof messageFlagReviewInputSchema>;
export type MessagePage = z.infer<typeof messagePageSchema>;
export type MessageSendInput = z.infer<typeof messageSendInputSchema>;
