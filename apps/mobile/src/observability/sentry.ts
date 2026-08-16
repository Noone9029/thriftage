import * as Sentry from '@sentry/react-native';

import { mobileConfig } from '../config/mobile-config';

const sensitiveKeyPattern =
  /address|authorization|body|cookie|credential|email|evidence|message|otp|password|phone|prompt|secret|session|token/i;

function scrub(value: unknown, key = ''): unknown {
  if (sensitiveKeyPattern.test(key)) return '[Filtered]';
  if (Array.isArray(value)) return value.map((item) => scrub(item));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        scrub(entryValue, entryKey),
      ]),
    );
  }
  return value;
}

export function initializeMobileMonitoring(): void {
  if (mobileConfig.sentryDsn === undefined) return;
  Sentry.init({
    beforeBreadcrumb: (breadcrumb) => scrub(breadcrumb) as typeof breadcrumb,
    beforeSend: (event) => scrub(event) as typeof event,
    dsn: mobileConfig.sentryDsn,
    enabled: mobileConfig.deploymentEnvironment !== 'local',
    environment: mobileConfig.deploymentEnvironment,
    release: mobileConfig.releaseVersion,
    sendDefaultPii: false,
    tracesSampleRate: mobileConfig.sentryTracesSampleRate,
  });
}

export { Sentry };
