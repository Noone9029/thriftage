import { z } from 'zod';

import { API_SERVICE_NAME } from '../constants/application';

export const healthResponseSchema = z.object({
  environment: z.enum(['local', 'staging', 'production']),
  releaseVersion: z.string().min(1),
  service: z.literal(API_SERVICE_NAME),
  status: z.literal('ok'),
  timestamp: z.string().datetime({ offset: true }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const readinessResponseSchema = healthResponseSchema.extend({
  status: z.literal('ready'),
});

export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
