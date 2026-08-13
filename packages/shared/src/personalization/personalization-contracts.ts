import { z } from 'zod';

export const styleQuizStatusValues = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] as const;
export const colorFamilyValues = [
  'BLACK',
  'WHITE',
  'GREY',
  'BROWN',
  'BEIGE',
  'RED',
  'ORANGE',
  'YELLOW',
  'GREEN',
  'BLUE',
  'PURPLE',
  'PINK',
  'METALLIC',
  'MULTICOLOR',
] as const;
export const colorPreferenceSentimentValues = ['PREFER', 'AVOID'] as const;
export const fitTypeValues = ['OVERSIZED', 'RELAXED', 'REGULAR', 'SLIM', 'TAILORED'] as const;
export const fashionPriorityValues = [
  'COMFORT',
  'PRICE',
  'AESTHETICS',
  'SUSTAINABILITY',
  'EXCLUSIVITY',
] as const;
export const lifestyleTypeValues = [
  'STUDENT',
  'PROFESSIONAL',
  'ENTREPRENEUR',
  'CREATIVE',
  'ATHLETE',
] as const;
export const styleExpressionValues = [
  'OUTGOING',
  'RESERVED',
  'CREATIVE',
  'AMBITIOUS',
  'EXPERIMENTAL',
  'CLASSIC',
] as const;
export const sizeSystemValues = [
  'ALPHA',
  'EU',
  'UK',
  'US',
  'WAIST_INCHES',
  'SHOE_EU',
  'SHOE_UK',
  'SHOE_US',
  'ONE_SIZE',
] as const;
export const garmentRoleValues = [
  'TOP',
  'BOTTOM',
  'DRESS',
  'OUTERWEAR',
  'SHOES',
  'BAG',
  'JEWELRY',
  'ACCESSORY',
  'OTHER',
] as const;

export const styleQuizStatusSchema = z.enum(styleQuizStatusValues);
export const colorFamilySchema = z.enum(colorFamilyValues);
export const colorPreferenceSentimentSchema = z.enum(colorPreferenceSentimentValues);
export const fitTypeSchema = z.enum(fitTypeValues);
export const fashionPrioritySchema = z.enum(fashionPriorityValues);
export const lifestyleTypeSchema = z.enum(lifestyleTypeValues);
export const styleExpressionSchema = z.enum(styleExpressionValues);
export const sizeSystemSchema = z.enum(sizeSystemValues);
export const garmentRoleSchema = z.enum(garmentRoleValues);

export const styleDefinitionSchema = z.strictObject({
  description: z.string().nullable(),
  displayName: z.string().min(1).max(80),
  id: z.string().uuid(),
  isActive: z.boolean(),
  slug: z.string().min(2).max(60),
  sortOrder: z.number().int(),
});

export const stylePreferenceInputSchema = z.strictObject({
  styleDefinitionId: z.string().uuid(),
  strength: z.number().int().min(1).max(5),
});
export const colorPreferenceInputSchema = z.strictObject({
  colorFamily: colorFamilySchema,
  sentiment: colorPreferenceSentimentSchema,
});
export const sizePreferenceInputSchema = z.strictObject({
  garmentRole: garmentRoleSchema,
  sizeKey: z.string().trim().min(1).max(40),
  sizeSystem: sizeSystemSchema,
});

const uniqueBy = <T>(values: readonly T[], key: (value: T) => string) => {
  const keys = values.map(key);
  return new Set(keys).size === keys.length;
};

