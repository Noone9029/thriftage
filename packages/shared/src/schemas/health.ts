import { z } from 'zod';

import { API_SERVICE_NAME } from '../constants/application';

export const healthResponseSchema = z.object({
  service: z.literal(API_SERVICE_NAME),
  status: z.literal('ok'),
  timestamp: z.string().datetime({ offset: true }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
