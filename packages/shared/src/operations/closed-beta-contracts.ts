import { z } from 'zod';

const countSchema = z.number().int().nonnegative();

export const closedBetaOperationsSchema = z.strictObject({
  ai: z.strictObject({
    estimatedCostMicroUsd: countSchema,
    failedGenerations: countSchema,
    generations: countSchema,
  }),
  externalSignals: z.strictObject({
    crashReporting: z.literal('SENTRY_DASHBOARD_REQUIRED'),
    smsCosts: z.literal('TWILIO_CONSOLE_REQUIRED'),
  }),
  generatedAt: z.string().datetime({ offset: true }),
  listings: z.strictObject({
    active: countSchema,
    created: countSchema,
    pendingReview: countSchema,
  }),
  messages: z.strictObject({ sent: countSchema }),
  orders: z.strictObject({
    cancelled: countSchema,
    completed: countSchema,
    created: countSchema,
    deliveredAwaitingFinalization: countSchema,
  }),
  runtime: z.strictObject({
    accountDeletion: z.boolean(),
    aiStylist: z.boolean(),
    environment: z.enum(['local', 'staging', 'production']),
    phoneAuth: z.boolean(),
    pushNotifications: z.boolean(),
    registration: z.boolean(),
    sellerVerification: z.boolean(),
    releaseVersion: z.string().min(1),
  }),
  safety: z.strictObject({
    openAiFeedback: countSchema,
    openDisputes: countSchema,
    openMessageFlags: countSchema,
    openReports: countSchema,
  }),
  users: z.strictObject({
    active: countSchema,
    registered: countSchema,
  }),
  windowHours: z.literal(24),
  workers: z.strictObject({
    accountDeletionFailed: countSchema,
    accountDeletionPending: countSchema,
    notificationFailed: countSchema,
    notificationOldestPendingAgeSeconds: countSchema.nullable(),
    notificationPending: countSchema,
  }),
});

export type ClosedBetaOperations = z.infer<typeof closedBetaOperationsSchema>;