export const styleProfileInputSchema = z
  .strictObject({
    budgetMaxMinor: z.number().int().positive().max(2_000_000_000).nullable().optional(),
    budgetMinMinor: z.number().int().nonnegative().max(2_000_000_000).nullable().optional(),
    colors: z.array(colorPreferenceInputSchema).max(15).default([]),
    currency: z.enum(['PKR', 'USD', 'GBP', 'EUR', 'AED', 'SAR', 'CAD']).default('PKR'),
    expressions: z.array(styleExpressionSchema).max(6).default([]),
    fits: z.array(fitTypeSchema).max(5).default([]),
    lifestyles: z.array(lifestyleTypeSchema).max(5).default([]),
    priorities: z.array(fashionPrioritySchema).max(5).default([]),
    quizStep: z.number().int().min(0).max(7),
    sizes: z.array(sizePreferenceInputSchema).max(20).default([]),
    styles: z.array(stylePreferenceInputSchema).max(10).default([]),
  })
  .superRefine((input, context) => {
    if (
      input.budgetMaxMinor != null &&
      input.budgetMinMinor != null &&
      input.budgetMinMinor > input.budgetMaxMinor
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Minimum budget must not exceed maximum budget.',
        path: ['budgetMinMinor'],
      });
    }
    if (!uniqueBy(input.styles, ({ styleDefinitionId }) => styleDefinitionId)) {
      context.addIssue({
        code: 'custom',
        message: 'Style selections must be unique.',
        path: ['styles'],
      });
    }
    if (!uniqueBy(input.colors, ({ colorFamily }) => colorFamily)) {
      context.addIssue({
        code: 'custom',
        message: 'Color selections must be unique.',
        path: ['colors'],
      });
    }
    if (!uniqueBy(input.sizes, ({ garmentRole, sizeSystem }) => `${garmentRole}:${sizeSystem}`)) {
      context.addIssue({
        code: 'custom',
        message: 'Size selections must be unique by garment role and system.',
        path: ['sizes'],
      });
    }
  });

export const styleProfileSchema = styleProfileInputSchema.safeExtend({
  behavioralResetAt: z.string().datetime({ offset: true }).nullable(),
  completedAt: z.string().datetime({ offset: true }).nullable(),
  id: z.string().uuid(),
  profileVersion: z.number().int().positive(),
  quizStatus: styleQuizStatusSchema,
  styles: z.array(stylePreferenceInputSchema.extend({ style: styleDefinitionSchema })),
  updatedAt: z.string().datetime({ offset: true }),
  result: z.strictObject({
    preferredFits: z.array(fitTypeSchema),
    primaryStyle: styleDefinitionSchema.nullable(),
    recommendedColors: z.array(colorFamilySchema),
    recommendedGarmentRoles: z.array(garmentRoleSchema),
    secondaryStyle: styleDefinitionSchema.nullable(),
  }),
});

export const styleQuizSaveSchema = styleProfileInputSchema;
export const styleQuizCompleteSchema = styleProfileInputSchema.refine(
  ({ styles, priorities }) => styles.length > 0 && priorities.length > 0,
  'At least one style and fashion priority are required.',
);

export const listingPersonalizationInputSchema = z.strictObject({
  colorFamily: colorFamilySchema,
  fitType: fitTypeSchema,
  garmentRole: garmentRoleSchema,
  sizeCompatibilityKey: z.string().trim().min(1).max(40),
  sizeSystem: sizeSystemSchema,
  styleDefinitionIds: z.array(z.string().uuid()).min(1).max(5),
});

export const matchContributionSchema = z.strictObject({
  code: z.enum(['STYLE', 'COLOR', 'FIT', 'SIZE', 'BUDGET', 'BEHAVIOR', 'SELLER']),
  label: z.string().min(1).max(120),
  points: z.number().min(0).max(100),
});
export const listingMatchSchema = z.strictObject({
  algorithmVersion: z.string().min(1).max(40),
  contributions: z.array(matchContributionSchema).max(5),
  profileVersion: z.number().int().positive(),
  reasons: z.array(z.string().min(1).max(120)).max(3),
  score: z.number().int().min(0).max(100),
});

export const recommendationFeedbackSchema = z.strictObject({
  hidden: z.boolean(),
  listingId: z.string().uuid(),
  updatedAt: z.string().datetime({ offset: true }),
});

export const recommendationEventInputSchema = z.strictObject({
  listingId: z.string().uuid(),
  source: z.enum(['FOR_YOU', 'SEARCH', 'SIMILAR', 'LISTING_DETAIL']),
  type: z.enum([
    'IMPRESSION',
    'VIEW',
    'LIKE',
    'SAVE',
    'FOLLOW_SELLER',
    'MESSAGE_SELLER',
    'CHECKOUT',
    'PURCHASE',
    'NOT_INTERESTED',
  ]),
});

