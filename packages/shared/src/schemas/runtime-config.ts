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
