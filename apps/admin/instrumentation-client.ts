import * as Sentry from '@sentry/nextjs';

import { createSentryOptions } from './sentry-options';

Sentry.init(
  createSentryOptions({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_DEPLOYMENT_ENV,
    release: process.env.NEXT_PUBLIC_RELEASE_VERSION,
    tracesSampleRate: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  }),
);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
