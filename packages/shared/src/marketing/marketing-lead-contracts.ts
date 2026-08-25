import { z } from 'zod';

export const marketingLeadKindValues = ['BETA', 'SELLER'] as const;
export const marketingAudienceValues = ['BUYER', 'SELLER', 'BOTH'] as const;
export const marketingSellerTypeValues = [
  'CLOSET_SELLER',
  'THRIFT_RESELLER',
  'FASHION_CREATOR',
  'OTHER',
] as const;
export const marketingItemVolumeValues = [
  'ONE_TO_TEN',
  'ELEVEN_TO_THIRTY',
  'THIRTY_ONE_TO_SEVENTY_FIVE',
  'MORE_THAN_SEVENTY_FIVE',
] as const;

const emailSchema = z
  .string()
  .trim()
  .email('Enter a valid email address.')
  .max(254)
  .transform((value) => value.toLowerCase());

const optionalText = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(maximum).optional(),
  );

const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().url('Enter a complete URL, including https://.').max(500).optional(),
);

const honeypotSchema = z.string().max(0, 'Submission could not be verified.').optional();

export const betaInterestInputSchema = z.strictObject({
  audience: z.enum(marketingAudienceValues),
  city: z.string().trim().min(2, 'Enter your city.').max(100),
  email: emailSchema,
  source: z.string().trim().min(1).max(100).default('public-web'),
  styleInterest: optionalText(120),
  website: honeypotSchema,
});

export const sellerInterestInputSchema = z.strictObject({
  city: z.string().trim().min(2, 'Enter your city.').max(100),
  email: emailSchema,
  itemVolume: z.enum(marketingItemVolumeValues),
  message: optionalText(1000),
  name: z.string().trim().min(2, 'Enter your name.').max(120),
  sellerType: z.enum(marketingSellerTypeValues),
  source: z.string().trim().min(1).max(100).default('public-web'),
  storeUrl: optionalUrl,
  website: honeypotSchema,
});

export const marketingLeadReceiptSchema = z.strictObject({
  status: z.enum(['CREATED', 'ALREADY_REGISTERED']),
});

export type BetaInterestInput = z.infer<typeof betaInterestInputSchema>;
export type SellerInterestInput = z.infer<typeof sellerInterestInputSchema>;
export type MarketingLeadKind = (typeof marketingLeadKindValues)[number];
export type MarketingLeadReceipt = z.infer<typeof marketingLeadReceiptSchema>;
