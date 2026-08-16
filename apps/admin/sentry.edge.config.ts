import * as Sentry from '@sentry/nextjs';

import { createSentryOptions } from './sentry-options';

Sentry.init(
  createSentryOptions({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.DEPLOYMENT_ENV,
    release: process.env.RELEASE_VERSION,
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE,
  }),
);
