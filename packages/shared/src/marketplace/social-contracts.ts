import { z } from 'zod';

export const socialActionResultSchema = z.strictObject({
  active: z.boolean(),
  count: z.number().int().nonnegative(),
});

export const sellerSocialCountsSchema = z.strictObject({
  followerCount: z.number().int().nonnegative(),
  followingCount: z.number().int().nonnegative(),
});

export type SellerSocialCounts = z.infer<typeof sellerSocialCountsSchema>;
export type SocialActionResult = z.infer<typeof socialActionResultSchema>;