export const privacyStatusSchema = z.strictObject({
  behavioralResetAt: z.string().datetime({ offset: true }).nullable(),
  hasLearnedSignals: z.boolean(),
  profileCompleted: z.boolean(),
});

export const recommendationConfigurationSchema = z.strictObject({
  behaviorWeight: z.number().int(),
  candidateLimit: z.number().int(),
  createdAt: z.coerce.date(),
  engagementWeight: z.number().int(),
  explorationPercent: z.number().int(),
  explorationWeight: z.number().int(),
  freshnessWeight: z.number().int(),
  id: z.string().uuid(),
  isActive: z.boolean(),
  maxPerSeller: z.number().int(),
  maxPerStyle: z.number().int(),
  personalWeight: z.number().int(),
  sellerWeight: z.number().int(),
  trustWeight: z.number().int(),
  updatedAt: z.coerce.date(),
  version: z.string(),
});

export const recommendationConfigurationInputSchema = z
  .strictObject({
    behaviorWeight: z.number().int().min(0).max(100),
    candidateLimit: z.number().int().min(20).max(500),
    engagementWeight: z.number().int().min(0).max(100),
    explorationPercent: z.number().int().min(0).max(30),
    explorationWeight: z.number().int().min(0).max(100),
    freshnessWeight: z.number().int().min(0).max(100),
    maxPerSeller: z.number().int().min(1).max(20),
    maxPerStyle: z.number().int().min(1).max(30),
    personalWeight: z.number().int().min(0).max(100),
    sellerWeight: z.number().int().min(0).max(100),
    trustWeight: z.number().int().min(0).max(100),
    version: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9._-]{1,39}$/),
  })
  .refine(
    (input) =>
      input.behaviorWeight +
        input.engagementWeight +
        input.explorationWeight +
        input.freshnessWeight +
        input.personalWeight +
        input.sellerWeight +
        input.trustWeight ===
      100,
    'Ranking weights must total 100.',
  );

export const personalizationAdminSummarySchema = z.strictObject({
  audits: z.array(
    z.strictObject({
      _count: z.strictObject({ _all: z.number().int().nonnegative() }),
      action: z.string(),
    }),
  ),
  completedProfiles: z.number().int().nonnegative(),
  events: z.array(
    z.strictObject({
      _count: z.strictObject({ _all: z.number().int().nonnegative() }),
      type: z.string(),
    }),
  ),
  hiddenRecommendations: z.number().int().nonnegative(),
  impressionMatchAverage: z.number().min(0).max(100).nullable(),
  impressionMatchCount: z.number().int().nonnegative(),
  profiles: z.number().int().nonnegative(),
  styleSelectionCounts: z.array(
    z.strictObject({
      _count: z.strictObject({ _all: z.number().int().nonnegative() }),
      styleDefinitionId: z.string().uuid(),
    }),
  ),
});

export type ColorFamily = z.infer<typeof colorFamilySchema>;
export type FitType = z.infer<typeof fitTypeSchema>;
export type GarmentRole = z.infer<typeof garmentRoleSchema>;
export type ListingMatch = z.infer<typeof listingMatchSchema>;
export type ListingPersonalizationInput = z.infer<typeof listingPersonalizationInputSchema>;
export type RecommendationEventInput = z.infer<typeof recommendationEventInputSchema>;
export type RecommendationConfiguration = z.infer<typeof recommendationConfigurationSchema>;
export type RecommendationConfigurationInput = z.infer<
  typeof recommendationConfigurationInputSchema
>;
export type PersonalizationAdminSummary = z.infer<typeof personalizationAdminSummarySchema>;
export type SizeSystem = z.infer<typeof sizeSystemSchema>;
export type StyleDefinition = z.infer<typeof styleDefinitionSchema>;
export type StyleProfile = z.infer<typeof styleProfileSchema>;
export type StyleProfileInput = z.infer<typeof styleProfileInputSchema>;
