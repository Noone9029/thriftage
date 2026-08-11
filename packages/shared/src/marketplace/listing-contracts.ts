import { z } from 'zod';

import { categorySchema } from './category-contracts';

export const listingStatusValues = [
  'DRAFT',
  'PENDING_REVIEW',
  'ACTIVE',
  'RESERVED',
  'SOLD',
  'REJECTED',
  'REMOVED',
  'ARCHIVED',
] as const;
export const listingConditionValues = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'] as const;
export const currencyCodeValues = ['PKR', 'USD', 'GBP', 'EUR', 'AED', 'SAR', 'CAD'] as const;
export const listingSortValues = ['NEWEST', 'OLDEST', 'PRICE_LOW', 'PRICE_HIGH'] as const;
export const feedModeValues = ['NEW', 'TRENDING', 'RECOMMENDED'] as const;

export const listingStatusSchema = z.enum(listingStatusValues);
export const listingConditionSchema = z.enum(listingConditionValues);
export const currencyCodeSchema = z.enum(currencyCodeValues);
export const listingSortSchema = z.enum(listingSortValues);
export const feedModeSchema = z.enum(feedModeValues);

const nullableListingText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

export const listingDraftInputSchema = z.strictObject({
  brand: nullableListingText(80),
  categoryId: z.string().uuid(),
  color: nullableListingText(50),
  condition: listingConditionSchema,
  currency: currencyCodeSchema.default('PKR'),
  description: z.string().trim().min(20).max(2000),
  priceMinor: z.number().int().positive().max(2_000_000_000),
  size: z.string().trim().min(1).max(50),
  title: z.string().trim().min(5).max(120),
});

export const listingUpdateInputSchema = listingDraftInputSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one listing field is required.');

export const listingImageSchema = z.strictObject({
  height: z.number().int().positive(),
  id: z.string().uuid(),
  position: z.number().int().min(0).max(9),
  url: z.string().url(),
  width: z.number().int().positive(),
});

export const listingSellerSchema = z.strictObject({
  id: z.string().uuid(),
  profileImageUrl: z.string().url().nullable(),
  username: z.string().min(3).max(30),
});

const listingBaseShape = {
  brand: z.string().nullable(),
  category: categorySchema,
  color: z.string().nullable(),
  condition: listingConditionSchema,
  createdAt: z.string().datetime({ offset: true }),
  currency: currencyCodeSchema,
  description: z.string(),
  id: z.string().uuid(),
  images: z.array(listingImageSchema).max(10),
  likeCount: z.number().int().nonnegative(),
  likedByViewer: z.boolean(),
  priceMinor: z.number().int().positive(),
  rejectionReason: z.string().nullable(),
  saveCount: z.number().int().nonnegative(),
  savedByViewer: z.boolean(),
  seller: listingSellerSchema,
  size: z.string(),
  status: listingStatusSchema,
  title: z.string(),
  updatedAt: z.string().datetime({ offset: true }),
} as const;

export const listingSummarySchema = z.strictObject(listingBaseShape);
export const listingDetailSchema = listingSummarySchema.extend({
  activatedAt: z.string().datetime({ offset: true }).nullable(),
  archivedAt: z.string().datetime({ offset: true }).nullable(),
  moderatedAt: z.string().datetime({ offset: true }).nullable(),
  submittedAt: z.string().datetime({ offset: true }).nullable(),
});

export const listingPageSchema = z.strictObject({
  items: z.array(listingDetailSchema),
  nextCursor: z.string().max(2048).nullable(),
});

export const cursorPageQuerySchema = z.strictObject({
  cursor: z.string().trim().max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(30).default(20),
});

export const listingSearchQuerySchema = cursorPageQuerySchema
  .extend({
    categoryId: z.string().uuid().optional(),
    condition: listingConditionSchema.optional(),
    currency: currencyCodeSchema.optional(),
    maxPriceMinor: z.coerce.number().int().positive().max(2_000_000_000).optional(),
    minPriceMinor: z.coerce.number().int().positive().max(2_000_000_000).optional(),
    q: z.string().trim().max(120).optional(),
    size: z.string().trim().max(50).optional(),
    sort: listingSortSchema.default('NEWEST'),
  })
  .refine(
    ({ maxPriceMinor, minPriceMinor }) =>
      maxPriceMinor === undefined || minPriceMinor === undefined || minPriceMinor <= maxPriceMinor,
    { message: 'Minimum price must not exceed maximum price.', path: ['minPriceMinor'] },
  );

export const feedQuerySchema = cursorPageQuerySchema.extend({
  mode: feedModeSchema.default('NEW'),
});

export const sellerListingQuerySchema = cursorPageQuerySchema.extend({
  status: listingStatusSchema.optional(),
});

export const imageOrderInputSchema = z.strictObject({
  imageIds: z.array(z.string().uuid()).min(1).max(10),
});

export const listingModerationInputSchema = z.strictObject({
  reason: z.string().trim().min(5).max(1000).optional(),
});

export const sellerProfileSchema = z.strictObject({
  bio: z.string().nullable(),
  completedSalesCount: z.number().int().nonnegative(),
  followerCount: z.number().int().nonnegative(),
  followingCount: z.number().int().nonnegative(),
  followedByViewer: z.boolean(),
  id: z.string().uuid(),
  listingCount: z.number().int().nonnegative(),
  memberSince: z.string().datetime({ offset: true }),
  profileImageUrl: z.string().url().nullable(),
  university: z.string().nullable(),
  username: z.string().min(3).max(30),
});

export const sellerProfileWithListingsSchema = z.strictObject({
  listings: listingPageSchema,
  profile: sellerProfileSchema,
});

export type CurrencyCode = z.infer<typeof currencyCodeSchema>;
export type FeedMode = z.infer<typeof feedModeSchema>;
export type FeedQuery = z.infer<typeof feedQuerySchema>;
export type ListingCondition = z.infer<typeof listingConditionSchema>;
export type ListingDetail = z.infer<typeof listingDetailSchema>;
export type ListingDraftInput = z.infer<typeof listingDraftInputSchema>;
export type ListingImage = z.infer<typeof listingImageSchema>;
export type ListingPage = z.infer<typeof listingPageSchema>;
export type ListingSearchQuery = z.infer<typeof listingSearchQuerySchema>;
export type ListingStatus = z.infer<typeof listingStatusSchema>;
export type ListingSummary = z.infer<typeof listingSummarySchema>;
export type ListingUpdateInput = z.infer<typeof listingUpdateInputSchema>;
export type SellerListingQuery = z.infer<typeof sellerListingQuerySchema>;
export type SellerProfile = z.infer<typeof sellerProfileSchema>;
export type SellerProfileWithListings = z.infer<typeof sellerProfileWithListingsSchema>;
