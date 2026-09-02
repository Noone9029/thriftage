import { z } from 'zod';

const optionalPublicUrlSchema = z.string().url().nullable();

export const publicRuntimeConfigSchema = z.strictObject({
  environment: z.enum(['local', 'staging', 'production']),
  features: z.strictObject({
    accountDeletion: z.boolean(),
    aiStylist: z.boolean(),
    phoneAuth: z.boolean(),
    pushNotifications: z.boolean(),
    registration: z.boolean(),
    sellerVerification: z.boolean(),
    cashOnDelivery: z.boolean(),
    localCourier: z.boolean(),
    payfast: z.boolean(),
    payouts: z.boolean(),
  }),
  commerce: z.strictObject({
    commissionBps: z.literal(1000),
    deliveryCities: z.array(z.string().min(1)).min(1),
    deliveryCountryCode: z.string().length(2),
    lahoreDeliveryFeeMinor: z.number().int().nonnegative(),
    paymentExpiryMinutes: z.literal(15),
  }),
  links: z.strictObject({
    accountDeletion: optionalPublicUrlSchema,
    communityGuidelines: optionalPublicUrlSchema,
    privacyPolicy: optionalPublicUrlSchema,
    support: optionalPublicUrlSchema,
    termsOfUse: optionalPublicUrlSchema,
  }),
  releaseVersion: z.string().min(1).max(120),
});

export type PublicRuntimeConfig = z.infer<typeof publicRuntimeConfigSchema>;
