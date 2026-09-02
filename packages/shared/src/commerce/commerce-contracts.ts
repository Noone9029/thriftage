import { z } from 'zod';

import { cursorPageQuerySchema, currencyCodeSchema } from '../marketplace/listing-contracts';

export const orderStatusValues = [
  'AWAITING_PAYMENT',
  'PENDING',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
] as const;
export const paymentMethodValues = ['CASH_ON_DELIVERY', 'PAYFAST_HOSTED'] as const;
export const paymentStatusValues = [
  'REQUIRES_ACTION',
  'PENDING_COLLECTION',
  'COLLECTED',
  'FAILED',
  'CANCELLED',
  'REFUND_PENDING',
  'REFUNDED',
] as const;
export const paymentProviderValues = ['CASH_ON_DELIVERY', 'PAYFAST'] as const;
export const shipmentStatusValues = [
  'PENDING',
  'BOOKED',
  'PICKED_UP',
  'IN_TRANSIT',
  'SHIPPED',
  'DELIVERED',
  'FAILED',
  'RETURNING',
  'RETURNED',
  'LOST',
  'CANCELLED',
] as const;

export const orderStatusSchema = z.enum(orderStatusValues);
export const paymentMethodSchema = z.enum(paymentMethodValues);
export const paymentStatusSchema = z.enum(paymentStatusValues);
export const paymentProviderSchema = z.enum(paymentProviderValues);
export const shipmentStatusSchema = z.enum(shipmentStatusValues);

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

export const addressInputSchema = z.strictObject({
  addressLine1: z.string().trim().min(5).max(180),
  addressLine2: optionalTrimmed(180),
  city: z.string().trim().min(2).max(100),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/),
  deliveryInstructions: optionalTrimmed(500),
  isDefault: z.boolean().default(false),
  label: z.string().trim().min(1).max(50),
  phone: z.string().trim().min(4).max(32),
  postalCode: optionalTrimmed(32),
  recipientName: z.string().trim().min(2).max(120),
  region: z.string().trim().min(2).max(100),
});

export const addressUpdateInputSchema = addressInputSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one address field is required.');

export const addressSchema = z.strictObject({
  ...addressInputSchema.shape,
  addressLine2: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  deliveryInstructions: z.string().nullable(),
  id: z.string().uuid(),
  postalCode: z.string().nullable(),
  updatedAt: z.string().datetime({ offset: true }),
});

export const checkoutInputSchema = z.strictObject({
  addressId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  listingId: z.string().uuid(),
  paymentMethod: paymentMethodSchema.default('CASH_ON_DELIVERY'),
});

export const orderCancellationInputSchema = z.strictObject({
  reason: z.string().trim().min(5).max(500),
});

export const shipmentInputSchema = z
  .strictObject({
    providerDisplayName: z.string().trim().min(2).max(100),
    trackingNumber: optionalTrimmed(120),
    trackingUrl: z.string().trim().url().max(2048).nullable().optional(),
  })
  .transform((value) => ({
    ...value,
    trackingNumber: value.trackingNumber ?? null,
    trackingUrl: value.trackingUrl ?? null,
  }));

export const adminShipmentInputSchema = z.strictObject({
  courierReference: z.string().trim().min(1).max(120),
  evidenceReference: z.string().trim().min(1).max(255),
  feeMinor: z.number().int().nonnegative(),
  status: z.enum([
    'BOOKED',
    'PICKED_UP',
    'IN_TRANSIT',
    'DELIVERED',
    'FAILED',
    'RETURNING',
    'RETURNED',
    'LOST',
  ]),
});

export const orderPartySchema = z.strictObject({
  id: z.string().uuid(),
  profileImageUrl: z.string().url().nullable(),
  username: z.string().min(3).max(30),
});

export const orderAddressSnapshotSchema = z.strictObject({
  addressLine1: z.string(),
  addressLine2: z.string().nullable(),
  city: z.string(),
  countryCode: z.string().length(2),
  deliveryInstructions: z.string().nullable(),
  phone: z.string(),
  postalCode: z.string().nullable(),
  recipientName: z.string(),
  region: z.string(),
});

export const paymentSchema = z.strictObject({
  amountMinor: z.number().int().positive(),
  collectedAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  currency: currencyCodeSchema,
  failureCode: z.string().nullable(),
  id: z.string().uuid(),
  method: paymentMethodSchema,
  checkoutUrl: z.string().url().nullable(),
  expiresAt: z.string().datetime({ offset: true }).nullable(),
  provider: paymentProviderSchema,
  providerReference: z.string().nullable(),
  status: paymentStatusSchema,
  refundedAt: z.string().datetime({ offset: true }).nullable(),
  updatedAt: z.string().datetime({ offset: true }),
});

export const shipmentSchema = z.strictObject({
  bookedAt: z.string().datetime({ offset: true }).nullable(),
  courierReference: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  deliveredAt: z.string().datetime({ offset: true }).nullable(),
  evidenceReference: z.string().nullable(),
  feeMinor: z.number().int().nonnegative(),
  id: z.string().uuid(),
  providerDisplayName: z.string(),
  providerCode: z.literal('LOCAL_COURIER_MANUAL'),
  pickedUpAt: z.string().datetime({ offset: true }).nullable(),
  returnedAt: z.string().datetime({ offset: true }).nullable(),
  shippedAt: z.string().datetime({ offset: true }).nullable(),
  status: shipmentStatusSchema,
  trackingNumber: z.string().nullable(),
  trackingUrl: z.string().url().nullable(),
  updatedAt: z.string().datetime({ offset: true }),
});

