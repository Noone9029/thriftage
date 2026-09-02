import { z } from 'zod';

const moneySchema = z.number().int();
const countSchema = z.number().int().nonnegative();

export const commerceMetricsQuerySchema = z
  .strictObject({
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
  })
  .refine(
    ({ from, to }) => from === undefined || to === undefined || new Date(from) <= new Date(to),
    {
      message: 'from must not be after to',
    },
  );

export const commerceMetricsSchema = z.strictObject({
  activeSellers: countSchema,
  activeUsers: countSchema,
  commissionAccruedMinor: moneySchema,
  commissionEarnedMinor: moneySchema,
  commissionReversedMinor: moneySchema,
  completedGmvMinor: moneySchema,
  contributionMarginMinor: moneySchema,
  courierCostsMinor: moneySchema,
  disputes: countSchema,
  from: z.string().datetime({ offset: true }),
  orders: countSchema,
  payoutBatches: countSchema,
  payoutsMinor: moneySchema,
  placedGmvMinor: moneySchema,
  providerCostsMinor: moneySchema,
  reconciliationExceptions: countSchema,
  refundsMinor: moneySchema,
  registrations: countSchema,
  sellerLiabilitiesMinor: moneySchema,
  to: z.string().datetime({ offset: true }),
  totalSellers: countSchema,
  unitsSold: countSchema,
});

export const sellerInventoryOperationsSchema = z.array(
  z.strictObject({
    active: z.boolean(),
    listingCount: countSchema,
    listings: z.array(
      z.strictObject({
        id: z.string().uuid(),
        stockAvailable: countSchema,
        stockReserved: countSchema,
        stockSold: countSchema,
        status: z.string(),
        title: z.string(),
      }),
    ),
    sellerId: z.string().uuid(),
    username: z.string(),
  }),
);

export type CommerceMetricsQuery = z.infer<typeof commerceMetricsQuerySchema>;
export type CommerceMetrics = z.infer<typeof commerceMetricsSchema>;
export type SellerInventoryOperations = z.infer<typeof sellerInventoryOperationsSchema>;
