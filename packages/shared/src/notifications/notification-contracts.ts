import { z } from 'zod';

import { cursorPageQuerySchema } from '../marketplace/listing-contracts';

export const notificationTypeValues = [
  'NEW_FOLLOWER',
  'NEW_MESSAGE',
  'ITEM_PURCHASED',
  'ITEM_SOLD',
  'ORDER_CONFIRMED',
  'ORDER_SHIPPED',
  'ORDER_DELIVERED',
  'ORDER_COMPLETED',
  'ORDER_CANCELLED',
  'LISTING_APPROVED',
  'LISTING_REJECTED',
  'LISTING_REMOVED',
  'REVIEW_RECEIVED',
  'DISPUTE_OPENED',
  'DISPUTE_UPDATED',
  'DISPUTE_RESOLVED',
  'SELLER_VERIFICATION_SUBMITTED',
  'SELLER_VERIFICATION_APPROVED',
  'SELLER_VERIFICATION_REJECTED',
  'ACCOUNT_RESTRICTED',
] as const;
export const notificationTypeSchema = z.enum(notificationTypeValues);

export const notificationSchema = z.strictObject({
  actorUserId: z.string().uuid().nullable(),
  body: z.string().max(240),
  conversationId: z.string().uuid().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  disputeId: z.string().uuid().nullable(),
  listingId: z.string().uuid().nullable(),
  orderId: z.string().uuid().nullable(),
  reviewId: z.string().uuid().nullable(),
  sellerVerificationId: z.string().uuid().nullable(),
  readAt: z.string().datetime({ offset: true }).nullable(),
  title: z.string().max(120),
  type: notificationTypeSchema,
});

export const notificationPageSchema = z.strictObject({
  items: z.array(notificationSchema),
  nextCursor: z.string().max(2048).nullable(),
  unreadCount: z.number().int().nonnegative(),
});

export const notificationQuerySchema = cursorPageQuerySchema;

export const pushDeviceInputSchema = z.strictObject({
  expoPushToken: z
    .string()
    .trim()
    .regex(/^(Expo(nent)?PushToken)\[[A-Za-z0-9_-]+\]$/)
    .max(255),
  platform: z.enum(['IOS', 'ANDROID']),
});

export const pushDeviceSchema = z.strictObject({
  active: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  lastSeenAt: z.string().datetime({ offset: true }),
  platform: z.enum(['IOS', 'ANDROID']),
  updatedAt: z.string().datetime({ offset: true }),
});

export const notificationErrorCodeValues = [
  'NOTIFICATION_DEVICE_INVALID',
  'NOTIFICATION_NOT_FOUND',
  'NOTIFICATION_SERVICE_ERROR',
] as const;
export const notificationErrorCodeSchema = z.enum(notificationErrorCodeValues);

export type Notification = z.infer<typeof notificationSchema>;
export type NotificationErrorCode = z.infer<typeof notificationErrorCodeSchema>;
export type NotificationPage = z.infer<typeof notificationPageSchema>;
export type NotificationQuery = z.infer<typeof notificationQuerySchema>;
export type PushDevice = z.infer<typeof pushDeviceSchema>;
export type PushDeviceInput = z.infer<typeof pushDeviceInputSchema>;
