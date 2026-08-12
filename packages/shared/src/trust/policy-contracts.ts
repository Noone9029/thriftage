import { z } from 'zod';

export const policyTypeValues = ['TERMS_OF_USE', 'PRIVACY_POLICY', 'COMMUNITY_GUIDELINES'] as const;
export const policyVersionSchema = z.strictObject({
  id: z.string().uuid(),
  policyType: z.enum(policyTypeValues),
  version: z.string(),
  title: z.string(),
  url: z.string().url(),
  effectiveAt: z.string().datetime({ offset: true }),
  publishedAt: z.string().datetime({ offset: true }),
  requiredForUgc: z.boolean(),
});
export const currentPolicyItemSchema = policyVersionSchema.extend({ accepted: z.boolean() });
export const currentPolicyPageSchema = z.strictObject({
  items: z.array(currentPolicyItemSchema),
  acceptedForUgc: z.boolean(),
});
export const policyAcceptanceInputSchema = z.strictObject({
  policyVersionIds: z.array(z.string().uuid()).min(1).max(3),
});
export const policyPublishInputSchema = z.strictObject({
  policyType: z.enum(policyTypeValues),
  version: z.string().trim().min(1).max(40),
  title: z.string().trim().min(3).max(120),
  url: z.string().url(),
  effectiveAt: z.string().datetime({ offset: true }),
  requiredForUgc: z.boolean().default(true),
});
export type PolicyVersion = z.infer<typeof policyVersionSchema>;
export type CurrentPolicyPage = z.infer<typeof currentPolicyPageSchema>;
export type PolicyAcceptanceInput = z.infer<typeof policyAcceptanceInputSchema>;
export type PolicyPublishInput = z.infer<typeof policyPublishInputSchema>;
