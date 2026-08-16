import type * as Sentry from '@sentry/nextjs';
import { redactSensitiveData } from '@thriftage/shared';

type SentryOptions = Parameters<typeof Sentry.init>[0];

function parseSampleRate(rawValue: string | undefined): number {
  if (!rawValue) return 0;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0;
}

export function createSentryOptions(input: {
  dsn: string | undefined;
  environment: string | undefined;
  release: string | undefined;
  tracesSampleRate: string | undefined;
}): SentryOptions {
  return {
    dsn: input.dsn || undefined,
    enabled: Boolean(input.dsn),
    environment: input.environment || 'local',
    release: input.release || 'dev',
    sendDefaultPii: false,
    tracesSampleRate: parseSampleRate(input.tracesSampleRate),
    beforeBreadcrumb(breadcrumb) {
      return redactSensitiveData(breadcrumb) as typeof breadcrumb;
    },
    beforeSend(event) {
      return redactSensitiveData(event) as typeof event;
    },
  };
}
