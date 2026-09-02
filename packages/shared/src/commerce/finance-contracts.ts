import { z } from 'zod';

import { currencyCodeSchema } from '../marketplace/listing-contracts';

export const payoutDestinationTypeSchema = z.enum(['BANK_IBAN', 'EASYPAISA', 'JAZZCASH']);
export const payoutProfileStatusSchema = z.enum([
  'PENDING_REVIEW',
  'ACTIVE',
  'REJECTED',
  'SUPERSEDED',
]);
export const settlementSourceSchema = z.enum(['PAYFAST', 'COURIER_COD', 'MANUAL_BANK']);
export const settlementStatusSchema = z.enum(['PENDING', 'MATCHED', 'EXCEPTION', 'REVERSED']);
export const refundStatusSchema = z.enum([
  'REQUESTED',
  'APPROVED',
  'SUBMITTED',
  'SUCCEEDED',
  'FAILED',
  'REJECTED',
  'STOCK_PENDING_INSPECTION',
  'STOCK_RESTORED',
]);

export const sellerPayoutProfileInputSchema = z
  .strictObject({
    accountTitle: z.string().trim().min(2).max(120),
    destination: z.string().trim().min(7).max(64),
    type: payoutDestinationTypeSchema,
  })
  .superRefine(({ destination, type }, context) => {
    if (type === 'BANK_IBAN' && !/^PK\d{2}[A-Z0-9]{20}$/i.test(destination.replaceAll(' ', ''))) {
      context.addIssue({
        code: 'custom',
        message: 'Enter a valid Pakistani IBAN.',
        path: ['destination'],
      });
    }
    if (type !== 'BANK_IBAN' && !/^\+92\d{10}$/.test(destination.replace(/[\s-]/g, ''))) {
      context.addIssue({
        code: 'custom',
        message: 'Wallet numbers must use +92XXXXXXXXXX.',
        path: ['destination'],
      });
    }
  });

export const sellerPayoutProfileSchema = z.strictObject({
  accountTitle: z.string(),
  createdAt: z.string().datetime({ offset: true }),
  displayLabel: z.string(),
  heldUntil: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  status: payoutProfileStatusSchema,
  type: payoutDestinationTypeSchema,
  updatedAt: z.string().datetime({ offset: true }),
});

export const sellerStatementEntrySchema = z.strictObject({
  amountMinor: z.number().int(),
  createdAt: z.string().datetime({ offset: true }),
  currency: currencyCodeSchema,
  id: z.string().uuid(),
  orderId: z.string().uuid().nullable(),
  type: z.enum([
    'PAYFAST_SETTLEMENT',
    'COURIER_COD_DEPOSIT',
    'REFUND',
    'PROVIDER_COST',
    'COURIER_COST',
    'WITHHOLDING',
    'COMMISSION',
    'SELLER_PAYABLE',
    'PAYOUT',
  ]),
});

export const settlementInputSchema = z.strictObject({
  amountMinor: z.number().int().positive(),
  currency: currencyCodeSchema.default('PKR'),
  evidenceReference: z.string().trim().min(1).max(255).nullable().optional(),
  externalReference: z.string().trim().min(1).max(255),
  orderId: z.string().uuid(),
  providerCostMinor: z.number().int().nonnegative().optional(),
  receivedAt: z.string().datetime({ offset: true }),
  source: settlementSourceSchema,
});

export const refundRequestInputSchema = z.strictObject({
  reason: z.enum([
    'NON_DELIVERY',
    'WRONG_ITEM',
    'COUNTERFEIT',
    'MATERIAL_MISMATCH',
    'VALID_CANCELLATION',
  ]),
  detail: z.string().trim().min(5).max(500),
});

export const refundDecisionInputSchema = z.strictObject({
  approve: z.boolean(),
  providerReference: z.string().trim().min(1).max(255).nullable().optional(),
  reason: z.string().trim().min(5).max(500),
});

export const payoutProfileReviewInputSchema = z.strictObject({
  approve: z.boolean(),
  reason: z.string().trim().min(5).max(500),
});

export const payoutBatchCreateInputSchema = z.strictObject({
  orderIds: z.array(z.string().uuid()).min(1).max(250),
});

export const payoutBatchPaidInputSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        payoutItemId: z.string().uuid(),
        providerReference: z.string().trim().min(1).max(255),
      }),
    )
    .min(1)
    .max(250),
});

export type SellerPayoutProfileInput = z.infer<typeof sellerPayoutProfileInputSchema>;
export type SettlementInput = z.infer<typeof settlementInputSchema>;
export type RefundRequestInput = z.infer<typeof refundRequestInputSchema>;
export type RefundDecisionInput = z.infer<typeof refundDecisionInputSchema>;
export type PayoutProfileReviewInput = z.infer<typeof payoutProfileReviewInputSchema>;
export type PayoutBatchCreateInput = z.infer<typeof payoutBatchCreateInputSchema>;
export type PayoutBatchPaidInput = z.infer<typeof payoutBatchPaidInputSchema>;
export type PayoutDestinationType = z.infer<typeof payoutDestinationTypeSchema>;
export type SellerPayoutProfile = z.infer<typeof sellerPayoutProfileSchema>;
export type SellerStatementEntry = z.infer<typeof sellerStatementEntrySchema>;