export const orderEventSchema = z.strictObject({
  actorId: z.string().uuid().nullable(),
  actorType: z.enum(['USER', 'ADMIN', 'SYSTEM']),
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  nextState: z.string().nullable(),
  previousState: z.string().nullable(),
  reason: z.string().nullable(),
  type: z.enum([
    'ORDER_CREATED',
    'SELLER_CONFIRMED',
    'SELLER_CANCELLED',
    'BUYER_CANCELLED',
    'MARKED_SHIPPED',
    'MARKED_DELIVERED',
    'COMPLETED',
    'PAYMENT_STATUS_CHANGED',
    'PAYMENT_EXPIRED',
    'REFUND_STATUS_CHANGED',
  ]),
});

const orderBaseShape = {
  buyer: orderPartySchema,
  cancellationReason: z.string().nullable(),
  cancelledAt: z.string().datetime({ offset: true }).nullable(),
  completedAt: z.string().datetime({ offset: true }).nullable(),
  confirmedAt: z.string().datetime({ offset: true }).nullable(),
  conversationId: z.string().uuid().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  currency: currencyCodeSchema,
  deliveredAt: z.string().datetime({ offset: true }).nullable(),
  deliveryRateVersion: z.string().min(1).max(40),
  id: z.string().uuid(),
  listingId: z.string().uuid(),
  listingImageUrl: z.string().url().nullable(),
  listingTitle: z.string(),
  orderNumber: z.string().min(1).max(32),
  paymentMethod: paymentMethodSchema,
  priceMinor: z.number().int().positive(),
  quantity: z.literal(1),
  itemSubtotalMinor: z.number().int().positive(),
  commissionBps: z.literal(1000),
  commissionMinor: z.number().int().nonnegative(),
  withholdingBps: z.number().int().min(0).max(10_000),
  withholdingMinor: z.number().int().nonnegative(),
  sellerNetMinor: z.number().int().nonnegative(),
  financialPolicyVersion: z.string().min(1).max(40),
  withholdingRuleVersion: z.string().min(1).max(40),
  paymentExpiresAt: z.string().datetime({ offset: true }).nullable(),
  disputeWindowEndsAt: z.string().datetime({ offset: true }).nullable(),
  payoutEligibleAt: z.string().datetime({ offset: true }).nullable(),
  seller: orderPartySchema,
  shippedAt: z.string().datetime({ offset: true }).nullable(),
  shippingMinor: z.number().int().nonnegative(),
  status: orderStatusSchema,
  totalMinor: z.number().int().positive(),
  updatedAt: z.string().datetime({ offset: true }),
} as const;

export const orderSummarySchema = z.strictObject(orderBaseShape);
export const orderDetailSchema = z.strictObject({
  ...orderBaseShape,
  address: orderAddressSnapshotSchema,
  events: z.array(orderEventSchema),
  payment: paymentSchema,
  shipment: shipmentSchema.nullable(),
});

export const orderPageSchema = z.strictObject({
  items: z.array(orderSummarySchema),
  nextCursor: z.string().max(2048).nullable(),
});

export const orderQuerySchema = cursorPageQuerySchema.extend({
  status: orderStatusSchema.optional(),
});

export const adminOrderQuerySchema = orderQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
});

export const commerceErrorCodeValues = [
  'ADDRESS_FORBIDDEN',
  'ADDRESS_INVALID',
  'ADDRESS_NOT_FOUND',
  'COMMERCE_SERVICE_ERROR',
  'COMMERCE_VALIDATION_FAILED',
  'LISTING_NOT_AVAILABLE',
  'ORDER_FORBIDDEN',
  'ORDER_INVALID_TRANSITION',
  'ORDER_NOT_CANCELLABLE',
  'ORDER_NOT_FOUND',
  'PAYMENT_FAILED',
  'PAYMENT_PROVIDER_UNAVAILABLE',
  'PAYMENT_METHOD_DISABLED',
  'PAYMENT_SIGNATURE_INVALID',
  'PAYMENT_STATUS_MISMATCH',
  'PAYOUT_DESTINATION_INVALID',
  'PAYOUT_NOT_ELIGIBLE',
  'PAYOUT_SEPARATION_OF_DUTIES_REQUIRED',
  'REFUND_NOT_ALLOWED',
  'SETTLEMENT_MISMATCH',
  'SELF_PURCHASE_NOT_ALLOWED',
  'SHIPMENT_INVALID_STATE',
] as const;
export const commerceErrorCodeSchema = z.enum(commerceErrorCodeValues);
export const payfastRecoveryStatusSchema = z.strictObject({
  orderId: z.string().uuid(),
  status: z.enum(['CANCELLED', 'FAILED', 'PAID', 'PENDING']),
});

export const payfastHostedSessionSchema = z.strictObject({
  expiresAt: z.string().datetime({ offset: true }),
  redirectUrl: z.string().url(),
});

export type Address = z.infer<typeof addressSchema>;
export type AddressInput = z.infer<typeof addressInputSchema>;
export type AddressUpdateInput = z.infer<typeof addressUpdateInputSchema>;
export type AdminOrderQuery = z.infer<typeof adminOrderQuerySchema>;
export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
export type CommerceErrorCode = z.infer<typeof commerceErrorCodeSchema>;
export type OrderCancellationInput = z.infer<typeof orderCancellationInputSchema>;
export type OrderDetail = z.infer<typeof orderDetailSchema>;
export type OrderPage = z.infer<typeof orderPageSchema>;
export type OrderQuery = z.infer<typeof orderQuerySchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type OrderSummary = z.infer<typeof orderSummarySchema>;
export type ShipmentInput = z.infer<typeof shipmentInputSchema>;
export type AdminShipmentInput = z.infer<typeof adminShipmentInputSchema>;
